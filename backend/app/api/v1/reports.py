import csv
import io
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ...core.database import get_db
from ...core import auth
from metadata_framework import models

router = APIRouter()

@router.get("/access-matrix")
def get_access_matrix(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    """
    Generates a flattened, long-format report of all users and their entitlements.
    Auditors prefer this row-per-grant format.
    """
    # Filter users by organization
    users = db.query(models.ETLUser).filter(models.ETLUser.org_id == tenant_ctx.org_id).all()
    
    report_data = []
    
    for user in users:
        # 1. Global Role Row
        global_role_nm = user.role.role_nm if user.role else "USER"
        report_data.append({
            "Employee": user.full_nm,
            "Username": user.username,
            "Email": user.email or "",
            "Scope Type": "Global",
            "Scope Name": "Platform",
            "Assigned Role": global_role_nm,
            "Effective Level": "Admin" if "ADMIN" in global_role_nm else "Viewer" if "VIEWER" in global_role_nm else "User"
        })
        
        # 2. Team Membership Rows
        for membership in user.team_memberships:
            if membership.actv_ind:
                role_nm = membership.role.role_nm
                level = "Write" if "_RW" in role_nm or "_LEAD" in role_nm else "Read"
                report_data.append({
                    "Employee": user.full_nm,
                    "Username": user.username,
                    "Email": user.email or "",
                    "Scope Type": "Team",
                    "Scope Name": membership.team.team_nm,
                    "Assigned Role": role_nm,
                    "Effective Level": level
                })
                
    return report_data

@router.get("/access-matrix/csv")
def export_access_matrix_csv(
    db: Session = Depends(get_db),
    tenant_ctx: auth.TenantContext = Depends(auth.get_tenant_context),
    current_user: models.ETLUser = Depends(auth.require_admin)
):
    """Export the Access Matrix as a flattened CSV file."""
    data = get_access_matrix(db, tenant_ctx, current_user)
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["Employee", "Username", "Email", "Scope Type", "Scope Name", "Assigned Role", "Effective Level"])
    writer.writeheader()
    writer.writerows(data)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=access_matrix_{tenant_ctx.org_id}.csv"}
    )
