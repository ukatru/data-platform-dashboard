from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import sqlalchemy as sa
from typing import List, Dict, Any, Union, Optional
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

@router.get("", response_model=schemas.PaginatedResponse[schemas.Job])
@router.get("/", response_model=schemas.PaginatedResponse[schemas.Job])
@router.get("/instances", response_model=schemas.PaginatedResponse[schemas.Job])
def list_pipelines(
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all pipelines (Static Definitions + Blueprint Instances) for the current organization"""
    
    # 1. Fetch Static Definitions (blueprint_ind = False)
    static_query = db.query(
        models.ETLJobDefinition,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.repo_url
    )\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)\
    .filter(models.ETLJobDefinition.blueprint_ind == False)
    
    if tenant_ctx.org_id is not None:
        static_query = static_query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
    if tenant_ctx.team_id:
        static_query = static_query.filter(models.ETLJobDefinition.team_id == tenant_ctx.team_id)
    if search:
        static_query = static_query.filter(models.ETLJobDefinition.job_nm.ilike(f"%{search}%"))

    # 2. Fetch Instances (Invocations)
    instance_query = db.query(
        models.ETLJobInstance,
        models.ETLJobDefinition.job_nm,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLSchedule.slug,
        models.ETLSchedule.cron,
        models.ETLCodeLocation.repo_url
    )\
    .join(models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id)\
    .join(models.ETLTeam, models.ETLJobInstance.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobInstance.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLSchedule, models.ETLJobInstance.schedule_id == models.ETLSchedule.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)

    if tenant_ctx.org_id is not None:
        instance_query = instance_query.filter(models.ETLJobInstance.org_id == tenant_ctx.org_id)
    if tenant_ctx.team_id:
        instance_query = instance_query.filter(models.ETLJobInstance.team_id == tenant_ctx.team_id)
    if search:
        instance_query = instance_query.filter(models.ETLJobDefinition.job_nm.ilike(f"%{search}%"))

    jobs = []
    
    # Process Static Jobs (Identified by STATIC instance_id)
    for job_def, team_nm, org_code, repo_url in static_query.all():
        params_override = db.query(models.ETLJobParameter).filter(
            models.ETLJobParameter.job_definition_id == job_def.id
        ).first()
        
        cron = params_override.cron_schedule if params_override else None
        start_dt = params_override.partition_start_dt if params_override else None
        
        jobs.append(schemas.Job(
            id=job_def.id,
            job_nm=job_def.job_nm,
            instance_id=None,
            source_type="static",
            org_id=job_def.org_id,
            team_id=job_def.team_id,
            team_nm=team_nm,
            org_code=org_code,
            code_location_id=job_def.code_location_id,
            schema_link="View",
            schedule=f"Static: {cron}" if cron else "Git Defined",
            cron_schedule=cron,
            partition_start_dt=start_dt,
            actv_ind=job_def.actv_ind,
            creat_by_nm=job_def.creat_by_nm,
            creat_dttm=job_def.creat_dttm,
            updt_by_nm=job_def.updt_by_nm,
            updt_dttm=job_def.updt_dttm,
            repo_url=repo_url
        ))

    # Process Instance Jobs (Linked to Blueprints)
    for inst, b_nm, t_nm, o_code, s_slug, s_cron, repo_url in instance_query.all():
        schedule_txt = "Manual"
        if inst.cron_schedule:
            schedule_txt = f"Custom: {inst.cron_schedule}"
        elif s_slug:
            schedule_txt = f"{s_slug} ({s_cron})"

        jobs.append(schemas.Job(
            id=inst.id,
            job_nm=b_nm,
            instance_id=inst.instance_id,
            source_type="instance",
            org_id=inst.org_id,
            team_id=inst.team_id,
            team_nm=t_nm,
            org_code=o_code,
            code_location_id=inst.code_location_id,
            schedule=schedule_txt,
            schedule_id=inst.schedule_id,
            cron_schedule=inst.cron_schedule,
            partition_start_dt=inst.partition_start_dt,
            actv_ind=inst.actv_ind,
            creat_by_nm=inst.creat_by_nm,
            creat_dttm=inst.creat_dttm,
            updt_by_nm=inst.updt_by_nm,
            updt_dttm=inst.updt_dttm,
            repo_url=repo_url
        ))

    # Sort jobs by creation date for stable pagination
    jobs.sort(key=lambda x: x.creat_dttm, reverse=True)
    
    total_count = len(jobs)
    paginated_jobs = jobs[offset : offset + limit]
    
    return {
        "items": paginated_jobs,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }

@router.get("/blueprints", response_model=schemas.PaginatedResponse[schemas.Definition])
def list_blueprints(
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all registered blueprints (logic templates) for the current organization"""
    from sqlalchemy import func
    
    # Query unified definitions where blueprint_ind = True
    query = db.query(
        models.ETLJobDefinition,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.repo_url,
        func.count(models.ETLJobInstance.id).label("instance_count")
    )\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)\
    .outerjoin(models.ETLJobInstance, models.ETLJobDefinition.id == models.ETLJobInstance.job_definition_id)\
    .filter(models.ETLJobDefinition.blueprint_ind == True)\
    .group_by(
        models.ETLJobDefinition.id, 
        models.ETLTeam.team_nm, 
        models.ETLOrg.org_code, 
        models.ETLCodeLocation.repo_url
    )
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
    if tenant_ctx.team_id:
        query = query.filter(models.ETLJobDefinition.team_id == tenant_ctx.team_id)
    if search:
        query = query.filter(models.ETLJobDefinition.job_nm.ilike(f"%{search}%"))
        
    total_count = query.count()
    results = query.order_by(models.ETLJobDefinition.creat_dttm.desc()).offset(offset).limit(limit).all()

    blueprints = []
    for b, team_nm, org_code, repo_url, count in results:
        b.team_nm = team_nm
        b.org_code = org_code
        b.repo_url = repo_url
        b.instance_count = count
        
        # 🟢 Explicit Schema Linking (ID-based, no guessing)
        if not b.params_schema:
            ps = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.job_definition_id == b.id).first()
            if ps:
                b.params_schema = ps.json_schema

        blueprints.append(b)

    return {
        "items": blueprints,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }
    
