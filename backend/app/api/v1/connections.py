from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import sys
import logging
import socket
from datetime import datetime

# Add framework paths
sys.path.append("/home/ukatru/github/dagster-dag-factory/src")
sys.path.append("/home/ukatru/github/dagster-metadata-framework/src")

from metadata_framework import models
from ... import schemas
from ...core.database import get_db
from ...core import auth
from ...core.secrets import process_secrets_on_save, mask_secrets_on_retrieval, resolve_secrets

# Import resources for testing
from dagster_dag_factory.resources.postgres import PostgresResource
from dagster_dag_factory.resources.snowflake import SnowflakeResource
from dagster_dag_factory.resources.s3 import S3Resource
from dagster_dag_factory.resources.sftp import SFTPResource
from dagster_dag_factory.resources.sqlserver import SQLServerResource

logger = logging.getLogger(__name__)

router = APIRouter()

class DiagnosticTracer:
    def __init__(self):
        self.logs = []
    
    def add_step(self, name: str, status: str = "running", message: str = ""):
        self.logs.append({
            "step": name,
            "status": status,
            "message": message,
            "timestamp": datetime.now().isoformat()
        })
    
    def update_last(self, status: str, message: str = ""):
        if self.logs:
            self.logs[-1]["status"] = status
            if message:
                self.logs[-1]["message"] = message

@router.get("/", response_model=List[schemas.Connection])
def list_connections(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """List all connections for the current organization"""
    query = db.query(models.ETLConnection, models.ETLTeam.team_nm, models.ETLOrg.org_code)\
        .join(models.ETLTeam, models.ETLConnection.team_id == models.ETLTeam.id)\
        .join(models.ETLOrg, models.ETLConnection.org_id == models.ETLOrg.id)
        
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLConnection.org_id == tenant_ctx.org_id)
    
    # Team Filtering
    if tenant_ctx.team_id:
        query = query.filter(models.ETLConnection.team_id == tenant_ctx.team_id)
    elif not tenant_ctx.has_permission(auth.Permission.PLATFORM_ADMIN):
        user_team_ids = [m.team_id for m in tenant_ctx.user.team_memberships if m.actv_ind]
        query = query.filter(models.ETLConnection.team_id.in_(user_team_ids))
    
    results = query.all()
    conns = []
    for c, team_nm, org_code in results:
        # Mask secrets
        c.config_json = mask_secrets_on_retrieval(c.config_json)
        # Use a temporary dict to add the fields for Pydantic validation if returning whole objects
        # Or better, iterate and set attributes if SQLAlchemy allows it on detached objects or just return dicts
        # Since the response model is List[schemas.Connection], Pydantic will handle it if we provide objects with these attrs.
        c.team_nm = team_nm
        c.org_code = org_code
        conns.append(c)
    return conns

@router.post("/", response_model=schemas.Connection, status_code=status.HTTP_201_CREATED)
def create_connection(
    conn: schemas.ConnectionCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_CONNECTIONS))
):
    """Create a new connection scoped to the current organization"""
    # Enforce Org ID from context if not System Admin
    org_id = conn.org_id
    if tenant_ctx.org_id is not None:
        org_id = tenant_ctx.org_id
    # process secrets
    processed_config = process_secrets_on_save(conn.conn_nm, conn.config_json)
    
    db_conn = models.ETLConnection(
        conn_nm=conn.conn_nm,
        conn_type=conn.conn_type,
        config_json=processed_config,
        org_id=org_id,
        team_id=conn.team_id or tenant_ctx.team_id,
        owner_type=conn.owner_type,
        owner_id=conn.owner_id,
        creat_by_nm=current_user.username
    )
    db.add(db_conn)
    db.commit()
    db.refresh(db_conn)
    # Mask for response
    db_conn.config_json = mask_secrets_on_retrieval(db_conn.config_json)
    return db_conn

@router.get("/{conn_id}", response_model=schemas.Connection)
def get_connection(
    conn_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_analyst)
):
    """Get connection by ID with tenant check"""
    query = db.query(models.ETLConnection).filter(models.ETLConnection.id == conn_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLConnection.org_id == tenant_ctx.org_id)
        
    conn = query.first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    # Mask secrets
    conn.config_json = mask_secrets_on_retrieval(conn.config_json)
    return conn

