package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/Filfeni/calculator/backend/internal/calculator"
)

func postCalculate(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) ErrorBody {
	t.Helper()
	var resp ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode error body %q: %v", rec.Body.String(), err)
	}
	return resp.Error
}

func TestHealthzBody(t *testing.T) {
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status = %q, want ok", body["status"])
	}
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		name  string
		body  string
		want  float64
		wantB bool
	}{
		{"add", `{"operation":"add","a":2,"b":3}`, 5, true},
		{"subtract", `{"operation":"subtract","a":2,"b":3}`, -1, true},
		{"multiply", `{"operation":"multiply","a":2.5,"b":4}`, 10, true},
		{"divide", `{"operation":"divide","a":7,"b":2}`, 3.5, true},
		{"power", `{"operation":"power","a":2,"b":8}`, 256, true},
		{"percentage", `{"operation":"percentage","a":20,"b":50}`, 10, true},
		{"sqrt", `{"operation":"sqrt","a":81}`, 9, false},
		{"zero operands", `{"operation":"add","a":0,"b":0}`, 0, true},
		{"b null on unary", `{"operation":"sqrt","a":4,"b":null}`, 2, false},
		{"whitespace around body", " \n{\"operation\":\"add\",\"a\":1,\"b\":1}\n ", 2, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postCalculate(t, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body %s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Fatalf("Content-Type = %q", ct)
			}
			var resp CalculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if resp.Result != tt.want {
				t.Fatalf("result = %v, want %v", resp.Result, tt.want)
			}
			if (resp.B != nil) != tt.wantB {
				t.Fatalf("b present = %v, want %v", resp.B != nil, tt.wantB)
			}
		})
	}
}

func TestCalculateEchoesRequest(t *testing.T) {
	rec := postCalculate(t, `{"operation":"divide","a":1,"b":0.5}`)
	var raw map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decode: %v", err)
	}
	want := map[string]any{"operation": "divide", "a": 1.0, "b": 0.5, "result": 2.0}
	for k, v := range want {
		if raw[k] != v {
			t.Errorf("%s = %v, want %v", k, raw[k], v)
		}
	}
	if len(raw) != len(want) {
		t.Errorf("unexpected keys in %v", raw)
	}
}

// b = 0 must reach the calculator as 0, not as "missing".
func TestCalculateZeroBIsNotMissing(t *testing.T) {
	rec := postCalculate(t, `{"operation":"divide","a":1,"b":0}`)
	if got := decodeError(t, rec).Code; got != "DIVISION_BY_ZERO" {
		t.Fatalf("code = %q, want DIVISION_BY_ZERO", got)
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		status     int
		code       string
		msgContain string
	}{
		{"empty body", ``, 400, "INVALID_JSON", "request body is empty"},
		{"malformed json", `{"operation":`, 400, "INVALID_JSON", "not valid JSON"},
		{"not an object", `[1,2]`, 400, "INVALID_JSON", ""},
		{"plain text", `hello`, 400, "INVALID_JSON", "not valid JSON"},
		{"trailing object", `{"operation":"add","a":1,"b":2}{"a":2}`, 400, "INVALID_JSON", "single JSON object"},
		{"trailing garbage", `{"operation":"add","a":1,"b":2} x`, 400, "INVALID_JSON", "single JSON object"},
		{"unknown field", `{"operation":"add","a":1,"b":2,"c":3}`, 400, "INVALID_JSON", `unknown field "c"`},
		{"a is string", `{"operation":"add","a":"1","b":2}`, 400, "INVALID_JSON", `field "a" has the wrong type`},
		{"b is bool", `{"operation":"add","a":1,"b":true}`, 400, "INVALID_JSON", `field "b" has the wrong type`},
		{"operation is number", `{"operation":5,"a":1,"b":2}`, 400, "INVALID_JSON", `field "operation" has the wrong type`},
		{"number out of float64 range", `{"operation":"add","a":1e400,"b":1}`, 400, "INVALID_JSON", `field "a"`},
		{"json null body", `null`, 400, "MISSING_FIELD", `"operation" is required`},
		{"empty object", `{}`, 400, "MISSING_FIELD", `"operation" is required`},
		{"missing a", `{"operation":"add","b":2}`, 400, "MISSING_FIELD", `"a" is required`},
		{"a null", `{"operation":"add","a":null,"b":2}`, 400, "MISSING_FIELD", `"a" is required`},
		{"missing b", `{"operation":"add","a":1}`, 400, "MISSING_FIELD", `"b" is required`},
		{"unknown operation", `{"operation":"modulo","a":1,"b":2}`, 400, "UNKNOWN_OPERATION", "unknown operation"},
		{"divide by zero", `{"operation":"divide","a":1,"b":0}`, 422, "DIVISION_BY_ZERO", "division by zero"},
		{"negative sqrt", `{"operation":"sqrt","a":-1}`, 422, "NEGATIVE_SQRT", "negative"},
		{"overflow", `{"operation":"power","a":10,"b":400}`, 422, "NOT_FINITE", "finite"},
		{"nan", `{"operation":"power","a":-8,"b":0.5}`, 422, "NOT_FINITE", "finite"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postCalculate(t, tt.body)
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d; body %s", rec.Code, tt.status, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Fatalf("Content-Type = %q", ct)
			}
			e := decodeError(t, rec)
			if e.Code != tt.code {
				t.Fatalf("code = %q, want %q (message %q)", e.Code, tt.code, e.Message)
			}
			if !strings.Contains(e.Message, tt.msgContain) {
				t.Fatalf("message = %q, want it to contain %q", e.Message, tt.msgContain)
			}
		})
	}
}

