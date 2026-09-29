import type { EquipmentStatus } from '../../types';

export type ChecklistValue = 'OK' | 'ATENCAO' | 'REPROVADO' | 'N.A.';
export type InspectionResult = 'regular' | 'observacao' | 'vencido';
export type DeviationSeverity = 'warning' | 'nonconformity';
export type EvidenceRequirement = 'optional' | 'recommended' | 'required';

export interface ChecklistProgress {
  total: number;
  answered: number;
  remaining: number;
  percentage: number;
  counts: Record<ChecklistValue, number>;
}

export interface InspectionResultPresentation {
  label: string;
  state: 'waiting' | 'partial' | 'final';
}

export interface InspectionDeviation {
  item: string;
  severity: DeviationSeverity;
  description: string;
}

export function deriveEvidenceRequirement(
  checklist: Record<string, ChecklistValue>,
  result: InspectionResult,
): EvidenceRequirement {
  if (result === 'vencido' || Object.values(checklist).includes('REPROVADO')) return 'required';
  if (result === 'observacao' || Object.values(checklist).includes('ATENCAO')) return 'recommended';
  return 'optional';
}

export function getEvidenceValidationMessage(
  requirement: EvidenceRequirement,
  hasPhoto: boolean,
): string | null {
  if (requirement !== 'required' || hasPhoto) return null;
  return 'Adicione uma evidência visual da não conformidade para concluir.';
}

export function getEvidenceInstruction(
  requirement: EvidenceRequirement,
  nonconformityCount: number,
): string {
  if (requirement === 'optional') return 'Adicione uma foto caso queira complementar o registro da inspeção.';
  if (requirement === 'recommended') return 'Uma foto ajuda a documentar a condição observada.';
  return nonconformityCount > 1
    ? 'Adicione uma evidência visual representativa das não conformidades identificadas.'
    : 'Adicione uma foto que evidencie a não conformidade identificada.';
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

export function getInspectionDeviations(
  items: string[],
  checklist: Record<string, ChecklistValue>,
  descriptions: Record<string, string> = {},
): InspectionDeviation[] {
  return items.flatMap((item) => {
    const value = checklist[item];
    if (value !== 'ATENCAO' && value !== 'REPROVADO') return [];
    return [{
      item,
      severity: value === 'ATENCAO' ? 'warning' : 'nonconformity',
      description: descriptions[item] ?? '',
    }];
  });
}

/** Descrições precisam de ao menos 5 caracteres alfanuméricos úteis. */
export function validateDeviationDescription(description: string): string | null {
  const normalized = description.trim();
  const usefulCharacters = normalized.replace(/[^\p{L}\p{N}]/gu, '');
  if (usefulCharacters.length < 5) return 'Descreva a condição com pelo menos 5 caracteres úteis.';
  if (/^(ok|x|teste)$/i.test(usefulCharacters)) return 'Informe uma descrição técnica do desvio.';
  return null;
}

export function getDeviationValidationMessage(deviations: InspectionDeviation[]): string | null {
  const invalidCount = deviations.filter((deviation) => validateDeviationDescription(deviation.description)).length;
  if (invalidCount === 0) return null;
  return invalidCount === 1
    ? 'Descreva o desvio identificado para concluir.'
    : `Descreva os ${invalidCount} desvios identificados para concluir.`;
}

export function buildInspectionNotes(
  deviations: InspectionDeviation[],
  generalNotes: string,
): string {
  const sections: string[] = [];
  const activeDeviations = deviations.filter((deviation) => deviation.description.trim());

  if (activeDeviations.length > 0) {
    const lines = ['[REGISTRO DE DESVIOS]'];
    activeDeviations.forEach((deviation) => {
      const label = deviation.severity === 'warning' ? 'OBSERVAÇÃO' : 'NÃO CONFORME';
      lines.push(`${label} — ${deviation.item}`, `Descrição: ${deviation.description.trim()}`);
    });
    sections.push(lines.join('\n'));
  }

  const trimmedGeneralNotes = generalNotes.trim();
  if (trimmedGeneralNotes) sections.push(`[OBSERVAÇÕES GERAIS]\n${trimmedGeneralNotes}`);
  return sections.join('\n\n');
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

export function getInspectionResultPresentation(
  progress: ChecklistProgress,
  result: InspectionResult,
): InspectionResultPresentation {
  const resultLabels: Record<InspectionResult, string> = {
    regular: 'Conforme',
    observacao: 'Em observação',
    vencido: 'Não conforme',
  };

  if (progress.answered === 0) return { label: 'Aguardando avaliação', state: 'waiting' };
  if (progress.remaining > 0) return { label: `Resultado parcial: ${resultLabels[result]}`, state: 'partial' };
  return { label: resultLabels[result], state: 'final' };
}
