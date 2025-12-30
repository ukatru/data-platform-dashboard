from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
from .core.config import settings
from .api.v1.router import api_router

# Inject framework paths
sys.path.append(settings.DAG_FACTORY_SRC)
sys.path.append(settings.METADATA_FRAMEWORK_SRC)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Nexus Control API Server",
        "docs": "/docs",
        "api": "/api/v1"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
