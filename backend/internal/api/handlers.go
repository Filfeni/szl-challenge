// Package api holds the HTTP handlers for the calculator API.
package api

import (
	"encoding/json"
	"net/http"
)

// NewRouter returns the API handler. Routes are registered with full paths
// (e.g. "GET /api/..."), so the router can be mounted without prefix stripping.
func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)
	return mux
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
