import { describe, expect, it } from 'vitest';
import { buildInspectionPayload, deriveInspectionStatus, validateInspectionResult } from './inspectionWorkflow';

describe('inspection workflow status', () => {
  it('prioritizes failed checklist items', () => {
    expect(deriveInspectionStatus({ a: 'ATENCAO', b: 'REPROVADO' }, '2099-01-01')).toBe('vencido');
  });

  it('returns observation when attention is the highest checklist result', () => {
    expect(deriveInspectionStatus({ a: 'OK', b: 'ATENCAO' }, '2099-01-01')).toBe('observacao');
  });

  it.each(['2026-10-28', '2026-12-31'])('returns regular for a checklist with only OK/N.A. regardless of deadline (%s)', (nextDate) => {
    expect(deriveInspectionStatus({ a: 'OK', b: 'N.A.' }, nextDate)).toBe('regular');
  });

  it('returns non-conforming legacy status for a failed checklist', () => {
    expect(deriveInspectionStatus({ a: 'REPROVADO' }, '2099-01-01')).toBe('vencido');
  });

  it('allows an explicit observation override for an otherwise regular checklist', () => {
    expect(validateInspectionResult({ a: 'OK', b: 'N.A.' }, 'observacao')).toBeNull();
  });

  it('rejects a conforming result when the checklist has attention', () => {
    expect(validateInspectionResult({ a: 'ATENCAO' }, 'regular')).toContain('Em observação');
  });

  it('rejects a conforming result when the checklist has a failed item', () => {
    expect(validateInspectionResult({ a: 'REPROVADO' }, 'regular')).toContain('Não conforme');
  });

  it('builds the same persisted inspection fields, including photo and identity', () => {
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    expect(buildInspectionPayload({
      inspectionId: 'INSP-test',
      equipmentId: 'EQ-001',
      inspectionDate: '2026-09-28',
      inspectorName: 'Ana',
      status: 'pendente',
      notes: 'Lacre rompido',
      userId: 'user-1',
      photo: { blob, mimeType: 'image/jpeg', width: 100, height: 80, size: 1234 },
      nextInspectionDate: '2026-10-28',
    })).toEqual({
      inspectionId: 'INSP-test',
      equipmentId: 'EQ-001',
      data: '2026-09-28',
      inspetor: 'Ana',
      status: 'pendente',
      observacoes: 'Lacre rompido',
      userId: 'user-1',
      photo: { blob, mimeType: 'image/jpeg', width: 100, height: 80, size: 1234 },
      dataProximaInspecao: '2026-10-28',
    });
  });
});
