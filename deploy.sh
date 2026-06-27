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

  # Install dependencies into a local dir for zip deploy
  pip install -r requirements.txt --target .packages --quiet

  # Create zip using Python (no system zip required)
  python3 - <<'PYEOF'
import zipfile, os, sys
root = os.getcwd()
out = "/tmp/clinictraq-backend.zip"
skip = {".pyc", ".pyo"}
skip_dirs = {"__pycache__", ".pytest_cache", "tests", ".venv", ".git"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fn in filenames:
            if os.path.splitext(fn)[1] in skip:
                continue
            full = os.path.join(dirpath, fn)
            arcname = os.path.relpath(full, root)
            zf.write(full, arcname)
print(f"Created {out} ({os.path.getsize(out)//1024}KB)")
PYEOF

  info "Deploying to Azure App Service: $AZURE_WEBAPP_NAME"
  az webapp deploy \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --src-path /tmp/clinictraq-backend.zip \
    --type zip \
    --async false

  info "Setting startup command..."
  az webapp config set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --startup-file "bash startup.sh"

  rm /tmp/clinictraq-backend.zip
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
