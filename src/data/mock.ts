import type { Equipment, Inspector, Stats, Inspection } from '../types';

export const equipamentos: Equipment[] = [];

export const inspetores: Inspector[] = [];

export const estatisticas: Stats = {
  total: 0,
  emDia: 0,
  pendentes: 0,
  vencidos: 0,
  conformidade: 0,
};

export const inspecoes: Inspection[] = [];
