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
    db.flush() # Get team ID
    
    # 1. Automated Onboarding: Initial Code Location
    if team_in.initial_code_location:
        db_loc = models.ETLCodeLocation(
            team_id=db_team.id,
            location_nm=f"{db_team.team_nm} Default",
            repo_url=team_in.initial_code_location,
            creat_by_nm=tenant_ctx.user.username
        )
        db.add(db_loc)
        
    # 2. Automated Onboarding: Initial Team Admin
    if team_in.initial_admin_id:
        # Find generic TeamAdmin role
        role = db.query(models.ETLRole).filter(
            models.ETLRole.role_nm == 'TeamAdmin', 
            models.ETLRole.team_id == None
        ).first()
        
        if role:
            db_member = models.ETLTeamMember(
                user_id=team_in.initial_admin_id,
                team_id=db_team.id,
                role_id=role.id,
                creat_by_nm=tenant_ctx.user.username
            )
            db.add(db_member)

    db.commit()
    db.refresh(db_team)
    return db_team

@router.patch("/teams/{team_id}", response_model=schemas.Team)
def update_team(
    team_id: int,
    team_in: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_TEAMS))
):
    """Update team metadata"""
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied to this team")
        
    update_data = team_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)
        
    team.updt_by_nm = tenant_ctx.user.username
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

@router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_TEAMS))
):
    """Delete a team and its associated resources"""
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
        
    if tenant_ctx.org_id is not None and team.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied to this team")
        
    # Check for memberships
    memberships = db.query(models.ETLTeamMember).filter(models.ETLTeamMember.team_id == team_id).all()
    if memberships:
        # For now, let's allow deletion but delete memberships too
        for m in memberships:
            db.delete(m)
            
    # Check for code locations
    locs = db.query(models.ETLCodeLocation).filter(models.ETLCodeLocation.team_id == team_id).all()
    for loc in locs:
        db.delete(loc)
        
    db.delete(team)
    db.commit()
    return None

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


