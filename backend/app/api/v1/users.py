from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ...core.database import get_db
from ...core import auth
from ... import schemas
from metadata_framework import models

router = APIRouter()

@router.get("", response_model=List[schemas.User])
def list_users(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    query = db.query(models.ETLUser)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLUser.org_id == tenant_ctx.org_id)
    return query.all()

@router.post("", response_model=schemas.User)
def create_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    # Enforce Org ID from context if not System Admin
    org_id = user_in.org_id
    if tenant_ctx.org_id is not None:
        org_id = tenant_ctx.org_id # Force to user's org

    # Check if user exists
    existing = db.query(models.ETLUser).filter(models.ETLUser.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    db_user = models.ETLUser(
        username=user_in.username,
        hashed_password=auth.get_password_hash(user_in.password),
        full_nm=user_in.full_nm,
        email=user_in.email,
        role_id=user_in.role_id,
        org_id=org_id,
        actv_ind=user_in.actv_ind,
        creat_by_nm=current_user.username
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    db_user = db.query(models.ETLUser).filter(models.ETLUser.id == user_id)
    
    # Enforce Tenant Boundary
    if current_user.org_id is not None:
        db_user = db_user.filter(models.ETLUser.org_id == current_user.org_id)
        
    db_user = db_user.first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data:
        db_user.hashed_password = auth.get_password_hash(update_data["password"])
        del update_data["password"]
        
    for field, value in update_data.items():
        setattr(db_user, field, value)
        
    db_user.updt_by_nm = current_user.username
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/roles", response_model=List[schemas.Role])
def list_roles(
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    return db.query(models.ETLRole).filter(models.ETLRole.actv_ind == True).all()

@router.post("/me/password")
def change_password(
    pwd_in: schemas.UserPasswordChange,
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.get_current_user)
):
    if not auth.verify_password(pwd_in.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    current_user.hashed_password = auth.get_password_hash(pwd_in.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
