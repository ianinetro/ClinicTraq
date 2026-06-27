#!/bin/bash
# ClinicTraq deployment script — run from your Azure VM
# Prerequisites on the VM:
#   - Azure CLI (az) installed and logged in: az login
#   - Node.js 20+ installed
#   - Python 3.11+ installed
#   - wrangler installed globally: npm install -g wrangler (for Cloudflare Pages)
#
# Usage:
#   ./deploy.sh                  # deploy both backend and frontend
#   ./deploy.sh --backend-only
#   ./deploy.sh --frontend-only

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Configuration — edit these or set as env vars ────────────────────────────
AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-clinictraq-rg}"
AZURE_WEBAPP_NAME="${AZURE_WEBAPP_NAME:-clinictraq-api}"
VITE_API_URL="${VITE_API_URL:-https://${AZURE_WEBAPP_NAME}.azurewebsites.net/api/v1}"
CF_PROJECT_NAME="${CF_PROJECT_NAME:-clinictraq}"
# ─────────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }

DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
for arg in "$@"; do
  case $arg in
    --backend-only)  DEPLOY_FRONTEND=false ;;
    --frontend-only) DEPLOY_BACKEND=false ;;
  esac
done

# ── Deploy backend to Azure App Service ──────────────────────────────────────
deploy_backend() {
  info "Building backend zip package..."
  cd "$REPO_ROOT/backend"

  # Let Azure install dependencies via Oryx build (do NOT bundle .packages)
  # Create zip using Python — source code only, no vendor packages
  python3 - <<'PYEOF'
import zipfile, os
root = os.getcwd()
out = "/tmp/clinictraq-backend.zip"
skip_ext = {".pyc", ".pyo"}
skip_dirs = {"__pycache__", ".pytest_cache", "tests", ".venv", ".git", ".packages"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if os.path.splitext(fn)[1] in skip_ext:
                continue
            full = os.path.join(dirpath, fn)
            arcname = os.path.relpath(full, root)
            zf.write(full, arcname)
print(f"Created {out} ({os.path.getsize(out)//1024}KB)")
PYEOF

  info "Configuring Azure App Service: $AZURE_WEBAPP_NAME"
  # SCM_DO_BUILD_DURING_DEPLOYMENT=true tells Oryx to run pip install on the server
  az webapp config appsettings set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    --output none

  info "Setting startup command..."
  az webapp config set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --startup-file "bash startup.sh" \
    --output none

  info "Deploying via Kudu ZIP API..."
  # Fetch publishing credentials
  CREDS=$(az webapp deployment list-publishing-credentials \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --query "{u:publishingUserName,p:publishingPassword}" \
    --output json)
  # Write to netrc so curl doesn't expand the $ in the username
  NETRC_FILE=$(mktemp)
  python3 - "$NETRC_FILE" "$AZURE_WEBAPP_NAME" <<PYEOF
import sys, json
netrc_path, app = sys.argv[1], sys.argv[2]
d = json.loads("""${CREDS}""")
with open(netrc_path, 'w') as f:
    f.write(f"machine {app}.scm.azurewebsites.net\n")
    f.write(f"login {d['u']}\n")
    f.write(f"password {d['p']}\n")
import os; os.chmod(netrc_path, 0o600)
PYEOF

  SCM_HOST="${AZURE_WEBAPP_NAME}.scm.azurewebsites.net"

  # Use the Kudu ZIP deploy endpoint (more reliable than az webapp deploy)
  HTTP_STATUS=$(curl -s -o /tmp/deploy_response.txt -w "%{http_code}" \
    -X POST \
    --netrc-file "$NETRC_FILE" \
    -H "Content-Type: application/zip" \
    --data-binary @/tmp/clinictraq-backend.zip \
    "https://${SCM_HOST}/api/zipdeploy?isAsync=true")

  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "202" ]]; then
    info "Deployment submitted (HTTP $HTTP_STATUS). Waiting for Oryx build to finish..."
    # Poll deployment status
    for i in $(seq 1 30); do
      sleep 10
      STATUS_JSON=$(curl -s --netrc-file "$NETRC_FILE" \
        "https://${SCM_HOST}/api/deployments/latest")
      DEPLOY_STATUS=$(echo "$STATUS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status', 0))" 2>/dev/null || echo "0")
      DEPLOY_MSG=$(echo "$STATUS_JSON"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status_text',''))" 2>/dev/null || echo "")
      info "  [$i/30] status=$DEPLOY_STATUS $DEPLOY_MSG"
      # status 4 = success, status 3 = failed
      if [[ "$DEPLOY_STATUS" == "4" ]]; then
        info "Oryx build and deployment succeeded."
        break
      elif [[ "$DEPLOY_STATUS" == "3" ]]; then
        error "Deployment failed. Check https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/api/deployments/latest for logs."
      fi
    done
  else
    cat /tmp/deploy_response.txt
    error "Kudu ZIP deploy returned HTTP $HTTP_STATUS"
  fi

  rm -f /tmp/clinictraq-backend.zip /tmp/deploy_response.txt "$NETRC_FILE"
  info "Backend deployed."
}

# ── Deploy frontend to Cloudflare Pages ──────────────────────────────────────
deploy_frontend() {
  info "Building frontend..."
  cd "$REPO_ROOT/frontend"

  npm ci --quiet
  VITE_API_URL="$VITE_API_URL" npm run build

  info "Deploying to Cloudflare Pages: $CF_PROJECT_NAME"
  npx wrangler pages deploy dist \
    --project-name "$CF_PROJECT_NAME" \
    --commit-dirty=true

  info "Frontend deployed."
}

# ── Run ──────────────────────────────────────────────────────────────────────
info "ClinicTraq deployment starting..."

if [[ "$DEPLOY_BACKEND" == "true" ]]; then
  command -v az &>/dev/null || error "Azure CLI not found. Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
  deploy_backend
fi

if [[ "$DEPLOY_FRONTEND" == "true" ]]; then
  command -v node &>/dev/null || error "Node.js not found. Install Node.js 20+."
  deploy_frontend
fi

info "Deployment complete."
