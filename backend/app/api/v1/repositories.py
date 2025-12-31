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

@router.get("/", response_model=List[schemas.CodeLocation])
def list_repositories(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List code locations scoped by organization and authorized teams"""
    query = db.query(models.ETLCodeLocation, models.ETLTeam.team_nm, models.ETLOrg.org_code)\
        .join(models.ETLTeam, models.ETLCodeLocation.team_id == models.ETLTeam.id)\
        .join(models.ETLOrg, models.ETLTeam.org_id == models.ETLOrg.id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLTeam.org_id == tenant_ctx.org_id)
        
    # Team Filtering: Users can only see repositories for teams they belong to
    if tenant_ctx.team_id:
        query = query.filter(models.ETLCodeLocation.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLCodeLocation.team_id.in_(user_team_ids))
        
    results = query.all()
    repositories = []
    for repo, team_nm, org_code in results:
        repo.team_nm = team_nm
        repo.org_code = org_code
        repositories.append(repo)
    return repositories

@router.get("/{id}", response_model=schemas.CodeLocation)
def get_repository(
    id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get a single code location by ID"""
    repo = db.query(models.ETLCodeLocation).filter(models.ETLCodeLocation.id == id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Check if user has access to this repository's team
    if not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        if repo.team_id not in user_team_ids:
            raise HTTPException(status_code=403, detail="Access denied to this repository")
    
    return repo

@router.post("/", response_model=schemas.CodeLocation, status_code=status.HTTP_201_CREATED)
def create_repository(
    repository: schemas.CodeLocationCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Create a new code location"""
    # Check if user has permission to create repositories for the target team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=repository.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to create repositories for Team ID {repository.team_id}"
        )
    
    # Check for duplicate repository name within the same team
    existing = db.query(models.ETLCodeLocation).filter(
        models.ETLCodeLocation.team_id == repository.team_id,
        models.ETLCodeLocation.location_nm == repository.location_nm
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Repository '{repository.location_nm}' already exists for this team"
        )
    
    db_repo = models.ETLCodeLocation(
        **repository.model_dump(),
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_repo)
    db.commit()
    db.refresh(db_repo)
    
    return db_repo

@router.put("/{id}", response_model=schemas.CodeLocation)
def update_repository(
    id: int,
    repository: schemas.CodeLocationUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Update an existing code location"""
    db_repo = db.query(models.ETLCodeLocation).filter(models.ETLCodeLocation.id == id).first()
    if not db_repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Check if user has permission to edit this repository's team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=db_repo.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to edit this repository"
        )
    
    # Check for duplicate name if location_nm is being changed
    if repository.location_nm and repository.location_nm != db_repo.location_nm:
        existing = db.query(models.ETLCodeLocation).filter(
            models.ETLCodeLocation.team_id == db_repo.team_id,
            models.ETLCodeLocation.location_nm == repository.location_nm,
            models.ETLCodeLocation.id != id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Repository '{repository.location_nm}' already exists for this team"
            )
    
    # Update fields
    update_data = repository.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_repo, field, value)
    
    db_repo.updt_by_nm = tenant_ctx.user.username
    db.commit()
    db.refresh(db_repo)
    
    return db_repo

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repository(
    id: int,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Delete a code location"""
    db_repo = db.query(models.ETLCodeLocation).filter(models.ETLCodeLocation.id == id).first()
    if not db_repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    
    # Check if user has permission to delete this repository's team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=db_repo.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this repository"
        )
    
    # Check for dependencies (pipelines, schemas)
    pipeline_count = db.query(models.ETLJob).filter(models.ETLJob.code_location_id == id).count()
    schema_count = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.code_location_id == id).count()
    
    if pipeline_count > 0 or schema_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete repository: {pipeline_count} pipeline(s) and {schema_count} schema(s) are still using it"
        )
    
    db.delete(db_repo)
    db.commit()
    
    return None