func TestCalculateBodyTooLarge(t *testing.T) {
	pad := strings.Repeat(" ", maxBodyBytes)
	rec := postCalculate(t, `{"operation":"add",`+pad+`"a":1,"b":2}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	e := decodeError(t, rec)
	if e.Code != "INVALID_JSON" || e.Message != "request body is too large" {
		t.Fatalf("got %+v", e)
	}
}

func TestCalculateBodyJustUnderLimit(t *testing.T) {
	body := `{"operation":"add","a":1,"b":2}`
	body += strings.Repeat(" ", maxBodyBytes-len(body))
	if rec := postCalculate(t, body); rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body %s", rec.Code, rec.Body)
	}
}

func TestRouting(t *testing.T) {
	tests := []struct {
		method, path string
		status       int
	}{
		{http.MethodGet, "/api/v1/calculate", http.StatusMethodNotAllowed},
		{http.MethodPost, "/healthz", http.StatusMethodNotAllowed},
		{http.MethodGet, "/nope", http.StatusNotFound},
		{http.MethodPost, "/api/v2/calculate", http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			NewRouter().ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, strings.NewReader("{}")))
			if rec.Code != tt.status {
				t.Fatalf("status = %d, want %d", rec.Code, tt.status)
			}
		})
	}
}

func TestMapError(t *testing.T) {
	tests := []struct {
		err    error
		status int
		code   string
	}{
		{calculator.ErrUnknownOperation, 400, "UNKNOWN_OPERATION"},
		{calculator.ErrMissingOperand, 400, "MISSING_FIELD"},
		{calculator.ErrDivisionByZero, 422, "DIVISION_BY_ZERO"},
		{calculator.ErrNegativeSqrt, 422, "NEGATIVE_SQRT"},
		{calculator.ErrNotFinite, 422, "NOT_FINITE"},
		{fmt.Errorf("wrapped: %w", calculator.ErrDivisionByZero), 422, "DIVISION_BY_ZERO"},
		{errors.New("something else"), 500, "INTERNAL"},
	}
	for _, tt := range tests {
		status, code := mapError(tt.err)
		if status != tt.status || code != tt.code {
			t.Errorf("mapError(%v) = %d, %q; want %d, %q", tt.err, status, code, tt.status, tt.code)
		}
	}
}

func TestCalculateConcurrent(t *testing.T) {
	h := NewRouter()
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			body := fmt.Sprintf(`{"operation":"add","a":%d,"b":1}`, i)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body)))
			var resp CalculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.Result != float64(i+1) {
				t.Errorf("i=%d: result %v, err %v", i, resp.Result, err)
			}
		}(i)
	}
	wg.Wait()
}
