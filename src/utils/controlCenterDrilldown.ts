import type { ActionPlan, Equipment, Inspection } from '../types';
import { getControlCenterCharts, type PeriodOption } from './controlCenterCharts';
import { getControlCenterIndicators } from './controlCenterIndicators';
import { normalizeFilterValue } from './controlCenterFilters';

export type ControlCenterEquipmentView =
  | 'attention'
  | 'inspected'
  | 'up-to-date'
  | 'no-inspection'
  | 'observation'
  | 'non-conforming'
  | 'inspection-overdue'
  | 'near-deadline'
  | 'no-conformity-plan'
  | 'situation:em_dia'
  | 'situation:observacao'
  | 'situation:nao_conforme'
  | 'situation:sem_inspecao'
  | 'situation:prazo_vencido'
  | 'situation:sem_prazo'
  | 'situation:fora_operacao'
  | 'sector';

export function getControlCenterEquipmentViewIds(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  view: string | null,
  todayYmd: string,
  period?: PeriodOption,
  sector?: string | null,
): string[] | null {
  if (!view) return null;
  const indicators = getControlCenterIndicators(equipments, inspections, actionPlans, { todayYmd });
  const charts = getControlCenterCharts(equipments, inspections, actionPlans, { todayYmd, period });
  switch (view) {
    case 'attention': return indicators.equipment.requiresAttention.ids;
    case 'inspected': return indicators.equipment.coverage.inspectedIds;
    case 'up-to-date': return indicators.equipment.upToDate.ids;
    case 'no-inspection': return indicators.equipment.noInspection.ids;
    case 'observation': return indicators.equipment.inObservation.ids;
    case 'non-conforming': return indicators.equipment.lastInspectionNonConformity.ids;
    case 'inspection-overdue': return indicators.equipment.inspectionsOverdue.ids;
    case 'near-deadline': return indicators.equipment.inspectionsNearDeadline.ids;
    case 'no-conformity-plan': return indicators.specialCategories.nonConformitiesWithoutPlan.ids;
    case 'situation:em_dia': return charts.equipmentSituationIds.em_dia;
    case 'situation:observacao': return charts.equipmentSituationIds.observacao;
    case 'situation:nao_conforme': return charts.equipmentSituationIds.nao_conforme;
    case 'situation:sem_inspecao': return charts.equipmentSituationIds.sem_inspecao;
    case 'situation:prazo_vencido': return charts.equipmentSituationIds.prazo_vencido;
    case 'situation:sem_prazo': return charts.equipmentSituationIds.sem_prazo;
    case 'situation:fora_operacao': return charts.equipmentSituationIds.fora_operacao;
    case 'sector': return charts.sectorEquipmentIds[normalizeFilterValue(sector)] ?? [];
    default: return null;
  }
}
