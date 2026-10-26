# Calculator

A small web calculator: a Go HTTP API that does the math and a React + TypeScript frontend that calls it. It supports add, subtract, multiply, divide, power, square root and percentage.

```
backend/   Go API (standard library only)
  cmd/server/            entry point, serves the API and optionally the built frontend
  internal/calculator/   pure math, no HTTP
  internal/api/          request parsing, validation, error mapping
frontend/  React 19 + Vite + Vitest
Dockerfile one image that serves both
Makefile   shortcuts for run, test and coverage
```

## Prerequisites

- Go 1.22 or newer (the router uses method-based patterns)
- Node.js 24 (see `frontend/.nvmrc`) and npm
- Docker, only for the container build
- `make` is optional; each target is a one-line command you can run by hand

## Running locally

Start the backend (listens on `:8080`, set `PORT` to change it):

```sh
make run-backend        # cd backend && go run ./cmd/server
```

In a second terminal, start the frontend:

```sh
cd frontend && npm install
make run-frontend       # cd frontend && npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8080`, so no CORS setup is needed.

## Running with Docker

```sh
docker build -t calculator .
docker run --rm -p 8080:8080 calculator
```

Open http://localhost:8080. The image builds the frontend, compiles a static Go binary, and runs it on a distroless non-root base. The server serves the frontend from `STATIC_DIR` (`/app/static`) and the API from the same origin.

## Tests and coverage

```sh
make test               # backend and frontend
make test-backend       # cd backend && go test ./...
make test-frontend      # cd frontend && npm test

make coverage           # both
make coverage-backend   # writes backend/coverage.out and prints per-function coverage
make coverage-frontend  # vitest with v8; HTML report in frontend/coverage/
```

Lint the frontend with `cd frontend && npm run lint` (oxlint).

## API reference

### `POST /api/v1/calculate`

Request:

```json
{ "operation": "divide", "a": 10, "b": 4 }
```

| Field       | Type   | Notes |
|-------------|--------|-------|
| `operation` | string | `add`, `subtract`, `multiply`, `divide`, `power`, `percentage`, `sqrt` |
| `a`         | number | Required |
| `b`         | number | Required for every operation except `sqrt`, where it is ignored |

`percentage` returns `a` percent of `b`, so `{"operation":"percentage","a":20,"b":50}` gives `10`.

Success, `200 OK`:

```json
{ "operation": "divide", "a": 10, "b": 4, "result": 2.5 }
```

Errors share one shape:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "division by zero" } }
```

| Status | Code                | When |
|--------|---------------------|------|
| 400    | `INVALID_JSON`      | Empty, malformed or oversized (over 1 KB) body, wrong field type, unknown field, or more than one JSON object |
| 400    | `MISSING_FIELD`     | `operation`, `a`, or `b` (for a binary operation) is missing |
| 400    | `UNKNOWN_OPERATION` | `operation` is not one of the names above |
| 422    | `DIVISION_BY_ZERO`  | `divide` with `b` = 0 |
| 422    | `NEGATIVE_SQRT`     | `sqrt` with `a` < 0 |
| 422    | `NOT_FINITE`        | The result overflows or is not a real number, e.g. `(-8)^0.5` |

Example:

```sh
curl -s -X POST localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"power","a":2,"b":10}'
```

### `GET /healthz`

Returns `{"status":"ok"}`.

## Design decisions

- The math lives in its own Go package with no HTTP code, so it is easy to test on its own. The handlers just read the request, call it, and write the response.
- There is a single `/api/v1/calculate` endpoint that takes the operation name, backed by a small map of operations. Adding a new one is a function plus one line.
- A missing number is treated as an error rather than quietly becoming 0.
- Requests are validated strictly (bad JSON, unknown fields, oversized bodies). Errors come back with a stable code and a readable message.
- 400 means the request itself is wrong; 422 means it is valid but cannot be calculated, like dividing by zero.
- Results that overflow or are not real numbers are rejected, since JSON cannot represent them.
- The backend uses the standard library only, since Go's router is enough for this.
- The frontend checks input first for quick feedback, but the backend always validates too.
- In dev the frontend proxies to the API, and in Docker one server hosts both, so there is no CORS setup.
- The UI is a simple form (two inputs plus operation buttons) instead of a full keypad. It is easier to validate, test and use on a phone.
- Styling is plain CSS with a few variables and one media query; no UI library is needed for one screen.

## Assumptions

- "Percentage" means `a` percent of `b` (20% of 50 = 10).
- Numbers are regular floats; the UI rounds what it shows so 0.1 + 0.2 displays as 0.3.
- There is no auth or rate limiting, since this is a demo.

## Improvements with more time

Keyboard input, a calculation history, an OpenAPI spec, and exact decimal math.

## AI usage

I used AI assistants (Claude) for parts of this project, mainly tests, infrastructure such as the Dockerfile and Makefile, and this README. The calculator logic and UI are my own. The prompts I used are in [PROMPTS.md](PROMPTS.md).
