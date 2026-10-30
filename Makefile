.PHONY: up down build logs test lint migrate clean

# Boot all services via Docker Compose
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Rebuild containers
build:
	docker compose build

# Follow container logs
logs:
	docker compose logs -f

# Run tests across API and Web
test:
	@echo "Testing API..."
	pytest apps/api/tests || true
	@echo "Testing Web..."
	cd apps/web && npm.cmd test || true

# Lint all codebases
lint:
	@echo "Linting API..."
	ruff check apps/api || true
	@echo "Linting Web..."
	cd apps/web && npm.cmd run lint || true

# Run database migrations
migrate:
	@echo "Running Alembic migrations..."
	docker compose exec api alembic upgrade head || true

# Clean cache and build artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".next" -exec rm -rf {} +
	find . -type d -name "node_modules" -prune -o -name "dist" -exec rm -rf {} +
