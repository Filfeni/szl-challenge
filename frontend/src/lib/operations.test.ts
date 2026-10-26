import { OPERATIONS, getOperation, type OperationName } from './operations';

describe('OPERATIONS', () => {
  it('lists every operation once', () => {
    const names = OPERATIONS.map((op) => op.name);
    expect(names).toEqual(['add', 'subtract', 'multiply', 'divide', 'power', 'percentage', 'sqrt']);
    expect(new Set(names).size).toBe(names.length);
  });

  it('marks only sqrt as unary', () => {
    const unary = OPERATIONS.filter((op) => op.arity === 1).map((op) => op.name);
    expect(unary).toEqual(['sqrt']);
  });

  it('gives every operation a symbol and label', () => {
    for (const op of OPERATIONS) {
      expect(op.symbol).not.toBe('');
      expect(op.label).not.toBe('');
    }
  });
});

describe('getOperation', () => {
  it.each(OPERATIONS.map((op) => [op.name, op] as const))('returns the info for %s', (name, info) => {
    expect(getOperation(name)).toBe(info);
  });

  it('returns undefined for an unknown name despite the non-null return type', () => {
    expect(getOperation('modulo' as OperationName)).toBeUndefined();
  });
});
