from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

# --- Organization Endpoints ---

@router.get("/orgs", response_model=List[schemas.Org])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    """
    List all organizations.
    Only accessible by System Admins (org_id is None).
    """
    if current_user.org_id is not None:
        # If user belongs to an org, they can only "see" their own org details in this list
        # but usually System Admins manage this. 
        # For now, return only the user's org if they are an admin.
        return db.query(models.ETLOrg).filter(models.ETLOrg.id == current_user.org_id).all()
    
    return db.query(models.ETLOrg).all()

@router.get("/orgs/{org_id}", response_model=schemas.Org)
def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get organization details with tenant check"""
    if current_user.org_id is not None and current_user.org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")
    
    org = db.query(models.ETLOrg).filter(models.ETLOrg.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

# --- Team Endpoints ---

@router.get("/teams", response_model=List[schemas.Team])
def list_teams(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List teams within the current organization"""
    query = db.query(models.ETLTeam)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLTeam.org_id == tenant_ctx.org_id)
    return query.all()

@router.post("/teams", response_model=schemas.Team, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in: schemas.TeamCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_TEAMS))
):
    """Create a new team in the current organization"""
    org_id = team_in.org_id
    if tenant_ctx.org_id is not None:
        org_id = tenant_ctx.org_id # Force to user's org
        
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization ID is required if not scoped to a specific organization."
        )
        
    db_team = models.ETLTeam(
        org_id=org_id,
        team_nm=team_in.team_nm,
        description=team_in.description,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_team)
    db.flush() # Flush to get the team ID
    
    # Auto-provision default roles for the new team using standardized naming
    # Industry standard: TEAM_NAME_ROLE_TYPE (all caps, snake_case)
    normalized_nm = db_team.team_nm.upper().replace(" ", "_")
    default_roles = [
        {"nm": f"{normalized_nm}_LEAD", "desc": f"Lead for {db_team.team_nm} - Can manage connections and users."},
        {"nm": f"{normalized_nm}_RW", "desc": f"Read-Write for {db_team.team_nm} - Can manage pipelines and schedules."},
        {"nm": f"{normalized_nm}_READER", "desc": f"Reader for {db_team.team_nm} - Can view runs and history."}
    ]
    
    for r in default_roles:
        db_role = models.ETLRole(
            team_id=db_team.id,
            role_nm=r["nm"],
            description=r["desc"],
            creat_by_nm="SYSTEM"
        )
        db.add(db_role)
    
    db.commit()
    db.refresh(db_team)
    return db_team

# --- Team Member Endpoints ---

@router.get("/teams/{team_id}/members", response_model=List[schemas.TeamMember])
def list_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """List all members of a specific team"""
    # Verify team belongs to org
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied to this team's members")
        
    return db.query(models.ETLTeamMember).filter(models.ETLTeamMember.team_id == team_id).all()

@router.post("/teams/{team_id}/members", response_model=schemas.TeamMember, status_code=status.HTTP_201_CREATED)
def add_team_member(
    team_id: int,
    member_in: schemas.TeamMemberCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_USERS))
):
    """Add a user to a team with a specific role"""
    # Verify team exists and belongs to org
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied to this team")
        
    # Verify user exists and belongs to the same org
    user = db.query(models.ETLUser).filter(models.ETLUser.id == member_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if tenant_ctx.org_id is not None and user.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="User belongs to a different organization")
        
    # Verify role exists and is scoped to this team or is global
    role = db.query(models.ETLRole).filter(models.ETLRole.id == member_in.role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.team_id is not None and role.team_id != team_id:
        raise HTTPException(status_code=403, detail="Role is scoped to a different team")

    # Check for existing membership
    existing = db.query(models.ETLTeamMember).filter(
        models.ETLTeamMember.user_id == member_in.user_id,
        models.ETLTeamMember.team_id == team_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    db_member = models.ETLTeamMember(
        user_id=member_in.user_id,
        team_id=team_id,
        role_id=member_in.role_id,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@router.delete("/teams/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_USERS))
):
    """Remove a user from a team"""
    # Verify team belongs to org
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied to this team")

    db_member = db.query(models.ETLTeamMember).filter(
        models.ETLTeamMember.team_id == team_id,
        models.ETLTeamMember.user_id == user_id
    ).first()
    
    if not db_member:
        raise HTTPException(status_code=404, detail="Membership not found")
        
    db.delete(db_member)
    db.commit()
    return None

# --- Code Location (Repo) Endpoints ---

@router.get("/code-locations", response_model=List[schemas.CodeLocation])
def list_code_locations(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List code locations (repositories) scoped to the organization's teams"""
    query = db.query(models.ETLCodeLocation).join(models.ETLTeam)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLTeam.org_id == tenant_ctx.org_id)
    return query.all()

@router.post("/code-locations", response_model=schemas.CodeLocation, status_code=status.HTTP_201_CREATED)
def register_code_location(
    loc_in: schemas.CodeLocationCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Register a new code location (repository)"""
    # Verify the target team belongs to the user's org
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == loc_in.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Team belongs to a different organization")
        
    db_loc = models.ETLCodeLocation(
        team_id=loc_in.team_id,
        location_nm=loc_in.location_nm,
        repo_url=loc_in.repo_url,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    return db_loc
