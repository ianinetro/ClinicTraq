.PHONY: dev backend frontend migrate test-backend install-backend install-frontend build logs db-shell

## Start all services in detached mode
dev:
	docker-compose up -d

## Run backend dev server (outside Docker)
backend:
	cd backend && uvicorn main:app --reload

## Run frontend dev server (outside Docker)
frontend:
	cd frontend && npm run dev

## Apply all pending Alembic migrations
migrate:
	cd backend && alembic upgrade head

## Run backend test suite
test-backend:
	cd backend && pytest

## Install backend Python dependencies
install-backend:
	cd backend && pip install -r requirements.txt

## Install frontend Node dependencies
install-frontend:
	cd frontend && npm install

## Build all Docker images
build:
	docker-compose build

## Tail logs from all containers
logs:
	docker-compose logs -f

## Open a psql shell in the postgres container
db-shell:
	docker-compose exec postgres psql -U clinictraq clinictraq
