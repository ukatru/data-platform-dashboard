from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.JobTemplate])
def list_schemas(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all job templates (blueprints) for the current organization and active team focus"""
    query = db.query(models.ETLJobTemplate, models.ETLTeam.team_nm, models.ETLOrg.org_code)\
        .outerjoin(models.ETLTeam, models.ETLJobTemplate.team_id == models.ETLTeam.id)\
        .outerjoin(models.ETLOrg, models.ETLJobTemplate.org_id == models.ETLOrg.id)
        
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobTemplate.org_id == tenant_ctx.org_id)
    
    # Team Filtering
    if tenant_ctx.team_id:
        query = query.filter(models.ETLJobTemplate.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLJobTemplate.team_id.in_(user_team_ids))
        
    results = query.all()
    templates = []
    for t, team_nm, org_code in results:
        data = schemas.JobTemplate.model_validate(t)
        data.team_nm = team_nm
        data.org_code = org_code
        templates.append(data)
    return templates

@router.post("/", response_model=schemas.JobTemplate, status_code=status.HTTP_201_CREATED)
def create_template(
    template: schemas.JobTemplate, # This might need a 'Create' variant
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Register a new job template"""
    db_template = models.ETLJobTemplate(
        **template.model_dump(),
        org_id=tenant_ctx.org_id,
        team_id=tenant_ctx.team_id,
        creat_by_nm=current_user.username
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/{template_id}", response_model=schemas.JobTemplate)
def get_template(
    template_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get template by ID"""
    template = db.query(models.ETLJobTemplate).filter(models.ETLJobTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.get("/by-name/{template_nm}", response_model=schemas.JobTemplate)
def get_template_by_name(
    template_nm: str, 
    code_location_id: int,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get template by name and code location"""
    template = db.query(models.ETLJobTemplate).filter(
        models.ETLJobTemplate.template_nm == template_nm,
        models.ETLJobTemplate.code_location_id == code_location_id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_nm}' not found")
    return template
