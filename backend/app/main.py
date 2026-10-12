import hashlib
import logging
import os
from datetime import date, timezone
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload, sessionmaker
from .database import make_engine
from .models import Application, TimelineEvent, SourceEmail, now
from .auth import install_auth
from .schemas import ApplicationCreate, ApplicationPatch, ImportSave, EmailInput
from . import analysis

def fingerprint(email, owner_id):
    normalized = ' '.join(f'{email.subject}\n{email.body}'.lower().split())
    return hashlib.sha256(f'{owner_id}:{normalized}'.encode()).hexdigest()

def iso(value):
    if value is None:
        return None
    if hasattr(value, 'tzinfo') and value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()

def serialize(a):
    return dict(id=a.id, company=a.company, role=a.role, status=a.status,
        appliedOn=iso(a.applied_on), jobUrl=a.job_url, interviewDate=iso(a.interview_date),
        followUpDate=iso(a.follow_up_date), nextAction=a.next_action, notes=a.notes,
        lastUpdated=iso(a.last_updated),
        timeline=[dict(id=t.id,date=iso(t.date),type=t.type,status=t.status,description=t.description) for t in a.timeline],
        sourceEmails=[dict(id=e.id,applicationId=a.id,subject=e.subject,sender=e.sender,
            receivedAt=iso(e.received_at),body=e.body,importedAt=iso(e.imported_at)) for e in a.emails])

