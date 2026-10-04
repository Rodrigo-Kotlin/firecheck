import type { Criticidade } from '../../types';
import type { ChecklistValue, DeviationSeverity, InspectionDeviation, InspectionResult } from './inspectionWorkflow';

export interface ActionPlanCandidate extends InspectionDeviation {
  eligible: true;
  criticidade: Criticidade;
  responsavel: string;
  prazo: string;
}

export interface ActionPlanOriginInput {
  inspectionId: string;
  equipmentId: string;
  inspectionDate: string;
  inspectionResult: InspectionResult;
  deviation: InspectionDeviation;
}

export function isActionPlanEligible(severity: DeviationSeverity): boolean {
  return severity === 'warning' || severity === 'nonconformity';
}

export function isChecklistValueActionPlanEligible(value: ChecklistValue): boolean {
  return value === 'ATENCAO' || value === 'REPROVADO';
}

export function toActionPlanCandidate(deviation: InspectionDeviation): ActionPlanCandidate | null {
  if (!isActionPlanEligible(deviation.severity)) return null;
  return {
    ...deviation,
    eligible: true,
    // The existing plan form uses Médio as its legitimate initial selection.
    // The operator can change it before confirming the plan.
    criticidade: 'Médio',
    responsavel: '',
    prazo: '',
  };
}

export function buildActionPlanDescription(input: ActionPlanOriginInput): string {
  const resultLabel: Record<InspectionResult, string> = {
    regular: 'Conforme',
    observacao: 'Em observação',
    vencido: 'Não conforme',
  };
  const severityLabel = input.deviation.severity === 'warning' ? 'Observação' : 'Não conforme';

  return [
    '[ORIGEM DA INSPEÇÃO]',
    `Inspeção: ${input.inspectionId}`,
    `Data: ${input.inspectionDate}`,
    `Equipamento: ${input.equipmentId}`,
    `Item: ${input.deviation.item}`,
    `Tipo: ${severityLabel}`,
    `Resultado: ${resultLabel[input.inspectionResult]}`,
    `Descrição: ${input.deviation.description.trim()}`,
  ].join('\n');
}
