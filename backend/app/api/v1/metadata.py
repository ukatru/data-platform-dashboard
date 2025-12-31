from typing import Dict, List
from fastapi import Depends, APIRouter
from ... import schemas
from ...core import auth
from metadata_framework import models

router = APIRouter()

# Define column metadata for each table
PIPELINE_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="job_nm", label="Job Name", data_type="string", visible=True, sortable=True, width="250px"),
    schemas.ColumnMetadata(name="instance_id", label="Instance ID", data_type="string", visible=True, sortable=True, render_hint="code", width="150px"),
    schemas.ColumnMetadata(name="schedule", label="Schedule", data_type="string", visible=True, sortable=True, width="180px"),
    schemas.ColumnMetadata(name="partition_start_dt", label="Partition Start", data_type="datetime", visible=False, sortable=True),
    schemas.ColumnMetadata(name="actv_ind", label="Active", data_type="boolean", visible=True, sortable=True, render_hint="badge", width="100px"),
    schemas.ColumnMetadata(name="creat_dttm", label="Created", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="120px"),
    schemas.ColumnMetadata(name="team_nm", label="Team", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="org_code", label="Org", data_type="string", visible=False, sortable=True, width="80px"),
]

JOB_DEFINITION_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="job_nm", label="Job Name", data_type="string", visible=True, sortable=True, render_hint="link", width="250px"),
    schemas.ColumnMetadata(name="description", label="Description", data_type="string", visible=True, sortable=True, width="350px"),
    schemas.ColumnMetadata(name="yaml_def", label="Definition", data_type="json", visible=True, sortable=False, render_hint="link", width="120px"),
    schemas.ColumnMetadata(name="asset_selection", label="Assets", data_type="json", visible=True, sortable=False, render_hint="badge", width="200px"),
    schemas.ColumnMetadata(name="creat_dttm", label="Discovered", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="150px"),
    schemas.ColumnMetadata(name="team_nm", label="Team Owner", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="repo_url", label="Source URL", data_type="string", visible=True, sortable=True, render_hint="external_link", width="250px"),
    schemas.ColumnMetadata(name="org_code", label="Org", data_type="string", visible=False, sortable=True, width="80px"),
]

SCHEDULE_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="slug", label="Slug", data_type="string", visible=True, sortable=True, width="200px"),
    schemas.ColumnMetadata(name="team_nm", label="Team", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="org_code", label="Org", data_type="string", visible=False, sortable=True, width="80px"),
    schemas.ColumnMetadata(name="cron", label="Cron Expression", data_type="string", visible=True, sortable=True, render_hint="code", width="200px"),
    schemas.ColumnMetadata(name="timezone", label="Timezone", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="actv_ind", label="Status", data_type="boolean", visible=True, sortable=True, render_hint="badge", width="100px"),
    schemas.ColumnMetadata(name="creat_dttm", label="Created", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="150px"),
]

CONNECTION_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="conn_nm", label="Name", data_type="string", visible=True, sortable=True, render_hint="link", width="300px"),
    schemas.ColumnMetadata(name="conn_type", label="Type", data_type="string", visible=True, sortable=True, render_hint="badge", width="150px"),
    schemas.ColumnMetadata(name="team_nm", label="Team", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="org_code", label="Org", data_type="string", visible=False, sortable=True, width="80px"),
    schemas.ColumnMetadata(name="creat_dttm", label="Created", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="200px"),
]

STATUS_COLUMNS = [
    schemas.ColumnMetadata(name="btch_nbr", label="Batch #", data_type="integer", visible=True, sortable=True, width="80px"),
    schemas.ColumnMetadata(name="job_nm", label="Job Name", data_type="string", visible=True, sortable=True, width="200px"),
    schemas.ColumnMetadata(name="run_id", label="Run ID", data_type="string", visible=True, sortable=True, render_hint="code", width="300px"),
    schemas.ColumnMetadata(name="btch_sts_cd", label="Status", data_type="string", visible=True, sortable=True, render_hint="badge", width="120px"),
    schemas.ColumnMetadata(name="run_mde_txt", label="Mode", data_type="string", visible=False, sortable=True),
    schemas.ColumnMetadata(name="strt_dttm", label="Start Time", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="180px"),
    schemas.ColumnMetadata(name="end_dttm", label="End Time", data_type="datetime", visible=False, sortable=True, render_hint="datetime"),
]

