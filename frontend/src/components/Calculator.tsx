import { useRef, useState, type FormEvent } from 'react';
import { ApiError, calculate } from '../api/calculatorClient';
import { OPERATIONS, getOperation, type OperationName } from '../lib/operations';
import { formatNumber } from '../lib/format';
import { parseOperand } from '../lib/validation';
import './Calculator.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; expression: string; result: number }
  | { kind: 'error'; message: string };

interface FieldErrors {
  a?: string;
  b?: string;
}

// Backend codes we want to phrase for people rather than show raw.
const FRIENDLY_MESSAGES: Record<string, string> = {
  DIVISION_BY_ZERO: "You can't divide by zero.",
  NEGATIVE_SQRT: "You can't take the square root of a negative number.",
  NOT_FINITE: 'The result is too large to represent.',
  NETWORK: 'Could not reach the calculator service. Is the backend running?',
};

export default function Calculator() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [operation, setOperation] = useState<OperationName>('add');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const op = getOperation(operation);
  const needsB = op.arity === 2;

  function selectOperation(name: OperationName) {
    setOperation(name);
    // The second field is hidden for unary operations, so its error would come back stale.
    if (getOperation(name).arity === 1) {
      setFieldErrors(({ a }) => ({ a }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Validate on the client first so obvious mistakes never hit the api
    const parsedA = parseOperand(a);
    const parsedB = needsB ? parseOperand(b) : null;
    const errors: FieldErrors = {};
    if (!parsedA.ok) errors.a = parsedA.error;
    if (parsedB && !parsedB.ok) errors.b = parsedB.error;
    setFieldErrors(errors);
    if (!parsedA.ok || (parsedB && !parsedB.ok)) return;

    // Cancel a request still in flight so a slow old answer can't overwrite a newer one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus({ kind: 'loading' });
    try {
      const res = await calculate(
        { operation, a: parsedA.value, b: parsedB?.value },
        controller.signal,
      );
      const expression = needsB
        ? `${formatNumber(res.a)} ${op.symbol} ${formatNumber(res.b ?? parsedB!.value)}`
        : `${op.symbol}${formatNumber(res.a)}`;
      setStatus({ kind: 'success', expression, result: res.result });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof ApiError
          ? (FRIENDLY_MESSAGES[err.code] ?? err.message)
          : 'Something went wrong. Please try again.';
      setStatus({ kind: 'error', message });
    }
  }

  return (
    <form className="calculator" onSubmit={handleSubmit} noValidate>
      <h1 className="calculator__title">Calculator</h1>

      <fieldset className="calculator__ops">
        <legend>Operation</legend>
        {OPERATIONS.map((o) => (
          <button
            key={o.name}
            type="button"
            className="calculator__op"
            aria-pressed={o.name === operation}
            aria-label={o.label}
            title={o.label}
            onClick={() => selectOperation(o.name)}
          >
            {o.symbol}
          </button>
        ))}
      </fieldset>

      <div className="calculator__inputs">
        <NumberField id="a" label={needsB ? 'First number' : 'Number'} value={a} onChange={setA} error={fieldErrors.a} />
        {needsB && (
          <NumberField id="b" label="Second number" value={b} onChange={setB} error={fieldErrors.b} />
        )}
      </div>

      <button type="submit" className="calculator__submit" disabled={status.kind === 'loading'}>
        {status.kind === 'loading' ? 'Calculating…' : `Calculate (${op.label})`}
      </button>

      <output className="calculator__display" aria-live="polite">
        {status.kind === 'success' && (
          <>
            <span className="calculator__expression">{status.expression} =</span>
            <span className="calculator__result">{formatNumber(status.result)}</span>
          </>
        )}
        {status.kind === 'error' && (
          <span className="calculator__error" role="alert">{status.message}</span>
        )}
      </output>
    </form>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function NumberField({ id, label, value, onChange, error }: NumberFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="calculator__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <span id={errorId} className="calculator__field-error">{error}</span>
      )}
    </div>
  );
}
