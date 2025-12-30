from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ... import schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.ParamsSchema])
def list_schemas(db: Session = Depends(get_db)):
    """List all parameter schemas"""
    return db.query(models.ETLParamsSchema).all()

@router.post("/", response_model=schemas.ParamsSchema, status_code=status.HTTP_201_CREATED)
def create_schema(schema: schemas.ParamsSchemaCreate, db: Session = Depends(get_db)):
    """Register a new parameter schema"""
    db_schema = models.ETLParamsSchema(**schema.model_dump(), creat_by_nm="DASHBOARD")
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    return db_schema

@router.get("/{schema_id}", response_model=schemas.ParamsSchema)
def get_schema(schema_id: int, db: Session = Depends(get_db)):
    """Get schema by ID"""
    schema = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    return schema

@router.get("/by-job/{job_nm}", response_model=schemas.ParamsSchema)
def get_schema_by_job(job_nm: str, db: Session = Depends(get_db)):
    """Get schema by job name"""
    schema = db.query(models.ETLParamsSchema).filter(models.ETLParamsSchema.job_nm == job_nm).first()
    if not schema:
        raise HTTPException(status_code=404, detail=f"Schema for job '{job_nm}' not found")
    return schema
