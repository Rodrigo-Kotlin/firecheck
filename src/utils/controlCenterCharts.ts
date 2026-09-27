import type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus } from '../types';
import {
  normalizeYmd,
  getTodayYmd,
  isYmdBefore,
  getLatestInspectionForEquipment,
  isEquipmentActive,
} from './equipmentFilters';

export type PeriodOption = '30d' | '90d' | '6m' | '12m';

export interface EquipmentSituationChartData {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export interface InspectionsByPeriodChartData {
  period: string;
  regular: number;
  observacao: number;
  pendente: number;
  vencido: number;
  total: number;
}

export interface ActionPlanChartData {
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
  inspectionsByPeriod: InspectionsByPeriodChartData[];
  actionPlans: ActionPlanChartData[];
  overduePlans: OverduePlansChartData[];
  sectorOccurrences: SectorOccurrencesChartData[];
}

export interface ControlCenterChartsOptions {
  todayYmd?: string;
  period?: PeriodOption;
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

function getPeriodStartDate(today: string, period: PeriodOption): string {
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatPeriodLabel(date: Date, period: PeriodOption): string {
  if (period === '30d' || period === '90d') {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.toLocaleDateString('pt-BR', { month: 'short' })}/${date.getFullYear()}`;
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

  for (const eq of activeEquipments) {
    const status = eq.status;
    const lastInspection = latestInspectionIndex.get(eq.id);
    const nextDate = normalizeYmd(eq.dataProximaInspecao);

    if (status === 'em_manutencao' || status === 'inativo' || status === 'substituido' || status === 'extraviado') {
      situationCounts.fora_operacao++;
      continue;
    }

    if (!lastInspection) {
      situationCounts.sem_inspecao++;
      continue;
    }

    const lastStatus = lastInspection.status;

    if (lastStatus === 'regular') {
      if (nextDate && !isYmdBefore(nextDate, today)) {
        situationCounts.em_dia++;
      } else if (nextDate && isYmdBefore(nextDate, today)) {
        situationCounts.prazo_vencido++;
      } else {
        situationCounts.sem_prazo++;
      }
    } else if (lastStatus === 'observacao') {
      situationCounts.observacao++;
    } else if (lastStatus === 'pendente' || lastStatus === 'vencido') {
      situationCounts.nao_conforme++;
    }
  }

  const situationTotal = activeEquipments.length;
  const situationColors: Record<string, string> = {
    em_dia: '#16a34a',
    observacao: '#ca8a04',
    nao_conforme: '#dc2626',
    sem_inspecao: '#2563eb',
    prazo_vencido: '#ef4444',
    sem_prazo: '#6b7280',
    fora_operacao: '#9ca3af',
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
      value,
      color: situationColors[key],
      percentage: situationTotal > 0 ? Math.round((value / situationTotal) * 100) : 0,
    }));

  // ============================================
  // GRÁFICO 2: Inspeções por Período
  // ============================================
  const periodStart = getPeriodStartDate(today, period);
  const periodEnd = today;

  const periodMap = new Map<string, { regular: number; observacao: number; pendente: number; vencido: number; total: number }>();

  const currentDate = new Date(periodStart + 'T00:00:00');
  const endDate = new Date(periodEnd + 'T00:00:00');

  if (period === '6m' || period === '12m') currentDate.setDate(1);

  while (currentDate <= endDate) {
    const key = getPeriodKey(currentDate, period);
    periodMap.set(key, { regular: 0, observacao: 0, pendente: 0, vencido: 0, total: 0 });
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

  let overduePlansCount = 0;

  for (const plan of actionPlans) {
    if (plan.deletedAt) continue;
    const equipment = activeEquipments.find(e => e.id === plan.equipmentId);
    if (!equipment) continue;

    if (plan.status === 'Concluída') {
      planStatusCounts.Concluída++;
    } else {
      planStatusCounts[plan.status as keyof typeof planStatusCounts]++;

      const planDate = normalizeYmd(plan.prazo);
      if (plan.status === 'Vencida' || (planDate !== null && isYmdBefore(planDate, today))) {
        overduePlansCount++;
      }
    }
  }

  const planStatusColors: Record<string, string> = {
    Aberta: '#ef4444',
    'Em andamento': '#ca8a04',
    Vencida: '#991b1b',
    Concluída: '#16a34a',
  };

  const actionPlansData: ActionPlanChartData[] = Object.entries(planStatusCounts)
    .filter(([, value]) => value > 0)
    .map(([label, value]) => ({
      label,
      value,
      color: planStatusColors[label],
    }));

  const overduePlans: OverduePlansChartData[] = overduePlansCount > 0
    ? [{ label: 'Planos atrasados', value: overduePlansCount, color: '#ef4444' }]
    : [];

  // ============================================
  // GRÁFICO 4: Ocorrências por Setor
  // ============================================
  const sectorMap = new Map<string, number>();

  for (const eq of activeEquipments) {
    const lastInspection = latestInspectionIndex.get(eq.id);
    if (!lastInspection) continue;

    const lastStatus = lastInspection.status;
    if (lastStatus !== 'pendente' && lastStatus !== 'vencido') continue;

    const setor = normalizeSetor(eq.setor);
    sectorMap.set(setor, (sectorMap.get(setor) || 0) + 1);
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
    inspectionsByPeriod,
    actionPlans: actionPlansData,
    overduePlans,
    sectorOccurrences,
  };
}

export type { Equipment, Inspection, ActionPlan, EquipmentStatus, ActionPlanStatus };
export { normalizeYmd, getTodayYmd, isYmdBefore, getLatestInspectionForEquipment, isEquipmentActive };
