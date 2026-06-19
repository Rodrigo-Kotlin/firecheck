export type EquipmentStatus = 'regular' | 'pendente' | 'vencido' | 'observacao' | 'em_manutencao' | 'inativo' | 'substituido' | 'extraviado';
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
  tipoCarga?: string;
  modeloExtintor?: string;
  classeFogo?: string;
  seloLacre?: string;
  manometro?: string;
  suporte?: string;
  sinalizacao?: string;
  acessoDesobstruido?: string;
  estadoGeral?: string;
  tipoHidrante?: string;
  tipoAbrigoVinculado?: string;
  registro?: string;
  valvula?: string;
  adaptador?: string;
  tampao?: string;
  pressao?: string;
  tipoMangueira?: string;
  diametro?: string;
  comprimento?: string;
  tipoUniao?: string;
  estadoMangueira?: string;
  acondicionamento?: string;
  possuiEtiquetaInspecao?: string;
  tipoAbrigo?: string;
  material?: string;
  estadoPorta?: string;
  estadoVisor?: string;
  possuiMangueira?: string;
  possuiEsguicho?: string;
  possuiChaveStorz?: string;
  possuiRegistro?: string;
  tipoEsguicho?: string;
  estadoRoscas?: string;
  estadoVedacao?: string;
  compatibilidadeMangueira?: string;
  localAcondicionamento?: string;
  tipoChaveStorz?: string;
  diametroCompativel?: string;
  estadoFisico?: string;
  tipoAcionador?: string;
  enderecoZona?: string;
  estadoTampa?: string;
  estadoBotao?: string;
  alturaInstalacao?: string;
  funcionamentoTestado?: string;
  tipoAlarme?: string;
  sireneAudiovisual?: string;
  sireneSonora?: string;
  sinalizadorVisual?: string;
  zonaLaco?: string;
  fonteAlimentacao?: string;
  tipoCentral?: string;
  quantidadeLacosZonas?: string;
  bateriaBackup?: string;
  comunicacaoDispositivos?: string;
  statusPainel?: string;
  localInstalacao?: string;
  modeloIluminacao?: string;
  funcaoIluminacao?: string;
  autonomia?: string;
  tipoInstalacao?: string;
  potencia?: string;
  tipoSinalizacao?: string;
  codigoPlaca?: string;
  fotoluminescente?: string;
  visibilidade?: string;
  estadoConservacao?: string;
  fixacaoAdequada?: string;
  tipoSprinkler?: string;
  temperaturaAcionamento?: string;
  posicaoInstalacao?: string;
  estadoBulbo?: string;
  obstrucao?: string;
  corrosao?: string;
  vazamento?: string;
  areaProtegida?: string;
  tipoBomba?: string;
  vazao?: string;
  alimentacaoEletrica?: string;
  painelComando?: string;
  bombaJockey?: string;
  bombaPrincipal?: string;
  bombaReserva?: string;
  tipoPorta?: string;
  tempoResistenciaFogo?: string;
  barraAntipanico?: string;
  dobradicas?: string;
  molaAerea?: string;
  fechamentoAutomatico?: string;
  vedacao?: string;
  tipoDetectorFumaca?: string;
  tipoDetectorCalor?: string;
  nomeModelo?: string;
  descricaoTecnica?: string;
  dataFabricacao?: string;
  dataUltimaManutencao?: string;
  dataProximaManutencao?: string;
  dataUltimoTeste?: string;
  dataProximoTeste?: string;
  dataTesteHidrostatico?: string;
  dataValidadeTeste?: string;
  dataProximaInspecao?: string;
  dataUltimaInspecao?: string;
  qrcode?: string;
  qrCode?: string;
  fotoUrl?: string;
  observacoes?: string;
  dadosTecnicos?: Record<string, string | number | boolean | null>;
  /** ID of the user who created this equipment. */
  createdBy?: string;
  /** ISO date when this equipment record was created. */
  createdAt?: string;
  /** ISO date when this equipment record was last updated. */
  updatedAt?: string;
  /** ISO date when this equipment was soft-deleted (tombstone). */
  deletedAt?: string | null;
  /** ID of the user who deleted this equipment. */
  deletedBy?: string | null;
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
