#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
cd /home/site/wwwroot
# Run Alembic migrations on startup
alembic upgrade head
# Start uvicorn on Azure's PORT (default 8000)
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_WORKERS:-2} --proxy-headers --forwarded-allow-ips='*'
