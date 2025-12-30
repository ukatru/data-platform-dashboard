from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

@router.get("/summary", response_model=schemas.SummaryStats)
def get_summary(
    team_id: Optional[int] = None,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_VIEW_LOGS))
):
    """Get summary statistics filtered by organization and optionally team"""
    conn_query = db.query(models.ETLConnection)
    job_query = db.query(models.ETLJob)
    status_query = db.query(models.ETLJobStatus)
    
    # 1. Base Org Filtering
    if tenant_ctx.org_id is not None:
        conn_query = conn_query.filter(models.ETLConnection.org_id == tenant_ctx.org_id)
        job_query = job_query.filter(models.ETLJob.org_id == tenant_ctx.org_id)
        status_query = status_query.filter(models.ETLJobStatus.org_id == tenant_ctx.org_id)

    # 2. Team Filtering (Implicit or Explicit)
    effective_team_id = team_id or tenant_ctx.team_id
    
    if effective_team_id:
        conn_query = conn_query.filter(models.ETLConnection.team_id == effective_team_id)
        job_query = job_query.filter(models.ETLJob.team_id == effective_team_id)
        status_query = status_query.filter(models.ETLJobStatus.team_id == effective_team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        # If not an admin and no specific team selected, show only teams the user belongs to
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        conn_query = conn_query.filter(models.ETLConnection.team_id.in_(user_team_ids))
        job_query = job_query.filter(models.ETLJob.team_id.in_(user_team_ids))
        status_query = status_query.filter(models.ETLJobStatus.team_id.in_(user_team_ids))

    conn_count = conn_query.count()
    job_count = job_query.count()
    sched_count = db.query(models.ETLSchedule).count() # TODO: Add team filtering to schedules
    
    # Operational stats
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    active_runs = status_query.filter(models.ETLJobStatus.btch_sts_cd == 'R').count()
    failed_today = status_query.filter(
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
    team_id: Optional[int] = None,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_VIEW_LOGS))
):
    """
    Get job execution history with filtering and tenant isolation.
    """
    query = db.query(models.ETLJobStatus)
    
    # 1. Base Org Filtering
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLJobStatus.org_id == tenant_ctx.org_id)
    
    # 2. Team Filtering
    effective_team_id = team_id or tenant_ctx.team_id
    if effective_team_id:
        query = query.filter(models.ETLJobStatus.team_id == effective_team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLJobStatus.team_id.in_(user_team_ids))
    
    if job_nm:
        query = query.filter(models.ETLJobStatus.job_nm.ilike(f"%{job_nm}%"))
    if sts_cd:
        query = query.filter(models.ETLJobStatus.btch_sts_cd == sts_cd)
    
    return query.order_by(models.ETLJobStatus.strt_dttm.desc()).limit(limit).all()

@router.get("/jobs/{btch_nbr}/assets", response_model=List[schemas.AssetStatus])
def get_batch_assets(
    btch_nbr: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_VIEW_LOGS))
):
    """
    Get asset-level events for a specific batch with tenant validation.
    """
    # Verify access to batch
    batch_query = db.query(models.ETLJobStatus).filter(models.ETLJobStatus.btch_nbr == btch_nbr)
    if tenant_ctx.org_id is not None:
        batch_query = batch_query.filter(models.ETLJobStatus.org_id == tenant_ctx.org_id)
        
    if not batch_query.first():
        raise HTTPException(status_code=403, detail="Access denied to this batch")

    return db.query(models.ETLAssetStatus).filter(
        models.ETLAssetStatus.btch_nbr == btch_nbr
    ).all()
