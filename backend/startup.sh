#!/bin/bash
# Azure App Service startup script.
# Packages are installed by Oryx during deployment into antenv/.
# Azure activates antenv before running this via appCommandLine.

cd /home/site/wwwroot

exec python3 -m uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
