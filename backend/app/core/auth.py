from datetime import datetime, timedelta
import hashlib
import bcrypt
from typing import Optional, Any, Union
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from ..core.config import settings
from ..core.database import get_db
# Framework models are injected in main.py, but we can import them directly here if sys.path is set
from metadata_framework import models

# We use bcrypt directly because passlib 1.7.4 has bugs with bcrypt 4.0+
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password, hashed_password):
    # Pre-hash with SHA-256 to handle bcrypt 72-char limit consistently
    password_hash = hashlib.sha256(plain_password.encode()).hexdigest().encode()
    return bcrypt.checkpw(password_hash, hashed_password.encode('utf-8'))

def get_password_hash(password):
    # Pre-hash with SHA-256 to handle bcrypt 72-char limit consistently
    password_hash = hashlib.sha256(password.encode()).hexdigest().encode()
    hashed = bcrypt.hashpw(password_hash, bcrypt.gensalt(rounds=12))
    return hashed.decode('utf-8')

class Permission:
    CAN_VIEW_LOGS = "CAN_VIEW_LOGS"
    CAN_EDIT_PIPELINES = "CAN_EDIT_PIPELINES"
    CAN_MANAGE_CONNECTIONS = "CAN_MANAGE_CONNECTIONS"
    CAN_MANAGE_TEAMS = "CAN_MANAGE_TEAMS"
    CAN_MANAGE_USERS = "CAN_MANAGE_USERS"
    PLATFORM_ADMIN = "PLATFORM_ADMIN"

def get_role_permissions(role_nm: str) -> set[str]:
    """Map roles to granular permissions based on the RACI matrix"""
    # Global Roles
    if role_nm == "DPE_PLATFORM_ADMIN":
        return {
            Permission.CAN_VIEW_LOGS, Permission.CAN_EDIT_PIPELINES,
            Permission.CAN_MANAGE_CONNECTIONS, Permission.CAN_MANAGE_TEAMS,
            Permission.CAN_MANAGE_USERS, Permission.PLATFORM_ADMIN
        }
    
    # Team Scoped Roles (mapped from names or types)
    if "_LEAD" in role_nm:
        return {
            Permission.CAN_VIEW_LOGS, Permission.CAN_EDIT_PIPELINES,
            Permission.CAN_MANAGE_CONNECTIONS, Permission.CAN_MANAGE_USERS
        }
    if "_RW" in role_nm or role_nm == "DPE_DEVELOPER":
        return {
            Permission.CAN_VIEW_LOGS, Permission.CAN_EDIT_PIPELINES
        }
    if "_READER" in role_nm or role_nm == "DPE_DATA_ANALYST":
        return {
            Permission.CAN_VIEW_LOGS
        }
        
    return {Permission.CAN_VIEW_LOGS} # Default safe role

class TenantContext:
    def __init__(self, user: models.ETLUser, payload: dict):
        self.user = user
        self.org_id = user.org_id
        self.org_code = payload.get("org_code")
        
        # The 'active' focus (team_id) from payload
        self.team_id = payload.get("team_id") or getattr(user, "default_team_id", None)
        
        # Store global permissions (from primary role)
        self.global_permissions = get_role_permissions(user.role.role_nm)
        
        # Map team_id -> set of permissions for all memberships
        self.team_permissions: dict[int, set[str]] = {}
        for membership in getattr(user, "team_memberships", []):
            if membership.actv_ind:
                self.team_permissions[membership.team_id] = get_role_permissions(membership.role.role_nm)

    def has_permission(self, permission: str, team_id: Optional[int] = None) -> bool:
        """
        Check if user has permission.
        If team_id is provided, checks if user has that permission IN THAT SPECIFIC TEAM.
        Otherwise, checks global permissions OR if they have it in ANY team (for broad visibility).
        PLATFORM_ADMIN always returns True.
        """
        if Permission.PLATFORM_ADMIN in self.global_permissions:
            return True
            
        # Global permission check
        if team_id is None:
            # Does the user have this globally?
            if permission in self.global_permissions:
                return True
            # Or do they have it in ANY of their teams? (Useful for 'CAN_VIEW_LOGS' in unified view)
            for team_perms in self.team_permissions.values():
                if permission in team_perms:
                    return True
            return False
            
        # Scoped permission check
        scoped_perms = self.team_permissions.get(team_id)
        if scoped_perms and permission in scoped_perms:
            return True
            
        return False

async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> models.ETLUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.ETLUser).filter(models.ETLUser.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.actv_ind:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

async def get_tenant_context(
    current_user: models.ETLUser = Depends(get_current_user),
    token: str = Depends(oauth2_scheme),
    x_team_id: Optional[str] = Header(None, alias="X-Team-Id")
) -> TenantContext:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if x_team_id:
            payload["team_id"] = int(x_team_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except ValueError:
        pass # Ignore malformed header
    
    return TenantContext(user=current_user, payload=payload)

def require_permission(required_permission: str):
    async def permission_checker(tenant_ctx: TenantContext = Depends(get_tenant_context)):
        if not tenant_ctx.has_permission(required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {required_permission}"
            )
        return tenant_ctx
    return permission_checker

def require_role(allowed_roles: list[str]):
    async def role_checker(current_user: models.ETLUser = Depends(get_current_user)):
        # Join with role to get the name
        if current_user.role.role_nm not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have sufficient permissions to perform this action"
            )
        return current_user
    return role_checker

# Dependency Shorthands
require_admin = require_permission(Permission.PLATFORM_ADMIN)
require_developer = require_permission(Permission.CAN_EDIT_PIPELINES)
require_analyst = require_permission(Permission.CAN_VIEW_LOGS)
