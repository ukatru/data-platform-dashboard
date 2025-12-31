import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models

# Use config values
DATABASE_URL = "postgresql://dagster:dagster@192.168.2.116:30722/dpe_framework"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    templates = db.query(models.ETLJobTemplate).all()
    print(f"Total Templates: {len(templates)}")
    for t in templates:
        print(f"ID: {t.id}, Name: {t.template_nm}, Org: {t.org_id}, Team: {t.team_id}, Active: {t.actv_ind}")
finally:
    db.close()
