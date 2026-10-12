from test_api import client, payload, imported


def test_old_email_cannot_overwrite_and_can_attach(client):
    app = client.post('/api/applications', json=payload()).json()
    client.patch('/api/applications/'+app['id'], json={'status':'Interview','followUpDate':'2026-12-20'})
    data = imported(targetApplicationId=app['id'], email={'subject':'Old confirmation','body':'Your application was received.','receivedAt':'2020-01-01'})
    assert client.post('/api/imports', json=data).status_code == 409
    unchanged = client.get('/api/applications/'+app['id']).json()
    assert unchanged['status'] == 'Interview'
    assert unchanged['sourceEmails'] == []
    data['updateFields'] = False
    saved = client.post('/api/imports', json=data)
    assert saved.status_code == 201
    assert saved.json()['status'] == 'Interview'
    assert saved.json()['followUpDate'] == '2026-12-20'
    assert len(saved.json()['sourceEmails']) == 1
    assert client.post('/api/imports', json=data).status_code == 409


def test_undated_update_blocked(client):
    app = client.post('/api/applications', json=payload()).json()
    data = imported(targetApplicationId=app['id'], email={'subject':'No date','body':'An undated update.'})
    assert client.post('/api/imports', json=data).status_code == 409


def test_reminder_edit_and_clear(client):
    app = client.post('/api/applications', json=payload()).json()
    path = '/api/applications/'+app['id']
    assert client.patch(path,json={'followUpDate':'2026-12-20'}).status_code == 200
    assert client.get(path).json()['followUpDate'] == '2026-12-20'
    assert client.patch(path,json={'followUpDate':''}).status_code == 200
    assert client.get(path).json()['followUpDate'] is None


def test_newer_reviewed_email_updates(client):
    from datetime import date, timedelta
    app = client.post('/api/applications', json=payload()).json()
    data = imported(targetApplicationId=app['id'], email={'subject':'Interview','body':'Please attend an interview.','receivedAt':(date.today()+timedelta(days=2)).isoformat()}, fields={'company':'Example Labs','role':'Backend Engineer','status':'Interview'})
    saved=client.post('/api/imports',json=data)
    assert saved.status_code == 201
    assert saved.json()['status'] == 'Interview'
    assert any(t['type']=='status' for t in saved.json()['timeline'])
