#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
# Oryx extracts the build + antenv to a temp dir; source files stay in /home/site/wwwroot.
# We must cd to wwwroot (where alembic.ini and main.py live) and activate the antenv.

cd /home/site/wwwroot

# Activate the virtualenv Oryx built (antenv location varies; find it)
ANTENV=$(find /tmp -maxdepth 2 -name "activate" -path "*/antenv/*" 2>/dev/null | head -1)
if [[ -n "$ANTENV" ]]; then
    # shellcheck source=/dev/null
    source "$ANTENV"
fi

# Run migrations (failures are non-fatal so the app still starts on schema errors)
alembic upgrade head || echo "WARNING: alembic upgrade failed — continuing startup"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
