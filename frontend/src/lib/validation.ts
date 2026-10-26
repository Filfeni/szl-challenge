export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// Plain decimals with an optional sign, fraction and exponent
const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function parseOperand(raw: string): ParseResult {
  const text = raw.trim();
  if (text === '') {
    // Number('') is 0, so an empty box would silently become zero.
    return { ok: false, error: 'Enter a number.' };
  }
  if (!NUMBER_PATTERN.test(text)) {
    return { ok: false, error: `"${text}" is not a valid number.` };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { ok: false, error: 'That number is too large.' };
  }
  return { ok: true, value };
}
