/**
 * Utility functions for generating mock email data.
 */

let messageCounter = 0;

/** Generate a unique Message-ID header */
export function messageId(domain: string): string {
  messageCounter++;
  const timestamp = Date.now();
  return `<msg-${String(messageCounter).padStart(4, '0')}-${timestamp}@${domain}>`;
}

/** Reset message counter (for idempotent seeding) */
export function resetCounter(): void {
  messageCounter = 0;
}

/** Generate a date string relative to now */
export function daysAgo(days: number, hours = 0, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours, d.getMinutes() - minutes, 0, 0);
  return d.toISOString();
}

/** Build References header from chain of Message-IDs */
export function buildReferences(...msgIds: string[]): string[] {
  return msgIds;
}

/** Generate a mock UUID (deterministic for idempotency) */
export function mockUuid(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-mock-4000-mock-${hex.padEnd(12, '0').slice(0, 12)}`;
}
