const EQUIPMENT_FILTER_PARAMS = ['q', 'view', 'ccView', 'sector', 'setor', 'local', 'tipo'] as const;

export function clearEquipmentFilterParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  EQUIPMENT_FILTER_PARAMS.forEach((key) => next.delete(key));
  return next;
}

export function hasEquipmentFilterParams(params: URLSearchParams): boolean {
  return EQUIPMENT_FILTER_PARAMS.some((key) => Boolean(params.get(key)));
}
