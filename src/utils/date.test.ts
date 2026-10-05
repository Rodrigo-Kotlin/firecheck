import { describe, expect, it } from 'vitest';
import { compareDateOnly, formatDateBR, formatDateTimeBR, getLocalDateISO, parseDateOnlyLocal } from './date';

describe('date presentation and civil calendar helpers', () => {
  it.each([
    ['2026-10-05', '05/10/2026'],
    ['2026-01-01', '01/01/2026'],
    ['2026-12-31', '31/12/2026'],
    ['2028-02-29', '29/02/2028'],
  ])('formats date-only %s as %s', (input, expected) => {
    expect(formatDateBR(input)).toBe(expected);
  });

  it('does not shift a date-only value through UTC', () => {
    expect(formatDateBR('2026-10-05')).toBe('05/10/2026');
    expect(parseDateOnlyLocal('2026-10-05')?.getDate()).toBe(5);
  });

  it('formats timestamps with a Brazilian 24-hour presentation', () => {
    expect(formatDateTimeBR('2026-10-05T18:35:00Z')).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:35$/);
    expect(formatDateTimeBR('2026-10-05T18:35:00-03:00')).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:35$/);
  });

  it('handles empty and invalid values safely', () => {
    expect(formatDateBR(null)).toBe('—');
    expect(formatDateBR(undefined)).toBe('—');
    expect(formatDateBR('')).toBe('—');
    expect(formatDateBR('2026-02-29')).toBe('—');
    expect(formatDateTimeBR('not-a-date')).toBe('—');
    expect(parseDateOnlyLocal('2026-02-29')).toBeNull();
  });

  it('uses the local calendar for today', () => {
    const local = new Date(2026, 9, 4, 22, 30);
    expect(getLocalDateISO(local)).toBe('2026-10-04');
  });

  it('compares date-only values in persistence format', () => {
    expect(compareDateOnly('2026-10-04', '2026-10-05')).toBe(-1);
    expect(compareDateOnly('2026-10-05', '2026-10-04')).toBe(1);
  });
});
