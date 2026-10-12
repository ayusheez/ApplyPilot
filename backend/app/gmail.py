"""Read-only Gmail integration. No Gmail contents are sent to an AI provider."""
import base64
import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urlencode
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .auth import COOKIE, token_hash
from .models import GmailConnection, GmailOAuthState, GmailImportJob, Application, SourceEmail, now
from .schemas import EmailInput

SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
BASE = 'https://gmail.googleapis.com/gmail/v1/users/me/'

def cipher():
    try:
        return Fernet(os.environ['TOKEN_ENCRYPTION_KEY'].encode())
    except (KeyError, ValueError):
        raise HTTPException(503, 'Gmail encryption is not configured. Check TOKEN_ENCRYPTION_KEY.') from None

def seal(value):
    return cipher().encrypt(json.dumps(value).encode()).decode()

def unseal(value):
    try:
        return json.loads(cipher().decrypt(value.encode()))
    except (InvalidToken, ValueError):
        raise HTTPException(503, 'Stored Gmail data cannot be unlocked. Restore the original encryption key.') from None

def config():
    values = {k: os.environ.get(k,'').strip() for k in ('GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','FRONTEND_URL')}
    if not all(values.values()):
        raise HTTPException(503, 'Gmail OAuth is not configured.')
    cipher()
    return values

def call(method, url, **kwargs):
    try:
        return httpx.request(method, url, timeout=httpx.Timeout(10,connect=5), **kwargs)
    except httpx.RequestError:
        raise HTTPException(503, 'Google could not be reached. Try again later; no automatic retries were made.') from None

def json_response(response):
    if response.status_code == 429:
        raise HTTPException(429, 'Google request limit reached. Try later.')
    if response.status_code in (400,401,403):
        raise HTTPException(409, 'Google access expired or was denied. Check Gmail API access and reconnect Gmail.')
    if response.status_code != 200:
        raise HTTPException(503, 'Google could not complete this request. Try later.')
    try:
        value=response.json()
        if not isinstance(value,dict): raise ValueError()
        return value
    except ValueError:
        raise HTTPException(502, 'Google returned an unreadable response.') from None

def connection(db, user_id):
    conn=db.scalar(select(GmailConnection).where(GmailConnection.user_id==user_id).with_for_update())
    if conn is None: raise HTTPException(409,'Connect Gmail first.')
    return conn

def access(db, conn):
    tokens=unseal(conn.tokens)
    if conn.expires_at.replace(tzinfo=timezone.utc) <= now()+timedelta(seconds=60):
        cfg=config()
        result=json_response(call('POST','https://oauth2.googleapis.com/token',data={
            'client_id':cfg['GOOGLE_CLIENT_ID'],'client_secret':cfg['GOOGLE_CLIENT_SECRET'],
            'refresh_token':tokens['refresh_token'],'grant_type':'refresh_token'}))
        if not result.get('access_token'):
            raise HTTPException(409,'Reconnect Gmail to renew access.')
        tokens['access_token']=result['access_token']
        conn.tokens=seal(tokens)
        conn.expires_at=now()+timedelta(seconds=int(result.get('expires_in',3600)))
        db.flush()
    return tokens['access_token']

def gmail_get(token,path,params=None):
    return json_response(call('GET',BASE+path,headers={'Authorization':'Bearer '+token},params=params))

class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.text=[]; self.hidden=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'): self.hidden+=1
        if tag in ('br','p','div','li'): self.text.append('\n')
    def handle_endtag(self,tag):
        if tag in ('script','style'): self.hidden=max(0,self.hidden-1)
    def handle_data(self,data):
        if not self.hidden: self.text.append(data)

def message_email(message):
    payload=message.get('payload',{})
    headers={h['name'].lower():h.get('value','') for h in payload.get('headers',[])}
    plain=[]; html=[]
    def walk(part,depth=0):
        if depth>20 or part.get('filename'): return
        data=part.get('body',{}).get('data')
        if data and part.get('mimeType') in ('text/plain','text/html'):
            if len(data)>200000: raise HTTPException(422,'Email is too long. Choose a shorter email.')
            try: decoded=base64.urlsafe_b64decode(data+'='*(-len(data)%4)).decode('utf-8',errors='replace')
            except ValueError: raise HTTPException(422,'Email encoding could not be read.') from None
            (plain if part['mimeType']=='text/plain' else html).append(decoded)
        for child in part.get('parts',[]): walk(child,depth+1)
    walk(payload)
    body='\n'.join(plain).strip()
    if not body and html:
        parser=PlainHTML(); parser.feed('\n'.join(html)); body=''.join(parser.text).strip()
    if not body: raise HTTPException(422,'No readable text body was found. Attachments are not imported.')
    if len(body)>20000: raise HTTPException(422,'Email exceeds 20,000 characters. It was not truncated or saved.')
    try: received=datetime.fromtimestamp(int(message['internalDate'])/1000,timezone.utc).date()
    except (KeyError,ValueError,OverflowError): received=None
    return EmailInput(subject=(headers.get('subject') or '(No subject)')[:300],sender=headers.get('from','')[:320] or None,received_at=received,body=body)

