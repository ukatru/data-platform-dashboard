from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

@router.get("", response_model=List[schemas.ParamsSchema])
def list_schemas(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all parameter schemas for the current organization and active team focus"""
    query = db.query(models.ETLParamsSchema, models.ETLTeam.team_nm, models.ETLOrg.org_code)\
        .join(models.ETLTeam, models.ETLParamsSchema.team_id == models.ETLTeam.id)\
        .join(models.ETLOrg, models.ETLParamsSchema.org_id == models.ETLOrg.id)
        
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLParamsSchema.org_id == tenant_ctx.org_id)
    
    # Team Filtering: Users can only see schemas for teams they belong to
    if tenant_ctx.team_id:
        query = query.filter(models.ETLParamsSchema.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLParamsSchema.team_id.in_(user_team_ids))
        
    results = query.all()
    schemas_list = []
    for s, team_nm, org_code in results:
        s.team_nm = team_nm
        s.org_code = org_code
        schemas_list.append(s)
    return schemas_list

@router.post("", response_model=schemas.ParamsSchema, status_code=status.HTTP_201_CREATED)
def create_schema(
    schema: schemas.ParamsSchemaCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Register a new parameter schema"""
    db_schema = models.ETLParamsSchema(
        **schema.model_dump(),
        org_id=tenant_ctx.org_id,
        team_id=tenant_ctx.team_id,
        creat_by_nm=current_user.username
    )
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    return db_schema

@router.get("/{schema_id}", response_model=schemas.ParamsSchema)
def get_schema(
    schema_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get schema by ID"""
    schema = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    return schema

@router.get("/by-job/{job_nm}", response_model=schemas.ParamsSchema)
def get_schema_by_job(
    job_nm: str, 
    code_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get schema by job name and code location"""
    query = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.job_nm == job_nm)
    
    if code_location_id:
        query = query.filter(models.ETLParamsSchema.code_location_id == code_location_id)
        
    schema = query.first()
    
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema for job '{job_nm}' in code location {code_location_id} not found")
    return schema
