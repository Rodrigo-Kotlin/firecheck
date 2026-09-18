import type { Equipment, Inspection } from '../types';

// ---------------------------------------------------------------------------
// Fonte única de verdade para os KPIs do Dashboard e os filtros da listagem
// de equipamentos. Dashboard e `Equipamentos.tsx` usam EXATAMENTE estas
// funções — garantir contagem do card == contagem da lista aberta.
//
// Definições (Prompt 11 — Dashboard clicável e filtros):
// - Ativo: sem `pendingDelete` e sem `deletedAt`.
// - CADASTRADOS  (registered):  todos os equipamentos ativos.
// - INSPECIONADOS (inspected):  ativos com >= 1 inspeção (distintos).
// - EM DIA        (up-to-date): ativo + tem inspeção + última condição
//                               `regular` + próxima inspeção não vencida.
// - PENDENTES     (pending):    ativo + (nunca inspecionado OU última
//                               condição `pendente`/`vencido` OU próxima
//                               inspeção vencida).
//
// Fuso horário: todas as comparações de data usam string `YYYY-MM-DD`
// (data civil) — nunca `new Date('YYYY-MM-DD')` que converte para UTC e
// produz erros de fronteira em fusos negativos.
// ---------------------------------------------------------------------------

export type EquipmentDashboardView = 'registered' | 'inspected' | 'up-to-date' | 'pending';

/** Valores válidos de `view` (query param `/equipamentos?view=...`). */
export const EQUIPMENT_DASHBOARD_VIEWS: readonly EquipmentDashboardView[] = [
  'registered',
  'inspected',
  'up-to-date',
  'pending',
];

