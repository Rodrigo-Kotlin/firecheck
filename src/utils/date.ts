const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

function dateParts(value: string | null | undefined): [number, number, number] | null {
  const match = DATE_ONLY_RE.exec(value?.trim() ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? [year, month, day]
    : null;
}

/** Formats a civil date without interpreting it as UTC. */
export function formatDateBR(value: string | null | undefined): string {
  const parts = dateParts(value);
  if (!parts) return '—';
  const [year, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** Formats an actual timestamp in the browser's local timezone. */
export function formatDateTimeBR(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return formatDateBR(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date).replace(',', '');
}

/** Parses YYYY-MM-DD as a local calendar date, never as UTC. */
export function parseDateOnlyLocal(value: string | null | undefined): Date | null {
  const parts = dateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

/** Returns today's local calendar date in the persistence format. */
export function getLocalDateISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Compares two valid YYYY-MM-DD calendar dates without timezone conversion. */
export function compareDateOnly(a: string, b: string): number {
  const left = dateParts(a);
  const right = dateParts(b);
  if (!left || !right) return 0;
  const leftValue = `${left[0].toString().padStart(4, '0')}${left[1].toString().padStart(2, '0')}${left[2].toString().padStart(2, '0')}`;
  const rightValue = `${right[0].toString().padStart(4, '0')}${right[1].toString().padStart(2, '0')}${right[2].toString().padStart(2, '0')}`;
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}
