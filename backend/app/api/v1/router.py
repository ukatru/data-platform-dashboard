from fastapi import APIRouter
from . import connections, schedules, schemas_router, pipelines, jobs, status, metadata, connections_metadata, auth, users, management, reports, repositories

api_router = APIRouter()

# Authentication & Users
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])

# Include all sub-routers
api_router.include_router(metadata.router, prefix="/metadata", tags=["Metadata"])
api_router.include_router(connections_metadata.router, prefix="/metadata/connections", tags=["Connection Metadata"])
api_router.include_router(connections.router, prefix="/connections", tags=["Connections"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["Schedules"])
api_router.include_router(schemas_router.router, prefix="/blueprints", tags=["Blueprints"])
api_router.include_router(pipelines.router, prefix="/pipelines", tags=["Pipelines"])
api_router.include_router(repositories.router, prefix="/repositories", tags=["Repositories"])
api_router.include_router(status.router, prefix="/status", tags=["Status"])
api_router.include_router(management.router, prefix="/management", tags=["Management"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])

@api_router.get("/")
def health_check():
    return {
        "status": "ok",
        "version": "v1",
        "message": "Nexus Control API"
    }
