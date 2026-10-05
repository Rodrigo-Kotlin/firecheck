import type { ActionPlanItem, ActionPlanItemStatus } from '../types';

export function buildConsolidatedActionPlanId(inspectionId: string): string {
  return `PAC-${inspectionId}`;
}

export function buildActionPlanItemId(planId: string, deviationKey: string): string {
  return `PAI-${planId}-${deviationKey}`;
}

export interface ActionPlanProgress {
  total: number;
  concluidas: number;
  abertas: number;
  emAndamento: number;
  vencidas: number;
  percentual: number;
}

export function isActionPlanItemOverdue(item: Pick<ActionPlanItem, 'prazo' | 'status'>, today = new Date().toISOString().slice(0, 10)): boolean {
  return item.status !== 'Concluída' && Boolean(item.prazo) && item.prazo < today;
}

export function getActionPlanProgress(items: readonly ActionPlanItem[], today?: string): ActionPlanProgress {
  const active = items.filter((item) => !item.deletedAt);
  const concluidas = active.filter((item) => item.status === 'Concluída').length;
  const emAndamento = active.filter((item) => item.status === 'Em andamento').length;
  const abertas = active.filter((item) => item.status === 'Aberta').length;
  const vencidas = active.filter((item) => isActionPlanItemOverdue(item, today)).length;
  return {
    total: active.length,
    concluidas,
    abertas,
    emAndamento,
    vencidas,
    percentual: active.length === 0 ? 0 : Math.round((concluidas / active.length) * 100),
  };
}

export function deriveActionPlanStatus(items: readonly ActionPlanItem[]): 'Aberta' | 'Em andamento' | 'Concluída' {
  const active = items.filter((item) => !item.deletedAt);
  if (active.length > 0 && active.every((item) => item.status === 'Concluída')) return 'Concluída';
  if (active.some((item) => item.status === 'Concluída' || item.status === 'Em andamento')) return 'Em andamento';
  return 'Aberta';
}

export function nextActionPlanDeadline(items: readonly ActionPlanItem[]): string | undefined {
  const dates = items
    .filter((item) => !item.deletedAt && item.status !== 'Concluída' && item.prazo)
    .map((item) => item.prazo)
    .sort();
  return dates[0];
}

export function normalizeActionPlanItemStatus(status: ActionPlanItemStatus, now = new Date().toISOString()): Pick<ActionPlanItem, 'status' | 'concluidoEm'> {
  return status === 'Concluída' ? { status, concluidoEm: now } : { status, concluidoEm: null };
}
