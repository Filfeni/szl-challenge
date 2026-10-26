// Package calculator holds the pure arithmetic logic
package calculator

import (
	"errors"
	"math"
)

// Sentinel errors let callers branch with errors.Is instead of string matching
var (
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNegativeSqrt     = errors.New("square root of a negative number")
	ErrUnknownOperation = errors.New("unknown operation")
	ErrMissingOperand   = errors.New(`"b" is required for this operation`)
	ErrNotFinite        = errors.New("result is not a finite number")
)

// Operation describes one calculator operation
type Operation struct {
	Arity int // 1 = unary (uses only a), 2 = binary (uses a and b)
	apply func(a, b float64) (float64, error)
}

func Add(a, b float64) (float64, error)      { return a + b, nil }
func Subtract(a, b float64) (float64, error) { return a - b, nil }
func Multiply(a, b float64) (float64, error) { return a * b, nil }

func Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

func Power(a, b float64) (float64, error) { return math.Pow(a, b), nil }

func Sqrt(a float64) (float64, error) {
	if a < 0 {
		return 0, ErrNegativeSqrt
	}
	return math.Sqrt(a), nil
}

// Percentage returns a percent of b, so Percentage(20, 50) is 10
func Percentage(a, b float64) (float64, error) { return a / 100 * b, nil }

var operations = map[string]Operation{
	"add":        {Arity: 2, apply: Add},
	"subtract":   {Arity: 2, apply: Subtract},
	"multiply":   {Arity: 2, apply: Multiply},
	"divide":     {Arity: 2, apply: Divide},
	"power":      {Arity: 2, apply: Power},
	"percentage": {Arity: 2, apply: Percentage},
	"sqrt":       {Arity: 1, apply: func(a, _ float64) (float64, error) { return Sqrt(a) }},
}

// Calculate runs the named operation. b is a pointer so that a binary operation can tell "b is 0" apart from "b was not sent".
func Calculate(name string, a float64, b *float64) (float64, error) {
	op, ok := operations[name]
	if !ok {
		return 0, ErrUnknownOperation
	}
	var bv float64
	if op.Arity == 2 {
		if b == nil {
			return 0, ErrMissingOperand
		}
		bv = *b
	}
	result, err := op.apply(a, bv)
	if err != nil {
		return 0, err
	}
	// Overflow gives ±Inf and (-8)^0.5 gives NaN. JSON cannot encode either, so we report them as errors
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNotFinite
	}
	return result, nil
}
