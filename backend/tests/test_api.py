import os
from concurrent.futures import ThreadPoolExecutor
import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import select, func, text
from sqlalchemy.engine import make_url
from app.main import create_app
from app.models import Application, TimelineEvent, SourceEmail

@pytest.fixture
def client(tmp_path, monkeypatch):
    url = os.environ.get('TEST_DATABASE_URL', f'sqlite:///{tmp_path / "test.db"}')
    if not url.startswith('sqlite:') and make_url(url).database != 'applypilot_test':
        raise RuntimeError('Integration tests require the dedicated applypilot_test database.')
    monkeypatch.setenv('DATABASE_URL', url)
    cfg = Config('alembic.ini')
    command.upgrade(cfg, 'head')
    app = create_app(url)
    if not url.startswith('sqlite:'):
        with app.state.engine.begin() as connection:
            connection.execute(text('TRUNCATE source_emails, timeline_events, applications, login_sessions, users CASCADE'))
    with TestClient(app, headers={"Origin":"http://localhost:5174"}) as c:
        assert c.post("/api/auth/register",json={"email":"owner@example.com","password":"Test password 123!"}).status_code == 201
        yield c
    app.state.engine.dispose()

def payload(**changes):
    return dict(company='Example Labs', role='Backend Engineer', status='Applied', appliedOn='2026-10-12', **changes)

def imported(**changes):
    data = dict(email={'subject':'Application received','body':'We received your application.','receivedAt':'2026-10-12'},
        fields={'company':'Example Labs','role':'Backend Engineer','status':'Applied'},targetApplicationId=None)
    data.update(changes)
    return data

def test_health_and_ready(client):
    assert client.get('/health').status_code == 200
    assert client.get('/ready').json()['status'] == 'ready'

def test_crud_timeline_and_restart(client):
    r = client.post('/api/applications',json=payload(notes='Initial note',jobUrl='https://example.com/jobs/1'))
    assert r.status_code == 201
    a = r.json()
    assert a['timeline'][0]['type'] == 'created'
    route = '/api/applications/' + a['id']
    r = client.patch(route,json={'status':'Interview','notes':'Prepare','interviewDate':'2026-10-20'})
    assert r.status_code == 200
    assert {e['type'] for e in r.json()['timeline']} == {'created','status','note','edit'}
    client.app.state.engine.dispose()
    restarted = create_app(str(client.app.state.engine.url.render_as_string(hide_password=False)))
    with TestClient(restarted, cookies=client.cookies) as second:
        assert second.get(route).json()['notes'] == 'Prepare'
        assert len(second.get('/api/applications').json()) == 1
    restarted.state.engine.dispose()
    assert client.delete(route).status_code == 204
    assert client.get(route).status_code == 404
    with client.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(TimelineEvent)) == 0

@pytest.mark.parametrize('patch', [
    {'company':' '}, {'role':''}, {'status':'Unknown'}, {'appliedOn':'2026-02-31'},
    {'jobUrl':'javascript:alert(1)'}, {'jobUrl':'https://user:pass@example.com'},
    {'company':'x'*101}, {'nextAction':'x'*161}, {'unexpected':'field'},
])
def test_invalid_create(client,patch):
    data=payload(); data.update(patch)
    r=client.post('/api/applications',json=data)
    assert r.status_code == 422
    assert r.json()['error']['code'] == 'validation_error'
    assert client.get('/api/applications').json() == []

def test_patch_null_clearing_and_noop(client):
    a=client.post('/api/applications',json=payload(interviewDate='2026-10-20')).json()
    route='/api/applications/'+a['id']
    assert client.patch(route,json={'company':None}).status_code == 422
    unchanged=client.patch(route,json={}).json()
    assert unchanged['lastUpdated'] == a['lastUpdated']
    cleared=client.patch(route,json={'interviewDate':''}).json()
    assert cleared['interviewDate'] is None

def test_import_duplicate_and_delete_cascade(client):
    r=client.post('/api/imports',json=imported())
    assert r.status_code == 201
    a=r.json()
    duplicate=imported(); duplicate['email']['body']='  WE RECEIVED  YOUR APPLICATION. '
    assert client.post('/api/imports',json=duplicate).status_code == 409
    assert len(client.get('/api/applications').json()) == 1
    assert len(client.get('/api/applications/'+a['id']).json()['sourceEmails']) == 1
    assert client.delete('/api/applications/'+a['id']).status_code == 204
    with client.app.state.sessions() as db:
        assert db.scalar(select(func.count()).select_from(SourceEmail)) == 0

def test_import_update_transaction(client):
    a=client.post('/api/applications',json=payload()).json()
    data=imported(targetApplicationId=a['id'])
    data['fields'].update(company='Corrected Labs',status='Interview',interviewDate='2026-10-20')
    r=client.post('/api/imports',json=data)
    assert r.status_code == 201
    assert r.json()['company']=='Corrected Labs'
    assert r.json()['status']=='Interview'
    assert len(r.json()['sourceEmails'])==1
    data['fields']['status']='Rejected'
    assert client.post('/api/imports',json=data).status_code==409
    assert client.get('/api/applications/'+a['id']).json()['status']=='Interview'

def test_missing_target_is_not_saved(client):
    assert client.post('/api/imports',json=imported(targetApplicationId='missing')).status_code==404
    assert client.get('/api/applications').json()==[]

def test_cors(client):
    r=client.options('/api/applications',headers={'Origin':'http://localhost:5174','Access-Control-Request-Method':'POST'})
    assert r.headers['access-control-allow-origin']=='http://localhost:5174'
    r=client.options('/api/applications',headers={'Origin':'https://untrusted.example','Access-Control-Request-Method':'POST'})
    assert 'access-control-allow-origin' not in r.headers

def test_concurrent_duplicate_postgres(client):
    if client.app.state.engine.dialect.name != 'postgresql':
        pytest.skip('Real PostgreSQL required for concurrent transactions')
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses=list(pool.map(lambda _: client.post('/api/imports',json=imported()).status_code,range(2)))
    assert sorted(responses)==[201,409]
    assert len(client.get('/api/applications').json())==1

def test_migrations_match_models(client):
    command.check(Config('alembic.ini'))