@router.put("/{conn_id}", response_model=schemas.Connection)
def update_connection(
    conn_id: int, 
    conn_update: schemas.ConnectionCreate, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_CONNECTIONS))
):
    """Update connection with tenant check"""
    query = db.query(models.ETLConnection).filter(models.ETLConnection.id == conn_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLConnection.org_id == tenant_ctx.org_id)
        
    db_conn = query.first()
    if not db_conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # process secrets
    processed_config = process_secrets_on_save(conn_update.conn_nm, conn_update.config_json)
    
    db_conn.conn_nm = conn_update.conn_nm
    db_conn.conn_type = conn_update.conn_type
    db_conn.config_json = processed_config
    db_conn.updt_by_nm = tenant_ctx.user.username
    
    db.commit()
    db.refresh(db_conn)
    # Mask for response
    db_conn.config_json = mask_secrets_on_retrieval(db_conn.config_json)
    return db_conn

def _check_host_infrastructure(tracer, host, port):
    """Helper to perform DNS and Port checks before auth."""
    if not host:
        return True
    
    try:
        # Phase 1: DNS Resolution
        tracer.add_step("DNS Resolution", "running", f"Resolving hostname '{host}'...")
        ip = socket.gethostbyname(host)
        tracer.update_last("success", f"Resolved to IP: {ip}")
        
        # Phase 2: Port Availability
        tracer.add_step("Port Availability", "running", f"Checking if port {port} is open at {host}...")
        with socket.create_connection((host, port), timeout=5):
            tracer.update_last("success", f"Port {port} is open and reachable")
        
        return True
    except socket.gaierror:
        tracer.update_last("error", f"Could not resolve hostname '{host}'. Please check DNS settings.")
        return False
    except (socket.timeout, ConnectionRefusedError):
        tracer.update_last("error", f"Connection timed out or refused on port {port}. Check firewall/security groups.")
        return False
    except Exception as e:
        tracer.update_last("error", f"Infrastructure check failed: {str(e)}")
        return False

