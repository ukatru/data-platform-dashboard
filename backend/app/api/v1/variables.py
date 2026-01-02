from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

# --- Team Variables ---

@router.get("/team", response_model=List[schemas.TeamVariable])
def list_team_variables(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """List variables for the current team or all teams if platform admin"""
    query = db.query(models.ETLTeamVariable).join(models.ETLTeam)
    
    if not tenant_ctx.team_id:
        if auth.Permission.PLATFORM_ADMIN in tenant_ctx.global_permissions:
            # Platform admins can see all team variables for their org
            vars = query.filter(models.ETLTeamVariable.org_id == tenant_ctx.org_id).all()
        else:
            return []
    else:
        vars = query.filter(models.ETLTeamVariable.team_id == tenant_ctx.team_id).all()

    # Map team name for display
    for v in vars:
        v.team_nm = v.team.team_nm
    return vars

@router.post("/team", response_model=schemas.TeamVariable, status_code=status.HTTP_201_CREATED)
def create_team_variable(
    var_in: schemas.VariableCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Create a new team-specific variable"""
    team_id = var_in.team_id or tenant_ctx.team_id
    if not team_id:
         raise HTTPException(status_code=400, detail="Team ID is required")
    
    # Verify team belongs to org
    team = db.query(models.ETLTeam).filter(models.ETLTeam.id == team_id).first()
    if not team or (tenant_ctx.org_id and team.org_id != tenant_ctx.org_id):
        raise HTTPException(status_code=403, detail="Invalid team or access denied")

    db_var = models.ETLTeamVariable(
        team_id=team_id,
        org_id=team.org_id,
        var_nm=var_in.var_nm,
        var_value=var_in.var_value,
        description=var_in.description,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_var)
    db.commit()
    db.refresh(db_var)
    return db_var

@router.patch("/team/{var_id}", response_model=schemas.TeamVariable)
def update_team_variable(
    var_id: int,
    var_in: schemas.VariableUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update a team variable"""
    db_var = db.query(models.ETLTeamVariable).filter(models.ETLTeamVariable.id == var_id).first()
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    # Tenant check
    if tenant_ctx.org_id and db_var.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if var_in.var_value is not None:
        db_var.var_value = var_in.var_value
    if var_in.description is not None:
        db_var.description = var_in.description
    db_var.updt_by_nm = tenant_ctx.user.username
    db.add(db_var)
    db.commit()
    db.refresh(db_var)
    return db_var

@router.delete("/team/{var_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team_variable(
    var_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete a team variable"""
    db_var = db.query(models.ETLTeamVariable).filter(models.ETLTeamVariable.id == var_id).first()
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    # Tenant check
    if tenant_ctx.org_id and db_var.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(db_var)
    db.commit()
    return None

# --- Org Variables ---

@router.get("/org", response_model=List[schemas.OrgVariable])
def list_org_variables(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """List variables for the current organization"""
    if not tenant_ctx.org_id:
        return []
    
    return db.query(models.ETLGlobalVariable).filter(
        models.ETLGlobalVariable.org_id == tenant_ctx.org_id
    ).all()

@router.post("/org", response_model=schemas.OrgVariable, status_code=status.HTTP_201_CREATED)
def create_org_variable(
    var_in: schemas.VariableCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.PLATFORM_ADMIN))
):
    """Create a new org-scoped variable"""
    org_id = var_in.org_id or tenant_ctx.org_id
    if not org_id:
         raise HTTPException(status_code=400, detail="Org ID is required")
    
    # Security check: platform admin can only create for their own org unless they are system admin
    if tenant_ctx.org_id and org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db_var = models.ETLGlobalVariable(
        org_id=org_id,
        var_nm=var_in.var_nm,
        var_value=var_in.var_value,
        description=var_in.description,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_var)
    db.commit()
    db.refresh(db_var)
    return db_var

@router.patch("/org/{var_id}", response_model=schemas.OrgVariable)
def update_org_variable(
    var_id: int,
    var_in: schemas.VariableUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.PLATFORM_ADMIN))
):
    """Update an org variable"""
    db_var = db.query(models.ETLGlobalVariable).filter(models.ETLGlobalVariable.id == var_id).first()
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    # Tenant check
    if tenant_ctx.org_id and db_var.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if var_in.var_value is not None:
        db_var.var_value = var_in.var_value
    if var_in.description is not None:
        db_var.description = var_in.description
    db_var.updt_by_nm = tenant_ctx.user.username
    db.add(db_var)
    db.commit()
    db.refresh(db_var)
    return db_var

@router.delete("/org/{var_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_org_variable(
    var_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.PLATFORM_ADMIN))
):
    """Delete an org variable"""
    db_var = db.query(models.ETLGlobalVariable).filter(models.ETLGlobalVariable.id == var_id).first()
    if not db_var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    # Tenant check
    if tenant_ctx.org_id and db_var.org_id != tenant_ctx.org_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.delete(db_var)
    db.commit()
    return None
