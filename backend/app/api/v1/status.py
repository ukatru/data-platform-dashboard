from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ... import schemas

router = APIRouter()

@router.get("/summary", response_model=schemas.SummaryStats)
def get_summary(db: Session = Depends(get_db)):
    """Get summary statistics for the dashboard"""
    conn_count = db.query(models.ETLConnection).count()
    job_count = db.query(models.ETLJob).count()
    sched_count = db.query(models.ETLSchedule).count()
    
    # Operational stats
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    active_runs = db.query(models.ETLJobStatus).filter(models.ETLJobStatus.btch_sts_cd == 'R').count()
    failed_today = db.query(models.ETLJobStatus).filter(
        models.ETLJobStatus.btch_sts_cd == 'A',
        models.ETLJobStatus.end_dttm >= today_start
    ).count()
    
    return {
        "connections": conn_count,
        "jobs": job_count,
        "schedules": sched_count,
        "active_runs": active_runs,
        "failed_today": failed_today,
        "last_sync": now
    }

@router.get("/jobs", response_model=List[schemas.JobStatus])
def get_job_statuses(
    job_nm: Optional[str] = None,
    sts_cd: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db)
):
    """
    Get job execution history with filtering.
    Read-only endpoint for monitoring.
    """
    query = db.query(models.ETLJobStatus)
    
    if job_nm:
        query = query.filter(models.ETLJobStatus.job_nm.ilike(f"%{job_nm}%"))
    if sts_cd:
        query = query.filter(models.ETLJobStatus.btch_sts_cd == sts_cd)
    
    return query.order_by(models.ETLJobStatus.strt_dttm.desc()).limit(limit).all()

@router.get("/jobs/{btch_nbr}/assets", response_model=List[schemas.AssetStatus])
def get_batch_assets(btch_nbr: int, db: Session = Depends(get_db)):
    """
    Get asset-level events for a specific batch.
    Shows detailed lineage and error information.
    """
    return db.query(models.ETLAssetStatus).filter(
        models.ETLAssetStatus.btch_nbr == btch_nbr
    ).all()
