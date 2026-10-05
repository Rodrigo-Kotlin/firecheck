import type { Equipment, Inspection, ActionPlan, ActionPlanItem, EquipmentStatus, ActionPlanStatus } from '../types';
import {
  normalizeYmd,
  getTodayYmd,
  isYmdBefore,
  getLatestInspectionForEquipment,
  isEquipmentActive,
} from './equipmentFilters';
import { deriveActionPlanStatus } from '../services/actionPlanItems';

export const UPCOMING_INSPECTION_DAYS = 3;
export type MetricUniverse = 'active' | 'operational' | 'inspected' | 'action_plan' | 'action_plan_item';
export type MetricSource = 'local_snapshot' | 'cloud_synced' | 'local_pending_sync';

export interface MetricResult<T = string> {
  count: number;
  ids: T[];
  universe: MetricUniverse;
  source: MetricSource;
  asOf: string;
}

export type IndicatorCollection<T = string> = MetricResult<T>;

export type TechnicalResult = 'regular' | 'observacao' | 'nao_conforme' | 'sem_inspecao';

export interface EquipmentIndicatorResult {
  registered: IndicatorCollection;
  operational: IndicatorCollection;
  coverage: MetricResult & { percentage: number; inspectedIds: string[]; eligibleIds: string[] };
  technicalResult: Record<TechnicalResult, IndicatorCollection>;
  upToDate: IndicatorCollection;
  requiresAttention: IndicatorCollection;
  noInspection: IndicatorCollection;
  inObservation: IndicatorCollection;
  lastInspectionNonConformity: IndicatorCollection;
  inspectionsNearDeadline: IndicatorCollection;
  inspectionsOverdue: IndicatorCollection;
}

export interface ActionPlanIndicatorResult {
  open: IndicatorCollection;
  overdue: IndicatorCollection;
  completed: IndicatorCollection;
  withoutDeadline: IndicatorCollection;
  pendingItems: MetricResult;
}

export interface SpecialCategoriesResult {
  underMaintenance: IndicatorCollection;
  inactive: IndicatorCollection;
  replaced: IndicatorCollection;
  missing: IndicatorCollection;
  nonConformitiesWithoutPlan: IndicatorCollection;
}

export interface DeadlineClassificationResult {
  semPrazo: IndicatorCollection;
  emDia: IndicatorCollection;
  proximoVencimento: IndicatorCollection;
  vencido: IndicatorCollection;
}

export interface ControlCenterIndicators {
  equipment: EquipmentIndicatorResult;
  actionPlans: ActionPlanIndicatorResult;
  specialCategories: SpecialCategoriesResult;
  deadlineClassification: DeadlineClassificationResult;
}

export interface ControlCenterOptions {
  todayYmd?: string;
  nearDeadlineWindowDays?: number;
  source?: MetricSource;
  filters?: { setor?: string; local?: string; tipo?: string };
  actionPlanItems?: ActionPlanItem[];
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Date.parse(value);
  return Number.isNaN(n) ? null : n;
}

