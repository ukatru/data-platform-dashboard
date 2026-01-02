from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import sys

sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

@router.get("", response_model=schemas.PaginatedResponse[schemas.Schedule])
def list_schedules(
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """List schedules scoped by organization and authorized teams"""
    query = db.query(models.ETLSchedule, models.ETLTeam.team_nm, models.ETLOrg.org_code)\
        .join(models.ETLTeam, models.ETLSchedule.team_id == models.ETLTeam.id)\
        .join(models.ETLOrg, models.ETLSchedule.org_id == models.ETLOrg.id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLSchedule.org_id == tenant_ctx.org_id)
        
    # If a specific team is focused, filter by that team. 
    # Otherwise, filter by ALL teams the user belongs to (unless Platform Admin)
    if tenant_ctx.team_id:
        query = query.filter(models.ETLSchedule.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLSchedule.team_id.in_(user_team_ids))
        
    if search:
        query = query.filter(models.ETLSchedule.slug.ilike(f"%{search}%"))

    total_count = query.count()
    results = query.order_by(models.ETLSchedule.creat_dttm.desc()).offset(offset).limit(limit).all()
    schedules = []
    for s, team_nm, org_code in results:
        s.team_nm = team_nm
        s.org_code = org_code
        schedules.append(s)

    return {
        "items": schedules,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }

@router.post("", response_model=schemas.Schedule, status_code=status.HTTP_201_CREATED)
def create_schedule(
    sched_in: schemas.ScheduleCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Create a new schedule scoped to the user's organization and a target team"""
    org_id = tenant_ctx.org_id or sched_in.org_id
    if org_id is None:
        raise HTTPException(status_code=400, detail="Organization ID is required")
        
    # Ensure user has permission for the TARGET team
    if sched_in.team_id and not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=sched_in.team_id):
        raise HTTPException(status_code=403, detail=f"You do not have permission to create schedules for Team ID {sched_in.team_id}")

    db_sched = models.ETLSchedule(
        **sched_in.model_dump(exclude={"org_id"}), 
        org_id=org_id,
        creat_by_nm=tenant_ctx.user.username
    )
    db.add(db_sched)
    db.commit()
    db.refresh(db_sched)
    return db_sched

@router.get("/{sched_id}", response_model=schemas.Schedule)
def get_schedule(
    sched_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context)
):
    """Get schedule by ID with tenant check"""
    query = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id)
    
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLSchedule.org_id == tenant_ctx.org_id)
        
    sched = query.first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
        
    return sched

@router.put("/{sched_id}", response_model=schemas.Schedule)
def update_schedule(
    sched_id: int, 
    sched_update: schemas.ScheduleCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Update schedule with tenant check"""
    query = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLSchedule.org_id == tenant_ctx.org_id)
        
    db_sched = query.first()
    if not db_sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    # Check permission for the owning team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=db_sched.team_id):
        raise HTTPException(status_code=403, detail="Access denied to update this schedule")

    for key, value in sched_update.model_dump(exclude_unset=True).items():
        setattr(db_sched, key, value)
    
    db_sched.updt_by_nm = tenant_ctx.user.username
    db.commit()
    db.refresh(db_sched)
    return db_sched

@router.delete("/{sched_id}")
def delete_schedule(
    sched_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_EDIT_PIPELINES))
):
    """Delete schedule with tenant check"""
    query = db.query(models.ETLSchedule).filter(models.ETLSchedule.id == sched_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLSchedule.org_id == tenant_ctx.org_id)
        
    db_sched = query.first()
    if not db_sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Check permission for the owning team
    if not tenant_ctx.has_permission(auth.Permission.CAN_EDIT_PIPELINES, team_id=db_sched.team_id):
        raise HTTPException(status_code=403, detail="Access denied to delete this schedule")
    
    db.delete(db_sched)
    db.commit()
    return {"message": "Schedule deleted successfully"}
