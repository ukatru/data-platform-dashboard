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
    """List all pipeline instances (Singletons from Definition + Instances from Templates)"""
    
    # 1. Fetch Singletons (Definition table)
    def_query = db.query(
        models.ETLJobDefinition,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.location_nm,
        models.ETLCodeLocation.repo_url,
        models.ETLSchedule.slug, 
        models.ETLSchedule.cron
    )\
    .outerjoin(models.ETLSchedule, models.ETLJobDefinition.schedule_id == models.ETLSchedule.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)\
    .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)

    # 2. Fetch Blueprint Instances (Instance table)
    inst_query = db.query(
        models.ETLJobInstance,
        models.ETLJobTemplate.template_nm,
        models.ETLTeam.team_nm,
        models.ETLOrg.org_code,
        models.ETLCodeLocation.location_nm,
        models.ETLCodeLocation.repo_url
    )\
    .join(models.ETLJobTemplate, models.ETLJobInstance.template_id == models.ETLJobTemplate.id)\
    .outerjoin(models.ETLCodeLocation, models.ETLJobInstance.code_location_id == models.ETLCodeLocation.id)\
    .join(models.ETLTeam, models.ETLJobInstance.team_id == models.ETLTeam.id)\
    .join(models.ETLOrg, models.ETLJobInstance.org_id == models.ETLOrg.id)

    if tenant_ctx.org_id is not None:
        def_query = def_query.filter(models.ETLJobDefinition.org_id == tenant_ctx.org_id)
        inst_query = inst_query.filter(models.ETLJobInstance.org_id == tenant_ctx.org_id)
        
    if tenant_ctx.team_id:
        def_query = def_query.filter(models.ETLJobDefinition.team_id == tenant_ctx.team_id)
        inst_query = inst_query.filter(models.ETLJobInstance.team_id == tenant_ctx.team_id)

    results = []

    # Process Singletons
    for jd, team_nm, org_code, loc_nm, repo_url, slug, cron in def_query.all():
        data = schemas.JobInstance.model_validate(jd)
        data.id = f"def_{jd.id}"
        data.job_nm = jd.job_nm
        data.is_singleton = True
        data.team_nm = team_nm
        data.org_code = org_code
        data.location_nm = loc_nm
        data.repo_url = repo_url
        data.schedule_display = f"{slug} ({cron})" if slug else (f"{jd.cron_schedule}" if jd.cron_schedule else "Manual")
        results.append(data)

    # Process Blueprint Instances
    for ji, template_nm, team_nm, org_code, loc_nm, repo_url in inst_query.all():
        data = schemas.JobInstance.model_validate(ji)
        data.id = f"inst_{ji.id}"
        data.job_nm = ji.instance_nm
        data.template_nm = template_nm
        data.is_singleton = False
        data.team_nm = team_nm
        data.org_code = org_code
        data.location_nm = loc_nm
        data.repo_url = repo_url
        data.schedule_display = f"{ji.cron_schedule}" if ji.cron_schedule else "Manual"
        results.append(data)
        
    return results

