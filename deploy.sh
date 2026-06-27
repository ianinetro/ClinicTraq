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
AZURE_ACR_NAME="${AZURE_ACR_NAME:-clinictraqacr}"
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

# ── Deploy backend to Azure App Service (Docker via ACR) ─────────────────────
deploy_backend() {
  IMAGE="${AZURE_ACR_NAME}.azurecr.io/clinictraq-api:latest"

  info "Building and pushing Docker image to ACR: $IMAGE"
  info "(az acr build runs the Docker build in Azure — no local Docker required)"
  az acr build \
    --registry "$AZURE_ACR_NAME" \
    --image "clinictraq-api:latest" \
    --file "$REPO_ROOT/backend/Dockerfile" \
    "$REPO_ROOT/backend"

  info "Updating App Service to use image: $IMAGE"
  az webapp config container set \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --container-image-name "$IMAGE" \
    --output none

  info "Restarting App Service..."
  az webapp restart \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_WEBAPP_NAME" \
    --output none

  info "Waiting for app to come online..."
  HEALTH_URL="https://${AZURE_WEBAPP_NAME}.azurewebsites.net/api/v1/health"
  for i in $(seq 1 30); do
    sleep 10
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" || echo "000")
    info "  [$i/30] health=$HTTP_CODE"
    if [[ "$HTTP_CODE" == "200" ]]; then
      info "App is healthy."
      break
    fi
  done

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
