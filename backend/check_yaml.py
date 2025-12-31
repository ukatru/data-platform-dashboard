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
    jobs = db.query(models.ETLJobDefinition).all()
    print(f"Total Jobs: {len(jobs)}")
    for j in jobs:
        has_yaml = j.yaml_def is not None
        print(f"ID: {j.id}, Name: {j.job_nm}, Singleton: {j.is_singleton}, Has YAML: {has_yaml}")
        if has_yaml and j.is_singleton:
            print(f"  YAML Preview: {str(j.yaml_def)[:100]}...")
finally:
    db.close()
