
import json
import sys
import os
BASE_URL = "http://localhost:8000/api/v1"

# We need a token. If we don't have one, we might need to login first.
# For now, let's try hitting it without auth to see if we get 401 or 500 (meaning server is up)
# Or if we can find a way to generate a token or mock it.
# Actually, let's look at check_db.py to see how it connects, maybe we can run the function directly.

# Better yet, let's try to run the code pieces from status.py directly in a script context
# to see if imports break.

import sys
import os
sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")
sys.path.append("/home/ukatru/github/data-platform-dashboard/backend")

try:
    from app.api.v1.status import get_summary
    from app.core.database import SessionLocal
    from app.core.auth import TenantContext, User
    from metadata_framework import models
    print("Imports successful")
    
    db = SessionLocal()
    # Mock tenant context
    # Need a user
    user = db.query(models.ETLUser).first()
    if not user:
        print("No user found")
        sys.exit(1)
        
    org_id = user.org_id
    # Mock memberships
    # This is hard to fully mock without constructing the object manually or using a real token.
    # Let's try to simulate a simple context
    
    class MockUser:
        def __init__(self, obj):
            self.id = obj.id
            self.username = obj.username
            self.team_memberships = obj.team_memberships
            
    ctx = TenantContext(
        user=user,
        org_id=user.org_id,
        team_id=user.default_team_id,
        permissions=["CAN_VIEW_LOGS", "PLATFORM_ADMIN"] # Grant badmin
    )
    
    print(f"Testing with User: {user.username}, Org: {user.org_id}, Team: {user.default_team_id}")
    
    summary = get_summary(team_id=None, db=db, tenant_ctx=ctx)
    print("Summary Result:")
    print(json.dumps(summary, default=str, indent=2))
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
