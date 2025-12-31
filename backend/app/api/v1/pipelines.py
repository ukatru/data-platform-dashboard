from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas
from ...services.validator import validate_params_against_schema

router = APIRouter()

@router.get("/", response_model=List[schemas.JobInstance])
def list_pipelines(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all pipeline instances scoped to the organization and team"""
    query = db.query(
        models.ETLJobInstance,
        models.ETLJobDefinition.job_nm,
        models.ETLSchedule.slug, 
        models.ETLSchedule.cron,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code
    )\
    .join(models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id)\
    .outerjoin(models.ETLSchedule, models.ETLJobInstance.schedule_id == models.ETLSchedule.id)\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
        
    # Team Filtering
    if tenant_ctx.team_id:
        query = query.filter(models.ETLJobDefinition.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLJobDefinition.team_id.in_(user_team_ids))
        
    results = query.all()
    
    instances = []
    for instance, job_nm, slug, cron, team_nm, org_code in results:
        data = schemas.JobInstance.model_validate(instance)
        data.job_nm = job_nm
        # Coalesce logic: Custom Cron > Central Schedule > Manual
        if instance.cron_schedule:
            data.schedule_display = f"Custom: {instance.cron_schedule}"
        elif slug:
            data.schedule_display = f"{slug} ({cron})"
        else:
            data.schedule_display = "Manual"
        
        data.team_nm = team_nm
        data.org_code = org_code
        instances.append(data)
        
    return instances

@router.post("/", response_model=schemas.JobInstance, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    instance: schemas.JobInstanceCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Create a new pipeline instance scoped to organization and team.
    """
    # 1. Verify Definition exists and user has access to its team
    definition = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == instance.job_definition_id
    ).first()
    
    if not definition:
        raise HTTPException(status_code=404, detail="Job Definition not found")
        
    # Scoped Permission Check: Ensure user can edit pipelines for the definition's team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=definition.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to create instances for Team ID {definition.team_id}"
        )

    # 2. Create the Job Instance
    db_instance = models.ETLJobInstance(
        **instance.model_dump(),
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_instance)
    db.commit()
    db.refresh(db_instance)
    
    # 3. Initialize empty parameter record
    db_params = models.ETLJobParameter(
        job_instance_id=db_instance.id,
        config_json={},
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_params)
    db.commit()
    
    return get_pipeline(db_instance.id, db, tenant_ctx)

@router.get("/{instance_id}", response_model=schemas.JobInstance)
def get_pipeline(
    instance_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """Get pipeline instance by ID with tenant check"""
    query = db.query(
        models.ETLJobInstance,
        models.ETLJobDefinition.job_nm,
        models.ETLSchedule.slug, 
        models.ETLSchedule.cron,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code
    )\
    .join(models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id)\
    .outerjoin(models.ETLSchedule, models.ETLJobInstance.schedule_id == models.ETLSchedule.id)\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
    .filter(models.ETLJobInstance.id == instance_id)
        
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
        
    result = query.first()
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    instance, job_nm, slug, cron, team_nm, org_code = result
    data = schemas.JobInstance.model_validate(instance)
    data.job_nm = job_nm
    # Coalesce logic
    if instance.cron_schedule:
        data.schedule_display = f"Custom: {instance.cron_schedule}"
    elif slug:
        data.schedule_display = f"{slug} ({cron})"
    else:
        data.schedule_display = "Manual"
    
    data.team_nm = team_nm
    data.org_code = org_code
        
    return data

@router.put("/{instance_id}", response_model=schemas.JobInstance)
def update_pipeline(
    instance_id: int, 
    update_data: schemas.JobInstanceUpdate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update pipeline instance with tenant check"""
    query = db.query(models.ETLJobInstance).join(
        models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id
    ).filter(models.ETLJobInstance.id == instance_id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
        
    db_instance = query.first()
    if not db_instance:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(db_instance, key, value)
    
    db_instance.updt_by_nm = tenant_ctx.user.username
    db_instance.updt_dttm = datetime.utcnow()
    db.commit()
    
    return get_pipeline(db_instance.id, db, tenant_ctx)

@router.delete("/{instance_id}")
def delete_pipeline(
    instance_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete pipeline instance with tenant check"""
    query = db.query(models.ETLJobInstance).join(
        models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id
    ).filter(models.ETLJobInstance.id == instance_id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
        
    db_instance = query.first()
    if not db_instance:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    db.delete(db_instance)
    db.commit()
    return {"message": "Pipeline instance deleted successfully"}

# Parameter management endpoints
@router.get("/{job_id}/params", response_model=schemas.JobParameter)
def get_pipeline_params(
    job_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get pipeline parameters"""
    params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.etl_job_id == job_id).first()
    if not params:
        raise HTTPException(status_code=404, detail="Parameters not found for this pipeline")
    return params

@router.put("/{id}/params", response_model=schemas.JobParameter)
def update_pipeline_params(
    id: int, 
    params: Dict[str, Any], 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Update pipeline instance parameters with JSON Schema validation.
    """
    # 1. Get the Instance and its related Definition
    instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    definition = instance.definition
    
    # 2. Validate params against the schema stored on the definition
    if definition.params_schema:
        validate_params_against_schema(params, definition.params_schema)
    
    # 3. Update or create parameter record
    db_params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.job_instance_id == id).first()
    if not db_params:
        db_params = models.ETLJobParameter(
            job_instance_id=id,
            config_json=params,
            creat_by_nm=tenant_ctx.user.username
        )
        db.add(db_params)
    else:
        db_params.config_json = params
        db_params.updt_by_nm = tenant_ctx.user.username
        db_params.updt_dttm = datetime.utcnow()
    
    db.commit()
    db.refresh(db_params)
    return db_params

@router.get("/{id}/schema", response_model=Dict[str, Any])
def get_pipeline_schema(
    id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """
    Get the JSON Schema for this pipeline instance's parameters.
    Fetched directly from the parent Job Definition.
    """
    instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    definition = instance.definition
    if not definition or not definition.params_schema:
        raise HTTPException(status_code=404, detail="Schema not found for this pipeline's definition")
    
    return definition.params_schema
