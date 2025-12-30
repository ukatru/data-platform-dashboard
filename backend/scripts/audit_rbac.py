import os
import sys
import json
import urllib.request
import urllib.parse
import hashlib
import bcrypt
import sqlalchemy
from sqlalchemy import text
from datetime import datetime

# Target API
API_BASE = "http://localhost:8000/api/v1"

def get_password_hash(password):
    password_hash = hashlib.sha256(password.encode()).hexdigest().encode()
    hashed = bcrypt.hashpw(password_hash, bcrypt.gensalt(rounds=12))
    return hashed.decode('utf-8')

class RBACAuditor:
    def __init__(self, db_url: str):
        self.engine = sqlalchemy.create_engine(db_url)
        self.tokens = {} # persona -> token
        self.user_ids = []

    def log(self, persona: str, action: str, result: str, details: str = ""):
        status_icon = "✅" if result == "PASS" else "❌"
        print(f"{status_icon} [{persona}] {action}: {result} {details}")

    def setup_sandbox_users(self):
        """Directly inject test users into the database to bypass credential churn."""
        print("🛠️ Setting up sandbox users...")
        with self.engine.connect() as conn:
            # Get role IDs
            org_admin_id = conn.execute(text("SELECT id FROM etl_role WHERE role_nm = 'OrgAdmin'")).scalar()
            viewer_id = conn.execute(text("SELECT id FROM etl_role WHERE role_nm = 'Viewer'")).scalar()
            org_id = conn.execute(text("SELECT id FROM etl_org WHERE org_code = 'EDS'")).scalar()
            
            # Create Admin Sandbox
            admin_pwd = get_password_hash("sandbox_admin_123")
            conn.execute(text("""
                INSERT INTO etl_user (username, hashed_password, full_nm, email, role_id, org_id, actv_ind, creat_by_nm, creat_dttm)
                VALUES ('auditor_admin', :pwd, 'Auditor Admin', 'auditor_admin@test.com', :rid, :oid, TRUE, 'SYSTEM', NOW())
                ON CONFLICT (username) DO UPDATE SET hashed_password = :pwd, actv_ind = TRUE
            """), {"pwd": admin_pwd, "rid": org_admin_id, "oid": org_id})
            
            # Create Viewer Sandbox
            viewer_pwd = get_password_hash("sandbox_viewer_123")
            conn.execute(text("""
                INSERT INTO etl_user (username, hashed_password, full_nm, email, role_id, org_id, actv_ind, creat_by_nm, creat_dttm)
                VALUES ('auditor_viewer', :pwd, 'Auditor Viewer', 'auditor_viewer@test.com', :rid, :oid, TRUE, 'SYSTEM', NOW())
                ON CONFLICT (username) DO UPDATE SET hashed_password = :pwd, actv_ind = TRUE
            """), {"pwd": viewer_pwd, "rid": viewer_id, "oid": org_id})
            
            conn.commit()
            print("✅ Sandbox users ready.")

    def get_token(self, persona: str, username: str, password: str):
        url = f"{API_BASE}/auth/login"
        data = urllib.parse.urlencode({"username": username, "password": password}).encode('utf-8')
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                self.tokens[persona] = body["access_token"]
        except Exception as e:
            print(f"❌ Failed to login as {username}: {e}")

    def _call(self, persona: str, method: str, path: str, expected_status: int = 200):
        url = f"{API_BASE}{path}"
        headers = {"Authorization": f"Bearer {self.tokens[persona]}"}
        req = urllib.request.Request(url, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == expected_status: return None
            self.log(persona, f"{method} {path}", "FAIL", f"Got {e.code}")
        except Exception as e:
            self.log(persona, f"{method} {path}", "ERROR", str(e))

    def cleanup(self):
        print("🧹 Cleaning up sandbox users...")
        with self.engine.connect() as conn:
            conn.execute(text("DELETE FROM etl_user WHERE username LIKE 'auditor_%'"))
            conn.commit()
        print("✅ Cleanup complete.")

    def run_suite(self):
        self.setup_sandbox_users()
        self.get_token("OrgAdmin", "auditor_admin", "sandbox_admin_123")
        self.get_token("Viewer", "auditor_viewer", "sandbox_viewer_123")

        if "OrgAdmin" not in self.tokens: return

        print("\n--- Running RBAC Assertions ---")
        
        # Assertion 1: Redaction
        print("Test: Connection Redaction...")
        conns = self._call("Viewer", "GET", "/connections/")
        if conns:
            leaked_secrets = any("[Redacted]" not in str(c.get("config_json")) for c in conns if c.get("config_json"))
            if not leaked_secrets:
                self.log("Viewer", "Secrets masked in list", "PASS")
            else:
                self.log("Viewer", "Secrets masked in list", "FAIL")

        # Assertion 2: Report Terminology
        print("Test: Report Terminology...")
        report = self._call("OrgAdmin", "GET", "/reports/access-matrix")
        if report:
            scopes = set(r.get("Scope Type") for r in report)
            if "Enterprise" in scopes and "Global" not in scopes:
                self.log("OrgAdmin", "Report Label: Enterprise", "PASS")
            else:
                self.log("OrgAdmin", "Report Label: Enterprise", "FAIL")

        self.cleanup()

if __name__ == "__main__":
    db_url = os.getenv("DATABASE_URL", "postgresql://dagster:dagster@192.168.2.116:30722/dagster_etl_framework")
    auditor = RBACAuditor(db_url)
    auditor.run_suite()
