import sys
import os

# Set up paths
backend_path = "/home/ukatru/github/data-platform-dashboard/backend"
sys.path.append(backend_path)
sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from app.api.v1.pipelines import list_pipelines
from app.core.database import SessionLocal
from app.core.auth import TenantContext
from metadata_framework import models

db = SessionLocal()
try:
    user = db.query(models.ETLUser).first()
    if not user:
        print("No user found in DB.")
        sys.exit(0)
        
    ctx = TenantContext(user=user, payload={})
    
    print("Testing list_pipelines to verify Location inheritance...")
    jobs = list_pipelines(db=db, tenant_ctx=ctx, current_user=user)
    
    for job in jobs:
        if job.source_type == "instance":
            print(f"Instance: {job.instance_id} | Blueprint: {job.job_nm} | Location: {job.repo_url}")
    
    print("Verification complete.")
    
finally:
    db.close()
