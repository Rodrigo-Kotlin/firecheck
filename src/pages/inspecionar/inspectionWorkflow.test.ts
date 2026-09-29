import { describe, expect, it } from 'vitest';
import { buildInspectionPayload, deriveInspectionStatus, getChecklistProgress, getChecklistRemainingMessage, getInspectionResultPresentation, isChecklistComplete, validateInspectionResult } from './inspectionWorkflow';

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

  it('calculates 0 of 15 checklist progress', () => {
    const progress = getChecklistProgress(Array.from({ length: 15 }, (_, index) => `item-${index}`), {});
    expect(progress.answered).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('calculates 1 of 15 checklist progress', () => {
    const progress = getChecklistProgress(Array.from({ length: 15 }, (_, index) => `item-${index}`), { 'item-0': 'OK' });
    expect(progress.answered).toBe(1);
    expect(progress.percentage).toBe(7);
  });

  it('calculates complete checklist progress', () => {
    const progress = getChecklistProgress(['a', 'b', 'c', 'd'], { a: 'OK', b: 'ATENCAO', c: 'REPROVADO', d: 'N.A.' });
    expect(progress.answered).toBe(4);
    expect(progress.percentage).toBe(100);
  });

  it('counts N.A. as answered and preserves semantic state counts', () => {
    const progress = getChecklistProgress(['a', 'b', 'c', 'd'], { a: 'OK', b: 'ATENCAO', c: 'REPROVADO', d: 'N.A.' });
    expect(progress.counts).toEqual({ OK: 1, ATENCAO: 1, REPROVADO: 1, 'N.A.': 1 });
    expect(progress.remaining).toBe(0);
  });

  it('returns singular and plural incomplete-checklist messages', () => {
    expect(getChecklistRemainingMessage(1)).toBe('Avalie o item restante para concluir.');
    expect(getChecklistRemainingMessage(3)).toBe('Avalie os 3 itens restantes para concluir.');
    expect(getChecklistRemainingMessage(0)).toBeNull();
  });

  it('only enables finalization for a complete non-empty checklist', () => {
    expect(isChecklistComplete(getChecklistProgress(['a'], {}))).toBe(false);
    expect(isChecklistComplete(getChecklistProgress(['a'], { a: 'N.A.' }))).toBe(true);
    expect(isChecklistComplete(getChecklistProgress([], {}))).toBe(false);
  });

  it('keeps zero responses waiting instead of selecting a final result', () => {
    expect(getInspectionResultPresentation(getChecklistProgress(['a'], {}), 'regular')).toEqual({
      label: 'Aguardando avaliação',
      state: 'waiting',
    });
  });

  it('marks partial conforming and observation results as provisional', () => {
    const progress = getChecklistProgress(['a', 'b'], { a: 'OK' });
    expect(getInspectionResultPresentation(progress, 'regular').label).toBe('Resultado parcial: Conforme');
    expect(getInspectionResultPresentation(progress, 'observacao').label).toBe('Resultado parcial: Em observação');
  });

  it('uses final result labels only when the checklist is complete', () => {
    const progress = getChecklistProgress(['a'], { a: 'REPROVADO' });
    expect(getInspectionResultPresentation(progress, 'vencido')).toEqual({ label: 'Não conforme', state: 'final' });
  });
});
