#!/bin/sh
# Diagnostic startup: test imports first so errors appear in containerStream.log
# before gunicorn forks workers (where output can be lost on fast crash).
echo "=== ClinicTraq container starting ===" >&2
python -c "
import sys, traceback
print('Python', sys.version, file=sys.stderr)
try:
    import main
    print('Imports OK', file=sys.stderr)
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
"
echo "=== Starting gunicorn ===" >&2
exec gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --workers "${WEB_WORKERS:-2}" \
    --timeout 120 \
    --preload \
    --access-logfile - \
    --error-logfile - \
    --log-level debug