@router.post("", response_model=schemas.Job, status_code=status.HTTP_201_CREATED)
def create_instance(
    job: schemas.JobCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Create a new pipeline Instance (Invocation) linked to a Blueprint definition.
    """
    # 1. Verify Definition exists and is a blueprint
    blueprint = None
    if job.job_definition_id:
        blueprint = db.query(models.ETLJobDefinition).filter(
            models.ETLJobDefinition.id == job.job_definition_id,
            models.ETLJobDefinition.blueprint_ind == True
        ).first()
    
    # Fallback to name for backward compatibility
    if not blueprint:
        blueprint = db.query(models.ETLJobDefinition).filter(
            models.ETLJobDefinition.job_nm == job.job_nm,
            models.ETLJobDefinition.blueprint_ind == True
        ).first()

    if not blueprint:
        raise HTTPException(status_code=404, detail="Blueprint definition not found.")

    # 2. Scoped Permission Check
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=job.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You do not have permission to create pipelines for Team ID {job.team_id}"
        )

    # 3. Create Instance
    db_inst = models.ETLJobInstance(
        instance_id=job.instance_id,
        job_definition_id=blueprint.id,
        org_id=tenant_ctx.org_id or job.org_id,
        team_id=job.team_id,
        code_location_id=job.code_location_id or blueprint.code_location_id,
        schedule_id=job.schedule_id,
        cron_schedule=job.cron_schedule,
        partition_start_dt=job.partition_start_dt,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_inst)
    db.commit()
    db.refresh(db_inst)
    
    # 4. Initialize parameters
    db_params = models.ETLInstanceParameter(
        instance_pk=db_inst.id,
        config_json={},
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_params)
    db.commit()
    
    return get_pipeline(db_inst.id, type="instance", db=db)

@router.get("/{job_id}", response_model=schemas.Job)
def get_pipeline(
    job_id: int, 
    type: str = "static", # Helper hint if needed, or we search both
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get pipeline by ID (searches definitions then instances)"""
    # 1. Try static definition (Where blueprint_ind is False)
    job_def = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == job_id,
        models.ETLJobDefinition.blueprint_ind == False
    ).first()
    if job_def:
        team = db.query(models.ETLTeam).filter(models.ETLTeam.id == job_def.team_id).first()
        org = db.query(models.ETLOrg).filter(models.ETLOrg.id == job_def.org_id).first()
        
        # Check override for schedule
        params_override = db.query(models.ETLJobParameter).filter(
            models.ETLJobParameter.job_definition_id == job_def.id
        ).first()
        
        cron = params_override.cron_schedule if params_override else None
        start_dt = params_override.partition_start_dt if params_override else None

        return schemas.Job(
            id=job_def.id,
            job_nm=job_def.job_nm,
            instance_id=None,
            source_type="static",
            org_id=job_def.org_id,
            team_id=job_def.team_id,
            team_nm=team.team_nm if team else "Unknown",
            org_code=org.org_code if org else "Unknown",
            code_location_id=job_def.code_location_id,
            schedule=f"Static: {cron}" if cron else "Git Defined",
            cron_schedule=cron,
            partition_start_dt=start_dt,
            actv_ind=job_def.actv_ind,
            creat_by_nm=job_def.creat_by_nm,
            creat_dttm=job_def.creat_dttm,
            updt_by_nm=job_def.updt_by_nm,
            updt_dttm=job_def.updt_dttm,
            yaml_content=job_def.yaml_content
        )
    
    # 2. Try instance
    inst_query = db.query(
        models.ETLJobInstance,
        models.ETLJobDefinition.job_nm,
        models.ETLJobDefinition.yaml_content,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLSchedule.slug,
        models.ETLSchedule.cron
    )\
    .join(models.ETLJobDefinition, models.ETLJobInstance.job_definition_id == models.ETLJobDefinition.id)\
    .join(models.ETLTeam, models.ETLJobInstance.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobInstance.org_id == models.ETLOrg.id)\
    .outerjoin(models.ETLSchedule, models.ETLJobInstance.schedule_id == models.ETLSchedule.id)\
    .filter(models.ETLJobInstance.id == job_id).first()

    if inst_query:
        inst, b_nm, y_content, team_nm, org_code, s_slug, s_cron = inst_query
        schedule_txt = "Manual"
        if inst.cron_schedule:
            schedule_txt = f"Custom: {inst.cron_schedule}"
        elif s_slug:
            schedule_txt = f"{s_slug} ({s_cron})"

        return schemas.Job(
            id=inst.id,
            job_nm=b_nm,
            instance_id=inst.instance_id,
            source_type="instance",
            org_id=inst.org_id,
            team_id=inst.team_id,
            team_nm=team_nm,
            org_code=org_code,
            code_location_id=inst.code_location_id,
            schedule=schedule_txt,
            schedule_id=inst.schedule_id,
            cron_schedule=inst.cron_schedule,
            actv_ind=inst.actv_ind,
            creat_by_nm=inst.creat_by_nm,
            creat_dttm=inst.creat_dttm,
            updt_by_nm=inst.updt_by_nm,
            updt_dttm=inst.updt_dttm,
            yaml_content=y_content
        )

    # 3. Try blueprint definition directly
    blueprint = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == job_id,
        models.ETLJobDefinition.blueprint_ind == True
    ).first()
    if blueprint:
        team = db.query(models.ETLTeam).filter(models.ETLTeam.id == blueprint.team_id).first()
        org = db.query(models.ETLOrg).filter(models.ETLOrg.id == blueprint.org_id).first()
        
        return schemas.Job(
            id=blueprint.id,
            job_nm=blueprint.job_nm,
            instance_id="TEMPLATE",
            source_type="blueprint",
            org_id=blueprint.org_id,
            team_id=blueprint.team_id,
            team_nm=team.team_nm if team else "Unknown",
            org_code=org.org_code if org else "Unknown",
            code_location_id=blueprint.code_location_id,
            schedule="N/A (Multi-Instance Template)",
            actv_ind=blueprint.actv_ind,
            creat_by_nm=blueprint.creat_by_nm,
            creat_dttm=blueprint.creat_dttm,
            updt_by_nm=blueprint.updt_by_nm,
            updt_dttm=blueprint.updt_dttm,
            yaml_content=blueprint.yaml_content
        )

    raise HTTPException(status_code=404, detail="Pipeline not found")

