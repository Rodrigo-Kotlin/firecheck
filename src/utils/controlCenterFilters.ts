import type { ActionPlan, Equipment, Inspection } from '../types';
import { isEquipmentActive, normalizeYmd } from './equipmentFilters';

export type ControlCenterFilterKey = 'setor' | 'local' | 'tipo';

export interface ControlCenterFilters {
  setor: string;
  local: string;
  tipo: string;
}

export interface ControlCenterFilterOptions {
  setor: string[];
  local: string[];
  tipo: string[];
}

export const EMPTY_CONTROL_CENTER_FILTERS: ControlCenterFilters = { setor: '', local: '', tipo: '' };

export function normalizeFilterValue(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

function uniqueValues(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeFilterValue(value);
    const key = normalized.toLocaleLowerCase('pt-BR');
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function getControlCenterFilterOptions(equipments: Equipment[]): ControlCenterFilterOptions {
  const active = equipments.filter(isEquipmentActive);
  return {
    setor: uniqueValues(active.map(eq => eq.setor)),
    local: uniqueValues(active.map(eq => eq.local)),
    tipo: uniqueValues(active.map(eq => eq.tipo)),
  };
}

export function parseControlCenterFilters(
  params: URLSearchParams,
  options?: ControlCenterFilterOptions,
): ControlCenterFilters {
  const parsed = {
    setor: normalizeFilterValue(params.get('setor')),
    local: normalizeFilterValue(params.get('local')),
    tipo: normalizeFilterValue(params.get('tipo')),
  };
  if (!options) return parsed;
  return {
    setor: options.setor.some(value => value.toLocaleLowerCase('pt-BR') === parsed.setor.toLocaleLowerCase('pt-BR')) ? parsed.setor : '',
    local: options.local.some(value => value.toLocaleLowerCase('pt-BR') === parsed.local.toLocaleLowerCase('pt-BR')) ? parsed.local : '',
    tipo: options.tipo.some(value => value.toLocaleLowerCase('pt-BR') === parsed.tipo.toLocaleLowerCase('pt-BR')) ? parsed.tipo : '',
  };
}

export function matchesControlCenterFilters(eq: Equipment, filters: ControlCenterFilters): boolean {
  if (!isEquipmentActive(eq)) return false;
  const matches = (actual: string | undefined, expected: string) => !expected || normalizeFilterValue(actual).toLocaleLowerCase('pt-BR') === normalizeFilterValue(expected).toLocaleLowerCase('pt-BR');
  return matches(eq.setor, filters.setor) && matches(eq.local, filters.local) && matches(eq.tipo, filters.tipo);
}

export function filterControlCenterData(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  filters: ControlCenterFilters,
) {
  const filteredEquipments = equipments.filter(eq => matchesControlCenterFilters(eq, filters));
  const ids = new Set(filteredEquipments.map(eq => eq.id));
  return {
    equipments: filteredEquipments,
    inspections: inspections.filter(insp => ids.has(insp.equipmentId)),
    actionPlans: actionPlans.filter(plan => ids.has(plan.equipmentId)),
  };
}

export function hasControlCenterFilters(filters: ControlCenterFilters): boolean {
  return Boolean(filters.setor || filters.local || filters.tipo);
}

export function withControlCenterParams(
  path: string,
  filters: ControlCenterFilters,
  extra: Record<string, string | null | undefined> = {},
): string {
  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  for (const key of ['setor', 'local', 'tipo'] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}

export function isInspectionInRange(data: string, from: string, to: string): boolean {
  const normalized = normalizeYmd(data);
  return normalized !== null && normalized >= from && normalized <= to;
}
