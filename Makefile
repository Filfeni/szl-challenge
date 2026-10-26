.PHONY: run-backend run-frontend test test-backend test-frontend coverage coverage-backend coverage-frontend build-frontend

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && go test ./...

test-frontend:
	cd frontend && npm test

coverage: coverage-backend coverage-frontend

coverage-backend:
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out

coverage-frontend:
	cd frontend && npm run test:coverage

build-frontend:
	cd frontend && npm run build
