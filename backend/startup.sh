#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
# Oryx extracts antenv to /tmp/<hash>/antenv; source files stay in /home/site/wwwroot.

# Always work from wwwroot (alembic.ini and main.py live here)
cd /home/site/wwwroot

# Activate the Oryx-built virtualenv so alembic/uvicorn are on PATH
ANTENV=$(find /tmp -maxdepth 2 -name "activate" -path "*/antenv/*" 2>/dev/null | head -1)
if [[ -n "$ANTENV" ]]; then
    # shellcheck source=/dev/null
    source "$ANTENV"
fi

# Ensure Python can import main.py from wwwroot regardless of Oryx PYTHONPATH
export PYTHONPATH="/home/site/wwwroot:${PYTHONPATH:-}"

# Run migrations (non-fatal)
alembic upgrade head || echo "WARNING: alembic upgrade failed — continuing startup"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
