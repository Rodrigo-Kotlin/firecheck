import type { InspectionDeviationInput } from '../types';

export function buildCanonicalActionPlanId(inspectionId: string, deviationKey: string): string {
  return `PAC-${inspectionId}-${deviationKey}`;
}

export function shouldCreateLegacyInspectionPlan(
  deviations: readonly InspectionDeviationInput[] | undefined,
  status: string,
): boolean {
  return deviations === undefined && (status === 'pendente' || status === 'vencido');
}