/** Guarda/reducer de tipo. View inválida/ausente → false (ignorada pela UI). */
export function isEquipmentDashboardView(value: string | null | undefined): value is EquipmentDashboardView {
  return value != null && (EQUIPMENT_DASHBOARD_VIEWS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Helpers de data civil (evita o bug de fuso do `new Date('YYYY-MM-DD')`)
// ---------------------------------------------------------------------------

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Normaliza qualquer entrada para `YYYY-MM-DD` (corta hora/tempo se houver).
 *  Retorna `null` quando a string não começa com uma data válida. */
export function normalizeYmd(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = YMD_RE.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month}-${day}`;
}

/** Data de hoje em `YYYY-MM-DD` no fuso LOCAL. */
export function getTodayYmd(now?: Date): string {
  const base = now ?? new Date();
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `a` é anterior a `b`? Comparação lexical segura para `YYYY-MM-DD`. */
export function isYmdBefore(a: string, b: string): boolean {
  return a < b;
}

// ---------------------------------------------------------------------------
// Classificação por inspeção
// ---------------------------------------------------------------------------

/** Converte um timestamp ISO em epoch ms; `null` quando ausente/ilegível.
 *  `created_at`/`createdAt` são timestamps completos (com fuso) — a conversão
 *  via `Date.parse` é segura (o bug de fuso só afeta datas civis
 *  `YYYY-MM-DD`, que não são usadas aqui). */
function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Date.parse(value);
  return Number.isNaN(n) ? null : n;
}

/** Compara duas inspeções para eleger a operacionalmente mais recente:
 *  1. `data` (desc); 2. `createdAt` (desc, quando disponível em ambas);
 *  3. `id` (desc) como desempate determinístico final.
 *  `updated_at` NUNCA participa da cronologia operacional — ele representa
 *  apenas auditoria/CAS/conflito. Uma edição administrativa de uma inspeção
 *  antiga não pode movê-la para o topo da ordenação. */
function compareInspectionsLatest(a: Inspection, b: Inspection): number {
  const da = normalizeYmd(a.data) ?? a.data;
  const db = normalizeYmd(b.data) ?? b.data;
  if (da !== db) return da > db ? 1 : -1;
  const ta = parseTimestamp(a.createdAt);
  const tb = parseTimestamp(b.createdAt);
  if (ta !== null && tb !== null && ta !== tb) return ta > tb ? 1 : -1;
  // Mesma data e mesmo created_at (ou created_at ausente em algum): desempate
  // determinístico final por id (maior id vence).
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** Última (mais recente) inspeção de um equipamento — `null` se não houver.
 *  Ordenação: `data` DESC → `created_at` DESC (quando disponível) → `id` DESC.
 *  `updated_at` (auditoria/CAS) não define cronologia operacional.
 *  As inspeções já chegam da store sem tombstones (`pendingDelete` filtrado
 *  em `carregarInspecoes`/`runSync`). */
export function getLatestInspectionForEquipment(
  inspections: Inspection[],
  equipmentId: string,
): Inspection | null {
  let latest: Inspection | null = null;
  for (const insp of inspections) {
    if (insp.equipmentId !== equipmentId) continue;
    if (!latest || compareInspectionsLatest(insp, latest) > 0) {
      latest = insp;
    }
  }
  return latest;
}

/** Equipamento ativo: sem tombstone local nem remoto. */
export function isEquipmentActive(eq: Equipment): boolean {
  return !eq.pendingDelete && !eq.deletedAt;
}

// ---------------------------------------------------------------------------
// Grupos compartilhados (Dashboard + listagem)
// ---------------------------------------------------------------------------

export interface EquipmentDashboardGroups {
  /** CADASTRADOS — todos os ativos. */
  registered: Equipment[];
  /** INSPECIONADOS — ativos com >= 1 inspeção distinta. */
  inspected: Equipment[];
  /** EM DIA — última inspeção `regular` + próxima não vencida. */
  upToDate: Equipment[];
  /** PENDENTES — nunca inspecionado / pendente/vencido / data vencida. */
  pending: Equipment[];
}

/** Calcula os 4 grupos de equipamento a partir dos mesmos arrays usados pela
 *  UI. É a fonte única de verdade: qualquer contador (card/lixe) usa isto. */
export function getEquipmentDashboardGroups(
  equipments: Equipment[],
  inspections: Inspection[],
  todayYmd?: string,
): EquipmentDashboardGroups {
  const today = todayYmd ?? getTodayYmd();
  const active = equipments.filter(isEquipmentActive);

  // Conjunto de equipamentos ativos com ao menos uma inspeção válida.
  const activeIds = new Set<string>();
  for (const eq of active) activeIds.add(eq.id);

  const inspectedIds = new Set<string>();
  for (const insp of inspections) {
    if (activeIds.has(insp.equipmentId)) inspectedIds.add(insp.equipmentId);
  }

  const registered: Equipment[] = [];
  const inspected: Equipment[] = [];
  const upToDate: Equipment[] = [];
  const pending: Equipment[] = [];

  for (const eq of active) {
    registered.push(eq);

    if (inspectedIds.has(eq.id)) inspected.push(eq);

    const last = getLatestInspectionForEquipment(inspections, eq.id);
    const nextDate = normalizeYmd(eq.dataProximaInspecao);
    const nextOverdue = nextDate !== null && isYmdBefore(nextDate, today);

    // EM DIA: tem inspeção + última condição `regular` + próxima não vencida.
    const isUpToDate = last !== null && last.status === 'regular' && !nextOverdue;
    if (isUpToDate) upToDate.push(eq);

    // PENDENTES: nunca inspecionado, OU última condição pendente/vencido,
    // OU próxima inspeção vencida. Disjunto de EM DIA por construção.
    const neverInspected = last === null;
    const lastNeedsAction = last !== null && (last.status === 'pendente' || last.status === 'vencido');
    if (neverInspected || lastNeedsAction || nextOverdue) pending.push(eq);
  }

  return { registered, inspected, upToDate, pending };
}

/** Retorna o grupo correspondente a uma visão (`?view=`). Usado pela
 *  listagem para exibir exatamente a mesma coleção contada no card. */
export function getDashboardGroupByView(
  groups: EquipmentDashboardGroups,
  view: EquipmentDashboardView,
): Equipment[] {
  switch (view) {
    case 'registered':
      return groups.registered;
    case 'inspected':
      return groups.inspected;
    case 'up-to-date':
      return groups.upToDate;
    case 'pending':
      return groups.pending;
  }
}