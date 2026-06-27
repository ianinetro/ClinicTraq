#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
#
# Azure activates the Oryx-built antenv BEFORE running this script,
# so uvicorn/alembic/python are already on PATH.

set -e

echo "[startup] PATH=$PATH"
echo "[startup] which python=$(which python 2>/dev/null || echo NOT_FOUND)"
echo "[startup] which uvicorn=$(which uvicorn 2>/dev/null || echo NOT_FOUND)"

# Source files live at /home/site/wwwroot
cd /home/site/wwwroot
export PYTHONPATH="/home/site/wwwroot:${PYTHONPATH:-}"

echo "[startup] CWD=$(pwd) PYTHON=$(python --version 2>&1)"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
