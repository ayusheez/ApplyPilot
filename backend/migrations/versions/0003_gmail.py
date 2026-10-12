"""Gmail tokens, single-use OAuth state and resumable selected-email imports."""
from alembic import op
import sqlalchemy as sa
revision='0003'
down_revision='0002'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('gmail_connections',sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),primary_key=True),sa.Column('mailbox',sa.String(320),nullable=False),sa.Column('tokens',sa.Text(),nullable=False),sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('gmail_oauth_states',sa.Column('state_hash',sa.String(64),primary_key=True),sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('session_hash',sa.String(64),nullable=False),sa.Column('verifier',sa.Text(),nullable=False),sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_gmail_oauth_states_user_id','gmail_oauth_states',['user_id'])
    op.create_table('gmail_import_jobs',sa.Column('id',sa.String(36),primary_key=True),sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),sa.Column('mailbox',sa.String(320),nullable=False),sa.Column('message_id',sa.String(128),nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('email_data',sa.Text()),sa.Column('application_id',sa.String(36),sa.ForeignKey('applications.id',ondelete='SET NULL')),sa.Column('updated_at',sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint('user_id','mailbox','message_id',name='uq_gmail_job_message'))
    op.create_index('ix_gmail_import_jobs_user_id','gmail_import_jobs',['user_id'])

def downgrade():
    raise RuntimeError('Restore a backup rather than removing Gmail connection history.')
