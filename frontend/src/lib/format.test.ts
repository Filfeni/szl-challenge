import { formatNumber } from './format';

describe('formatNumber', () => {
  it('trims floating point noise', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1.1 * 3)).toBe('3.3');
  });

  it('leaves ordinary numbers alone', () => {
    expect(formatNumber(42)).toBe('42');
    expect(formatNumber(-7.5)).toBe('-7.5');
    expect(formatNumber(0)).toBe('0');
  });

  it('normalises negative zero to 0', () => {
    expect(formatNumber(-0)).toBe('0');
  });

  it('uses exponent notation for very large and very small numbers', () => {
    expect(formatNumber(1e21)).toBe('1e+21');
    expect(formatNumber(1.5e-10)).toBe('1.5e-10');
  });

  it('passes through non-finite values', () => {
    expect(formatNumber(Infinity)).toBe('Infinity');
    expect(formatNumber(-Infinity)).toBe('-Infinity');
    expect(formatNumber(NaN)).toBe('NaN');
  });

  // Documents current behaviour: 12 significant digits means large exact
  // integers are rounded for display (suspected bug, see report).
  it('rounds integers beyond 12 significant digits', () => {
    expect(formatNumber(123456789012)).toBe('123456789012');
    expect(formatNumber(1234567890123)).toBe('1234567890120');
  });
});
