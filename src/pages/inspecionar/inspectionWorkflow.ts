import type { EquipmentStatus } from '../../types';

export type ChecklistValue = 'OK' | 'ATENCAO' | 'REPROVADO' | 'N.A.';
export type InspectionResult = 'regular' | 'observacao' | 'vencido';

export interface ChecklistProgress {
  total: number;
  answered: number;
  remaining: number;
  percentage: number;
  counts: Record<ChecklistValue, number>;
}

export interface InspectionPhotoPayload {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export interface InspectionPayloadInput {
  inspectionId: string;
  equipmentId: string;
  inspectionDate: string;
  inspectorName: string;
  status: EquipmentStatus;
  notes: string;
  userId?: string;
  photo?: InspectionPhotoPayload;
  nextInspectionDate?: string;
}

export function buildInspectionPayload(input: InspectionPayloadInput) {
  return {
    inspectionId: input.inspectionId,
    equipmentId: input.equipmentId,
    data: input.inspectionDate,
    inspetor: input.inspectorName,
    status: input.status,
    observacoes: input.notes,
    userId: input.userId,
    photo: input.photo,
    dataProximaInspecao: input.nextInspectionDate,
  };
}

export function deriveInspectionStatus(
  checklist: Record<string, ChecklistValue>,
  validadeDate?: string,
): InspectionResult {
  // Keep the deadline argument for call-site compatibility, but never mix it
  // with the inspection result.
  void validadeDate;
  const values = Object.values(checklist);
  const hasReprovado = values.some((val) => val === 'REPROVADO');
  const hasAtencao = values.some((val) => val === 'ATENCAO');

  if (hasReprovado) {
    // `vencido` is the existing persisted value used for non-conforming results.
    return 'vencido';
  }

  if (hasAtencao) return 'observacao';

  // The next inspection date is a deadline, not the inspection result.
  return 'regular';
}

export function validateInspectionResult(
  checklist: Record<string, ChecklistValue>,
  result: InspectionResult,
): string | null {
  const values = Object.values(checklist);
  if (values.includes('REPROVADO') && result !== 'vencido') {
    return 'Itens reprovados exigem o resultado Não conforme.';
  }
  if (values.includes('ATENCAO') && result === 'regular') {
    return 'Itens em atenção exigem o resultado Em observação ou Não conforme.';
  }
  return null;
}

export function getChecklistProgress(
  items: string[],
  values: Record<string, ChecklistValue>,
): ChecklistProgress {
  const counts: Record<ChecklistValue, number> = { OK: 0, ATENCAO: 0, REPROVADO: 0, 'N.A.': 0 };
  const answered = items.reduce((count, item) => {
    const value = values[item];
    if (!value) return count;
    counts[value]++;
    return count + 1;
  }, 0);
  const total = items.length;

  return {
    total,
    answered,
    remaining: total - answered,
    percentage: total === 0 ? 0 : Math.round((answered / total) * 100),
    counts,
  };
}

export function getChecklistRemainingMessage(remaining: number): string | null {
  if (remaining <= 0) return null;
  return remaining === 1
    ? 'Avalie o item restante para concluir.'
    : `Avalie os ${remaining} itens restantes para concluir.`;
}

export function isChecklistComplete(progress: ChecklistProgress): boolean {
  return progress.total > 0 && progress.remaining === 0;
}