function compareInspectionsLatest(a: Inspection, b: Inspection): number {
  const da = normalizeYmd(a.data) ?? a.data;
  const db = normalizeYmd(b.data) ?? b.data;
  if (da !== db) return da > db ? 1 : -1;
  const ta = parseTimestamp(a.createdAt);
  const tb = parseTimestamp(b.createdAt);
  if (ta !== null && tb !== null && ta !== tb) return ta > tb ? 1 : -1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

function buildLatestInspectionIndex(inspections: Inspection[]): Map<string, Inspection> {
  const index = new Map<string, Inspection>();
  for (const insp of inspections) {
    if (!normalizeYmd(insp.data) || (insp as Inspection & { pendingDelete?: boolean }).pendingDelete) continue;
    const existing = index.get(insp.equipmentId);
    if (!existing || compareInspectionsLatest(insp, existing) > 0) index.set(insp.equipmentId, insp);
  }
  return index;
}

function metric(ids: string[], universe: MetricUniverse, source: MetricSource, asOf: string): MetricResult {
  return { count: ids.length, ids, universe, source, asOf };
}

function matchesFilters(eq: Equipment, filters: ControlCenterOptions['filters']): boolean {
  if (!filters) return true;
  return (!filters.setor || eq.setor === filters.setor)
    && (!filters.local || eq.local === filters.local)
    && (!filters.tipo || eq.tipo === filters.tipo);
}

function isNonOperationalStatus(status: EquipmentStatus): boolean {
  return status === 'em_manutencao' || status === 'inativo' || status === 'substituido' || status === 'extraviado';
}

function classifyDeadline(nextDate: string | null | undefined, today: string, windowDays: number): DeadlineStatus {
  const normalized = normalizeYmd(nextDate);
  if (!normalized) return 'sem_prazo';
  if (isYmdBefore(normalized, today)) return 'vencido';
  const limitDate = new Date(`${today}T00:00:00`);
  limitDate.setDate(limitDate.getDate() + windowDays);
  const limitYmd = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}-${String(limitDate.getDate()).padStart(2, '0')}`;
  if (normalized <= limitYmd) return 'proximo_vencimento';
  return 'em_dia';
}

export type DeadlineStatus = 'sem_prazo' | 'em_dia' | 'proximo_vencimento' | 'vencido';

function technicalResult(lastInspection: Inspection | undefined): TechnicalResult {
  if (!lastInspection) return 'sem_inspecao';
  if (lastInspection.status === 'regular') return 'regular';
  if (lastInspection.status === 'observacao') return 'observacao';
  return 'nao_conforme';
}

function effectivePlanStatus(plan: ActionPlan, items: ActionPlanItem[]): ActionPlanStatus {
  if (plan.modelVersion !== 2) return plan.status;
  const activeItems = items.filter(item => item.planId === plan.id && !item.deletedAt);
  return deriveActionPlanStatus(activeItems);
}

function hasPlanForInspection(plan: ActionPlan, inspectionId: string): boolean {
  if (plan.deletedAt) return false;
  if (plan.inspectionId === inspectionId && plan.originType === 'inspection') return true;
  if (plan.id === `PAC-${inspectionId}`) return true;
  return plan.id.startsWith(`PAC-${inspectionId}-`);
}

export function getControlCenterIndicators(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  options: ControlCenterOptions = {},
): ControlCenterIndicators {
  const today = options.todayYmd ?? getTodayYmd();
  const source = options.source ?? 'local_snapshot';
  const nearDeadlineWindowDays = options.nearDeadlineWindowDays ?? UPCOMING_INSPECTION_DAYS;
  const activeById = new Map<string, Equipment>();
  for (const eq of equipments) if (isEquipmentActive(eq) && !activeById.has(eq.id)) activeById.set(eq.id, eq);
  const filteredEquipments = [...activeById.values()].filter(eq => matchesFilters(eq, options.filters));
  const filteredIds = new Set(filteredEquipments.map(eq => eq.id));
  const operational = filteredEquipments.filter(eq => !isNonOperationalStatus(eq.status));
  const operationalIds = operational.map(eq => eq.id);
  const latest = buildLatestInspectionIndex(inspections);
  const inspectedIds = operational.filter(eq => latest.has(eq.id)).map(eq => eq.id);
  const technicalIds: Record<TechnicalResult, string[]> = { regular: [], observacao: [], nao_conforme: [], sem_inspecao: [] };
  const nearIds: string[] = [];
  const overdueIds: string[] = [];
  const deadlineIds: Record<DeadlineStatus, string[]> = { sem_prazo: [], em_dia: [], proximo_vencimento: [], vencido: [] };
  const specialIds: Record<'em_manutencao' | 'inativo' | 'substituido' | 'extraviado', string[]> = {
    em_manutencao: [], inativo: [], substituido: [], extraviado: [],
  };

  for (const eq of filteredEquipments) {
    const deadline = classifyDeadline(eq.dataProximaInspecao, today, nearDeadlineWindowDays);
    deadlineIds[deadline].push(eq.id);
    if (isNonOperationalStatus(eq.status)) {
      specialIds[eq.status as keyof typeof specialIds].push(eq.id);
      continue;
    }
    const last = latest.get(eq.id);
    const result = technicalResult(last);
    technicalIds[result].push(eq.id);
    if (!last) continue;
    if (deadline === 'proximo_vencimento') nearIds.push(eq.id);
    if (deadline === 'vencido') overdueIds.push(eq.id);
  }

  const planItems = options.actionPlanItems ?? [];
  const scopedPlans = [...new Map(actionPlans.filter(plan => {
    if (plan.deletedAt) return false;
    if (plan.equipmentId) return filteredIds.has(plan.equipmentId);
    return !options.filters || (!options.filters.setor && !options.filters.local && !options.filters.tipo);
  }).map(plan => [plan.id, plan])).values()];
  const openPlanIds: string[] = [];
  const overduePlanIds: string[] = [];
  const completedPlanIds: string[] = [];
  const withoutDeadlinePlanIds: string[] = [];
  const pendingItemIds = new Set<string>();
  for (const plan of scopedPlans) {
    const status = effectivePlanStatus(plan, planItems);
    if (status === 'Concluída') {
      completedPlanIds.push(plan.id);
      continue;
    }
    openPlanIds.push(plan.id);
    const prazo = normalizeYmd(plan.modelVersion === 2 ? planItems.filter(i => i.planId === plan.id && !i.deletedAt && i.status !== 'Concluída').map(i => i.prazo).filter(Boolean).sort()[0] : plan.prazo);
    if (status === 'Vencida' || (prazo !== null && prazo < today)) overduePlanIds.push(plan.id);
    if (!prazo) withoutDeadlinePlanIds.push(plan.id);
    if (plan.modelVersion === 2) {
      for (const item of planItems) if (item.planId === plan.id && !item.deletedAt && item.status !== 'Concluída') pendingItemIds.add(item.id);
    }
  }

  const nonConformityIds: string[] = [];
  for (const eq of operational) {
    const inspection = latest.get(eq.id);
    if (!inspection || technicalResult(inspection) !== 'nao_conforme') continue;
    const hasPlan = actionPlans.some(plan => hasPlanForInspection(plan, inspection.id));
    if (!hasPlan) nonConformityIds.push(eq.id);
  }

  const asOf = today;
  const technicalResultMetrics = Object.fromEntries(
    (Object.keys(technicalIds) as TechnicalResult[]).map(key => [key, metric(technicalIds[key], 'operational', source, asOf)]),
  ) as Record<TechnicalResult, IndicatorCollection>;
  const deadlineMetrics = {
    semPrazo: metric(deadlineIds.sem_prazo, 'active', source, asOf),
    emDia: metric(deadlineIds.em_dia, 'active', source, asOf),
    proximoVencimento: metric(deadlineIds.proximo_vencimento, 'active', source, asOf),
    vencido: metric(deadlineIds.vencido, 'active', source, asOf),
  };

  return {
    equipment: {
      registered: metric(filteredEquipments.map(eq => eq.id), 'active', source, asOf),
      operational: metric(operationalIds, 'operational', source, asOf),
      coverage: { ...metric(inspectedIds, 'inspected', source, asOf), percentage: operationalIds.length ? Math.round((inspectedIds.length / operationalIds.length) * 100) : 0, inspectedIds, eligibleIds: operationalIds },
      technicalResult: technicalResultMetrics,
      upToDate: technicalResultMetrics.regular,
      requiresAttention: metric([...technicalIds.observacao, ...technicalIds.nao_conforme], 'operational', source, asOf),
      noInspection: technicalResultMetrics.sem_inspecao,
      inObservation: technicalResultMetrics.observacao,
      lastInspectionNonConformity: technicalResultMetrics.nao_conforme,
      inspectionsNearDeadline: metric(nearIds, 'inspected', source, asOf),
      inspectionsOverdue: metric(overdueIds, 'inspected', source, asOf),
    },
    actionPlans: {
      open: metric(openPlanIds, 'action_plan', source, asOf),
      overdue: metric(overduePlanIds, 'action_plan', source, asOf),
      completed: metric(completedPlanIds, 'action_plan', source, asOf),
      withoutDeadline: metric(withoutDeadlinePlanIds, 'action_plan', source, asOf),
      pendingItems: metric([...pendingItemIds], 'action_plan_item', source, asOf),
    },
    specialCategories: {
      underMaintenance: metric(specialIds.em_manutencao, 'active', source, asOf),
      inactive: metric(specialIds.inativo, 'active', source, asOf),
      replaced: metric(specialIds.substituido, 'active', source, asOf),
      missing: metric(specialIds.extraviado, 'active', source, asOf),
      nonConformitiesWithoutPlan: metric(nonConformityIds, 'operational', source, asOf),
    },
    deadlineClassification: deadlineMetrics,
  };
}

export type { Equipment, Inspection, ActionPlan, ActionPlanItem, EquipmentStatus, ActionPlanStatus };
export { normalizeYmd, getTodayYmd, isYmdBefore, getLatestInspectionForEquipment, isEquipmentActive };
