#!/bin/bash
# Azure App Service startup — packages are bundled in .packages/ inside the zip.
# No Oryx antenv extraction needed.

cd /home/site/wwwroot
export PYTHONPATH="/home/site/wwwroot/.packages:/home/site/wwwroot:${PYTHONPATH:-}"

echo "[startup] python=$(python3 --version 2>&1)"
echo "[startup] uvicorn=$(python3 -m uvicorn --version 2>&1)"

exec python3 -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
