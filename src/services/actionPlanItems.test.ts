import { describe, expect, it } from 'vitest';
import { buildActionPlanItemId, buildConsolidatedActionPlanId, deriveActionPlanStatus, getActionPlanProgress, isActionPlanItemOverdue, nextActionPlanDeadline, normalizeActionPlanItemStatus } from './actionPlanItems';
import type { ActionPlanItem } from '../types';

const item = (status: ActionPlanItem['status'], prazo = '2099-01-01'): ActionPlanItem => ({
  id: 'PAI-PAC-i-d', planId: 'PAC-i', deviationKey: 'd', checklistItemKey: 'd', tipoDesvio: 'warning',
  descricaoDesvio: 'desc', acaoCorretiva: '', solucaoAdotada: '', responsavel: '', prazo, status,
  concluidoEm: null, createdAt: '2026-01-01T00:00:00.000Z',
});

describe('consolidated action plan items', () => {
  it('builds deterministic parent and child IDs', () => {
    expect(buildConsolidatedActionPlanId('inspection-1')).toBe('PAC-inspection-1');
    expect(buildActionPlanItemId('PAC-inspection-1', 'extintor-1')).toBe('PAI-PAC-inspection-1-extintor-1');
  });

  it('derives progress and parent status from active children', () => {
    const items = [item('Concluída'), item('Em andamento'), item('Aberta')];
    expect(getActionPlanProgress(items)).toMatchObject({ total: 3, concluidas: 1, emAndamento: 1, abertas: 1, percentual: 33 });
    expect(deriveActionPlanStatus(items)).toBe('Em andamento');
    expect(deriveActionPlanStatus([item('Concluída'), item('Concluída')])).toBe('Concluída');
  });

  it('derives overdue state, completion timestamp and next deadline', () => {
    expect(isActionPlanItemOverdue(item('Aberta', '2026-01-01'), '2026-02-01')).toBe(true);
    expect(isActionPlanItemOverdue(item('Concluída', '2020-01-01'), '2026-02-01')).toBe(false);
    expect(normalizeActionPlanItemStatus('Concluída', '2026-02-01T00:00:00.000Z')).toEqual({ status: 'Concluída', concluidoEm: '2026-02-01T00:00:00.000Z' });
    expect(normalizeActionPlanItemStatus('Aberta', '2026-02-01T00:00:00.000Z')).toEqual({ status: 'Aberta', concluidoEm: null });
    expect(nextActionPlanDeadline([item('Concluída', '2026-01-01'), item('Aberta', '2026-03-01'), item('Aberta', '')])).toBe('2026-03-01');
    expect(nextActionPlanDeadline([item('Concluída', '2026-01-01')])).toBeUndefined();
  });

  it('excludes soft-deleted children from counts and progress', () => {
    const deleted = { ...item('Concluída'), deletedAt: '2026-02-01T00:00:00.000Z' };
    expect(getActionPlanProgress([item('Aberta'), deleted])).toMatchObject({ total: 1, concluidas: 0, percentual: 0 });
    expect(deriveActionPlanStatus([deleted])).toBe('Aberta');
  });

  it('calculates the expected completion percentages', () => {
    expect(getActionPlanProgress([]).percentual).toBe(0);
    expect(getActionPlanProgress([item('Concluída'), item('Aberta'), item('Aberta'), item('Aberta')]).percentual).toBe(25);
    expect(getActionPlanProgress([item('Concluída'), item('Concluída'), item('Aberta'), item('Aberta')]).percentual).toBe(50);
    expect(getActionPlanProgress([item('Concluída'), item('Concluída'), item('Concluída'), item('Concluída')]).percentual).toBe(100);
  });
});
