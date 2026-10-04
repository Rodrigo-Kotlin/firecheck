import { describe, expect, it } from 'vitest';
import { buildActionPlanDescription, isActionPlanEligible, isChecklistValueActionPlanEligible, toActionPlanCandidate } from './inspectionActionPlanMapper';

describe('inspection action-plan mapping', () => {
  const base = { item: 'Lacre íntegro', description: 'Lacre rompido no momento da inspeção.' };

  it('accepts observations and non-conformities', () => {
    expect(isActionPlanEligible('warning')).toBe(true);
    expect(isActionPlanEligible('nonconformity')).toBe(true);
    expect(toActionPlanCandidate({ ...base, severity: 'warning' })?.criticidade).toBe('Médio');
  });

  it('does not create candidates for OK or N.A.', () => {
    expect(isChecklistValueActionPlanEligible('OK')).toBe(false);
    expect(isChecklistValueActionPlanEligible('N.A.')).toBe(false);
    expect(isChecklistValueActionPlanEligible('ATENCAO')).toBe(true);
    expect(isChecklistValueActionPlanEligible('REPROVADO')).toBe(true);
  });

  it('formats deterministic origin data in the existing description field', () => {
    const description = buildActionPlanDescription({
      inspectionId: 'INSP-123',
      equipmentId: 'EXT-002',
      inspectionDate: '2026-10-04',
      inspectionResult: 'vencido',
      deviation: { ...base, severity: 'nonconformity' },
    });
    expect(description).toContain('Inspeção: INSP-123');
    expect(description).toContain('Equipamento: EXT-002');
    expect(description).toContain('Item: Lacre íntegro');
    expect(description).toContain('Tipo: Não conforme');
    expect(description).toContain('Descrição: Lacre rompido');
  });

  it('does not invent responsibility, deadline, or corrective action', () => {
    const candidate = toActionPlanCandidate({ ...base, severity: 'warning' });
    expect(candidate?.responsavel).toBe('');
    expect(candidate?.prazo).toBe('');
    expect(buildActionPlanDescription({
      inspectionId: 'INSP-123',
      equipmentId: 'EXT-002',
      inspectionDate: '2026-10-04',
      inspectionResult: 'observacao',
      deviation: { ...base, severity: 'warning' },
    })).not.toContain('Substituir');
  });
});
