#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
#
# Oryx extracts output.tar.zst to /tmp/<hash>/ at runtime.
# main.py, domains/, alembic.ini, and antenv/ all live in that extracted dir.
# NEVER cd to /home/site/wwwroot — source files are NOT there at runtime.

# Work from the directory containing this script (the Oryx-extracted app dir)
cd "$(dirname "${BASH_SOURCE[0]}")"
APP_DIR="$(pwd)"

# Activate the Oryx-built virtualenv (always in antenv/ alongside this script)
if [[ -f "$APP_DIR/antenv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "$APP_DIR/antenv/bin/activate"
fi

# Add app dir to PYTHONPATH so uvicorn can import main.py and domains/
export PYTHONPATH="$APP_DIR:${PYTHONPATH:-}"

# Run migrations with timeout (non-fatal — app starts even if DB is unavailable)
timeout 60 alembic upgrade head || echo "WARNING: alembic upgrade failed — continuing startup"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
