from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime

# Base schemas with audit fields
class AuditBase(BaseModel):
    creat_by_nm: str
    creat_dttm: datetime
    updt_by_nm: Optional[str] = None
    updt_dttm: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Column metadata for dynamic table rendering
class ColumnMetadata(BaseModel):
    name: str
    label: str
    data_type: Literal["string", "integer", "boolean", "datetime", "json"]
    visible: bool = True
    sortable: bool = True
    filterable: bool = False
    render_hint: Optional[Literal["text", "code", "badge", "datetime", "json", "link"]] = None
    width: Optional[str] = None  # e.g., "200px", "auto"

class TableMetadata(BaseModel):
    table_name: str
    columns: List[ColumnMetadata]
    primary_key: str

# Connection schemas
class ConnectionBase(BaseModel):
    conn_nm: str
    conn_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    config_json: Dict[str, Any] = {}

class ConnectionCreate(ConnectionBase):
    password: Optional[str] = None

class Connection(ConnectionBase, AuditBase):
    id: int

# Schedule schemas
class ScheduleBase(BaseModel):
    slug: str
    cron: str
    timezone: Optional[str] = "UTC"
    actv_ind: bool = True

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase, AuditBase):
    id: int

# Connection Type Schema
class ConnTypeSchemaBase(BaseModel):
    conn_type: str
    json_schema: Dict[str, Any]
    description: Optional[str] = None

class ConnTypeSchemaCreate(ConnTypeSchemaBase):
    pass

class ConnTypeSchema(ConnTypeSchemaBase, AuditBase):
    id: int

# Parameter Schema (JSON Schema Registry)
class ParamsSchemaBase(BaseModel):
    job_nm: str
    json_schema: Dict[str, Any]
    description: Optional[str] = None

class ParamsSchemaCreate(ParamsSchemaBase):
    pass

class ParamsSchema(ParamsSchemaBase, AuditBase):
    id: int

# Job schemas
class JobBase(BaseModel):
    job_nm: str
    invok_id: str
    source_conn_nm: Optional[str] = None
    target_conn_nm: Optional[str] = None
    schedule_id: Optional[int] = None
    cron_schedule: Optional[str] = None
    partition_start_dt: Optional[datetime] = None
    actv_ind: Optional[bool] = True

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    source_conn_nm: Optional[str] = None
    target_conn_nm: Optional[str] = None
    schedule_id: Optional[int] = None
    cron_schedule: Optional[str] = None
    partition_start_dt: Optional[datetime] = None
    actv_ind: Optional[bool] = True

class Job(JobBase, AuditBase):
    id: int
    schedule: Optional[str] = None

# Job Parameter schemas
class JobParameterBase(BaseModel):
    etl_job_id: int
    config_json: Dict[str, Any]

class JobParameterCreate(JobParameterBase):
    pass

class JobParameter(JobParameterBase, AuditBase):
    id: int

# Status schemas (Read-only)
class JobStatus(BaseModel):
    btch_nbr: int
    job_nm: str
    run_id: str
    btch_sts_cd: str
    run_mde_txt: Optional[str] = None
    strt_dttm: datetime
    end_dttm: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class AssetStatus(BaseModel):
    id: int
    btch_nbr: int
    asset_nm: str
    asset_sts_cd: str
    dagster_event_type: Optional[str] = None
    err_msg_txt: Optional[str] = None
    
    class Config:
        from_attributes = True

# Summary stats for dashboard
class SummaryStats(BaseModel):
    connections: int
    jobs: int
    schedules: int
    active_runs: int
    failed_today: int
    last_sync: datetime
