import { describe, expect, it } from 'vitest';
import { formatCivilDate } from './dateFormatting';

describe('formatCivilDate', () => {
  it('formata uma data civil sem conversão de fuso', () => {
    expect(formatCivilDate('2026-10-13')).toBe('13/10/2026');
  });

  it('uses the standard empty marker for absent or invalid values', () => {
    expect(formatCivilDate(undefined)).toBe('—');
    expect(formatCivilDate('sem data')).toBe('—');
  });
});
