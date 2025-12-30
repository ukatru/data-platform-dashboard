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

@router.get("/", response_model=List[schemas.Schedule])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all schedules"""
    return db.query(models.ETLSchedule).all()

@router.post("/", response_model=schemas.Schedule, status_code=status.HTTP_201_CREATED)
def create_schedule(
    sched: schemas.ScheduleCreate, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Create a new schedule"""
    db_sched = models.ETLSchedule(**sched.model_dump(), creat_by_nm=current_user.username)
    db.add(db_sched)
    db.commit()
    db.refresh(db_sched)
    return db_sched

@router.get("/{sched_id}", response_model=schemas.Schedule)
def get_schedule(
    sched_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get schedule by ID"""
    sched = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return sched

@router.put("/{sched_id}", response_model=schemas.Schedule)
def update_schedule(
    sched_id: int, 
    sched_update: schemas.ScheduleCreate, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Update schedule"""
    db_sched = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id).first()
    if not db_sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    for key, value in sched_update.model_dump(exclude_unset=True).items():
        setattr(db_sched, key, value)
    
    db_sched.updt_by_nm = current_user.username
    db.commit()
    db.refresh(db_sched)
    return db_sched

@router.delete("/{sched_id}")
def delete_schedule(
    sched_id: int, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_developer)
):
    """Delete schedule"""
    db_sched = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id).first()
    if not db_sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    db.delete(db_sched)
    db.commit()
    return {"message": "Schedule deleted successfully"}
