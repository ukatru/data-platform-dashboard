import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from metadata_framework import models

# Database URL from environment or default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/metadata")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate():
    db = SessionLocal()
    try:
        print("Starting migration: Core Data -> EDW")
        
        # 1. Locate teams
        core_team = db.query(models.ETLTeam).filter(models.ETLTeam.team_nm == "Core Data").first()
        edw_team = db.query(models.ETLTeam).filter(models.ETLTeam.team_nm == "EDW").first()
        
        if not core_team:
            print("Core Data team not found. Skipping.")
            return
            
        if not edw_team:
            print("EDW team not found. Creating it...")
            # Assuming org_id 1 for simplicity in this script, or inheriting from Core Data
            edw_team = models.ETLTeam(
                team_nm="EDW",
                org_id=core_team.org_id,
                description="Enterprise Data Warehouse Team",
                actv_ind=True
            )
            db.add(edw_team)
            db.flush()
            
        print(f"Migrating resources from Core Data (ID: {core_team.id}) to EDW (ID: {edw_team.id})")
        
        # 2. Reassign Jobs
        jobs_affected = db.query(models.ETLJob).filter(models.ETLJob.team_id == core_team.id).update({models.ETLJob.team_id: edw_team.id})
        print(f"Updated {jobs_affected} jobs.")
        
        # 3. Reassign Connections
        conns_affected = db.query(models.ETLConnection).filter(models.ETLConnection.team_id == core_team.id).update({models.ETLConnection.team_id: edw_team.id})
        print(f"Updated {conns_affected} connections.")
        
        # 4. Reassign Team Memberships
        # We need to be careful with unique constraints (org_id, team_id, user_id)
        # For now, let's move them if they don't already exist in EDW
        memberships = db.query(models.ETLTeamMember).filter(models.ETLTeamMember.team_id == core_team.id).all()
        for member in memberships:
            exists = db.query(models.ETLTeamMember).filter(
                models.ETLTeamMember.team_id == edw_team.id,
                models.ETLTeamMember.user_id == member.user_id
            ).first()
            
            if not exists:
                member.team_id = edw_team.id
                print(f"Moved user {member.user_id} to EDW team.")
            else:
                db.delete(member)
                print(f"Removed redundant membership for user {member.user_id} (already in EDW).")
        
        # 5. Handle Roles (if roles were team-specific)
        roles_affected = db.query(models.ETLRole).filter(models.ETLRole.team_id == core_team.id).update({models.ETLRole.team_id: edw_team.id})
        print(f"Updated {roles_affected} team roles.")
        
        # 6. Deactivate Core Data team
        core_team.actv_ind = False
        print("Deactivated Core Data team.")
        
        db.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
