# ClinicTraq EHR — Claude Code Reference

## Project Overview

ClinicTraq is a multi-tenant Electronic Health Record (EHR) and medical billing platform. It handles patient demographics, clinical visits, insurance claims, payments, work queues, and integrations with clearinghouses and NPI registries.

**Compliance scope:** HIPAA. All PHI must be masked at rest and in transit; access is audited.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (async), Python 3.11 |
| ORM | SQLAlchemy 2.x (async), Alembic migrations |
| Database | PostgreSQL 16 |
| Cache / Queue broker | Redis 7 |
| Background tasks | Celery + RedBeat scheduler |
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS v4 + BillerBay Command UI design tokens |
| Auth | JWT (access + refresh tokens), Fernet for PHI field encryption |
| PDF generation | WeasyPrint |
| E2E testing | Playwright |
| Unit/integration tests | pytest (backend) |

---

## Running the Project

### Docker (recommended)

```bash
# Copy env and start everything
cp .env.example .env
docker-compose up -d

# Run migrations after first start
make migrate
```

### Without Docker

**Backend** (from `backend/`):
```bash
pip install -r requirements.txt
uvicorn main:app --reload
# API available at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev
# Available at http://localhost:5173 (Vite default)
```

### Makefile shortcuts

```bash
make dev              # docker-compose up -d
make backend          # run backend with hot-reload
make frontend         # run frontend dev server
make migrate          # alembic upgrade head
make test-backend     # pytest
make build            # docker-compose build
make logs             # tail all container logs
make db-shell         # psql into postgres container
```

---

## Backend Structure

```
backend/
├── main.py                   # FastAPI app factory, router registration
├── worker.py                 # Celery app instance
├── core/
│   ├── config.py             # Settings (pydantic-settings)
│   ├── database.py           # Async engine, session factory
│   ├── security.py           # JWT, password hashing, Fernet
│   └── dependencies.py       # FastAPI dependencies (auth, tenant, PHI reveal)
├── domains/
│   ├── identity/             # Users, roles, permissions, tenants
│   ├── master_data/          # Payers, fee schedules, ICD/CPT codes
│   ├── patients/             # Patient demographics, insurance, contacts
│   ├── visits/               # Encounters, diagnoses, procedures, documents
│   ├── claims/               # Claim lifecycle, EDI 837, ERA 835 parsing
│   ├── payments/             # Payments, adjustments, patient balance
│   ├── work_queue/           # Task queues, denial management, follow-ups
│   ├── audit/                # Audit log, PHI access log
│   ├── search/               # Full-text and faceted search endpoints
│   └── integrations/         # NPI registry, clearinghouse, HL7/FHIR
├── migrations/               # Alembic versions
└── tests/
```

Each domain typically contains:
- `models.py` — SQLAlchemy ORM models
- `schemas.py` — Pydantic request/response schemas
- `router.py` — FastAPI router
- `service.py` — Business logic
- `repository.py` — DB queries

---

## Frontend Structure

```
frontend/src/
├── modules/                  # Feature pages (one folder per domain)
│   ├── dashboard/
│   ├── patients/
│   ├── visits/
│   ├── claims/
│   ├── payments/
│   ├── work-queue/
│   └── settings/
├── components/
│   ├── ui/                   # Primitive UI components (Button, Input, Badge…)
│   └── shared/               # Cross-module shared components (DataTable, Modal…)
├── services/                 # API client functions (axios or fetch wrappers)
├── hooks/                    # Custom React hooks
├── stores/                   # Zustand stores
├── tokens/
│   └── index.css             # BillerBay Command UI CSS variables (source of truth)
└── main.tsx
```

---

## Design System — BillerBay Command UI

**Critical rule: NEVER use raw Tailwind color utilities (e.g. `bg-blue-600`, `text-slate-900`). Always use CSS variable tokens.**

### Key tokens (defined in `src/tokens/index.css`)

| Token | Value | Usage |
|---|---|---|
| `--bb-brand-ink` | `#12122C` | Navigation background, dark surfaces |
| `--bb-brand-blue` | `#0410BD` | Primary actions, links, focus rings |
| `--bb-surface-app` | `#F2F2F8` | Main app background |
| `--bb-surface-card` | `#FFFFFF` | Cards, panels |
| `--bb-text-primary` | `#12122C` | Body text |
| `--bb-text-secondary` | `#6B6B8A` | Labels, helper text |
| `--bb-border` | `#E0E0EF` | Dividers, input borders |
| `--bb-status-success` | `#16A34A` | Paid, approved |
| `--bb-status-warning` | `#D97706` | Pending, needs attention |
| `--bb-status-danger` | `#DC2626` | Denied, error |

Usage in Tailwind v4:
```tsx
// ✅ Correct
<div className="bg-[--bb-surface-app] text-[--bb-brand-ink]">

// ❌ Wrong
<div className="bg-slate-100 text-gray-900">
```

---

## Multi-Tenancy

Every database table has a `tenant_id UUID NOT NULL` column. All queries are automatically scoped via the `TenantContext` FastAPI dependency, which reads the tenant from the authenticated user's JWT claims. **Never query without tenant scope.**

```python
# Every router that touches tenant data uses this dependency
router = APIRouter(dependencies=[Depends(require_tenant)])
```

---

## PHI Handling

- Patient PII fields (SSN, DOB, full name in some contexts) are encrypted at rest using Fernet symmetric encryption.
- API responses mask PHI fields by default (e.g., SSN returned as `***-**-1234`).
- Frontend uses the `<PHIField>` component for any PHI display; revealing triggers an audit event.
- Every PHI reveal is written to the `audit.phi_access_log` table with user, timestamp, field, and patient ID.

---

## Database Migrations

```bash
# Apply all pending migrations
cd backend && alembic upgrade head

# Create a new migration after model changes
cd backend && alembic revision --autogenerate -m "describe the change"

# Downgrade one step
cd backend && alembic downgrade -1
```

---

## Testing

```bash
# Backend unit + integration tests
cd backend && pytest

# With coverage
cd backend && pytest --cov=. --cov-report=html

# E2E (requires running stack)
cd frontend && npx playwright test
```
