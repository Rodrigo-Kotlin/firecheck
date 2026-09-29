import type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus } from '../types';
import {
  normalizeYmd,
  getTodayYmd,
  isYmdBefore,
  getLatestInspectionForEquipment,
  isEquipmentActive,
} from './equipmentFilters';

export type PeriodOption = '30d' | '90d' | '6m' | '12m';
export type EquipmentSituationCategory =
  | 'em_dia'
  | 'observacao'
  | 'nao_conforme'
  | 'sem_inspecao'
  | 'prazo_vencido'
  | 'sem_prazo'
  | 'fora_operacao';

export interface EquipmentSituationChartData {
  category?: EquipmentSituationCategory;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export interface InspectionsByPeriodChartData {
  periodKey?: string;
  period: string;
  regular: number;
  observacao: number;
  pendente: number;
  vencido: number;
  total: number;
}

export interface ActionPlanChartData {
  status?: ActionPlanStatus;
  label: string;
  value: number;
  color: string;
}

export interface OverduePlansChartData {
  label: string;
  value: number;
  color: string;
}

export interface SectorOccurrencesChartData {
  setor: string;
  count: number;
}

export interface ControlCenterChartsResult {
  equipmentSituation: EquipmentSituationChartData[];
  equipmentSituationIds: Record<EquipmentSituationCategory, string[]>;
  inspectionsByPeriod: InspectionsByPeriodChartData[];
  inspectionIdsByPeriod: Record<string, string[]>;
  actionPlans: ActionPlanChartData[];
  actionPlanIds: Record<ActionPlanStatus, string[]>;
  overduePlans: OverduePlansChartData[];
  overduePlanIds: string[];
  sectorOccurrences: SectorOccurrencesChartData[];
  sectorEquipmentIds: Record<string, string[]>;
}

export interface ControlCenterChartsOptions {
  todayYmd?: string;
  period?: PeriodOption;
}

export interface ControlCenterPeriodRange {
  startYmd: string;
  endYmd: string;
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

function normalizeSetor(setor: string | undefined): string {
  if (!setor || setor.trim() === '') return 'Não informado';
  return setor.trim().replace(/\s+/g, ' ');
}

export function getControlCenterPeriodRange(today: string, period: PeriodOption): ControlCenterPeriodRange {
  const date = new Date(today + 'T00:00:00');
  switch (period) {
    case '30d':
      date.setDate(date.getDate() - 30);
      break;
    case '90d':
      date.setDate(date.getDate() - 90);
      break;
    case '6m':
      date.setMonth(date.getMonth() - 6);
      break;
    case '12m':
      date.setFullYear(date.getFullYear() - 1);
      break;
  }
  return {
    startYmd: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    endYmd: today,
  };
}

function formatPeriodLabel(date: Date, period: PeriodOption): string {
  if (period === '30d' || period === '90d') {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${month}/${String(date.getFullYear()).slice(-2)}`;
}

function getPeriodKey(date: Date, period: PeriodOption): string {
  if (period === '30d' || period === '90d') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isWithinPeriod(dateYmd: string, startYmd: string, endYmd: string): boolean {
  return dateYmd >= startYmd && dateYmd <= endYmd;
}

export function getControlCenterCharts(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  options: ControlCenterChartsOptions = {}
): ControlCenterChartsResult {
  const today = options.todayYmd ?? getTodayYmd();
  const period = options.period ?? '6m';

  const activeEquipments = equipments.filter(isEquipmentActive);
  const latestInspectionIndex = buildLatestInspectionIndex(inspections);

  // ============================================
  // GRÁFICO 1: Situação dos Equipamentos
  // ============================================
  const situationCounts = {
    em_dia: 0,
    observacao: 0,
    nao_conforme: 0,
    sem_inspecao: 0,
    prazo_vencido: 0,
    sem_prazo: 0,
    fora_operacao: 0,
  };
  const equipmentSituationIds: Record<EquipmentSituationCategory, string[]> = {
    em_dia: [], observacao: [], nao_conforme: [], sem_inspecao: [], prazo_vencido: [], sem_prazo: [], fora_operacao: [],
  };

  for (const eq of activeEquipments) {
    const status = eq.status;
    const lastInspection = latestInspectionIndex.get(eq.id);
    const nextDate = normalizeYmd(eq.dataProximaInspecao);

    if (status === 'em_manutencao' || status === 'inativo' || status === 'substituido' || status === 'extraviado') {
      situationCounts.fora_operacao++;
      equipmentSituationIds.fora_operacao.push(eq.id);
      continue;
    }

    if (!lastInspection) {
      situationCounts.sem_inspecao++;
      equipmentSituationIds.sem_inspecao.push(eq.id);
      continue;
    }

    const lastStatus = lastInspection.status;

    if (lastStatus === 'regular') {
      if (nextDate && !isYmdBefore(nextDate, today)) {
        situationCounts.em_dia++;
        equipmentSituationIds.em_dia.push(eq.id);
      } else if (nextDate && isYmdBefore(nextDate, today)) {
        situationCounts.prazo_vencido++;
        equipmentSituationIds.prazo_vencido.push(eq.id);
      } else {
        situationCounts.sem_prazo++;
        equipmentSituationIds.sem_prazo.push(eq.id);
      }
    } else if (lastStatus === 'observacao') {
      situationCounts.observacao++;
      equipmentSituationIds.observacao.push(eq.id);
    } else if (lastStatus === 'pendente' || lastStatus === 'vencido') {
      situationCounts.nao_conforme++;
      equipmentSituationIds.nao_conforme.push(eq.id);
    }
  }

  const situationTotal = activeEquipments.length;
  const situationColors: Record<string, string> = {
    em_dia: 'var(--color-success)',
    observacao: 'var(--color-pending)',
    nao_conforme: 'var(--color-critical)',
    sem_inspecao: 'var(--color-text-muted)',
    prazo_vencido: 'var(--color-critical)',
    sem_prazo: 'var(--color-text-muted)',
    fora_operacao: '#94A3B8',
  };

  const situationLabels: Record<string, string> = {
    em_dia: 'Em dia',
    observacao: 'Em observação',
    nao_conforme: 'Não conformes',
    sem_inspecao: 'Sem inspeção',
    prazo_vencido: 'Prazo vencido',
    sem_prazo: 'Sem prazo',
    fora_operacao: 'Fora de operação',
  };

  const equipmentSituation: EquipmentSituationChartData[] = Object.entries(situationCounts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      label: situationLabels[key],
      category: key as EquipmentSituationCategory,
      value,
      color: situationColors[key],
      percentage: situationTotal > 0 ? Math.round((value / situationTotal) * 100) : 0,
    }));

  // ============================================
  // GRÁFICO 2: Inspeções por Período
  // ============================================
  const { startYmd: periodStart, endYmd: periodEnd } = getControlCenterPeriodRange(today, period);

  const periodMap = new Map<string, { regular: number; observacao: number; pendente: number; vencido: number; total: number }>();
  const inspectionIdsByPeriod: Record<string, string[]> = {};

  const currentDate = new Date(periodStart + 'T00:00:00');
  const endDate = new Date(periodEnd + 'T00:00:00');

  if (period === '6m' || period === '12m') currentDate.setDate(1);

  while (currentDate <= endDate) {
    const key = getPeriodKey(currentDate, period);
    periodMap.set(key, { regular: 0, observacao: 0, pendente: 0, vencido: 0, total: 0 });
    inspectionIdsByPeriod[key] = [];
    if (period === '30d' || period === '90d') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  const seenInspectionIds = new Set<string>();
  for (const insp of inspections) {
    if (seenInspectionIds.has(insp.id)) continue;
    seenInspectionIds.add(insp.id);
    const inspDate = normalizeYmd(insp.data);
    if (!inspDate) continue;
    if (!isWithinPeriod(inspDate, periodStart, periodEnd)) continue;

    const key = getPeriodKey(new Date(inspDate + 'T00:00:00'), period);
    const entry = periodMap.get(key);
    if (entry) {
      entry.total++;
      inspectionIdsByPeriod[key].push(insp.id);
      switch (insp.status) {
        case 'regular':
          entry.regular++;
          break;
        case 'observacao':
          entry.observacao++;
          break;
        case 'pendente':
          entry.pendente++;
          break;
        case 'vencido':
          entry.vencido++;
          break;
      }
    }
  }

  const inspectionsByPeriod: InspectionsByPeriodChartData[] = Array.from(periodMap.entries())
    .map(([key, data]) => {
      const dateParts = key.split('-').map(Number);
      const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] || 1);
      return {
        periodKey: key,
        period: formatPeriodLabel(date, period),
        ...data,
      };
    });

  // ============================================
  // GRÁFICO 3: Planos de Ação
  // ============================================
  const planStatusCounts = {
    Aberta: 0,
    'Em andamento': 0,
    Vencida: 0,
    Concluída: 0,
  };
  const actionPlanIds: Record<ActionPlanStatus, string[]> = {
    Aberta: [], 'Em andamento': [], Vencida: [], Concluída: [],
  };

  let overduePlansCount = 0;
  const overduePlanIds: string[] = [];

  for (const plan of actionPlans) {
    if (plan.deletedAt) continue;
    const equipment = activeEquipments.find(e => e.id === plan.equipmentId);
    if (!equipment) continue;

    if (plan.status === 'Concluída') {
      planStatusCounts.Concluída++;
      actionPlanIds.Concluída.push(plan.id);
    } else {
      planStatusCounts[plan.status as keyof typeof planStatusCounts]++;
      actionPlanIds[plan.status].push(plan.id);

      const planDate = normalizeYmd(plan.prazo);
      if (plan.status === 'Vencida' || (planDate !== null && isYmdBefore(planDate, today))) {
        overduePlansCount++;
        overduePlanIds.push(plan.id);
      }
    }
  }

  const planStatusColors: Record<string, string> = {
    Aberta: 'var(--color-info)',
    'Em andamento': 'var(--color-primary)',
    Vencida: 'var(--color-critical)',
    Concluída: 'var(--color-success)',
  };

  const actionPlansData: ActionPlanChartData[] = Object.entries(planStatusCounts)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value,
      status: label as ActionPlanStatus,
      color: planStatusColors[label],
    }));

  const overduePlans: OverduePlansChartData[] = overduePlansCount > 0
    ? [{ label: 'Planos atrasados', value: overduePlansCount, color: 'var(--color-critical)' }]
    : [];

  // ============================================
  // GRÁFICO 4: Ocorrências por Setor
  // ============================================
  const sectorMap = new Map<string, number>();
  const sectorEquipmentIdMap = new Map<string, string[]>();

  for (const eq of activeEquipments) {
    const lastInspection = latestInspectionIndex.get(eq.id);
    if (!lastInspection) continue;

    const lastStatus = lastInspection.status;
    if (lastStatus !== 'pendente' && lastStatus !== 'vencido') continue;

    const setor = normalizeSetor(eq.setor);
    sectorMap.set(setor, (sectorMap.get(setor) || 0) + 1);
    const ids = sectorEquipmentIdMap.get(setor) ?? [];
    ids.push(eq.id);
    sectorEquipmentIdMap.set(setor, ids);
  }

  const sortedSectors = Array.from(sectorMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const topSectors = sortedSectors.slice(0, 8);
  const othersCount = sortedSectors.slice(8).reduce((sum, [, count]) => sum + count, 0);

  const sectorOccurrences: SectorOccurrencesChartData[] = topSectors.map(([setor, count]) => ({
    setor,
    count,
  }));

  if (othersCount > 0) {
    sectorOccurrences.push({ setor: 'Outros setores', count: othersCount });
  }

  return {
    equipmentSituation,
    equipmentSituationIds,
    inspectionsByPeriod,
    inspectionIdsByPeriod,
    actionPlans: actionPlansData,
    actionPlanIds,
    overduePlans,
    overduePlanIds,
    sectorOccurrences,
    sectorEquipmentIds: Object.fromEntries(
      [...topSectors].map(([setor]) => [setor, sectorEquipmentIdMap.get(setor) ?? []]).concat(
        othersCount > 0
          ? [['Outros setores', sortedSectors.slice(8).flatMap(([setor]) => sectorEquipmentIdMap.get(setor) ?? [])] as [string, string[]]]
          : [],
      ),
    ),
  };
}

export type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus };
export { normalizeYmd, getTodayYmd, isYmdBefore, getLatestInspectionForEquipment, isEquipmentActive };
