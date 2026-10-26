// Package api turns HTTP requests into calculator calls and calculator results or errors into JSON responses.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"github.com/Filfeni/calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 10 // 1 KB is plenty for two numbers

// CalculateRequest is the JSON body of POST /api/v1/calculate.
// Pointers let us tell "field missing" apart from "field is 0"
type CalculateRequest struct {
	Operation string   `json:"operation"`
	A         *float64 `json:"a"`
	B         *float64 `json:"b,omitempty"`
}

type CalculateResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error ErrorBody `json:"error"`
}

func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("POST /api/v1/calculate", handleCalculate)
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	var req CalculateRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", decodeErrorMessage(err))
		return
	}
	// Reject trailing data such as `{"a":1}{"a":2}`.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "INVALID_JSON", "request body must contain a single JSON object")
		return
	}
	if req.Operation == "" {
		writeError(w, http.StatusBadRequest, "MISSING_FIELD", `"operation" is required`)
		return
	}
	if req.A == nil {
		writeError(w, http.StatusBadRequest, "MISSING_FIELD", `"a" is required`)
		return
	}

	result, err := calculator.Calculate(req.Operation, *req.A, req.B)
	if err != nil {
		status, code := mapError(err)
		writeError(w, status, code, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Operation: req.Operation, A: *req.A, B: req.B, Result: result})
}

// mapError translates domain errors into HTTP status codes 

func mapError(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusBadRequest, "UNKNOWN_OPERATION"
	case errors.Is(err, calculator.ErrMissingOperand):
		return http.StatusBadRequest, "MISSING_FIELD"
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, "DIVISION_BY_ZERO"
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, "NEGATIVE_SQRT"
	case errors.Is(err, calculator.ErrNotFinite):
		return http.StatusUnprocessableEntity, "NOT_FINITE"
	default:
		return http.StatusInternalServerError, "INTERNAL"
	}
}

func decodeErrorMessage(err error) string {
	var typeErr *json.UnmarshalTypeError
	var maxErr *http.MaxBytesError
	switch {
	case errors.As(err, &typeErr):
		return fmt.Sprintf("field %q has the wrong type: got %s, want number", typeErr.Field, typeErr.Value)
	case errors.As(err, &maxErr):
		return "request body is too large"
	case errors.Is(err, io.EOF):
		return "request body is empty"
	case strings.HasPrefix(err.Error(), "json: unknown field"):
		return strings.TrimPrefix(err.Error(), "json: ")
	default:
		return "request body is not valid JSON: " + err.Error()
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorResponse{Error: ErrorBody{Code: code, Message: message}})
}
