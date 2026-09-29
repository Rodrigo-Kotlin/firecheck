import type { Equipment, Inspection } from '../../types';
import { filterControlCenterData, type ControlCenterFilters } from '../../utils/controlCenterFilters';
import { isoToBr } from './reportFormatters';
import { STATUS_MAP, type HistoryEntry, type HistoryStatus } from './reportTypes';

export function buildHistoryEntries(inspections: Inspection[]): HistoryEntry[] {
  return inspections.map((inspection) => ({
    id: inspection.id,
    data: isoToBr(inspection.data),
    dataISO: inspection.data,
    inspetor: inspection.inspetor,
    equipId: inspection.equipmentId,
    status: STATUS_MAP[inspection.status] ?? 'PENDENTE' as HistoryStatus,
    statusCode: inspection.status,
    observacoes: inspection.observacoes,
  }));
}

export type HistoryFilterInput = {
  search: string;
  date: string;
  dateFrom: string;
  dateTo: string;
  status: HistoryStatus | 'Todos';
};

export function filterHistoryEntries(history: HistoryEntry[], filters: HistoryFilterInput): HistoryEntry[] {
  const term = filters.search.toLowerCase();
  return history.filter((entry) => {
    const matchSearch = !term ||
      entry.inspetor.toLowerCase().includes(term) ||
      entry.equipId.toLowerCase().includes(term) ||
      (entry.observacoes && entry.observacoes.toLowerCase().includes(term));
    const matchDate = (!filters.date || entry.dataISO === filters.date) &&
      (!filters.dateFrom || entry.dataISO >= filters.dateFrom) &&
      (!filters.dateTo || entry.dataISO <= filters.dateTo);
    const matchStatus = filters.status === 'Todos' || entry.status === filters.status;
    return matchSearch && matchDate && matchStatus;
  });
}

export type ReportSummary = {
  totalInspecoes: number;
  conformesCount: number;
  pendentesCriticos: number;
  conformidadePct: number;
};

export function buildReportSummary(scopedInspections: Inspection[], scopedEquipment: Equipment[]): ReportSummary {
  const conformesCount = scopedEquipment.filter((equipment) => equipment.status === 'regular' || equipment.status === 'observacao').length;
  const pendentesCriticos = scopedEquipment.filter((equipment) => equipment.status === 'vencido').length;
  return {
    totalInspecoes: scopedInspections.length,
    conformesCount,
    pendentesCriticos,
    conformidadePct: scopedEquipment.length > 0 ? Math.round((conformesCount / scopedEquipment.length) * 100) : 0,
  };
}

export function scopeReportData(
  equipments: Equipment[],
  inspections: Inspection[],
  filters: ControlCenterFilters,
) {
  const scoped = filterControlCenterData(equipments, inspections, [], filters);
  return {
    equipments: scoped.equipments,
    inspections: scoped.inspections,
    summary: buildReportSummary(scoped.inspections, scoped.equipments),
  };
}
