"""Initial application, timeline and email schema."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('applications',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('company',sa.String(100),nullable=False),
        sa.Column('role',sa.String(120),nullable=False),
        sa.Column('status',sa.String(20),nullable=False),
        sa.Column('applied_on',sa.Date(),nullable=False),
        sa.Column('job_url',sa.Text()),sa.Column('interview_date',sa.Date()),
        sa.Column('follow_up_date',sa.Date()),sa.Column('next_action',sa.String(160)),
        sa.Column('notes',sa.Text(),nullable=False),
        sa.Column('last_updated',sa.DateTime(timezone=True),nullable=False),
        sa.CheckConstraint("status IN ('Applied','Assessment','Interview','Offer','Rejected','Withdrawn')",name='valid_status'))
    op.create_index('ix_applications_company','applications',['company'])
    op.create_index('ix_applications_status','applications',['status'])
    op.create_table('timeline_events',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('application_id',sa.String(36),sa.ForeignKey('applications.id',ondelete='CASCADE'),nullable=False),
        sa.Column('date',sa.DateTime(timezone=True),nullable=False),
        sa.Column('type',sa.String(20),nullable=False),sa.Column('status',sa.String(20)),
        sa.Column('description',sa.Text(),nullable=False))
    op.create_index('ix_timeline_events_application_id','timeline_events',['application_id'])
    op.create_table('source_emails',
        sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('application_id',sa.String(36),sa.ForeignKey('applications.id',ondelete='CASCADE'),nullable=False),
        sa.Column('fingerprint',sa.String(64),nullable=False),
        sa.Column('subject',sa.String(300),nullable=False),sa.Column('sender',sa.String(320)),
        sa.Column('received_at',sa.Date()),sa.Column('body',sa.Text(),nullable=False),
        sa.Column('imported_at',sa.DateTime(timezone=True),nullable=False),
        sa.UniqueConstraint('fingerprint',name='uq_email_fingerprint'))
    op.create_index('ix_source_emails_application_id','source_emails',['application_id'])

def downgrade():
    op.drop_table('source_emails')
    op.drop_table('timeline_events')
    op.drop_table('applications')
