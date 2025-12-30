from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from ...core.database import get_db
from ...core import auth
from ...core.config import settings
from ... import schemas
from metadata_framework import models

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
def login_for_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    user = db.query(models.ETLUser).filter(models.ETLUser.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.actv_ind:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Enrich token with organization context
    token_data = {
        "sub": user.username,
        "org_id": user.org_id,
        "org_code": user.org.org_code if user.org else None
    }
    
    access_token = auth.create_access_token(
        data=token_data, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(
    current_user: models.ETLUser = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Calculate aggregated permissions (Legacy/Unified view support)
    all_perms = auth.get_role_permissions(current_user.role.role_nm)
    
    # Calculate scoped permissions map
    team_perms_map: dict[int, list[str]] = {}
    
    for membership in current_user.team_memberships:
        if membership.actv_ind:
            role_perms = auth.get_role_permissions(membership.role.role_nm)
            team_perms_map[membership.team_id] = list(role_perms)
            all_perms.update(role_perms)
    
    # Attach to user object for Pydantic serialization
    current_user.permissions = list(all_perms)
    current_user.team_permissions = team_perms_map
    return current_user
