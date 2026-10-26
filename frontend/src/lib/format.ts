// Trim float overflow like 0.1 + 0.2 = 0.30000000000000004 for visual ease
export function formatNumber(n: number): string {
  return Number.parseFloat(n.toPrecision(12)).toString();
}
