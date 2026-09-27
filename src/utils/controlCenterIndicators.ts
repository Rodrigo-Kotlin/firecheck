import type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus } from '../types';
import {
  normalizeYmd,
  getTodayYmd,
  isYmdBefore,
  getLatestInspectionForEquipment,
  isEquipmentActive,
} from './equipmentFilters';

export type DeadlineStatus = 'sem_prazo' | 'em_dia' | 'proximo_vencimento' | 'vencido';

export interface IndicatorCollection<T> {
  count: number;
  ids: T[];
}

export interface EquipmentIndicatorResult {
  registered: IndicatorCollection<string>;
  operational: IndicatorCollection<string>;
  coverage: { count: number; percentage: number; inspectedIds: string[]; eligibleIds: string[] };
  upToDate: IndicatorCollection<string>;
  requiresAttention: IndicatorCollection<string>;
  noInspection: IndicatorCollection<string>;
  inObservation: IndicatorCollection<string>;
  lastInspectionNonConformity: IndicatorCollection<string>;
  inspectionsNearDeadline: IndicatorCollection<string>;
  inspectionsOverdue: IndicatorCollection<string>;
}

export interface ActionPlanIndicatorResult {
  open: IndicatorCollection<string>;
  overdue: IndicatorCollection<string>;
  completed: IndicatorCollection<string>;
  withoutDeadline: IndicatorCollection<string>;
}

export interface SpecialCategoriesResult {
  underMaintenance: IndicatorCollection<string>;
  inactive: IndicatorCollection<string>;
  replaced: IndicatorCollection<string>;
  missing: IndicatorCollection<string>;
  nonConformitiesWithoutPlan: IndicatorCollection<string>;
}

