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

@router.get("/", response_model=List[schemas.ParamsSchema])
def list_schemas(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all parameter schemas for the current organization"""
    query = db.query(models.ETLParamsSchema)
    if tenant_ctx.org_id is not None:
        # Filter schemas belonging to repositories within the user's organization
        query = query.join(models.ETLCodeLocation).join(models.ETLTeam)\
            .filter(models.ETLTeam.org_id == tenant_ctx.org_id)
    return query.all()

@router.post("/", response_model=schemas.ParamsSchema, status_code=status.HTTP_201_CREATED)
def create_schema(
    schema: schemas.ParamsSchemaCreate, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Register a new parameter schema"""
    db_schema = models.ETLParamsSchema(**schema.model_dump(), creat_by_nm=current_user.username)
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
    code_location_id: int,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get schema by job name and code location"""
    schema = db.query(models.ETLParamsSchema).filter(
        models.ETLParamsSchema.job_nm == job_nm,
        models.ETLParamsSchema.code_location_id == code_location_id
    ).first()
    
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema for job '{job_nm}' in code location {code_location_id} not found")
    return schema