@router.put("/{job_id}", response_model=schemas.Job)
def update_pipeline(
    job_id: int, 
    job_update: schemas.JobUpdate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update pipeline instance (or static override if matched)"""
    # 1. Try instance first
    db_inst = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == job_id).first()
    if db_inst:
        for key, value in job_update.model_dump(exclude_unset=True).items():
            setattr(db_inst, key, value)
        db_inst.updt_by_nm = tenant_ctx.user.username
        db_inst.updt_dttm = datetime.utcnow()
        db.commit()
        return get_pipeline(db_inst.id, type="instance", db=db)
    
    # 2. Try static definition (only allows certain overrides like schedule)
    db_def = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == job_id,
        models.ETLJobDefinition.blueprint_ind == False
    ).first()
    if db_def:
        # Link by Definition ID
        db_params = db.query(models.ETLJobParameter).filter(
            models.ETLJobParameter.job_definition_id == db_def.id
        ).first()
        
        if not db_params:
            db_params = models.ETLJobParameter(
                job_definition_id=db_def.id,
                team_id=db_def.team_id,
                org_id=db_def.org_id,
                config_json={},
                creat_by_nm=tenant_ctx.user.username
            )
            db.add(db_params)
            
        if job_update.cron_schedule is not None:
            db_params.cron_schedule = job_update.cron_schedule
        if job_update.partition_start_dt is not None:
            db_params.partition_start_dt = job_update.partition_start_dt
        
        db_params.updt_by_nm = tenant_ctx.user.username
        db_params.updt_dttm = datetime.utcnow()
        db.commit()
        return get_pipeline(db_def.id, type="static", db=db)

    raise HTTPException(status_code=404, detail="Pipeline or Instance not found")

@router.delete("/{job_id}")
def delete_pipeline(
    job_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete pipeline Instance (Static Definitions cannot be deleted via API)"""
    db_inst = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == job_id).first()
    if not db_inst:
        # Check if they are trying to delete a static def
        db_def = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == job_id).first()
        if db_def:
            raise HTTPException(status_code=403, detail="Static (Git-owned) pipelines cannot be deleted via Portal. Delete them in code and sync.")
        raise HTTPException(status_code=404, detail="Pipeline instance not found")
    
    # Delete parameters first
    db.query(models.ETLInstanceParameter).filter(models.ETLInstanceParameter.instance_pk == db_inst.id).delete()
    db.delete(db_inst)
    db.commit()
    return {"message": "Pipeline instance deleted successfully"}

