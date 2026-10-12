"""Accounts and sessions; preserve legacy records unassigned until local transfer."""
from alembic import op
import sqlalchemy as sa
revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('users', sa.Column('id',sa.String(36),primary_key=True),
        sa.Column('email',sa.String(254),nullable=False,unique=True),
        sa.Column('password_hash',sa.Text(),nullable=False),
        sa.Column('created_at',sa.DateTime(timezone=True),nullable=False))
    op.create_table('login_sessions',sa.Column('token_hash',sa.String(64),primary_key=True),
        sa.Column('user_id',sa.String(36),sa.ForeignKey('users.id',ondelete='CASCADE'),nullable=False),
        sa.Column('expires_at',sa.DateTime(timezone=True),nullable=False))
    op.create_index('ix_login_sessions_user_id','login_sessions',['user_id'])
    with op.batch_alter_table('applications') as batch:
        batch.add_column(sa.Column('owner_id',sa.String(36),nullable=True))
        batch.create_foreign_key('fk_applications_owner','users',['owner_id'],['id'])
        batch.create_index('ix_applications_owner_id',['owner_id'])

def downgrade():
    raise RuntimeError('Account migration downgrade would remove ownership. Restore a backup instead.')
