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
    render_hint: Optional[Literal["text", "code", "badge", "datetime", "json", "link", "external_link"]] = None
    width: Optional[str] = None  # e.g., "200px", "auto"

class TableMetadata(BaseModel):
    table_name: str
    columns: List[ColumnMetadata]
    primary_key: str

# SaaS Hierarchy Schemas
class OrgBase(BaseModel):
    org_nm: str
    org_code: str
    description: Optional[str] = None
    actv_ind: bool = True

class OrgCreate(OrgBase):
    pass

class Org(OrgBase, AuditBase):
    id: int

class TeamBase(BaseModel):
    org_id: Optional[int] = None
    team_nm: str
    description: Optional[str] = None
    actv_ind: bool = True

class TeamCreate(TeamBase):
    initial_code_location: Optional[str] = None # Repo URL
    initial_admin_id: Optional[int] = None # ID of the user to be assigned as TeamAdmin

class TeamUpdate(BaseModel):
    team_nm: Optional[str] = None
    description: Optional[str] = None
    actv_ind: Optional[bool] = None

class Team(TeamBase, AuditBase):
    id: int

class CodeLocationBase(BaseModel):
    team_id: int
    location_nm: str
    repo_url: Optional[str] = None

class CodeLocationCreate(CodeLocationBase):
    pass

class CodeLocationUpdate(BaseModel):
    location_nm: Optional[str] = None
    repo_url: Optional[str] = None

class CodeLocation(CodeLocationBase, AuditBase):
    id: int

# Connection schemas
class ConnectionBase(BaseModel):
    conn_nm: str
    conn_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    config_json: Dict[str, Any] = {}
    
    # Scoping
    org_id: Optional[int] = None
    team_id: Optional[int] = None
    owner_type: Optional[Literal["TEAM", "CODE_LOC"]] = None
    owner_id: Optional[int] = None

class ConnectionCreate(ConnectionBase):
    password: Optional[str] = None

class Connection(ConnectionBase, AuditBase):
    id: int
    team_nm: Optional[str] = None
    org_code: Optional[str] = None

# Schedule schemas
class ScheduleBase(BaseModel):
    slug: str
    cron: str
    timezone: Optional[str] = "UTC"
    actv_ind: bool = True
    org_id: Optional[int] = None
    team_id: Optional[int] = None

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase, AuditBase):
    id: int
    team_nm: Optional[str] = None
    org_code: Optional[str] = None

# Connection Type Schema
class ConnTypeSchemaBase(BaseModel):
    conn_type: str
    json_schema: Dict[str, Any]
    description: Optional[str] = None

class ConnTypeSchemaCreate(ConnTypeSchemaBase):
    pass

class ConnTypeSchema(ConnTypeSchemaBase, AuditBase):
    id: int

# Code Location (Repository) schemas
class CodeLocationBase(BaseModel):
    location_nm: str
    team_id: int
    repo_url: Optional[str] = None

class CodeLocationCreate(CodeLocationBase):
    pass

class CodeLocationUpdate(BaseModel):
    location_nm: Optional[str] = None
    repo_url: Optional[str] = None

class CodeLocation(CodeLocationBase, AuditBase):
    id: int
    team_nm: Optional[str] = None
    org_code: Optional[str] = None

    class Config:
        from_attributes = True

# Parameter Schema (JSON Schema Registry)
class ParamsSchemaBase(BaseModel):
    job_nm: str
    json_schema: Dict[str, Any]
    description: Optional[str] = None
    org_id: Optional[int] = None
    team_id: Optional[int] = None
    code_location_id: Optional[int] = None

class ParamsSchemaCreate(ParamsSchemaBase):
    pass

class ParamsSchema(ParamsSchemaBase, AuditBase):
    id: int
    team_nm: Optional[str] = None
    org_code: Optional[str] = None

# Job Definition schemas (Source of Truth)
class JobDefinitionBase(BaseModel):
    job_nm: str
    description: Optional[str] = None
    yaml_def: Optional[Dict[str, Any]] = None
    params_schema: Optional[Dict[str, Any]] = None
    asset_selection: Optional[List[str]] = None
    org_id: Optional[int] = None
    team_id: Optional[int] = None
    code_location_id: Optional[int] = None
    actv_ind: bool = True

class JobDefinition(JobDefinitionBase, AuditBase):
    id: int
    team_nm: Optional[str] = None
    org_code: Optional[str] = None
    location_nm: Optional[str] = None
    repo_url: Optional[str] = None

# Job Instance schemas (User Configured)
class JobInstanceBase(BaseModel):
    job_definition_id: int
    instance_id: str
    description: Optional[str] = None
    schedule_id: Optional[int] = None
    cron_schedule: Optional[str] = None
    partition_start_dt: Optional[datetime] = None
    actv_ind: bool = True

class JobInstanceCreate(JobInstanceBase):
    pass

class JobInstanceUpdate(BaseModel):
    description: Optional[str] = None
    schedule_id: Optional[int] = None
    cron_schedule: Optional[str] = None
    partition_start_dt: Optional[datetime] = None
    actv_ind: Optional[bool] = None

class JobInstance(JobInstanceBase, AuditBase):
    id: int
    job_nm: Optional[str] = None # Coalesced from definition for UI convenience
    schedule_display: Optional[str] = None
    team_nm: Optional[str] = None
    org_code: Optional[str] = None

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
    run_id: str
    org_id: Optional[int] = None
    team_id: Optional[int] = None
    job_nm: str
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

# RBAC Schemas
class RoleBase(BaseModel):
    role_nm: str
    description: Optional[str] = None
    actv_ind: bool = True

class Role(RoleBase):
    id: int
    team_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class TeamMemberBase(BaseModel):
    user_id: int
    team_id: int
    role_id: int
    actv_ind: bool = True

class TeamMemberCreate(TeamMemberBase):
    pass

class TeamMember(TeamMemberBase, AuditBase):
    id: int
    user: Optional['UserBase'] = None
    team: Optional['TeamBase'] = None
    role: Optional[Role] = None

class UserBase(BaseModel):
    username: str
    full_nm: str
    email: Optional[str] = None
    actv_ind: bool = True
    role_id: int
    org_id: Optional[int] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_nm: Optional[str] = None
    email: Optional[str] = None
    role_id: Optional[int] = None
    org_id: Optional[int] = None
    actv_ind: Optional[bool] = None
    password: Optional[str] = None

class User(UserBase, AuditBase):
    id: int
    role: Role
    org: Optional[Org] = None
    team_memberships: List[TeamMember] = []
    default_team_id: Optional[int] = None
    permissions: List[str] = []
    team_permissions: Dict[int, List[str]] = {}

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str
