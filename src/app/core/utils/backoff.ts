export function expBackoffDelay(attempt: number, baseMs: number): number {
  const jitter = Math.random() * baseMs;
  return Math.min(30000, 2 ** attempt * baseMs + jitter);
}
