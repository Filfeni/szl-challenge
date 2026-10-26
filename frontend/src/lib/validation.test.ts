import { parseOperand } from './validation';

describe('parseOperand', () => {
  it.each([
    ['0', 0],
    ['42', 42],
    ['-3', -3],
    ['+3', 3],
    ['3.14', 3.14],
    ['.5', 0.5],
    ['-.5', -0.5],
    ['5.', 5],
    ['1e3', 1000],
    ['1E-2', 0.01],
    ['2.5e+2', 250],
    ['  7  ', 7],
  ])('accepts %j', (raw, value) => {
    expect(parseOperand(raw)).toEqual({ ok: true, value });
  });

  it.each(['', '   ', '\t\n'])('rejects blank input %j', (raw) => {
    expect(parseOperand(raw)).toEqual({ ok: false, error: 'Enter a number.' });
  });

  it.each(['abc', '.', '-', '1.2.3', '1e', 'e5', '0x10', 'Infinity', 'NaN', '1,000', '1 2', '--1', '½'])(
    'rejects %j as not a number',
    (raw) => {
      expect(parseOperand(raw)).toEqual({ ok: false, error: `"${raw.trim()}" is not a valid number.` });
    },
  );

  it('quotes the trimmed text in the error', () => {
    expect(parseOperand('  abc ')).toEqual({ ok: false, error: '"abc" is not a valid number.' });
  });

  it('rejects numbers that overflow to Infinity', () => {
    expect(parseOperand('1e400')).toEqual({ ok: false, error: 'That number is too large.' });
    expect(parseOperand('-1e400')).toEqual({ ok: false, error: 'That number is too large.' });
  });

  it('silently underflows tiny numbers to zero', () => {
    expect(parseOperand('1e-400')).toEqual({ ok: true, value: 0 });
  });
});
