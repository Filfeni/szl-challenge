export type OperationName =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'power'
  | 'percentage'
  | 'sqrt';

export interface OperationInfo {
  name: OperationName;
  symbol: string;
  label: string;
  arity: 1 | 2;
}

export const OPERATIONS: readonly OperationInfo[] = [
  { name: 'add', symbol: '+', label: 'Add', arity: 2 },
  { name: 'subtract', symbol: '−', label: 'Subtract', arity: 2 },
  { name: 'multiply', symbol: '×', label: 'Multiply', arity: 2 },
  { name: 'divide', symbol: '÷', label: 'Divide', arity: 2 },
  { name: 'power', symbol: 'xʸ', label: 'Power', arity: 2 },
  { name: 'percentage', symbol: '%', label: 'Percent of', arity: 2 },
  { name: 'sqrt', symbol: '√', label: 'Square root', arity: 1 },
];

export function getOperation(name: OperationName): OperationInfo {
  return OPERATIONS.find((op) => op.name === name)!;
}
