import json
import httpx
import pytest
from test_api import client, payload, imported
from app import analysis
from app.schemas import EmailInput
from fastapi import HTTPException

EMAIL = {'subject':'Application received', 'body':'Example Labs received your application for Backend Engineer.', 'receivedAt':'2026-10-12'}

def extracted():
    return {k: {'value':v, 'excerpt':q} for k,v,q in [
        ('company','Example Labs','Example Labs'), ('role','Backend Engineer','Backend Engineer'),
        ('status','Applied','received your application'), ('interviewDate',None,None),
        ('followUpDate',None,None), ('nextAction',None,None)]}

def provider(monkeypatch, data=None, status=200, finish='STOP'):
    monkeypatch.setenv('GEMINI_API_KEY','test-key-not-real')
    calls=[]
    def post(url, **kwargs):
        calls.append((url,kwargs))
        return httpx.Response(status, json={'candidates':[{'finishReason':finish,'content':{'parts':[{'text':json.dumps(data if data is not None else extracted())}]}}]})
    monkeypatch.setattr(analysis.httpx,'post',post)
    return calls

def test_analysis_review_only_and_private_payload(client, monkeypatch):
    calls=provider(monkeypatch)
    r=client.post('/api/analysis',json=EMAIL)
    assert r.status_code==200
    assert r.json()['extraction']['company']['value']=='Example Labs'
    assert r.json()['extraction']['interviewDate']=={'value':None,'excerpt':None}
    assert client.get('/api/applications').json()==[]
    assert len(calls)==1
    url, args=calls[0]
    assert 'test-key' not in url
    assert args['headers']['x-goog-api-key']=='test-key-not-real'
    sent=json.loads(args['json']['contents'][0]['parts'][0]['text'])
    assert set(sent)=={'subject','sender','receivedAt','body'}

def test_duplicate_skips_provider(client, monkeypatch):
    calls=provider(monkeypatch)
    saved=client.post('/api/imports',json=imported(email=EMAIL)).json()
    r=client.post('/api/analysis',json=EMAIL)
    assert r.json()['kind']=='duplicate'
    assert r.json()['applicationId']==saved['id']
    assert calls==[]

def test_matching_requires_company_and_role_and_unambiguous(client, monkeypatch):
    provider(monkeypatch)
    a=client.post('/api/applications',json=payload()).json()
    assert client.post('/api/analysis',json=EMAIL).json()['extraction']['matchedApplicationId']==a['id']
    client.post('/api/applications',json=payload())
    assert client.post('/api/analysis',json=EMAIL).json()['extraction']['matchedApplicationId'] is None

def test_analysis_auth_and_tenant_scope(client, monkeypatch):
    calls=provider(monkeypatch)
    client.post('/api/imports',json=imported(email=EMAIL))
    client.post('/api/auth/logout')
    assert client.post('/api/analysis',json=EMAIL).status_code==401
    assert not calls
    client.post('/api/auth/register',json={'email':'second@example.com','password':'Another password 123!'})
    r=client.post('/api/analysis',json=EMAIL)
    assert r.json()['kind']=='result'
    assert r.json()['extraction']['matchedApplicationId'] is None

def test_missing_key(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==503

@pytest.mark.parametrize('code,expected',[(400,503),(401,503),(403,503),(404,503),(429,429),(500,503)])
def test_provider_errors_sanitized(monkeypatch,code,expected):
    provider(monkeypatch,status=code)
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==expected
    assert 'test-key' not in e.value.detail

@pytest.mark.parametrize('finish',['SAFETY','MAX_TOKENS'])
def test_incomplete_response(monkeypatch,finish):
    provider(monkeypatch,finish=finish)
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==502

@pytest.mark.parametrize('invalid',[{'value':'Hired','excerpt':'received your application'}, {'value':5,'excerpt':None}])
def test_invalid_schema(monkeypatch,invalid):
    data=extracted();data['status']=invalid
    provider(monkeypatch,data)
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==502

def test_fabricated_evidence_removed(monkeypatch):
    data=extracted();data['company']={'value':'Invented Ltd','excerpt':'Invented Ltd'}
    provider(monkeypatch,data)
    result,warnings=analysis.extract(EmailInput(**EMAIL))
    assert result['company']=={'value':None,'excerpt':None}
    assert warnings

def test_timeout(monkeypatch):
    provider(monkeypatch)
    def timeout(*args,**kwargs): raise httpx.ReadTimeout('private details')
    monkeypatch.setattr(analysis.httpx,'post',timeout)
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==504
    assert 'private details' not in e.value.detail

def test_malformed_provider_envelope(monkeypatch):
    provider(monkeypatch)
    monkeypatch.setattr(analysis.httpx,'post',lambda *a,**kw: httpx.Response(200,json=['unexpected']))
    with pytest.raises(HTTPException) as e: analysis.extract(EmailInput(**EMAIL))
    assert e.value.status_code==502
