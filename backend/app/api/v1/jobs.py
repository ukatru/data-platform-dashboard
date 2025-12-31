from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import sys

sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.JobDefinition])
def list_job_definitions(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """
    List all Job Definitions scoped to the organization and team.
    Job Definitions are read-only and synced from YAML via the Dagster Factory.
    """
    query = db.query(
        models.ETLJobDefinition,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.location_nm,
        models.ETLCodeLocation.repo_url
    )\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)

    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)

    # Team Filtering
    if tenant_ctx.team_id:
        query = query.filter(models.ETLJobDefinition.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLJobDefinition.team_id.in_(user_team_ids))

    results = query.all()
    
    definitions = []
    for definition, team_nm, org_code, loc_nm, repo_url in results:
        data = schemas.JobDefinition.model_validate(definition)
        data.team_nm = team_nm
        data.org_code = org_code
        data.location_nm = loc_nm
        data.repo_url = repo_url
        definitions.append(data)
        
    return definitions

@router.get("/{id}", response_model=schemas.JobDefinition)
def get_job_definition(
    id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get a specific Job Definition by ID with tenant checks"""
    query = db.query(
        models.ETLJobDefinition,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.location_nm,
        models.ETLCodeLocation.repo_url
    )\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)\
    .filter(models.ETLJobDefinition.id == id)

    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)

    result = query.first()
    if not result:
        raise HTTPException(status_code=404, detail="Job Definition not found")

    definition, team_nm, org_code, loc_nm, repo_url = result
    data = schemas.JobDefinition.model_validate(definition)
    data.team_nm = team_nm
    data.org_code = org_code
    data.location_nm = loc_nm
    data.repo_url = repo_url
    return data