@router.post("/", response_model=schemas.JobInstance, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    instance: schemas.JobInstanceCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Create a new pipeline instance. 
    Blueprints (templates) create ETLJobInstance.
    Singletons create ETLJobDefinition.
    """
    from metadata_framework.params_provider import JobParamsProvider
    provider = JobParamsProvider()

    # 1. Determine if this is a Blueprint instance or a Singleton
    template_id = instance.job_definition_id # This comes from the UI's selection
    
    if template_id:
        # 🟢 Blueprint Instance Path
        template = db.query(models.ETLJobTemplate).filter(models.ETLJobTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Determine scoping
        target_team_id = template.team_id or tenant_ctx.team_id
        cl_id = template.code_location_id
        
        # Use a new provider method to handle the specific etl_job_instance table
        ji_id = provider.upsert_job_instance(
            instance_nm=instance.instance_id,
            template_id=template_id,
            params_json=instance.params_json or {},
            description=instance.description,
            cron_schedule=instance.cron_schedule,
            partition_start_dt=instance.partition_start_dt,
            team_id=target_team_id,
            org_id=tenant_ctx.org_id,
            cl_id=cl_id,
            by_nm=tenant_ctx.user.username
        )
        
        # Fetch back for return (we use the list query logic)
        return get_pipeline(ji_id, db, tenant_ctx, is_instance=True)
    else:
        # 🟢 Singleton Path (Legacy/Native YAML)
        # For now, we still support creating these, but they go to etl_job_definition
        # Note: UI usually enforces YAML if not a template.
        db_instance = models.ETLJobDefinition(
            job_nm=instance.instance_id,
            description=instance.description,
            is_singleton=True,
            yaml_def=instance.yaml_def,
            org_id=tenant_ctx.org_id,
            team_id=tenant_ctx.team_id,
            # For simplicity, pick the first code location of the team
            code_location_id=db.query(models.ETLCodeLocation).filter(models.ETLCodeLocation.team_id == tenant_ctx.team_id).first().id,
            cron_schedule=instance.cron_schedule,
            partition_start_dt=instance.partition_start_dt,
            creat_by_nm=tenant_ctx.user.username
        )
        db.add(db_instance)
        db.commit()
        db.refresh(db_instance)
        
        # Params for singletons go to etl_job_parameter
        db_params = models.ETLJobParameter(
            job_definition_id=db_instance.id,
            config_json=instance.params_json or {},
            creat_by_nm=tenant_ctx.user.username
        )
        db.add(db_params)
        db.commit()
        
        return get_pipeline(db_instance.id, db, tenant_ctx, is_instance=False)

@router.get("/{instance_id}", response_model=schemas.JobInstance)
def get_pipeline(
    instance_id: str, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """Get pipeline instance by string ID (e.g. def_1 or inst_1)"""
    if instance_id.startswith("inst_"):
        actual_id = int(instance_id.replace("inst_", ""))
        # Blueprint Instance
        res = db.query(models.ETLJobInstance, models.ETLJobTemplate, models.ETLTeam, models.ETLOrg, models.ETLCodeLocation)\
            .join(models.ETLJobTemplate, models.ETLJobInstance.template_id == models.ETLJobTemplate.id)\
            .join(models.ETLTeam, models.ETLJobInstance.team_id == models.ETLTeam.id)\
            .join(models.ETLOrg, models.ETLJobInstance.org_id == models.ETLOrg.id)\
            .outerjoin(models.ETLCodeLocation, models.ETLJobInstance.code_location_id == models.ETLCodeLocation.id)\
            .filter(models.ETLJobInstance.id == actual_id).first()
        
        if not res: raise HTTPException(status_code=404, detail="Instance not found")
        ji, jt, team, org, cl = res
        data = schemas.JobInstance.model_validate(ji)
        data.id = f"inst_{ji.id}"
        data.job_nm = ji.instance_nm
        data.template_nm = jt.template_nm
        data.yaml_def = jt.yaml_def
        data.params_schema = jt.params_schema
        data.asset_selection = jt.asset_selection
        data.team_nm = team.team_nm
        data.org_code = org.org_code
        data.location_nm = cl.location_nm if cl else None
        data.schedule_display = ji.cron_schedule or "Manual"
        return data
    else:
        actual_id = int(instance_id.replace("def_", "")) if instance_id.startswith("def_") else int(instance_id)
        # Singleton
        res = db.query(models.ETLJobDefinition, models.ETLTeam, models.ETLOrg, models.ETLCodeLocation)\
            .join(models.ETLTeam, models.ETLJobDefinition.team_id == models.ETLTeam.id)\
            .join(models.ETLOrg, models.ETLJobDefinition.org_id == models.ETLOrg.id)\
            .outerjoin(models.ETLCodeLocation, models.ETLJobDefinition.code_location_id == models.ETLCodeLocation.id)\
            .filter(models.ETLJobDefinition.id == actual_id).first()
        
        if not res: raise HTTPException(status_code=404, detail="Singleton not found")
        jd, team, org, cl = res
        data = schemas.JobInstance.model_validate(jd)
        data.id = f"def_{jd.id}"
        data.job_nm = jd.job_nm
        data.team_nm = team.team_nm
        data.org_code = org.org_code
        data.location_nm = cl.location_nm if cl else None
        
        # Fetch params from etl_job_parameter
        params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.job_definition_id == jd.id).first()
        data.params_json = params.config_json if params else {}
        
        return data

@router.put("/{instance_id}", response_model=schemas.JobInstance)
def update_pipeline(
    instance_id: str, 
    update_data: schemas.JobInstanceUpdate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update pipeline instance (Blueprint Instance or Singleton)"""
    if instance_id.startswith("inst_"):
        actual_id = int(instance_id.replace("inst_", ""))
        db_instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == actual_id).first()
        if not db_instance: raise HTTPException(status_code=404, detail="Instance not found")
        
        dump = update_data.model_dump(exclude_unset=True)
        if "instance_id" in dump:
            db_instance.instance_nm = dump.pop("instance_id")
        
        for key, value in dump.items():
            if hasattr(db_instance, key):
                setattr(db_instance, key, value)
    else:
        actual_id = int(instance_id.replace("def_", "")) if instance_id.startswith("def_") else int(instance_id)
        db_instance = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == actual_id).first()
        if not db_instance: raise HTTPException(status_code=404, detail="Singleton not found")
        
        dump = update_data.model_dump(exclude_unset=True)
        if "instance_id" in dump:
            db_instance.job_nm = dump.pop("instance_id")

        for key, value in dump.items():
            if hasattr(db_instance, key):
                setattr(db_instance, key, value)
    
    db_instance.updt_by_nm = tenant_ctx.user.username
    db_instance.updt_dttm = datetime.utcnow()
    db.commit()
    
    return get_pipeline(instance_id, db, tenant_ctx)

