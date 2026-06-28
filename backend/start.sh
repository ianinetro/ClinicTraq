#!/bin/sh
# Diagnostic startup: test imports first. If they fail, start a fallback HTTP
# server on port 8000 so Azure's warmup probe succeeds and we can inspect via
# Kudu SSH or curl the error at /health. Container stays alive for 1 hour.
echo "=== ClinicTraq startup: $(date -u) ===" >&2

python -u - <<'PYEOF'
import sys, traceback

print("Python:", sys.version, flush=True)
print("Testing imports...", flush=True)

try:
    import main as _m
    print("Imports OK — app object:", _m.app, flush=True)
except Exception as exc:
    tb = traceback.format_exc()
    print("IMPORT ERROR:", tb, flush=True, file=sys.stderr)

    # Start a minimal HTTP server so Azure's warmup probe can succeed and we
    # can read the error via curl https://<app>.azurewebsites.net/health
    import http.server, threading, time, os

    body = (
        "IMPORT ERROR — container in diagnostic hold\n\n" + tb
    ).encode()

    class _H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body)
        def log_message(self, fmt, *args):
            print("HTTP:", fmt % args, flush=True)

    port = int(os.environ.get("WEBSITES_PORT", 8000))
    httpd = http.server.HTTPServer(("0.0.0.0", port), _H)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    print(f"Fallback server on :{port} — curl it to read the import error", flush=True)
    # Hold for 1 hour so Kudu SSH is available for inspection
    time.sleep(3600)
    sys.exit(1)
PYEOF

echo "=== Imports passed, starting gunicorn ===" >&2
exec gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    --bind "0.0.0.0:${WEBSITES_PORT:-8000}" \
    --workers "${WEB_WORKERS:-2}" \
    --timeout 120 \
    --preload \
    --access-logfile - \
    --error-logfile - \
    --log-level debug
