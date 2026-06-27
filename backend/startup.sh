#!/bin/bash
# Azure App Service startup for ClinicTraq FastAPI backend

cd /home/site/wwwroot

# Activate Oryx-built virtualenv.
# Oryx places antenv in wwwroot after build; some versions put it in /tmp/<hash>/.
if [[ -f "/home/site/wwwroot/antenv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source "/home/site/wwwroot/antenv/bin/activate"
    echo "[startup] activated antenv from wwwroot"
else
    ANTENV=$(find /tmp /home/site -maxdepth 6 -name "activate" -path "*/antenv/bin/*" 2>/dev/null | head -1)
    if [[ -n "$ANTENV" ]]; then
        # shellcheck source=/dev/null
        source "$ANTENV"
        echo "[startup] activated antenv from $ANTENV"
    else
        echo "[startup] no antenv found — relying on system PATH"
    fi
fi

# Ensure Python can import main.py from wwwroot
export PYTHONPATH="/home/site/wwwroot:${PYTHONPATH:-}"

echo "[startup] python=$(command -v python3 2>/dev/null || command -v python) uvicorn=$(command -v uvicorn 2>/dev/null || echo NOT_FOUND)"

# Run migrations with timeout (non-fatal — app starts even if DB is unavailable at boot)
timeout 60 alembic upgrade head && echo "[startup] migrations ok" || echo "[startup] WARNING: alembic upgrade failed or timed out — continuing"

# Launch application
if command -v uvicorn &>/dev/null; then
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --workers "${WEB_WORKERS:-2}" \
        --proxy-headers \
        --forwarded-allow-ips='*'
else
    # Fallback: use python -m uvicorn (works when uvicorn is installed but not on PATH)
    echo "[startup] uvicorn not on PATH — using python -m uvicorn"
    exec python3 -m uvicorn main:app \
        --host 0.0.0.0 \
        --port "${PORT:-8000}" \
        --workers "${WEB_WORKERS:-2}" \
        --proxy-headers \
        --forwarded-allow-ips='*'
fi
