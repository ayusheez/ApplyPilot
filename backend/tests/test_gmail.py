import base64
from datetime import timedelta
from urllib.parse import urlparse, parse_qs
import pytest
import httpx
from cryptography.fernet import Fernet
from sqlalchemy import select
from test_api import client, imported
from test_auth import other
from app import gmail
from app.models import GmailConnection, GmailOAuthState, GmailImportJob, now

@pytest.fixture
def configured(client,monkeypatch):
    for k,v in {'GOOGLE_CLIENT_ID':'test-client','GOOGLE_CLIENT_SECRET':'test-secret','GOOGLE_REDIRECT_URI':'http://127.0.0.1:18083/api/gmail/callback','FRONTEND_URL':'http://localhost:5174','TOKEN_ENCRYPTION_KEY':Fernet.generate_key().decode()}.items():monkeypatch.setenv(k,v)
    return client

def fake_google(monkeypatch):
    calls=[]
    def request(method,url,**kwargs):
        calls.append((method,url,kwargs))
        if url.endswith('/token'): return httpx.Response(200,json={'access_token':'fake-access','refresh_token':'fake-refresh','scope':gmail.SCOPE,'expires_in':3600})
        if url.endswith('/revoke'): return httpx.Response(200,json={})
        if url.endswith('/profile'): return httpx.Response(200,json={'emailAddress':'mailbox@example.com'})
        if url.endswith('/messages'): return httpx.Response(200,json={'messages':[{'id':'abc123'}],'nextPageToken':'page-two'})
        return httpx.Response(200,json={'id':'abc123','internalDate':'1791763200000','payload':{'mimeType':'text/plain','headers':[{'name':'Subject','value':'Application received'},{'name':'From','value':'recruiter@example.com'}],'body':{'data':base64.urlsafe_b64encode(b'Example Labs received your application for Backend Engineer.').decode()}}})
    monkeypatch.setattr(gmail.httpx,'request',request)
    return calls

def connect(client):
    r=client.post('/api/gmail/connect'); assert r.status_code==200
    args=parse_qs(urlparse(r.json()['url']).query)
    r=client.get('/api/gmail/callback',params={'state':args['state'][0],'code':'fictional-code'},follow_redirects=False)
    assert r.status_code==303
    assert r.headers['location'].endswith('gmail=connected')
    return args

def test_oauth_single_use_encrypted_and_scoped(configured,monkeypatch):
    calls=fake_google(monkeypatch);args=connect(configured)
    assert args['scope']==[gmail.SCOPE]
    assert args['code_challenge_method']==['S256']
    assert configured.get('/api/gmail/status').json()['connected']
    with configured.app.state.sessions() as db:
        c=db.scalar(select(GmailConnection));assert 'fake-refresh' not in c.tokens
        assert gmail.unseal(c.tokens)['refresh_token']=='fake-refresh'
    assert configured.get('/api/gmail/callback',params={'state':args['state'][0],'code':'again'}).status_code==400
    assert len([c for c in calls if c[1].endswith('/token')])==1

def test_oauth_other_account_and_expiry(configured,monkeypatch):
    calls=fake_google(monkeypatch)
    state=parse_qs(urlparse(configured.post('/api/gmail/connect').json()['url']).query)['state'][0]
    with other(configured) as second:
        assert second.get('/api/gmail/callback',params={'state':state,'code':'bad'}).status_code==400
    with configured.app.state.sessions() as db:
        record=db.scalar(select(GmailOAuthState));record.expires_at=now()-timedelta(minutes=1);db.commit()
    assert configured.get('/api/gmail/callback',params={'state':state,'code':'bad'}).status_code==400
    assert calls==[]

def test_selected_email_resume_save_dedupe_and_isolation(configured,monkeypatch):
    fake_google(monkeypatch);connect(configured)
    listing=configured.get('/api/gmail/messages');assert listing.status_code==200
    assert listing.json()['nextPage']=='page-two'
    selected=configured.post('/api/gmail/messages/abc123/prepare');assert selected.status_code==200
    data=selected.json();assert data['kind']=='review'
    with configured.app.state.sessions() as db:
        job=db.get(GmailImportJob,data['jobId']);assert 'Example Labs' not in job.email_data
    assert configured.get('/api/gmail/imports/'+data['jobId']).json()['email']==data['email']
    with other(configured) as second:
        assert second.get('/api/gmail/status').json()['connected'] is False
        assert second.get('/api/gmail/imports/'+data['jobId']).status_code==404
        assert second.post('/api/imports',json=imported(gmailJobId=data['jobId'])).status_code==404
    saved=configured.post('/api/imports',json=imported(gmailJobId=data['jobId']))
    assert saved.status_code==201
    assert saved.json()['sourceEmails'][0]['body']==data['email']['body']
    assert configured.post('/api/gmail/messages/abc123/prepare').json()['kind']=='duplicate'
    with configured.app.state.sessions() as db:
        job=db.get(GmailImportJob,data['jobId']);assert job.status=='saved' and job.email_data is None

def test_refresh_and_disconnect_cleanup(configured,monkeypatch):
    calls=fake_google(monkeypatch);connect(configured)
    configured.post('/api/gmail/messages/abc123/prepare')
    with configured.app.state.sessions() as db:
        c=db.scalar(select(GmailConnection));c.expires_at=now()-timedelta(seconds=1);db.commit()
    assert configured.get('/api/gmail/messages').status_code==200
    assert any(c[2].get('data',{}).get('grant_type')=='refresh_token' for c in calls)
    assert configured.delete('/api/gmail/connection').json()['revoked']
    assert configured.get('/api/gmail/status').json()['connected'] is False
    assert configured.get('/api/gmail/imports').json()==[]

def test_revoke_failure_still_disconnects(configured,monkeypatch):
    fake_google(monkeypatch);connect(configured)
    monkeypatch.setattr(gmail.httpx,'request',lambda *a,**kw:httpx.Response(503))
    assert configured.delete('/api/gmail/connection').json()=={'disconnected':True,'revoked':False}

def test_failed_fetch_persisted(configured,monkeypatch):
    fake_google(monkeypatch);connect(configured)
    monkeypatch.setattr(gmail.httpx,'request',lambda *a,**kw:httpx.Response(429))
    assert configured.post('/api/gmail/messages/abc123/prepare').status_code==429
    assert configured.get('/api/gmail/imports').json()[0]['status']=='failed'

def test_html_stripped_and_attachments_ignored():
    data=base64.urlsafe_b64encode(b'<p>Interview invitation</p><script>bad()</script>').decode()
    email=gmail.message_email({'payload':{'mimeType':'text/html','body':{'data':data}}})
    assert 'Interview invitation' in email.body and 'bad()' not in email.body

def test_gmail_never_calls_ai(configured,monkeypatch):
    from app import analysis
    def forbidden(*a,**kw):raise AssertionError('Gmail sent to AI')
    monkeypatch.setattr(analysis,'extract',forbidden)
    fake_google(monkeypatch);connect(configured)
    assert configured.post('/api/gmail/messages/abc123/prepare').status_code==200
