
import sys
import os
sys.path.append('/home/ukatru/github/dagster-dag-factory/src')
sys.path.append('/home/ukatru/github/dagster-metadata-framework/src')
sys.path.append('/home/ukatru/github/data-platform-dashboard/backend')

from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from metadata_framework import models
from app.api.v1.status import get_summary
from app.core import auth

# Mock TenantContext
class MockUser:
    def __init__(self):
        self.username = "admin"
        self.org_id = 1
        self.role = type('Role', (), {'role_nm': 'DPE_PLATFORM_ADMIN'})()
        self.team_memberships = []

class MockCtx:
    def __init__(self):
        self.org_id = 1
        self.team_id = None
        self.user = MockUser()
        self.global_permissions = {"PLATFORM_ADMIN", "CAN_VIEW_LOGS"}
    
    def has_permission(self, perm, team_id=None):
        return True

POSTGRES_USER = "dagster"
POSTGRES_PASSWORD = "dagster"
POSTGRES_HOST = "192.168.2.116"
POSTGRES_PORT = "30722"
POSTGRES_DB = "dagster_etl_framework"

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

try:
    engine = create_engine(DATABASE_URL)
    with Session(engine) as session:
        summary = get_summary(team_id=None, db=session, tenant_ctx=MockCtx())
        print("Summary retrieved successfully:")
        print(summary)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