def _perform_connection_test(conn_type: str, config: dict, conn_nm: str = "New Connection"):
    """
    Internal helper to execute the actual connection test with verbose logging.
    """
    tracer = DiagnosticTracer()
    
    try:
        if conn_type == "PostgreSQL":
            host = config.get("host")
            port = config.get("port", 5432)
            
            if not _check_host_infrastructure(tracer, host, port):
                return {"status": "error", "message": "Infrastructure check failed", "logs": tracer.logs}

            tracer.add_step("PostgreSQL Authentication", "running", f"Authenticating as {config.get('user')}...")
            resource = PostgresResource(**config)
            with resource.get_connection() as conn:
                tracer.update_last("success", f"Authenticated successfully to database '{config.get('database')}'")
                
                tracer.add_step("Metadata Probe", "running", "Executing health check (SELECT 1)...")
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                tracer.update_last("success", "Query executed successfully")
            
            return {"status": "success", "message": "All checks passed", "logs": tracer.logs}

        elif conn_type == "SQLServer":
            host = config.get("host")
            port = config.get("port", 1433)
            
            if not _check_host_infrastructure(tracer, host, port):
                return {"status": "error", "message": "Infrastructure check failed", "logs": tracer.logs}

            tracer.add_step("SQL Server Authentication", "running", f"Authenticating as {config.get('user')}...")
            resource = SQLServerResource(**config)
            with resource.get_connection() as conn:
                tracer.update_last("success", f"Authenticated successfully to database '{config.get('database')}'")
                
                tracer.add_step("Metadata Probe", "running", "Executing health check (SELECT 1)...")
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                tracer.update_last("success", "Query executed successfully")
            
            return {"status": "success", "message": "All checks passed", "logs": tracer.logs}

        elif conn_type == "Snowflake":
            # DNS/Port check for Snowflake (host is account.region.snowflakecomputing.com usually)
            host = f"{config.get('account')}.snowflakecomputing.com"
            if not _check_host_infrastructure(tracer, host, 443):
                return {"status": "error", "message": "Infrastructure check failed", "logs": tracer.logs}

            # Map UI fields to Resource Aliases
            mapping = {"schema": "schema_"}
            mapped_config = {mapping.get(k, k): v for k, v in config.items()}
            
            tracer.add_step("Snowflake Authentication", "running", f"Authenticating as {mapped_config.get('user')}...")
            resource = SnowflakeResource(**mapped_config)
            with resource.get_connection() as conn:
                tracer.update_last("success", f"Authenticated successfully")
                
                tracer.add_step("Session Context", "running", "Validating query execution...")
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                tracer.update_last("success", "Session established successfully")
            
            return {"status": "success", "message": "All checks passed", "logs": tracer.logs}

        elif conn_type == "S3":
            endpoint_url = config.get("endpoint_url")
            if endpoint_url:
                from urllib.parse import urlparse
                parsed = urlparse(endpoint_url)
                host = parsed.hostname
                port = parsed.port or (443 if parsed.scheme == "https" else 80)
                
                if not _check_host_infrastructure(tracer, host, port):
                    return {"status": "error", "message": "MinIO/Localstack endpoint unreachable", "logs": tracer.logs}

            # Map UI fields to Resource Aliases (to avoid modifying base.py)
            mapping = {
                "aws_access_key_id": "access_key",
                "aws_secret_access_key": "secret_key",
                "aws_session_token": "session_token"
            }
            mapped_config = {mapping.get(k, k): v for k, v in config.items()}

            tracer.add_step("S3 Identity Check", "running", f"Validating credentials{' against ' + endpoint_url if endpoint_url else ' against AWS'}...")
            resource = S3Resource(**mapped_config)
            client = resource.get_client()
            client.list_buckets()
            tracer.update_last("success", "Credentials validated (Bucket list retrieved)")
            
            return {"status": "success", "message": "All checks passed", "logs": tracer.logs}

        elif conn_type == "SFTP":
            host = config.get("host")
            port = config.get("port", 22)
            
            if not _check_host_infrastructure(tracer, host, port):
                return {"status": "error", "message": "Infrastructure check failed", "logs": tracer.logs}

            tracer.add_step("SSH Authentication", "running", f"Authenticating as {config.get('username')}...")
            resource = SFTPResource(**config)
            with resource.get_client() as conn:
                tracer.update_last("success", "Secure authentication established")
                
                tracer.add_step("Filesystem Probe", "running", "Probing directory permissions...")
                conn.listdir(".")
                tracer.update_last("success", "Directory list successful")
            
            return {"status": "success", "message": "All checks passed", "logs": tracer.logs}

        else:
            tracer.add_step("Implementation Check", "warning", f"Testing not implemented for {conn_type}")
            return {"status": "warning", "message": "No test implementation", "logs": tracer.logs}

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Test failed: {error_msg}")
        tracer.update_last("error", error_msg)
        return {"status": "error", "message": error_msg, "logs": tracer.logs}

@router.post("/test-raw")
def test_raw_connection(
    conn: schemas.ConnectionCreate,
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_CONNECTIONS))
):
    """
    Stateless connection test before saving.
    """
    return _perform_connection_test(conn.conn_type, conn.config_json, conn.conn_nm)

@router.post("/{conn_id}/test")
def test_connection(
    conn_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_CONNECTIONS))
):
    """
    Test an existing connection.
    """
    conn = db.query(models.ETLConnection).filter(models.ETLConnection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Resolve secrets
    resolved_config = resolve_secrets(conn.conn_nm, conn.config_json)
    
    return _perform_connection_test(conn.conn_type, resolved_config, conn.conn_nm)

@router.delete("/{conn_id}")
def delete_connection(
    conn_id: int, 
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.require_permission(auth.Permission.CAN_MANAGE_CONNECTIONS))
):
    """Delete connection with tenant check"""
    query = db.query(models.ETLConnection).filter(models.ETLConnection.id == conn_id)
    if tenant_ctx.org_id is not None:
        query = query.filter(models.ETLConnection.org_id == tenant_ctx.org_id)
        
    db_conn = query.first()
    if not db_conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    db.delete(db_conn)
    db.commit()
    return {"message": "Connection deleted successfully"}
