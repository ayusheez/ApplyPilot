import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Date, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def uid():
    return str(uuid.uuid4())

def now():
    return datetime.now(timezone.utc)

class Application(Base):
    __tablename__ = 'applications'
    __table_args__ = (CheckConstraint("status IN ('Applied','Assessment','Interview','Offer','Rejected','Withdrawn')", name='valid_status'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey('users.id'), index=True)
    company: Mapped[str] = mapped_column(String(100), index=True)
    role: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), index=True)
    applied_on: Mapped[object] = mapped_column(Date)
    job_url: Mapped[str | None] = mapped_column(Text)
    interview_date: Mapped[object | None] = mapped_column(Date)
    follow_up_date: Mapped[object | None] = mapped_column(Date)
    next_action: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str] = mapped_column(Text, default='')
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    timeline: Mapped[list['TimelineEvent']] = relationship(cascade='all, delete-orphan', order_by='TimelineEvent.date')
    emails: Mapped[list['SourceEmail']] = relationship(cascade='all, delete-orphan', order_by='SourceEmail.imported_at')

class TimelineEvent(Base):
    __tablename__ = 'timeline_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id', ondelete='CASCADE'), index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    type: Mapped[str] = mapped_column(String(20))
    status: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)

class SourceEmail(Base):
    __tablename__ = 'source_emails'
    __table_args__ = (UniqueConstraint('fingerprint', name='uq_email_fingerprint'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    application_id: Mapped[str] = mapped_column(ForeignKey('applications.id', ondelete='CASCADE'), index=True)
    fingerprint: Mapped[str] = mapped_column(String(64))
    subject: Mapped[str] = mapped_column(String(300))
    sender: Mapped[str | None] = mapped_column(String(320))
    received_at: Mapped[object | None] = mapped_column(Date)
    body: Mapped[str] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class GmailConnection(Base):
    __tablename__ = 'gmail_connections'
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    mailbox: Mapped[str] = mapped_column(String(320))
    tokens: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class GmailOAuthState(Base):
    __tablename__ = 'gmail_oauth_states'
    state_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    session_hash: Mapped[str] = mapped_column(String(64))
    verifier: Mapped[str] = mapped_column(Text)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class GmailImportJob(Base):
    __tablename__ = 'gmail_import_jobs'
    __table_args__ = (UniqueConstraint('user_id','mailbox','message_id',name='uq_gmail_job_message'),)
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True)
    mailbox: Mapped[str] = mapped_column(String(320))
    message_id: Mapped[str] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(20))
    email_data: Mapped[str | None] = mapped_column(Text)
    application_id: Mapped[str | None] = mapped_column(ForeignKey('applications.id',ondelete='SET NULL'))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=now)
