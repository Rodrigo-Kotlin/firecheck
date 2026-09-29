import { FIELD_CONFIGS, type FieldConfig } from '../../constants/equipmentFormConfig';

export const EQUIPMENT_FORM_SECTIONS = ['identificacao', 'localizacao', 'dadosTecnicos', 'inspecaoManutencao'] as const;

export function fieldsBySection(tipo: string): Record<string, FieldConfig[]> {
  const map: Record<string, FieldConfig[]> = {
    identificacao: [], localizacao: [], dadosTecnicos: [], inspecaoManutencao: [],
  };
  for (const section of EQUIPMENT_FORM_SECTIONS) {
    map[section] = FIELD_CONFIGS.filter((field) => field.section === section && field.tipos.includes(tipo));
  }
  return map;
}
