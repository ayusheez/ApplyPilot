"""Local operator-only transfer of pre-account records. No public claim endpoint."""
import argparse
import os
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import make_engine
from .models import User, Application
from .main import fingerprint

def transfer(db, email):
    user=db.scalar(select(User).where(User.email==email.strip().lower()))
    if not user: raise ValueError('Create this account in ApplyPilot first.')
    records=db.scalars(select(Application).where(Application.owner_id.is_(None)).with_for_update()).all()
    for app in records:
        app.owner_id=user.id
        for email_record in app.emails:
            email_record.fingerprint=fingerprint(email_record,user.id)
    db.commit()
    return len(records)

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--email',required=True)
    args=parser.parse_args()
    with Session(make_engine(os.environ['DATABASE_URL'])) as db:
        print(f'Transferred {transfer(db,args.email)} existing application(s).')
