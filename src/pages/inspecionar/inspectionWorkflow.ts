import type { EquipmentStatus } from '../../types';

export type ChecklistValue = 'OK' | 'ATENCAO' | 'REPROVADO' | 'N.A.';

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
  validadeDate: string,
  now = new Date(),
): EquipmentStatus {
  let finalStatus: EquipmentStatus = 'regular';
  const values = Object.values(checklist);
  const hasReprovado = values.some((val) => val === 'REPROVADO');
  const hasAtencao = values.some((val) => val === 'ATENCAO');

  if (hasReprovado) {
    finalStatus = 'vencido';
  } else if (hasAtencao) {
    finalStatus = 'pendente';
  } else if (validadeDate) {
    const expDate = new Date(validadeDate);
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) {
      finalStatus = 'vencido';
    } else if (diffDays <= 30) {
      finalStatus = 'observacao';
    }
  }

  return finalStatus;
}
