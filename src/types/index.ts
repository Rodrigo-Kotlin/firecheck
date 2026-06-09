export type EquipmentStatus = 'regular' | 'pendente' | 'vencido' | 'observacao';
export type ActionPlanStatus = 'Aberta' | 'Em andamento' | 'Concluída' | 'Vencida';
export type Criticidade = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';

export interface ActionPlan {
  id: string;
  equipmentId: string;
  local: string;
  descricao: string;
  criticidade: Criticidade;
  responsavel: string;
  prazo: string;
  status: ActionPlanStatus;
  createdAt: string;
  /** ID of the user who created this action plan. */
  userId?: string;
}

export interface AppConfig {
  empresa: string;
  unidade: string;
  offlineMode: boolean;
  notificationsEnabled: boolean;
}

export interface Equipment {
  id: string;
  tipo: string;
  subtipo?: string;
  local: string;
  setor: string;
  status: EquipmentStatus;
  pavimento?: string;
  fabricante?: string;
  numSerie?: string;
  capacidade?: string;
  tipoCarga?: 'Água Pressurizada' | 'CO2' | 'PQS' | 'Espuma' | 'Classe K' | string;
  modeloExtintor?: string;
  dataFabricacao?: string;
  dataUltimaManutencao?: string;
  dataProximaManutencao?: string;
  dataProximaInspecao?: string;
  qrcode?: string;
  fotoUrl?: string;
  observacoes?: string;
  /** ID of the user who created this equipment. */
  createdBy?: string;
}

export interface Inspection {
  id: string;
  equipmentId: string;
  data: string;
  inspetor: string;
  status: EquipmentStatus;
  observacoes?: string;
  /** ID of the user who performed this inspection. */
  userId?: string;
}

export interface Inspector {
  id: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
}

/** Linha da tabela `public.profiles` no Supabase. Espelha `auth.users` 1:1
 *  e adiciona os campos de aplicação (nome, cargo, role). */
export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  total: number;
  emDia: number;
  pendentes: number;
  vencidos: number;
  conformidade: number;
}
