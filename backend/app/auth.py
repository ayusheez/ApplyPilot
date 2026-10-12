import hashlib
import hmac
import os
import re
import secrets
import threading
import time
from collections import deque
from datetime import timedelta, timezone
from fastapi import Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .models import User, LoginSession, now

COOKIE = 'applypilot_session'

def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(),salt=salt,n=32768,r=8,p=3,maxmem=64*1024*1024)
    return f'scrypt${salt.hex()}${digest.hex()}'

def verify_password(password, stored):
    try:
        _, salt, digest = stored.split('$')
        actual = hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=32768,r=8,p=3,maxmem=64*1024*1024)
        return hmac.compare_digest(actual, bytes.fromhex(digest))
    except (ValueError, TypeError):
        return False

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3,max_length=254)
    password: str = Field(min_length=12,max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls,v):
        v=v.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',v):
            raise ValueError('Enter a valid email address')
        return v

def install_auth(app, session, origins):
    allowed = {x.strip() for x in origins} | {'http://localhost:18083', 'http://127.0.0.1:18083'}
    secure = os.environ.get('COOKIE_SECURE','false').lower() == 'true'
    attempts = {}
    lock = threading.Lock()
    dummy = hash_password(secrets.token_urlsafe(32))

    def origin_guard(request: Request):
        if request.headers.get('origin') not in allowed:
            raise HTTPException(403,'Request origin is not allowed.')

    def throttle(request, email):
        instant = time.monotonic()
        keys = [(f'ip:{request.client.host}',30),(f'email:{email}',10)]
        with lock:
            for key in list(attempts):
                while attempts[key] and attempts[key][0] < instant-900:
                    attempts[key].popleft()
                if not attempts[key]: del attempts[key]
            if len(attempts)>10000:
                raise HTTPException(429,'Too many attempts. Try again later.')
            if any(len(attempts.get(k,()))>=limit for k,limit in keys):
                raise HTTPException(429,'Too many attempts. Try again in 15 minutes.')
            for key,_ in keys: attempts.setdefault(key,deque()).append(instant)

    def current_user(request: Request, db=Depends(session)):
        if request.method not in ('GET','HEAD','OPTIONS'):
            origin_guard(request)
        token = request.cookies.get(COOKIE)
        record = db.get(LoginSession,token_hash(token)) if token else None
        if not record or record.expires_at.replace(tzinfo=timezone.utc) <= now():
            raise HTTPException(401,'Please sign in to continue.')
        user = db.get(User,record.user_id)
        if not user: raise HTTPException(401,'Please sign in to continue.')
        return user

    def begin_session(user,request,response,db):
        previous=request.cookies.get(COOKIE)
        if previous: db.execute(delete(LoginSession).where(LoginSession.token_hash==token_hash(previous)))
        db.execute(delete(LoginSession).where(LoginSession.expires_at < now()))
        token=secrets.token_urlsafe(32)
        db.add(LoginSession(token_hash=token_hash(token),user_id=user.id,expires_at=now()+timedelta(days=7)))
        db.commit()
        response.set_cookie(COOKIE,token,max_age=7*86400,httponly=True,secure=secure,samesite='lax',path='/')
        response.headers['Cache-Control']='no-store'
        return {'id':user.id,'email':user.email}

    @app.post('/api/auth/register',status_code=201)
    def register(data: Credentials, request: Request, response: Response, db=Depends(session)):
        origin_guard(request); throttle(request,data.email)
        user=User(email=data.email,password_hash=hash_password(data.password))
        db.add(user)
        try: db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409,'Unable to create this account. Try signing in.')
        return begin_session(user,request,response,db)

    @app.post('/api/auth/login')
    def login(data: Credentials, request: Request, response: Response, db=Depends(session)):
        origin_guard(request); throttle(request,data.email)
        user=db.scalar(select(User).where(User.email==data.email))
        valid=verify_password(data.password,user.password_hash if user else dummy)
        if not user or not valid: raise HTTPException(401,'Incorrect email or password.')
        return begin_session(user,request,response,db)

    @app.get('/api/auth/me')
    def me(response: Response,user=Depends(current_user)):
        response.headers['Cache-Control']='no-store'
        return {'id':user.id,'email':user.email}

    @app.post('/api/auth/logout',status_code=204)
    def logout(request: Request,response: Response,db=Depends(session)):
        origin_guard(request)
        token=request.cookies.get(COOKIE)
        if token: db.execute(delete(LoginSession).where(LoginSession.token_hash==token_hash(token)))
        db.commit()
        response.delete_cookie(COOKIE,path='/',secure=secure,httponly=True,samesite='lax')

    return current_user
