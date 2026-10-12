from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_api import client, payload, imported
from app.models import User, LoginSession, Application, now
from app.auth import COOKIE, token_hash
from app.claim_legacy import transfer

def other(client):
    c=TestClient(client.app,headers={'Origin':'http://localhost:5174'})
    assert c.post('/api/auth/register',json={'email':'other@example.com','password':'Another password 123!'}).status_code==201
    return c

def test_auth_required(client):
    with TestClient(client.app) as anonymous:
        assert anonymous.get('/api/applications').status_code==401
        assert anonymous.post('/api/applications',json=payload(),headers={'Origin':'http://localhost:5174'}).status_code==401

def test_account_isolation(client):
    record=client.post('/api/applications',json=payload()).json()
    with other(client) as second:
        assert second.get('/api/applications').json()==[]
        path='/api/applications/'+record['id']
        assert second.get(path).status_code==404
        assert second.patch(path,json={'notes':'tamper'}).status_code==404
        assert second.delete(path).status_code==404
        assert second.post('/api/imports',json=imported(targetApplicationId=record['id'])).status_code==404
    assert client.get('/api/applications/'+record['id']).json()['notes']==''

def test_duplicate_scope_per_account(client):
    assert client.post('/api/imports',json=imported()).status_code==201
    with other(client) as second:
        assert second.post('/api/imports',json=imported()).status_code==201
        assert second.post('/api/imports',json=imported()).status_code==409

def test_logout_revokes_session_and_login(client):
    token=client.cookies.get(COOKIE)
    assert client.post('/api/auth/logout').status_code==204
    assert client.get('/api/auth/me').status_code==401
    with TestClient(client.app,cookies={COOKIE:token}) as replay:
        assert replay.get('/api/auth/me').status_code==401
    assert client.post('/api/auth/login',json={'email':' OWNER@EXAMPLE.COM ','password':'Test password 123!'}).status_code==200
    assert client.get('/api/auth/me').json()['email']=='owner@example.com'

def test_wrong_password_and_storage(client):
    r=client.post('/api/auth/login',json={'email':'owner@example.com','password':'Wrong password 123!'})
    assert r.status_code==401
    with client.app.state.sessions() as db:
        user=db.scalar(select(User))
        assert user.password_hash.startswith('scrypt$')
        assert 'Test password' not in user.password_hash
        assert db.get(LoginSession,client.cookies.get(COOKIE)) is None

def test_cookie_flags_and_expiry(client):
    r=client.post('/api/auth/login',json={'email':'owner@example.com','password':'Test password 123!'})
    cookie=r.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=lax' in cookie
    with client.app.state.sessions() as db:
        session=db.get(LoginSession,token_hash(client.cookies.get(COOKIE)))
        session.expires_at=now()-timedelta(seconds=1);db.commit()
    assert client.get('/api/auth/me').status_code==401

def test_csrf_and_short_password(client):
    assert client.post('/api/applications',json=payload(),headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/auth/login',json={'email':'owner@example.com','password':'Test password 123!'},headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/auth/register',json={'email':'short@example.com','password':'short'}).status_code==422

def test_rate_limit(client):
    for _ in range(9):
        assert client.post('/api/auth/login',json={'email':'owner@example.com','password':'Wrong password 123!'}).status_code==401
    assert client.post('/api/auth/login',json={'email':'owner@example.com','password':'Wrong password 123!'}).status_code==429

def test_legacy_not_claimed_by_registration(client):
    with client.app.state.sessions() as db:
        app=Application(company='Legacy Company',role='Engineer',status='Applied',applied_on=now().date(),notes='keep')
        db.add(app);db.commit();id=app.id
    assert client.get('/api/applications/'+id).status_code==404
    with other(client) as second:
        assert second.get('/api/applications/'+id).status_code==404
    with client.app.state.sessions() as db:
        assert transfer(db,'owner@example.com')==1
    assert client.get('/api/applications/'+id).json()['notes']=='keep'

def test_session_rotation_and_cache(client):
    previous=client.cookies.get(COOKIE)
    assert client.post('/api/auth/login',json={'email':'owner@example.com','password':'Test password 123!'}).status_code==200
    assert client.cookies.get(COOKIE)!=previous
    with TestClient(client.app,cookies={COOKIE:previous}) as replay:
        assert replay.get('/api/applications').status_code==401
    assert client.get('/api/applications').headers['cache-control']=='no-store'

def test_migration_preserves_legacy(tmp_path,monkeypatch):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine,text
    url=f'sqlite:///{tmp_path / "legacy.db"}'
    monkeypatch.setenv('DATABASE_URL',url)
    cfg=Config('alembic.ini')
    command.upgrade(cfg,'0001')
    engine=create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO applications (id,company,role,status,applied_on,notes,last_updated) VALUES ('legacy','Aether Shield','Intern','Applied','2026-10-12','Preserve me','2026-10-12')"))
    command.upgrade(cfg,'head')
    with engine.connect() as connection:
        record=connection.execute(text("SELECT company,notes,owner_id FROM applications WHERE id='legacy'")).one()
        assert tuple(record)==('Aether Shield','Preserve me',None)
    engine.dispose()
