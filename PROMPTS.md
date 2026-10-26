# Prompts

These are the prompts I gave the AI assistant (Claude) while building this project, in order. I wrote the calculator logic (`backend/internal/calculator`, `backend/internal/api`) and the UI (`frontend/src`) myself. I used the assistant for scaffolding, tests, Docker and docs, and I reviewed every change before committing it.

## 1. Scaffold the repository

> Set up one Git repository under C:/Sezzle/szl-challenge with two folders: /backend (Go 1.22+, standard library only) and /frontend (Vite React + TypeScript). Scaffolding only; I'll write the calculator logic and UI myself.
>
> Backend:
> - go.mod, module github.com/&lt;my-user&gt;/calculator/backend.
> - cmd/server/main.go: PORT (default 8080), mounts api.NewRouter() on /api/ and /healthz, serves STATIC_DIR on / with an index.html fallback when set, slog request logging, graceful shutdown.
> - internal/api/handlers.go: placeholder NewRouter() with GET /healthz only.
>
> Frontend:
> - Remove the demo content. Dev proxy /api -> http://localhost:8080.
> - Vitest + React Testing Library + jsdom + v8 coverage. Scripts: test, test:coverage.
>
> Root: Makefile (run, test and coverage targets for each side) and .gitignore. Check both build.

Follow-up:

> the git repository is already cloned in the /szl-challenge folder

## 2. Backend tests

> Write table-driven Go tests for backend/internal/calculator and backend/internal/api (use httptest with NewRouter()). Don't change those files; flag suspected bugs instead.
>
> Cover every operation and every error code and status, plus missing fields, wrong types, unknown fields, oversized body, 405 on GET and /healthz. Standard library only. Run `go test -race -cover ./...` and report coverage.

Follow-up:

> can you add gofmt-clean for my files

## 3. Frontend tests

> Write Vitest + React Testing Library tests for frontend/src/lib, src/api/calculatorClient.ts and src/components/Calculator.tsx. Don't change those files; flag suspected bugs instead.
>
> Stub fetch for the client (success, API error, network error, non-JSON). Mock the client for the component (switching operations, sqrt hiding the second input, field errors, results, error messages, loading state). Run `npm run test:coverage` and report the summary.

Follow-up, after reviewing the list of suspected bugs:

> can you address/fix bug number 2 and 5

## 4. Docker

> Add a multi-stage Dockerfile at the repo root: build the frontend with Node 24 LTS, build the Go server as a static binary, and run both from a distroless image with the frontend dist at /app/static (STATIC_DIR=/app/static, port 8080). Add a .dockerignore, build and run it, and check /healthz and one calculation.

Follow-up, when told `frontend/.nvmrc` still said Node 22:

> I want them aligned

## 5. README

> Write README.md from the code: overview, prerequisites, how to run backend, frontend and Docker, tests and coverage, API reference, and a short AI usage section linking PROMPTS.md. Use my notes below for design decisions and assumptions. Keep it concise.

(followed by my own list of design decisions and assumptions, which are in the README)

Follow-up:

> Add the PROMPTS.md for me. Also make the go versions match.
