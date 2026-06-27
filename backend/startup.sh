#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend
#
# Oryx architecture:
#   - output.tar.zst extracted to /tmp/<hash>/ — contains ONLY antenv (the virtualenv)
#   - Python source files (main.py, domains/, alembic.ini…) stay at /home/site/wwwroot/
#
# So: activate antenv from /tmp, then work from /home/site/wwwroot.

# Find and activate the Oryx-built antenv in the extracted temp dir
ANTENV=$(find /tmp -maxdepth 5 -name "activate" -path "*/antenv/bin/*" 2>/dev/null | head -1)
if [[ -n "$ANTENV" ]]; then
    # shellcheck source=/dev/null
    source "$ANTENV"
    echo "[startup] activated antenv: $ANTENV"
else
    echo "[startup] WARNING: antenv not found in /tmp"
fi

# Source files live at /home/site/wwwroot (the ZIP extraction root)
cd /home/site/wwwroot

# Add wwwroot to PYTHONPATH so uvicorn can import main.py and the domains/ package
export PYTHONPATH="/home/site/wwwroot:${PYTHONPATH:-}"

echo "[startup] CWD=$(pwd) PYTHONPATH=$PYTHONPATH"

# Run migrations with timeout (non-fatal — app starts even if DB is unavailable at boot)
timeout 60 alembic upgrade head && echo "[startup] migrations ok" || echo "[startup] WARNING: alembic failed — continuing"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
