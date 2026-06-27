#!/bin/bash
# ClinicTraq deployment script — run from your Azure VM
# Prerequisites on the VM:
#   - Azure CLI (az) installed and logged in: az login
#   - Node.js 20+ installed
#   - Python 3.11+ installed (must match Azure App Service runtime)
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
  cd "$REPO_ROOT/backend"

  # Install Python packages into .packages/ so they ship inside the zip.
  # This avoids Oryx's output.tar.zst which takes >230s to extract at container start.
  info "Installing Python packages into .packages/ (this takes ~1-2 min)..."
  rm -rf .packages
  pip install -r requirements.txt --target .packages --quiet --upgrade

  info "Building backend zip package..."
  python3 - <<'PYEOF'
import zipfile, os
root = os.getcwd()
out = "/tmp/clinictraq-backend.zip"
skip_ext = {".pyc", ".pyo"}
skip_dirs = {"__pycache__", ".pytest_cache", "tests", ".venv", ".git"}
skip_files = {".deployment"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if os.path.splitext(fn)[1] in skip_ext:
                continue
            if fn in skip_files:
                continue
            full = os.path.join(dirpath, fn)
            arcname = os.path.relpath(full, root)
            zf.write(full, arcname)
print(f"Created {out} ({os.path.getsize(out)//1024//1024}MB / {os.path.getsize(out)//1024}KB)")
PYEOF

  info "Configuring Azure App Service: $AZURE_WEBAPP_NAME"
  # Disable Oryx server-side build — packages are already in the zip
  az webapp config appsettings set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false \
    --output none

  info "Setting startup command..."
  az webapp config set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --startup-file "bash startup.sh" \
    --output none

  # Enable basic-auth publishing credentials (disabled by default on newer App Services)
  info "Enabling SCM basic auth..."
  az resource update \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name scm \
    --namespace Microsoft.Web \
    --resource-type basicPublishingCredentialsPolicies \
    --parent "sites/$AZURE_WEBAPP_NAME" \
    --set properties.allow=true \
    --output none

  info "Deploying via Kudu ZIP API..."
  PUBLISH_USER=$(az webapp deployment list-publishing-credentials \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --query "publishingUserName" \
    --output tsv)
  PUBLISH_PASS=$(az webapp deployment list-publishing-credentials \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --query "publishingPassword" \
    --output tsv)

  NETRC_FILE=$(mktemp)
  chmod 600 "$NETRC_FILE"
  printf 'machine %s.scm.azurewebsites.net\nlogin %s\npassword %s\n' \
    "$AZURE_WEBAPP_NAME" "$PUBLISH_USER" "$PUBLISH_PASS" > "$NETRC_FILE"

  SCM_HOST="${AZURE_WEBAPP_NAME}.scm.azurewebsites.net"

  HTTP_STATUS=$(curl -s -o /tmp/deploy_response.txt -w "%{http_code}" \
    -X POST \
    --netrc-file "$NETRC_FILE" \
    -H "Content-Type: application/zip" \
    --data-binary @/tmp/clinictraq-backend.zip \
    "https://${SCM_HOST}/api/zipdeploy?isAsync=true")

  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "202" ]]; then
    info "Deployment submitted (HTTP $HTTP_STATUS). Waiting for build to finish..."
    for i in $(seq 1 30); do
      sleep 10
      STATUS_JSON=$(curl -s --netrc-file "$NETRC_FILE" \
        "https://${SCM_HOST}/api/deployments/latest")
      DEPLOY_STATUS=$(echo "$STATUS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status', 0))" 2>/dev/null || echo "0")
      DEPLOY_MSG=$(echo "$STATUS_JSON"   | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status_text',''))" 2>/dev/null || echo "")
      info "  [$i/30] status=$DEPLOY_STATUS $DEPLOY_MSG"
      if [[ "$DEPLOY_STATUS" == "4" ]]; then
        info "Deployment succeeded."
        break
      elif [[ "$DEPLOY_STATUS" == "3" ]]; then
        error "Deployment failed. Check https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/api/deployments/latest"
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
