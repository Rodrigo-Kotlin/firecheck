import type { Inspection } from '../../types';

export type HistoryStatus = 'APROVADO' | 'OBSERVAÇÃO' | 'REPROVADO' | 'PENDENTE';

export type HistoryEntry = {
  id: string;
  data: string;
  dataISO: string;
  inspetor: string;
  equipId: string;
  status: HistoryStatus;
  statusCode: Inspection['status'];
  observacoes?: string;
};

export const STATUS_MAP: Record<string, HistoryStatus> = {
  regular: 'APROVADO',
  observacao: 'OBSERVAÇÃO',
  vencido: 'REPROVADO',
  pendente: 'PENDENTE',
};

export const HISTORY_STATUS_BADGE: Record<HistoryStatus, string> = {
  APROVADO: 'bg-green-100 text-success',
  'OBSERVAÇÃO': 'bg-amber-100 text-pending',
  REPROVADO: 'bg-red-100 text-critical',
  PENDENTE: 'bg-orange-100 text-orange-600',
};

export function getHistoryStatusFromQuery(value: string | null): HistoryStatus | 'Todos' {
  return value === 'regular' ? 'APROVADO' : value === 'observacao' ? 'OBSERVAÇÃO' : value === 'vencido' ? 'REPROVADO' : value === 'pendente' ? 'PENDENTE' : 'Todos';
}
