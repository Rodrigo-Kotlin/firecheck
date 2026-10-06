import type { Equipment, Inspection } from '../types';
import {
  getLatestInspectionForEquipment,
  getTodayYmd,
  isYmdBefore,
  normalizeYmd,
} from './equipmentFilters';

export const UPCOMING_EQUIPMENT_DAYS = 3;

export type EquipmentTechnicalResult = 'regular' | 'observacao' | 'nao_conforme' | 'sem_inspecao';
export type EquipmentDeadlineResult = 'em_prazo' | 'proximo' | 'vencido' | 'sem_prazo';

export const TECHNICAL_RESULT_META: Record<EquipmentTechnicalResult, { label: string; border: string; pill: string }> = {
  regular: { label: 'Conforme', border: 'border-l-success', pill: 'bg-green-100 text-success' },
  observacao: { label: 'Observação', border: 'border-l-pending', pill: 'bg-amber-100 text-pending' },
  nao_conforme: { label: 'Não Conforme', border: 'border-l-critical', pill: 'bg-red-100 text-critical' },
  sem_inspecao: { label: 'Sem inspeção', border: 'border-l-gray-300', pill: 'bg-gray-100 text-gray-500' },
};

export const DEADLINE_RESULT_META: Record<EquipmentDeadlineResult, { label: string; pill: string }> = {
  em_prazo: { label: 'Em prazo', pill: 'bg-green-50 text-success' },
  proximo: { label: 'Próximo', pill: 'bg-amber-50 text-pending' },
  vencido: { label: 'Vencido', pill: 'bg-red-50 text-critical' },
  sem_prazo: { label: 'Sem prazo', pill: 'bg-gray-100 text-gray-500' },
};

export const OPERATIONAL_STATUS_LABEL: Record<string, string> = {
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  substituido: 'Substituído',
  extraviado: 'Extraviado',
};

export interface EquipmentPresentation {
  latestInspection: Inspection | null;
  technicalResult: EquipmentTechnicalResult;
  deadlineResult: EquipmentDeadlineResult;
  nextInspectionYmd: string | null;
}

function isValidInspection(inspection: Inspection): boolean {
  return normalizeYmd(inspection.data) !== null
    && !(inspection as Inspection & { pendingDelete?: boolean }).pendingDelete;
}

function addCivilDays(todayYmd: string, days: number): string {
  const date = new Date(`${todayYmd}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getEquipmentPresentation(
  equipment: Equipment,
  inspections: Inspection[],
  todayYmd = getTodayYmd(),
): EquipmentPresentation {
  const validInspections = inspections.filter(isValidInspection);
  const latestInspection = getLatestInspectionForEquipment(validInspections, equipment.id);
  const technicalResult: EquipmentTechnicalResult = !latestInspection
    ? 'sem_inspecao'
    : latestInspection.status === 'regular'
      ? 'regular'
      : latestInspection.status === 'observacao'
        ? 'observacao'
        : 'nao_conforme';

  const nextInspectionYmd = normalizeYmd(equipment.dataProximaInspecao);
  let deadlineResult: EquipmentDeadlineResult = 'sem_prazo';
  if (nextInspectionYmd) {
    if (isYmdBefore(nextInspectionYmd, todayYmd)) deadlineResult = 'vencido';
    else if (nextInspectionYmd <= addCivilDays(todayYmd, UPCOMING_EQUIPMENT_DAYS)) deadlineResult = 'proximo';
    else deadlineResult = 'em_prazo';
  }

  return { latestInspection, technicalResult, deadlineResult, nextInspectionYmd };
}

export type EquipmentViewMode = 'cards' | 'list';
export const EQUIPMENT_VIEW_MODE_KEY = 'efetivafire-equipment-view-mode';

export function getEquipmentStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readEquipmentViewMode(storage: Pick<Storage, 'getItem'> | null | undefined): EquipmentViewMode {
  try {
    return storage?.getItem(EQUIPMENT_VIEW_MODE_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
}

export function persistEquipmentViewMode(storage: Pick<Storage, 'setItem'> | null | undefined, mode: EquipmentViewMode): void {
  try {
    storage?.setItem(EQUIPMENT_VIEW_MODE_KEY, mode);
  } catch {
    // localStorage can be unavailable in private browsing or restricted contexts.
  }
}
