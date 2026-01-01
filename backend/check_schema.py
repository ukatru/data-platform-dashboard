
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Framework paths from settings or hardcoded for speed
sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.core.config import settings
from metadata_framework import models

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    print(f"Connecting to: {settings.database_url}")
    # Try a raw SQL query first
    print("Testing Raw SQL...")
    result = db.execute(text("SELECT id, job_nm FROM etl_job_definition LIMIT 1"))
    row = result.fetchone()
    print(f"Raw SQL Row (id, job_nm): {row}")
    
    try:
        result = db.execute(text("SELECT file_loc FROM etl_job_definition LIMIT 1"))
        print(f"Raw SQL Row (file_loc): {result.fetchone()}")
    except Exception as e:
        print(f"Raw SQL Error (file_loc): {e}")

    # Try SQLAlchemy ORM query
    print("Testing ORM...")
    job = db.query(models.ETLJobDefinition).first()
    if job:
        print(f"ORM Job: {job.job_nm}, file_loc: {getattr(job, 'file_loc', 'N/A')}")
    else:
        print("No jobs found in etl_job_definition")
except Exception as e:
    print(f"General Error: {e}")
finally:
    db.close()
