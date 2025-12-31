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

@router.get("/", response_model=List[schemas.Job])
def list_pipelines(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all pipelines (jobs) for the current organization"""
    query = db.query(
        models.ETLJob, 
        models.ETLSchedule.slug, 
        models.ETLSchedule.cron,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code
    )\
    .outerjoin(models.ETLSchedule, models.ETLJob.schedule_id == models.ETLSchedule.id)\
    .join(models.ETLTeam, models.ETLJob.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJob.org_id == models.ETLOrg.id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJob.org_id == tenant_ctx.org_id)
        
    # Team Filtering
    if tenant_ctx.team_id:
        query = query.filter(models.ETLJob.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLJob.team_id.in_(user_team_ids))
        
    results = query.all()
    
    jobs = []
    for job, slug, cron, team_nm, org_code in results:
        job_data = schemas.Job.model_validate(job)
        # Coalesce logic: Custom Cron > Central Schedule > Manual
        if job.cron_schedule:
            job_data.schedule = f"Custom: {job.cron_schedule}"
        elif slug:
            job_data.schedule = f"{slug} ({cron})"
        else:
            job_data.schedule = "Manual"
        
        job_data.team_nm = team_nm
        job_data.org_code = org_code
        jobs.append(job_data)
        
    return jobs

@router.post("/", response_model=schemas.Job, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    job: schemas.JobCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Create a new pipeline scoped to organization and team.
    """
    # Enforce Org ID from context if not System Admin
    org_id = job.org_id
    if tenant_ctx.org_id is not None:
        org_id = tenant_ctx.org_id
        
    # Scoped Permission Check: Ensure user can edit pipelines for the TARGET team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=job.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to create pipelines for Team ID {job.team_id}"
        )
    """
    Create a new pipeline (composite operation).
    Creates records in:
    1. etl_job - main pipeline record
    2. etl_job_parameter - initialize with empty config (optional)
    """
    # Create the job
    # Auto-assign code_location_id if not provided
    code_location_id = job.code_location_id
    if not code_location_id and job.team_id:
        # Get the first code location for this team
        first_location = db.query(models.ETLCodeLocation).filter(
            models.ETLCodeLocation.team_id == job.team_id
        ).first()
        if first_location:
            code_location_id = first_location.id
    
    db_job = models.ETLJob(
        **job.model_dump(exclude={"org_id", "code_location_id"}), 
        org_id=org_id,
        code_location_id=code_location_id,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    # Initialize empty parameter record
    db_params = models.ETLJobParameter(
        etl_job_id=db_job.id,
        config_json={},
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_params)
    db.commit()
    
    return get_pipeline(db_job.id, db)

@router.get("/{job_id}", response_model=schemas.Job)
def get_pipeline(
    job_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get pipeline by ID with tenant check"""
    query = db.query(
        models.ETLJob, 
        models.ETLSchedule.slug, 
        models.ETLSchedule.cron,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code
    )\
    .outerjoin(models.ETLSchedule, models.ETLJob.schedule_id == models.ETLSchedule.id)\
    .join(models.ETLTeam, models.ETLJob.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJob.org_id == models.ETLOrg.id)\
    .filter(models.ETLJob.id == job_id)
        
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJob.org_id == tenant_ctx.org_id)
        
    result = query.first()
        
    if not result:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    job, slug, cron, team_nm, org_code = result
    job_data = schemas.Job.model_validate(job)
    # Coalesce logic: Custom Cron > Central Schedule > Manual
    if job.cron_schedule:
        job_data.schedule = f"Custom: {job.cron_schedule}"
    elif slug:
        job_data.schedule = f"{slug} ({cron})"
    else:
        job_data.schedule = "Manual"
    
    job_data.team_nm = team_nm
    job_data.org_code = org_code
        
    return job_data

@router.put("/{job_id}", response_model=schemas.Job)
def update_pipeline(
    job_id: int, 
    job_update: schemas.JobUpdate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update pipeline with tenant check"""
    query = db.query(models.ETLJob).filter(models.ETLJob.id == job_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJob.org_id == tenant_ctx.org_id)
        
    db_job = query.first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    for key, value in job_update.model_dump(exclude_unset=True).items():
        setattr(db_job, key, value)
    
    db_job.updt_by_nm = tenant_ctx.user.username
    db_job.updt_dttm = datetime.utcnow()
    db.commit()
    
    return get_pipeline(db_job.id, db, tenant_ctx, tenant_ctx.user)

@router.delete("/{job_id}")
def delete_pipeline(
    job_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete pipeline with tenant check"""
    query = db.query(models.ETLJob).filter(models.ETLJob.id == job_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJob.org_id == tenant_ctx.org_id)
        
    db_job = query.first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    db.delete(db_job)
    db.commit()
    return {"message": "Pipeline deleted successfully"}

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

@router.put("/{job_id}/params", response_model=schemas.JobParameter)
def update_pipeline_params(
    job_id: int, 
    params: Dict[str, Any], 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Update pipeline parameters with JSON Schema validation.
    Parameters are validated against the schema registered for this job.
    """
    # Get the job
    job = db.query(models.ETLJob).filter(models.ETLJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # Get the schema for validation (Scoped to the job's code location)
    schema = db.query(models.ETLParamsSchema).filter(
        models.ETLParamsSchema.job_nm == job.job_nm,
        models.ETLParamsSchema.code_location_id == job.code_location_id
    ).first()
    
    if schema:
        # Validate params against schema
        validate_params_against_schema(params, schema.json_schema)
    
    # Update or create parameters
    db_params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.etl_job_id == job_id).first()
    if not db_params:
        db_params = models.ETLJobParameter(
            etl_job_id=job_id,
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

@router.get("/{job_id}/schema", response_model=schemas.ParamsSchema)
def get_pipeline_schema(
    job_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """
    Get the JSON Schema for this pipeline's parameters.
    Used by the frontend to dynamically generate the parameter form.
    """
    job = db.query(models.ETLJob).filter(models.ETLJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    schema = db.query(models.ETLParamsSchema).filter(
        models.ETLParamsSchema.job_nm == job.job_nm,
        models.ETLParamsSchema.code_location_id == job.code_location_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found for this pipeline's code location")
    
    return schema
