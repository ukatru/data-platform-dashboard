from datetime import datetime, timedelta
import hashlib
import bcrypt
from typing import Optional, Any, Union
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
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
require_admin = require_role(["DPE_PLATFORM_ADMIN"])
require_developer = require_role(["DPE_PLATFORM_ADMIN", "DPE_DEVELOPER"])
require_analyst = require_role(["DPE_PLATFORM_ADMIN", "DPE_DEVELOPER", "DPE_DATA_ANALYST"])