def create_app(database_url=None):
    url = database_url or os.environ.get('DATABASE_URL')
    if not url:
        raise RuntimeError('Set DATABASE_URL before starting ApplyPilot. See .env.example.')
    app = FastAPI(title='ApplyPilot API', version='0.1.0', description='Account-based application tracking API.')
    engine = make_engine(url)
    app.state.engine = engine
    app.state.sessions = sessionmaker(engine, expire_on_commit=False)
    origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5174,http://127.0.0.1:5174').split(',')
    app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in origins],
        allow_credentials=True, allow_methods=['GET','POST','PATCH','DELETE'], allow_headers=['Content-Type'])

    def session():
        with app.state.sessions() as db:
            yield db

    @app.middleware('http')
    async def prevent_private_caching(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store'
        return response

    current_user = install_auth(app, session, origins)

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return JSONResponse(status_code=exc.status_code, content={'error': {'code': str(exc.status_code), 'message': exc.detail}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(status_code=422, content={'error': {'code':'validation_error','message':'Check the submitted fields.',
            'fields':[{'field':'.'.join(map(str,e['loc'])),'message':e['msg']} for e in exc.errors()]}})

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        # Do not log SQL parameters: they can contain private email contents.
        logging.getLogger('applypilot').error('Database request failed: %s', type(exc).__name__)
        return JSONResponse(status_code=503, content={'error':{'code':'database_unavailable','message':'Database operation failed. Please retry.'}})

    def get(db, id, owner_id, lock=False):
        stmt = select(Application).where(Application.id == id, Application.owner_id == owner_id).options(selectinload(Application.timeline),selectinload(Application.emails))
        if lock:
            stmt = stmt.with_for_update()
        a = db.scalar(stmt)
        if a is None:
            raise HTTPException(404, 'Application not found')
        return a

    @app.get('/health')
    def health():
        return {'status':'ok', 'service':'applypilot'}

    @app.get('/ready')
    def ready(db: Session = Depends(session)):
        db.execute(text('SELECT 1'))
        # A live server with no migrations applied is not ready.
        db.execute(select(Application.id).limit(1))
        return {'status':'ready', 'database':engine.dialect.name}

    @app.get('/api/applications')
    def applications(db: Session = Depends(session), user=Depends(current_user)):
        records = db.scalars(select(Application).where(Application.owner_id == user.id).options(selectinload(Application.timeline),selectinload(Application.emails)).order_by(Application.last_updated.desc(),Application.id)).all()
        return [serialize(a) for a in records]

    @app.post('/api/applications', status_code=201)
    def create(data: ApplicationCreate, db: Session = Depends(session), user=Depends(current_user)):
        a = Application(**data.model_dump(), owner_id=user.id)
        a.timeline.append(TimelineEvent(type='created',status=a.status,description='Application added'))
        db.add(a)
        db.commit()
        return serialize(a)

    @app.get('/api/applications/{id}')
    def detail(id: str, db: Session = Depends(session), user=Depends(current_user)):
        return serialize(get(db,id,user.id))

    @app.patch('/api/applications/{id}')
    def update(id: str, data: ApplicationPatch, db: Session = Depends(session), user=Depends(current_user)):
        a = get(db,id,user.id,lock=True)
        changes = {k:v for k,v in data.model_dump(exclude_unset=True).items() if getattr(a,k) != v}
        if 'status' in changes:
            a.timeline.append(TimelineEvent(type='status',status=changes['status'],description=f"Status changed to {changes['status']}"))
        if 'notes' in changes:
            a.timeline.append(TimelineEvent(type='note',description='Notes updated'))
        if changes.keys() - {'status','notes'}:
            a.timeline.append(TimelineEvent(type='edit',description='Details edited'))
        for k,v in changes.items():
            setattr(a,k,v)
        if changes:
            a.last_updated = now()
        db.commit()
        return serialize(a)

    @app.delete('/api/applications/{id}', status_code=204)
    def delete(id: str, db: Session = Depends(session), user=Depends(current_user)):
        db.delete(get(db,id,user.id,lock=True))
        db.commit()
        return Response(status_code=204)

    @app.post('/api/analysis')
    def analyse_email(data: EmailInput, db: Session = Depends(session), user=Depends(current_user)):
        duplicate = db.scalar(select(Application).join(SourceEmail).where(
            Application.owner_id == user.id, SourceEmail.fingerprint == fingerprint(data, user.id)))
        if duplicate:
            return dict(kind='duplicate', applicationId=duplicate.id, company=duplicate.company, role=duplicate.role)
        extraction, warnings = analysis.extract(data)
        company, role = extraction['company']['value'], extraction['role']['value']
        matches = []
        if company and role:
            records = db.scalars(select(Application).where(Application.owner_id == user.id)).all()
            matches = [a.id for a in records if analysis.normalize(a.company) == analysis.normalize(company)
                and analysis.normalize(a.role) == analysis.normalize(role)]
        extraction['matchedApplicationId'] = matches[0] if len(matches) == 1 else None
        extraction['warnings'] = warnings
        return dict(kind='result', extraction=extraction)

    @app.post('/api/imports', status_code=201)
    def save_import(data: ImportSave, db: Session = Depends(session), user=Depends(current_user)):
        fp = fingerprint(data.email,user.id)
        if db.scalar(select(SourceEmail.id).where(SourceEmail.fingerprint==fp)):
            raise HTTPException(409,'This email was already imported.')
        fields = data.fields.model_dump()
        if data.target_application_id:
            a = get(db,data.target_application_id,user.id,lock=True)
            if a.status != fields['status']:
                a.timeline.append(TimelineEvent(type='status',status=fields['status'],description=f"Status changed to {fields['status']} (from email)"))
            for k,v in fields.items():
                if v is not None:
                    setattr(a,k,v)
            a.last_updated = now()
        else:
            a = Application(**fields, owner_id=user.id, applied_on=data.email.received_at or date.today(), notes='')
            db.add(a)
        a.timeline.append(TimelineEvent(type='import',status=a.status,description=f'Email imported: {data.email.subject}'))
        a.emails.append(SourceEmail(**data.email.model_dump(),fingerprint=fp))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if db.scalar(select(SourceEmail.id).where(SourceEmail.fingerprint==fp)):
                raise HTTPException(409,'This email was already imported.')
            raise
        return serialize(a)

    return app
