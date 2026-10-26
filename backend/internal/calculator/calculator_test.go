package calculator

import (
	"errors"
	"math"
	"testing"
)

func ptr(f float64) *float64 { return &f }

func TestCalculate(t *testing.T) {
	tests := []struct {
		name    string
		op      string
		a       float64
		b       *float64
		want    float64
		wantErr error
	}{
		{"add", "add", 2, ptr(3), 5, nil},
		{"add negatives", "add", -2.5, ptr(-1.5), -4, nil},
		{"subtract", "subtract", 10, ptr(4), 6, nil},
		{"subtract to negative", "subtract", 4, ptr(10), -6, nil},
		{"multiply", "multiply", 6, ptr(7), 42, nil},
		{"multiply by zero", "multiply", 6, ptr(0), 0, nil},
		{"divide", "divide", 9, ptr(3), 3, nil},
		{"divide fractional", "divide", 1, ptr(4), 0.25, nil},
		{"divide by zero", "divide", 1, ptr(0), 0, ErrDivisionByZero},
		{"divide by negative zero", "divide", 1, ptr(math.Copysign(0, -1)), 0, ErrDivisionByZero},
		{"divide zero by zero", "divide", 0, ptr(0), 0, ErrDivisionByZero},
		{"power", "power", 2, ptr(10), 1024, nil},
		{"power zero exponent", "power", 5, ptr(0), 1, nil},
		{"power negative exponent", "power", 2, ptr(-1), 0.5, nil},
		{"power fractional exponent", "power", 9, ptr(0.5), 3, nil},
		{"power negative base fractional exponent is NaN", "power", -8, ptr(0.5), 0, ErrNotFinite},
		{"power overflow", "power", 10, ptr(400), 0, ErrNotFinite},
		{"power zero to negative is Inf", "power", 0, ptr(-1), 0, ErrNotFinite},
		{"percentage", "percentage", 20, ptr(50), 10, nil},
		{"percentage over 100", "percentage", 150, ptr(40), 60, nil},
		{"percentage of zero", "percentage", 20, ptr(0), 0, nil},
		{"sqrt", "sqrt", 16, nil, 4, nil},
		{"sqrt zero", "sqrt", 0, nil, 0, nil},
		{"sqrt ignores b", "sqrt", 25, ptr(-100), 5, nil},
		{"sqrt negative", "sqrt", -4, nil, 0, ErrNegativeSqrt},
		{"multiply overflow", "multiply", math.MaxFloat64, ptr(2), 0, ErrNotFinite},
		{"add overflow", "add", math.MaxFloat64, ptr(math.MaxFloat64), 0, ErrNotFinite},
		{"unknown operation", "modulo", 1, ptr(2), 0, ErrUnknownOperation},
		{"operation is case sensitive", "Add", 1, ptr(2), 0, ErrUnknownOperation},
		{"empty operation", "", 1, ptr(2), 0, ErrUnknownOperation},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.a, tt.b)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("result = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCalculateBinaryRequiresB(t *testing.T) {
	for name, op := range operations {
		if op.Arity != 2 {
			continue
		}
		t.Run(name, func(t *testing.T) {
			if _, err := Calculate(name, 1, nil); !errors.Is(err, ErrMissingOperand) {
				t.Fatalf("err = %v, want %v", err, ErrMissingOperand)
			}
		})
	}
}

func TestOperationsTable(t *testing.T) {
	want := map[string]int{
		"add": 2, "subtract": 2, "multiply": 2, "divide": 2,
		"power": 2, "percentage": 2, "sqrt": 1,
	}
	if len(operations) != len(want) {
		t.Fatalf("got %d operations, want %d", len(operations), len(want))
	}
	for name, arity := range want {
		op, ok := operations[name]
		if !ok {
			t.Errorf("operation %q missing", name)
			continue
		}
		if op.Arity != arity {
			t.Errorf("%s arity = %d, want %d", name, op.Arity, arity)
		}
		if op.apply == nil {
			t.Errorf("%s has no apply func", name)
		}
	}
}

func TestExportedFuncs(t *testing.T) {
	binary := []struct {
		name string
		fn   func(a, b float64) (float64, error)
		a, b float64
		want float64
	}{
		{"Add", Add, 1, 2, 3},
		{"Subtract", Subtract, 1, 2, -1},
		{"Multiply", Multiply, 3, 4, 12},
		{"Divide", Divide, 8, 2, 4},
		{"Power", Power, 3, 3, 27},
		{"Percentage", Percentage, 10, 200, 20},
	}
	for _, tt := range binary {
		got, err := tt.fn(tt.a, tt.b)
		if err != nil || got != tt.want {
			t.Errorf("%s(%v, %v) = %v, %v; want %v, nil", tt.name, tt.a, tt.b, got, err, tt.want)
		}
	}
	if got, err := Sqrt(2); err != nil || math.Abs(got-math.Sqrt2) > 1e-15 {
		t.Errorf("Sqrt(2) = %v, %v", got, err)
	}
	if _, err := Sqrt(-1); !errors.Is(err, ErrNegativeSqrt) {
		t.Errorf("Sqrt(-1) err = %v, want %v", err, ErrNegativeSqrt)
	}
	if _, err := Divide(1, 0); !errors.Is(err, ErrDivisionByZero) {
		t.Errorf("Divide(1, 0) err = %v, want %v", err, ErrDivisionByZero)
	}
}

func TestSentinelErrorsAreDistinct(t *testing.T) {
	errs := []error{ErrDivisionByZero, ErrNegativeSqrt, ErrUnknownOperation, ErrMissingOperand, ErrNotFinite}
	for i, a := range errs {
		for j, b := range errs {
			if i != j && errors.Is(a, b) {
				t.Errorf("%v matches %v", a, b)
			}
		}
	}
}
