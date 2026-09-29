import { describe, expect, it } from 'vitest';
import { individualReportFilename, monthlyReportFilename } from './reportFileNames';

describe('report filenames', () => {
  it('keeps the EfetivaFire filename prefixes', () => {
    expect(individualReportFilename('EQ-001', 'INSP-001')).toBe('efetivafire-relatorio_EQ-001_INSP-001.pdf');
    expect(monthlyReportFilename(9, 2026)).toBe('efetivafire-relatorio-mensal_9_2026.pdf');
    expect(individualReportFilename('EQ-001', 'INSP-001')).not.toContain('firecheck');
  });
});
