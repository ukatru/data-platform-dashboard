from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from metadata_framework import models
from ...core.database import get_db
from ...core import auth
from ... import schemas

router = APIRouter()

# Standard Connection Schemas
STANDARD_SCHEMAS = {
    "PostgreSQL": {
        "type": "object",
        "required": ["host", "user", "password", "database"],
        "properties": {
            "host": {"type": "string", "title": "Host"},
            "port": {"type": "integer", "title": "Port", "default": 5432},
            "user": {"type": "string", "title": "Username"},
            "password": {"type": "string", "title": "Password", "format": "password"},
            "database": {"type": "string", "title": "Database Name"},
        }
    },
    "Snowflake": {
        "type": "object",
        "required": ["account", "user", "warehouse", "database"],
        "properties": {
            "account": {"type": "string", "title": "Account Identifier"},
            "user": {"type": "string", "title": "Username"},
            "password": {"type": "string", "title": "Password", "format": "password"},
            "warehouse": {"type": "string", "title": "Warehouse"},
            "database": {"type": "string", "title": "Database"},
            "schema": {"type": "string", "title": "Schema", "default": "PUBLIC"},
            "role": {"type": "string", "title": "Role"},
            "private_key": {"type": "string", "title": "Private Key (PEM)", "format": "textarea"},
            "private_key_passphrase": {"type": "string", "title": "PK Passphrase", "format": "password"},
        }
    },
    "S3": {
        "type": "object",
        "required": ["region_name"],
        "properties": {
            "region_name": {"type": "string", "title": "AWS Region", "default": "us-east-1"},
            "bucket_name": {"type": "string", "title": "Default Bucket"},
            "aws_access_key_id": {"type": "string", "title": "Access Key ID"},
            "aws_secret_access_key": {"type": "string", "title": "Secret Access Key", "format": "password"},
            "endpoint_url": {"type": "string", "title": "Custom Endpoint URL (Minio/Localstack)"},
        }
    },
    "SFTP": {
        "type": "object",
        "required": ["host", "username"],
        "properties": {
            "host": {"type": "string", "title": "SFTP Host"},
            "port": {"type": "integer", "title": "Port", "default": 22},
            "username": {"type": "string", "title": "Username"},
            "password": {"type": "string", "title": "Password", "format": "password"},
            "private_key": {"type": "string", "title": "Private Key (B64)", "format": "textarea"},
            "key_type": {
                "type": "string", 
                "title": "Key Type", 
                "enum": ["RSA", "ECDSA", "ED25519"], 
                "default": "RSA"
            },
        }
    },
    "SQLServer": {
        "type": "object",
        "required": ["host", "database"],
        "properties": {
            "host": {"type": "string", "title": "Host"},
            "port": {"type": "integer", "title": "Port", "default": 1433},
            "user": {"type": "string", "title": "Username"},
            "password": {"type": "string", "title": "Password", "format": "password"},
            "database": {"type": "string", "title": "Database Name"},
            "driver": {"type": "string", "title": "ODBC Driver", "default": "ODBC Driver 18 for SQL Server"},
            "encrypt": {"type": "boolean", "title": "Encrypt", "default": True},
            "trust_server_certificate": {"type": "boolean", "title": "Trust Server Cert", "default": True},
        }
    }
}

@router.get("/types", response_model=List[schemas.ConnTypeSchema])
def list_connection_types(
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all registered connection types and their schemas"""
    return db.query(models.ETLConnTypeSchema).all()

@router.get("/types/{conn_type}", response_model=schemas.ConnTypeSchema)
def get_connection_type_schema(
    conn_type: str, 
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get schema for a specific connection type"""
    schema = db.query(models.ETLConnTypeSchema).filter(models.ETLConnTypeSchema.conn_type == conn_type).first()
    if not schema:
        # Check if it's a standard one we can seed
        if conn_type in STANDARD_SCHEMAS:
            db_schema = models.ETLConnTypeSchema(
                conn_type=conn_type,
                json_schema=STANDARD_SCHEMAS[conn_type],
                description=f"Standard schema for {conn_type} connections",
                creat_by_nm="SYSTEM"
            )
            db.add(db_schema)
            db.commit()
            db.refresh(db_schema)
            return db_schema
        raise HTTPException(status_code=404, detail=f"Connection type {conn_type} not found")
    return schema

@router.post("/seed", status_code=status.HTTP_201_CREATED)
def seed_standard_schemas(
    db: Session = Depends(get_db),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    """Seed the database with standard connection schemas"""
    seeded = []
    for ctype, sjson in STANDARD_SCHEMAS.items():
        existing = db.query(models.ETLConnTypeSchema).filter(models.ETLConnTypeSchema.conn_type == ctype).first()
        if not existing:
            db_schema = models.ETLConnTypeSchema(
                conn_type=ctype,
                json_schema=sjson,
                description=f"Standard schema for {ctype} connections",
                creat_by_nm="SYSTEM"
            )
            db.add(db_schema)
            seeded.append(ctype)
    db.commit()
    return {"message": f"Seeded {len(seeded)} schemas", "seeded": seeded}