export interface DeadlineClassificationResult {
  semPrazo: IndicatorCollection<string>;
  emDia: IndicatorCollection<string>;
  proximoVencimento: IndicatorCollection<string>;
  vencido: IndicatorCollection<string>;
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
  filters?: {
    setor?: string;
    local?: string;
    tipo?: string;
  };
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
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

function buildLatestInspectionIndex(inspections: Inspection[]): Map<string, Inspection> {
  const index = new Map<string, Inspection>();
  for (const insp of inspections) {
    const existing = index.get(insp.equipmentId);
    if (!existing || compareInspectionsLatest(insp, existing) > 0) {
      index.set(insp.equipmentId, insp);
    }
  }
  return index;
}

function classifyDeadline(nextDate: string | null | undefined, today: string, windowDays: number): DeadlineStatus {
  const normalized = normalizeYmd(nextDate);
  if (!normalized) return 'sem_prazo';
  if (isYmdBefore(normalized, today)) return 'vencido';
  if (normalized === today) return 'em_dia';
  const limitDate = new Date(today + 'T00:00:00');
  limitDate.setDate(limitDate.getDate() + windowDays);
  const limitYmd = `${limitDate.getFullYear()}-${String(limitDate.getMonth() + 1).padStart(2, '0')}-${String(limitDate.getDate()).padStart(2, '0')}`;
  if (isYmdBefore(normalized, limitYmd) || normalized === limitYmd) return 'proximo_vencimento';
  return 'em_dia';
}

function matchesFilters(eq: Equipment, filters: ControlCenterOptions['filters']): boolean {
  if (!filters) return true;
  if (filters.setor && eq.setor !== filters.setor) return false;
  if (filters.local && eq.local !== filters.local) return false;
  if (filters.tipo && eq.tipo !== filters.tipo) return false;
  return true;
}

function isNonOperationalStatus(status: EquipmentStatus): boolean {
  return status === 'em_manutencao' || status === 'inativo' || status === 'substituido' || status === 'extraviado';
}

export function getControlCenterIndicators(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  options: ControlCenterOptions = {}
): ControlCenterIndicators {
  const today = options.todayYmd ?? getTodayYmd();
  const nearDeadlineWindowDays = options.nearDeadlineWindowDays ?? 30;
  const filters = options.filters;

  const activeEquipments = equipments.filter(isEquipmentActive);
  const filteredEquipments = activeEquipments.filter(eq => matchesFilters(eq, filters));

  const latestInspectionIndex = buildLatestInspectionIndex(inspections);

  const registeredIds: string[] = [];
  const operationalIds: string[] = [];
  const inspectedIds: string[] = [];
  const upToDateIds: string[] = [];
  const requiresAttentionIds: string[] = [];
  const noInspectionIds: string[] = [];
  const inObservationIds: string[] = [];
  const lastInspectionNonConformityIds: string[] = [];
  const inspectionsNearDeadlineIds: string[] = [];
  const inspectionsOverdueIds: string[] = [];

  const specialCategories: SpecialCategoriesResult = {
    underMaintenance: { count: 0, ids: [] },
    inactive: { count: 0, ids: [] },
    replaced: { count: 0, ids: [] },
    missing: { count: 0, ids: [] },
    nonConformitiesWithoutPlan: { count: 0, ids: [] },
  };

  const deadlineClassification: DeadlineClassificationResult = {
    semPrazo: { count: 0, ids: [] },
    emDia: { count: 0, ids: [] },
    proximoVencimento: { count: 0, ids: [] },
    vencido: { count: 0, ids: [] },
  };

  const attentionReasons = new Map<string, Set<string>>();

  for (const eq of filteredEquipments) {
    registeredIds.push(eq.id);

    const status = eq.status;
    const lastInspection = latestInspectionIndex.get(eq.id);
    const nextDate = normalizeYmd(eq.dataProximaInspecao);
    const deadlineStatus = classifyDeadline(nextDate, today, nearDeadlineWindowDays);

    switch (deadlineStatus) {
      case 'sem_prazo':
        deadlineClassification.semPrazo.ids.push(eq.id);
        deadlineClassification.semPrazo.count++;
        break;
      case 'em_dia':
        deadlineClassification.emDia.ids.push(eq.id);
        deadlineClassification.emDia.count++;
        break;
      case 'proximo_vencimento':
        deadlineClassification.proximoVencimento.ids.push(eq.id);
        deadlineClassification.proximoVencimento.count++;
        break;
      case 'vencido':
        deadlineClassification.vencido.ids.push(eq.id);
        deadlineClassification.vencido.count++;
        break;
    }

    if (isNonOperationalStatus(status)) {
      switch (status) {
        case 'em_manutencao':
          specialCategories.underMaintenance.ids.push(eq.id);
          specialCategories.underMaintenance.count++;
          break;
        case 'inativo':
          specialCategories.inactive.ids.push(eq.id);
          specialCategories.inactive.count++;
          break;
        case 'substituido':
          specialCategories.replaced.ids.push(eq.id);
          specialCategories.replaced.count++;
          break;
        case 'extraviado':
          specialCategories.missing.ids.push(eq.id);
          specialCategories.missing.count++;
          break;
      }
      continue;
    }

    operationalIds.push(eq.id);

    if (!lastInspection) {
      noInspectionIds.push(eq.id);
      attentionReasons.set(eq.id, new Set(['sem_inspecao']));
      continue;
    }

    inspectedIds.push(eq.id);

    const lastStatus = lastInspection.status;

    if (lastStatus === 'regular' && deadlineStatus === 'em_dia') {
      upToDateIds.push(eq.id);
    } else {
      if (lastStatus === 'observacao') {
        inObservationIds.push(eq.id);
        attentionReasons.set(eq.id, (attentionReasons.get(eq.id) ?? new Set()).add('observacao'));
      }
      if (lastStatus === 'pendente' || lastStatus === 'vencido') {
        lastInspectionNonConformityIds.push(eq.id);
        attentionReasons.set(eq.id, (attentionReasons.get(eq.id) ?? new Set()).add('nao_conformidade'));
      }
      if (deadlineStatus === 'vencido' || deadlineStatus === 'proximo_vencimento') {
        if (deadlineStatus === 'vencido') {
          inspectionsOverdueIds.push(eq.id);
        } else {
          inspectionsNearDeadlineIds.push(eq.id);
        }
        attentionReasons.set(eq.id, (attentionReasons.get(eq.id) ?? new Set()).add('prazo'));
      }
    }
  }

  for (const eq of filteredEquipments) {
    const reasons = attentionReasons.get(eq.id);
    if (reasons && reasons.size > 0) {
      requiresAttentionIds.push(eq.id);
    }
  }

  const coverage = {
    count: inspectedIds.length,
    percentage: operationalIds.length > 0 ? Math.round((inspectedIds.length / operationalIds.length) * 100) : 0,
    inspectedIds,
    eligibleIds: operationalIds,
  };

  const nonConformityEquipmentIds = new Set(lastInspectionNonConformityIds);
  for (const plan of actionPlans) {
    if (plan.deletedAt) continue;
    const planId = plan.id;
    if (planId.startsWith('PAC-')) {
      const inspectionId = planId.slice(4);
      const inspection = inspections.find(i => i.id === inspectionId);
      if (inspection && nonConformityEquipmentIds.has(inspection.equipmentId)) {
        nonConformityEquipmentIds.delete(inspection.equipmentId);
      }
    }
  }
  specialCategories.nonConformitiesWithoutPlan.ids = Array.from(nonConformityEquipmentIds);
  specialCategories.nonConformitiesWithoutPlan.count = specialCategories.nonConformitiesWithoutPlan.ids.length;

  const openPlanIds: string[] = [];
  const overduePlanIds: string[] = [];
  const completedPlanIds: string[] = [];
  const withoutDeadlinePlanIds: string[] = [];

  for (const plan of actionPlans) {
    if (plan.deletedAt) continue;
    if (!matchesFilters({ setor: '', local: '', tipo: '' } as Equipment, filters)) continue;
    const equipment = filteredEquipments.find(e => e.id === plan.equipmentId);
    if (!equipment) continue;

    const planDeadlineStatus = classifyDeadline(plan.prazo ?? null, today, 0);

    if (plan.status === 'Concluída') {
      completedPlanIds.push(plan.id);
    } else {
      openPlanIds.push(plan.id);
      if (planDeadlineStatus === 'vencido' || plan.status === 'Vencida') {
        overduePlanIds.push(plan.id);
      }
      if (!plan.prazo || normalizeYmd(plan.prazo) === null) {
        withoutDeadlinePlanIds.push(plan.id);
      }
    }
  }

  return {
    equipment: {
      registered: { count: registeredIds.length, ids: registeredIds },
      operational: { count: operationalIds.length, ids: operationalIds },
      coverage,
      upToDate: { count: upToDateIds.length, ids: upToDateIds },
      requiresAttention: { count: requiresAttentionIds.length, ids: requiresAttentionIds },
      noInspection: { count: noInspectionIds.length, ids: noInspectionIds },
      inObservation: { count: inObservationIds.length, ids: inObservationIds },
      lastInspectionNonConformity: { count: lastInspectionNonConformityIds.length, ids: lastInspectionNonConformityIds },
      inspectionsNearDeadline: { count: inspectionsNearDeadlineIds.length, ids: inspectionsNearDeadlineIds },
      inspectionsOverdue: { count: inspectionsOverdueIds.length, ids: inspectionsOverdueIds },
    },
    actionPlans: {
      open: { count: openPlanIds.length, ids: openPlanIds },
      overdue: { count: overduePlanIds.length, ids: overduePlanIds },
      completed: { count: completedPlanIds.length, ids: completedPlanIds },
      withoutDeadline: { count: withoutDeadlinePlanIds.length, ids: withoutDeadlinePlanIds },
    },
    specialCategories,
    deadlineClassification,
  };
}

export type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus };
export { normalizeYmd, getTodayYmd, isYmdBefore, getLatestInspectionForEquipment, isEquipmentActive };