@router.delete("/{instance_id}")
def delete_pipeline(
    instance_id: str, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete pipeline instance"""
    if instance_id.startswith("inst_"):
        actual_id = int(instance_id.replace("inst_", ""))
        db_instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == actual_id).first()
    else:
        actual_id = int(instance_id.replace("def_", "")) if instance_id.startswith("def_") else int(instance_id)
        db_instance = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == actual_id).first()
        
    if not db_instance:
        raise HTTPException(status_code=404, detail="Pipeline Instance not found")
    
    db.delete(db_instance)
    db.commit()
    return {"message": "Pipeline instance deleted successfully"}

# Parameter management endpoints
@router.get("/{job_id}/params", response_model=schemas.JobParameter)
def get_pipeline_params(
    job_id: str, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get pipeline parameters"""
    if job_id.startswith("inst_"):
        actual_id = int(job_id.replace("inst_", ""))
        instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == actual_id).first()
        if not instance: raise HTTPException(status_code=404, detail="Instance not found")
        return {"job_definition_id": job_id, "config_json": instance.params_json or {}, "id": 0}
    else:
        actual_id = int(job_id.replace("def_", "")) if job_id.startswith("def_") else int(job_id)
        params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.job_definition_id == actual_id).first()
        if not params:
            raise HTTPException(status_code=404, detail="Parameters not found for this pipeline")
        return params

@router.put("/{id}/params", response_model=schemas.JobParameter)
def update_pipeline_params(
    id: str, 
    params: Dict[str, Any], 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """
    Update pipeline instance parameters with JSON Schema validation.
    """
    if id.startswith("inst_"):
        actual_id = int(id.replace("inst_", ""))
        instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == actual_id).first()
        if not instance: raise HTTPException(status_code=404, detail="Instance not found")
        
        # Validation against template schema
        template = db.query(models.ETLJobTemplate).filter(models.ETLJobTemplate.id == instance.template_id).first()
        if template and template.params_schema:
            validate_params_against_schema(params, template.params_schema)
            
        instance.params_json = params
        instance.updt_by_nm = tenant_ctx.user.username
        instance.updt_dttm = datetime.utcnow()
        db.commit()
        
        return {"job_definition_id": id, "config_json": params, "id": 0}
    else:
        actual_id = int(id.replace("def_", "")) if id.startswith("def_") else int(id)
        instance = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == actual_id).first()
        if not instance: raise HTTPException(status_code=404, detail="Singleton not found")
        
        if instance.params_schema:
            validate_params_against_schema(params, instance.params_schema)
        
        db_params = db.query(models.ETLJobParameter).filter(models.ETLJobParameter.job_definition_id == actual_id).first()
        if not db_params:
            db_params = models.ETLJobParameter(job_definition_id=actual_id, config_json=params, creat_by_nm=tenant_ctx.user.username)
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
    id: str, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """
    Get the JSON Schema for this pipeline instance's parameters.
    """
    if id.startswith("inst_"):
        actual_id = int(id.replace("inst_", ""))
        instance = db.query(models.ETLJobInstance).filter(models.ETLJobInstance.id == actual_id).first()
        if not instance: raise HTTPException(status_code=404, detail="Instance not found")
        
        template = db.query(models.ETLJobTemplate).filter(models.ETLJobTemplate.id == instance.template_id).first()
        if template and template.params_schema:
            return template.params_schema
    else:
        actual_id = int(id.replace("def_", "")) if id.startswith("def_") else int(id)
        instance = db.query(models.ETLJobDefinition).filter(models.ETLJobDefinition.id == actual_id).first()
        if not instance:
            raise HTTPException(status_code=404, detail="Pipeline Singleton not found")
        
        # Check for direct schema on definition
        if instance.params_schema:
            return instance.params_schema
            
        # Fallback to template schema if applicable
        if instance.template_id:
            template = db.query(models.ETLJobTemplate).filter(models.ETLJobTemplate.id == instance.template_id).first()
            if template and template.params_schema:
                return template.params_schema
            
    raise HTTPException(status_code=404, detail="Schema not found for this pipeline")