# Parameter management endpoints
@router.get("/{job_id}/params", response_model=schemas.JobParameter)
def get_pipeline_params(
    job_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get parameters (checks instance first, then static override)"""
    # 1. Instance
    inst = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == job_id).first()
    if inst:
        params = db.query(models.ETLInstanceParameter).filter(models.ETLInstanceParameter.instance_pk == job_id).first()
        if params:
            return schemas.JobParameter(
                id=params.id,
                etl_job_id=job_id,
                config_json=params.config_json,
                creat_by_nm=params.creat_by_nm,
                creat_dttm=params.creat_dttm
            )
        # Handle instance without params record gracefully
        return schemas.JobParameter(
            id=0,
            etl_job_id=job_id,
            config_json={},
            creat_by_nm="SYSTEM",
            creat_dttm=inst.creat_dttm
        )
    
    # 2. Static override
    job_def = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == job_id,
        models.ETLJobDefinition.blueprint_ind == False
    ).first()
    if job_def:
        s_params = db.query(models.ETLJobParameter).filter(
            models.ETLJobParameter.job_definition_id == job_def.id
        ).first()
        if s_params:
            return schemas.JobParameter(
                id=s_params.id,
                etl_job_id=job_id,
                config_json=s_params.config_json,
                creat_by_nm=s_params.creat_by_nm,
                creat_dttm=s_params.creat_dttm
            )
        # Handle static without override record gracefully
        return schemas.JobParameter(
            id=0,
            etl_job_id=job_id,
            config_json={},
            creat_by_nm="SYSTEM",
            creat_dttm=job_def.creat_dttm
        )

    raise HTTPException(status_code=404, detail="Pipeline not found")

@router.put("/{job_id}/params", response_model=schemas.JobParameter)
def update_pipeline_params(
    job_id: int, 
    params: Dict[str, Any], 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update pipeline parameters with validation"""
    # 1. Find the target instance and its definition schema
    db_inst = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == job_id).first()
    if db_inst:
        job_def = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == db_inst.job_definition_id).first()
        if job_def and job_def.params_schema:
            validate_params_against_schema(params, job_def.params_schema)
        
        db_params = db.query(models.ETLInstanceParameter).filter(models.ETLInstanceParameter.instance_pk == job_id).first()
        if not db_params:
            db_params = models.ETLInstanceParameter(instance_pk=job_id, config_json=params, creat_by_nm=tenant_ctx.user.username)
            db.add(db_params)
        else:
            db_params.config_json = params
            db_params.updt_by_nm = tenant_ctx.user.username
            db_params.updt_dttm = datetime.utcnow()
        db.commit()
        db_params_id = db_params.id
        db_params_creat_by = db_params.creat_by_nm
        db_params_creat_dttm = db_params.creat_dttm
        return schemas.JobParameter(
            id=db_params_id,
            etl_job_id=job_id,
            config_json=params,
            creat_by_nm=db_params_creat_by,
            creat_dttm=db_params_creat_dttm
        )

    db_def = db.query(models.ETLJobDefinition).filter(
        models.ETLJobDefinition.id == job_id,
        models.ETLJobDefinition.blueprint_ind == False
    ).first()
    if db_def:
        if db_def.params_schema:
            validate_params_against_schema(params, db_def.params_schema)
        
        db_params = db.query(models.ETLJobParameter).filter(
            models.ETLJobParameter.job_definition_id == db_def.id
        ).first()
        if not db_params:
            db_params = models.ETLJobParameter(
                job_definition_id=db_def.id,
                team_id=db_def.team_id,
                org_id=db_def.org_id,
                config_json=params,
                creat_by_nm=tenant_ctx.user.username
            )
            db.add(db_params)
        else:
            db_params.config_json = params
            db_params.updt_by_nm = tenant_ctx.user.username
            db_params.updt_dttm = datetime.utcnow()
        db.commit()
        db_params_id = db_params.id
        db_params_creat_by = db_params.creat_by_nm
        db_params_creat_dttm = db_params.creat_dttm
        return schemas.JobParameter(
            id=db_params_id,
            etl_job_id=job_id,
            config_json=params,
            creat_by_nm=db_params_creat_by,
            creat_dttm=db_params_creat_dttm
        )

    raise HTTPException(status_code=404, detail="Pipeline not found")

