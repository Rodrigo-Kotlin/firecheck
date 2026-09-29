import { describe, expect, it } from 'vitest';
import { buildInspectionPayload, deriveInspectionStatus } from './inspectionWorkflow';

describe('inspection workflow status', () => {
  it('prioritizes failed checklist items', () => {
    expect(deriveInspectionStatus({ a: 'ATENCAO', b: 'REPROVADO' }, '2099-01-01')).toBe('vencido');
  });

  it('returns pending when attention is the highest checklist result', () => {
    expect(deriveInspectionStatus({ a: 'OK', b: 'ATENCAO' }, '2099-01-01')).toBe('pendente');
  });

  it('derives deadline status only when checklist is regular', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    expect(deriveInspectionStatus({ a: 'OK' }, '2026-10-02', now)).toBe('vencido');
    expect(deriveInspectionStatus({ a: 'OK' }, '2026-10-20', now)).toBe('observacao');
    expect(deriveInspectionStatus({ a: 'OK' }, '2026-12-31', now)).toBe('regular');
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