SCHEMA_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="job_nm", label="Job Name", data_type="string", visible=True, sortable=True, render_hint="link", width="250px"),
    schemas.ColumnMetadata(name="team_nm", label="Team", data_type="string", visible=True, sortable=True, width="120px"),
    schemas.ColumnMetadata(name="org_code", label="Org", data_type="string", visible=False, sortable=True, width="80px"),
    schemas.ColumnMetadata(name="description", label="Description", data_type="string", visible=True, sortable=True, width="300px"),
    schemas.ColumnMetadata(name="json_schema", label="Schema", data_type="json", visible=False, sortable=False, render_hint="json"),
    schemas.ColumnMetadata(name="is_strict", label="Strict", data_type="boolean", visible=False, sortable=True, render_hint="badge"),
    schemas.ColumnMetadata(name="creat_dttm", label="Created", data_type="datetime", visible=True, sortable=True, render_hint="datetime", width="150px"),
]

@router.get("/pipelines", response_model=schemas.TableMetadata)
def get_pipeline_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for pipelines table"""
    return schemas.TableMetadata(
        table_name="pipelines",
        columns=PIPELINE_COLUMNS,
        primary_key="id"
    )

@router.get("/schedules", response_model=schemas.TableMetadata)
def get_schedule_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for schedules table"""
    return schemas.TableMetadata(
        table_name="schedules",
        columns=SCHEDULE_COLUMNS,
        primary_key="id"
    )

@router.get("/connections", response_model=schemas.TableMetadata)
def get_connection_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for connections table"""
    return schemas.TableMetadata(
        table_name="connections",
        columns=CONNECTION_COLUMNS,
        primary_key="id"
    )

@router.get("/status", response_model=schemas.TableMetadata)
def get_status_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for status table"""
    return schemas.TableMetadata(
        table_name="status",
        columns=STATUS_COLUMNS,
        primary_key="btch_nbr"
    )

@router.get("/schemas", response_model=schemas.TableMetadata)
def get_schema_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for schemas table"""
    return schemas.TableMetadata(
        table_name="schemas",
        columns=SCHEMA_COLUMNS,
        primary_key="id"
    )

@router.get("/jobs", response_model=schemas.TableMetadata)
def get_job_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for job definitions table"""
    return schemas.TableMetadata(
        table_name="jobs",
        columns=JOB_DEFINITION_COLUMNS,
        primary_key="id"
    )

# Repository (Code Location) columns
REPOSITORY_COLUMNS = [
    schemas.ColumnMetadata(name="id", label="ID", data_type="integer", visible=False, sortable=True),
    schemas.ColumnMetadata(name="location_nm", label="Repository", data_type="string", visible=True, sortable=True, render_hint="link", width="250px"),
    schemas.ColumnMetadata(name="team_nm", label="Team Owner", data_type="string", visible=True, sortable=True, width="150px"),
    schemas.ColumnMetadata(name="repo_url", label="URL", data_type="string", visible=True, sortable=True, render_hint="external_link", width="300px"),
    schemas.ColumnMetadata(name="creat_dttm", label="Created", data_type="datetime", visible=True, sortable=True, width="150px"),
]

@router.get("/repositories", response_model=schemas.TableMetadata)
def get_repository_metadata(current_user: models.ETLUser = Depends(auth.require_analyst)):
    """Get column metadata for repositories table"""
    return schemas.TableMetadata(
        table_name="repositories",
        columns=REPOSITORY_COLUMNS,
        primary_key="id"
    )