@router.get("/{job_id}/schema", response_model=schemas.ParamsSchema)
def get_pipeline_schema(
    job_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get the JSON Schema (linked by ID, NO GUESSING)"""
    # 1. Resolve Definition ID
    job_def = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == job_id).first()
    if not job_def:
        inst = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == job_id).first()
        if inst:
            job_def = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == inst.job_definition_id).first()

    if job_def:
        # Search for Schema explicitly linked by ID
        ps = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.job_definition_id == job_def.id).first()
        schema = ps.json_schema if ps else job_def.params_schema

        return schemas.ParamsSchema(
            id=job_def.id,
            job_definition_id=job_def.id,
            job_nm=job_def.job_nm,
            json_schema=schema or {},
            description=f"Schema for {job_def.job_nm}",
            team_nm="System",
            org_code="SYS",
            creat_by_nm=job_def.creat_by_nm,
            creat_dttm=job_def.creat_dttm
        )
    
    raise HTTPException(status_code=404, detail="Schema not found for this pipeline")

@router.get("/validate-id/{instance_id}")
def validate_instance_id_uniqueness(
    instance_id: str,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Check if an instance_id/job_nm already exists to prevent collisions"""
    # Case-insensitive, trimmed check to prevent collisions
    instance_id_clean = instance_id.strip().lower()
    
    # Check static definitions
    exists_static = db.query(models.ETLJobDefinition).filter(
        sa.func.lower(sa.func.trim(models.ETLJobDefinition.job_nm)) == instance_id_clean
    ).first()
    if exists_static:
        return {"available": False, "reason": "Existing static pipeline name"}
    
    # Check instances
    exists_inst = db.query(models.ETLJobInstance).filter(
        sa.func.lower(sa.func.trim(models.ETLJobInstance.instance_id)) == instance_id_clean
    ).first()
    if exists_inst:
        return {"available": False, "reason": "Existing instance ID"}
    
    return {"available": True}
