import { describe, expect, it } from 'vitest';
import { buildHistoryEntries, buildReportSummary, filterHistoryEntries } from './reportData';
import type { Equipment, Inspection } from '../../types';

const equipment = (overrides: Partial<Equipment> = {}): Equipment => ({
  id: 'EQ-1', tipo: 'Extintor', local: 'Bloco A', setor: 'Setor 1', status: 'regular', ...overrides,
});

const inspection = (overrides: Partial<Inspection> = {}): Inspection => ({
  id: 'INSP-1', equipmentId: 'EQ-1', data: '2026-09-28', inspetor: 'Ana', status: 'regular', ...overrides,
});

describe('report data composition', () => {
  it('formats civil dates and maps report statuses', () => {
    expect(buildHistoryEntries([inspection()])[0]).toMatchObject({
      data: '28/09/2026', status: 'APROVADO', dataISO: '2026-09-28',
    });
  });

  it('filters by text, date range and status without changing order', () => {
    const history = buildHistoryEntries([
      inspection({ id: 'A', data: '2026-09-01', inspetor: 'Ana' }),
      inspection({ id: 'B', data: '2026-09-20', inspetor: 'Bruno', status: 'vencido' }),
    ]);
    expect(filterHistoryEntries(history, { search: 'bruno', date: '', dateFrom: '2026-09-01', dateTo: '2026-09-30', status: 'REPROVADO' }).map((entry) => entry.id)).toEqual(['B']);
    expect(filterHistoryEntries(history, { search: '', date: '', dateFrom: '', dateTo: '', status: 'Todos' }).map((entry) => entry.id)).toEqual(['A', 'B']);
  });

  it('calculates the existing summary denominator and rounding', () => {
    const result = buildReportSummary([inspection(), inspection({ id: 'I-2' })], [
      equipment(), equipment({ id: 'EQ-2', status: 'observacao' }), equipment({ id: 'EQ-3', status: 'vencido' }),
    ]);
    expect(result).toEqual({ totalInspecoes: 2, conformesCount: 2, pendentesCriticos: 1, conformidadePct: 67 });
  });
});
