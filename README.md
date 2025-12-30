# Nexus Control: Metadata-Driven ETL Dashboard

A production-grade ETL management platform with **zero hard-coded UI fields**. All forms are dynamically generated from JSON Schemas stored in the database.

## Quick Start

### Backend (FastAPI)
```bash
cd backend
pip install -e .
python -m app.main
```
API will be available at `http://localhost:8000`

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
UI will be available at `http://localhost:5173`

## Architecture

### Backend
- **FastAPI** with modular routers
- **SQLAlchemy** ORM for database access
- **Pydantic** for validation
- **JSON Schema** validation for runtime parameters

### Frontend
- **React + TypeScript**
- **React Router** for navigation
- **@rjsf/core** for dynamic form generation
- **Framer Motion** for animations

## Key Features

### 🔥 Dynamic Form Generation
Forms are auto-generated from `etl_param_schema` JSON schemas. No hard-coded fields.

```tsx
<DynamicFormRenderer pipelineId={123} />
```

### 📊 Real-Time Monitoring
Live job status tracking with filtering and search.

### 🔒 JSON Schema Validation
Parameters are validated both client-side and server-side against registered schemas.

### 🎨 Modern UI
Glassmorphism design with dark theme and smooth animations.

## API Endpoints

### Pipelines
- `GET /api/v1/pipelines` - List all pipelines
- `GET /api/v1/pipelines/{id}` - Get pipeline details
- `PUT /api/v1/pipelines/{id}/params` - Update parameters (validated)
- `GET /api/v1/pipelines/{id}/schema` - Get JSON Schema for form generation

### Connections
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE /api/v1/connections`

### Schedules
- Full CRUD: `GET`, `POST`, `PUT`, `DELETE /api/v1/schedules`

### Schemas
- `GET /api/v1/schemas` - List all schemas
- `POST /api/v1/schemas` - Register new schema
- `GET /api/v1/schemas/by-job/{job_nm}` - Get schema by job name

### Status (Read-Only)
- `GET /api/v1/status/summary` - Dashboard statistics
- `GET /api/v1/status/jobs` - Job execution history
- `GET /api/v1/status/jobs/{btch_nbr}/assets` - Asset lineage

## Database Tables

### Onboarding (CRUD)
- `etl_connection` - Data source/target credentials
- `etl_schedule` - Cron-based schedules
- `etl_param_schema` - JSON Schema definitions
- `etl_job_parameter` - Runtime configuration

### Reporting (Read-Only)
- `etl_job_status` - Batch execution history
- `etl_asset_status` - Asset-level lineage events

## Development

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## Production Deployment

1. Set environment variables in `backend/.env`
2. Build frontend: `npm run build`
3. Serve with reverse proxy (nginx/caddy)
4. Use gunicorn/uvicorn for backend

## License

MIT