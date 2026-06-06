/**
 * Mappers between Supabase row shape (snake_case) and the app's domain
 * types (camelCase). Keeping these conversions in one place avoids leaking
 * SQL column names into the rest of the codebase.
 */
import type { Equipment, Inspection, ActionPlan, Inspector } from '../types';

// ---------------------------------------------------------------------------
// Database row shapes
// ---------------------------------------------------------------------------

export interface DbEquipamento {
  id: string;
  tipo: string;
  subtipo: string | null;
  local: string;
  setor: string;
  pavimento: string | null;
  fabricante: string | null;
  num_serie: string | null;
  capacidade: string | null;
  tipo_carga: string | null;
  data_fabricacao: string | null;
  data_ultima_manutencao: string | null;
  data_proxima_manutencao: string | null;
  data_proxima_inspecao: string | null;
  status: Equipment['status'];
  qrcode: string | null;
  foto_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInspecao {
  id: string;
  equipment_id: string;
  data: string;
  inspetor: string;
  status: Equipment['status'];
  observacoes: string | null;
  checklist_json: unknown;
  sincronizado: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPlanoAcao {
  id: string;
  equipment_id: string;
  local: string;
  descricao: string;
  criticidade: ActionPlan['criticidade'];
  responsavel: string;
  prazo: string | null;
  status: ActionPlan['status'];
  created_at: string;
  updated_at: string;
}

export interface DbInspetor {
  id: string;
  nome: string;
  cargo: string;
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

const emptyToUndef = (v: string | null | undefined): string | undefined =>
  v === null || v === undefined || v === '' ? undefined : v;

export function dbToEquipment(row: DbEquipamento): Equipment {
  return {
    id: row.id,
    tipo: row.tipo,
    subtipo: emptyToUndef(row.subtipo),
    local: row.local,
    setor: row.setor,
    pavimento: emptyToUndef(row.pavimento),
    fabricante: emptyToUndef(row.fabricante),
    numSerie: emptyToUndef(row.num_serie),
    capacidade: emptyToUndef(row.capacidade),
    tipoCarga: emptyToUndef(row.tipo_carga),
    dataFabricacao: emptyToUndef(row.data_fabricacao),
    dataUltimaManutencao: emptyToUndef(row.data_ultima_manutencao),
    dataProximaManutencao: emptyToUndef(row.data_proxima_manutencao),
    dataProximaInspecao: emptyToUndef(row.data_proxima_inspecao),
    status: row.status,
    qrcode: emptyToUndef(row.qrcode),
    fotoUrl: emptyToUndef(row.foto_url),
    observacoes: emptyToUndef(row.observacoes),
  };
}

export function equipmentToDb(eq: Partial<Equipment>): Partial<DbEquipamento> {
  const row: Partial<DbEquipamento> = {};
  if (eq.id !== undefined) row.id = eq.id;
  if (eq.tipo !== undefined) row.tipo = eq.tipo;
  if (eq.subtipo !== undefined) row.subtipo = eq.subtipo ?? null;
  if (eq.local !== undefined) row.local = eq.local;
  if (eq.setor !== undefined) row.setor = eq.setor;
  if (eq.pavimento !== undefined) row.pavimento = eq.pavimento ?? null;
  if (eq.fabricante !== undefined) row.fabricante = eq.fabricante ?? null;
  if (eq.numSerie !== undefined) row.num_serie = eq.numSerie ?? null;
  if (eq.capacidade !== undefined) row.capacidade = eq.capacidade ?? null;
  if (eq.tipoCarga !== undefined) row.tipo_carga = eq.tipoCarga ?? null;
  if (eq.dataFabricacao !== undefined) row.data_fabricacao = eq.dataFabricacao ?? null;
  if (eq.dataUltimaManutencao !== undefined) row.data_ultima_manutencao = eq.dataUltimaManutencao ?? null;
  if (eq.dataProximaManutencao !== undefined) row.data_proxima_manutencao = eq.dataProximaManutencao ?? null;
  if (eq.dataProximaInspecao !== undefined) row.data_proxima_inspecao = eq.dataProximaInspecao ?? null;
  if (eq.status !== undefined) row.status = eq.status;
  if (eq.qrcode !== undefined) row.qrcode = eq.qrcode ?? null;
  if (eq.fotoUrl !== undefined) row.foto_url = eq.fotoUrl ?? null;
  if (eq.observacoes !== undefined) row.observacoes = eq.observacoes ?? null;
  return row;
}

export function dbToInspection(row: DbInspecao): Inspection {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    data: row.data,
    inspetor: row.inspetor,
    status: row.status,
    observacoes: emptyToUndef(row.observacoes),
  };
}

export function inspectionToDb(insp: Partial<Inspection>): Partial<DbInspecao> {
  const row: Partial<DbInspecao> = {};
  if (insp.id !== undefined) row.id = insp.id;
  if (insp.equipmentId !== undefined) row.equipment_id = insp.equipmentId;
  if (insp.data !== undefined) row.data = insp.data;
  if (insp.inspetor !== undefined) row.inspetor = insp.inspetor;
  if (insp.status !== undefined) row.status = insp.status;
  if (insp.observacoes !== undefined) row.observacoes = insp.observacoes ?? null;
  return row;
}

export function dbToActionPlan(row: DbPlanoAcao): ActionPlan {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    local: row.local,
    descricao: row.descricao,
    criticidade: row.criticidade,
    responsavel: row.responsavel,
    prazo: emptyToUndef(row.prazo) ?? '',
    status: row.status,
    createdAt: row.created_at.split('T')[0],
  };
}

export function actionPlanToDb(plan: Partial<ActionPlan>): Partial<DbPlanoAcao> {
  const row: Partial<DbPlanoAcao> = {};
  if (plan.id !== undefined) row.id = plan.id;
  if (plan.equipmentId !== undefined) row.equipment_id = plan.equipmentId;
  if (plan.local !== undefined) row.local = plan.local;
  if (plan.descricao !== undefined) row.descricao = plan.descricao;
  if (plan.criticidade !== undefined) row.criticidade = plan.criticidade;
  if (plan.responsavel !== undefined) row.responsavel = plan.responsavel;
  if (plan.prazo !== undefined) row.prazo = plan.prazo ?? null;
  if (plan.status !== undefined) row.status = plan.status;
  return row;
}

export function dbToInspector(row: DbInspetor): Inspector {
  return { id: row.id, nome: row.nome, cargo: row.cargo };
}