def job_payload(job):
    if job.status=='fetching' and job.updated_at.replace(tzinfo=timezone.utc)<now()-timedelta(minutes=2):
        job.status='failed'
    return {'id':job.id,'status':job.status,'applicationId':job.application_id}

def install_gmail(app, session, current_user, fingerprint):
    @app.get('/api/gmail/status')
    def status(db=Depends(session),user=Depends(current_user)):
        conn=db.get(GmailConnection,user.id)
        return {'connected':bool(conn),'mailbox':conn.mailbox if conn else None}

    @app.post('/api/gmail/connect')
    def connect(request:Request,db=Depends(session),user=Depends(current_user)):
        cfg=config(); state=secrets.token_urlsafe(32); verifier=secrets.token_urlsafe(48)
        db.execute(delete(GmailOAuthState).where((GmailOAuthState.user_id==user.id)|(GmailOAuthState.expires_at<now())))
        db.add(GmailOAuthState(state_hash=token_hash(state),user_id=user.id,session_hash=token_hash(request.cookies[COOKIE]),verifier=seal(verifier),expires_at=now()+timedelta(minutes=10)))
        db.commit()
        challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        return {'url':'https://accounts.google.com/o/oauth2/v2/auth?'+urlencode({
            'client_id':cfg['GOOGLE_CLIENT_ID'],'redirect_uri':cfg['GOOGLE_REDIRECT_URI'],
            'response_type':'code','scope':SCOPE,'state':state,'access_type':'offline',
            'prompt':'consent select_account','code_challenge':challenge,'code_challenge_method':'S256'})}

    @app.get('/api/gmail/callback')
    def callback(request:Request,state:str='',code:str='',error:str='',db=Depends(session),user=Depends(current_user)):
        cfg=config()
        record=db.scalar(select(GmailOAuthState).where(GmailOAuthState.state_hash==token_hash(state)).with_for_update())
        if not record or record.user_id!=user.id or record.session_hash!=token_hash(request.cookies.get(COOKIE,'')) or record.expires_at.replace(tzinfo=timezone.utc)<now():
            raise HTTPException(400,'Gmail connection request expired or did not match this session. Start Connect Gmail again.')
        verifier=unseal(record.verifier)
        db.delete(record); db.commit()  # Consume once, before exchanging the code.
        def back(result):
            return RedirectResponse(cfg['FRONTEND_URL'].rstrip('/')+'/import?gmail='+result,status_code=303,headers={'Referrer-Policy':'no-referrer','Cache-Control':'no-store'})
        if error or not code: return back('cancelled')
        try:
            tokens=json_response(call('POST','https://oauth2.googleapis.com/token',data={
                'code':code,'client_id':cfg['GOOGLE_CLIENT_ID'],'client_secret':cfg['GOOGLE_CLIENT_SECRET'],
                'redirect_uri':cfg['GOOGLE_REDIRECT_URI'],'grant_type':'authorization_code','code_verifier':verifier}))
            if SCOPE not in tokens.get('scope','').split() or not tokens.get('refresh_token') or not tokens.get('access_token'):
                return back('permission-required')
            profile=gmail_get(tokens['access_token'],'profile')
            mailbox=profile.get('emailAddress')
            if not isinstance(mailbox,str) or len(mailbox)>320: return back('failed')
            conn=db.get(GmailConnection,user.id)
            if not conn: conn=GmailConnection(user_id=user.id); db.add(conn)
            conn.mailbox=mailbox.lower()
            conn.tokens=seal({'access_token':tokens['access_token'],'refresh_token':tokens['refresh_token']})
            conn.expires_at=now()+timedelta(seconds=int(tokens.get('expires_in',3600)))
            db.commit()
            return back('connected')
        except (HTTPException,ValueError,KeyError):
            db.rollback(); return back('failed')

    @app.delete('/api/gmail/connection')
    def disconnect(db=Depends(session),user=Depends(current_user)):
        conn=db.get(GmailConnection,user.id); revoked=True
        if conn:
            try:
                token=unseal(conn.tokens)['refresh_token']
                response=call('POST','https://oauth2.googleapis.com/revoke',data={'token':token})
                revoked=response.status_code == 200
            except (HTTPException,KeyError): revoked=False
            db.delete(conn)
        db.execute(delete(GmailOAuthState).where(GmailOAuthState.user_id==user.id))
        db.execute(delete(GmailImportJob).where(GmailImportJob.user_id==user.id,GmailImportJob.status!='saved'))
        db.commit()
        return {'disconnected':True,'revoked':revoked}

    @app.get('/api/gmail/messages')
    def messages(q:str=Query(default='newer_than:30d {application interview assessment offer recruitment}',max_length=300),page:str=Query(default='',max_length=2000),db=Depends(session),user=Depends(current_user)):
        conn=connection(db,user.id); token=access(db,conn)
        params={'q':q,'maxResults':5}
        if page: params['pageToken']=page
        listing=gmail_get(token,'messages',params)
        result=[]
        for item in listing.get('messages',[])[:5]:
            mid=item.get('id','')
            if not re.fullmatch('[A-Za-z0-9_-]{1,128}',mid): continue
            meta=gmail_get(token,'messages/'+mid,{'format':'metadata','metadataHeaders':['Subject','From','Date']})
            headers={h['name'].lower():h.get('value','') for h in meta.get('payload',{}).get('headers',[])}
            result.append({'id':mid,'subject':headers.get('subject','(No subject)'),'sender':headers.get('from',''),'date':headers.get('date','')})
        db.commit()
        return {'messages':result,'nextPage':listing.get('nextPageToken')}

    def owned_job(db,id,user):
        job=db.scalar(select(GmailImportJob).where(GmailImportJob.id==id,GmailImportJob.user_id==user.id).with_for_update())
        if not job: raise HTTPException(404,'Import not found.')
        return job

    def review(db,job,user):
        state=job_payload(job)
        if job.status=='saved' and job.application_id:
            a=db.scalar(select(Application).where(Application.id==job.application_id,Application.owner_id==user.id))
            if a: return {'kind':'duplicate','applicationId':a.id,'company':a.company,'role':a.role}
        if job.status!='ready' or not job.email_data: raise HTTPException(409,'Import is not ready. Select the email again to retry an interrupted import.')
        email=EmailInput.model_validate(unseal(job.email_data))
        a=db.scalar(select(Application).join(SourceEmail).where(Application.owner_id==user.id,SourceEmail.fingerprint==fingerprint(email,user.id)))
        if a: return {'kind':'duplicate','applicationId':a.id,'company':a.company,'role':a.role}
        return {'kind':'review','jobId':job.id,'email':email.model_dump(mode='json',by_alias=True)}

    @app.get('/api/gmail/imports')
    def imports(db=Depends(session),user=Depends(current_user)):
        jobs=db.scalars(select(GmailImportJob).where(GmailImportJob.user_id==user.id,GmailImportJob.status!='saved').order_by(GmailImportJob.updated_at.desc()).limit(20)).all()
        result=[job_payload(j) for j in jobs]; db.commit(); return result

    @app.get('/api/gmail/imports/{id}')
    def resume(id:str,db=Depends(session),user=Depends(current_user)):
        return review(db,owned_job(db,id,user),user)

    @app.delete('/api/gmail/imports/{id}',status_code=204)
    def discard(id:str,db=Depends(session),user=Depends(current_user)):
        job=owned_job(db,id,user)
        if job.status=='saved': raise HTTPException(409,'Delete the application to remove saved source emails.')
        db.delete(job); db.commit()

    @app.post('/api/gmail/messages/{id}/prepare')
    def prepare(id:str,db=Depends(session),user=Depends(current_user)):
        if not re.fullmatch('[A-Za-z0-9_-]{1,128}',id): raise HTTPException(422,'Invalid Gmail message ID.')
        conn=connection(db,user.id)
        job=db.scalar(select(GmailImportJob).where(GmailImportJob.user_id==user.id,GmailImportJob.mailbox==conn.mailbox,GmailImportJob.message_id==id).with_for_update())
        if job:
            job_payload(job)
            if job.status=='saved' and not job.application_id: job.status='failed'
            if job.status in ('ready','saved'): return review(db,job,user)
            if job.status=='fetching': raise HTTPException(409,'This email is already being fetched. Wait briefly, then resume it.')
        else:
            job=GmailImportJob(user_id=user.id,mailbox=conn.mailbox,message_id=id)
            db.add(job)
        job.status='fetching'; job.updated_at=now()
        try: db.commit()
        except IntegrityError:
            db.rollback(); raise HTTPException(409,'This email is already being imported. Refresh pending imports.') from None
        try:
            conn=connection(db,user.id)
            if conn.mailbox!=job.mailbox: raise HTTPException(409,'Gmail account changed. Select the email again.')
            token=access(db,conn)
            message=gmail_get(token,'messages/'+id,{'format':'full'})
            email=message_email(message)
            # A concurrent disconnect must not recreate removed pending data.
            current=db.get(GmailImportJob,job.id,populate_existing=True)
            if current is None: raise HTTPException(409,'Import was cancelled.')
            job.email_data=seal(email.model_dump(mode='json',by_alias=True)); job.status='ready'; job.updated_at=now()
            db.commit()
            return review(db,job,user)
        except HTTPException:
            db.rollback()
            current=db.get(GmailImportJob,job.id)
            if current:
                current.status='failed'; current.updated_at=now(); db.commit()
            raise
