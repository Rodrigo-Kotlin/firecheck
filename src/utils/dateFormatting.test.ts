import { describe, expect, it } from 'vitest';
import { formatCivilDate } from './dateFormatting';

describe('formatCivilDate', () => {
  it('formata uma data civil sem conversão de fuso', () => {
    expect(formatCivilDate('2026-10-13')).toBe('13/10/2026');
  });

  it('preserva valores ausentes ou não reconhecidos', () => {
    expect(formatCivilDate(undefined)).toBe('');
    expect(formatCivilDate('sem data')).toBe('sem data');
  });
});
