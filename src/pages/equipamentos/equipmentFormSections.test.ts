import { describe, expect, it } from 'vitest';
import { EQUIP_TYPES, FIELD_CONFIGS } from '../../constants/equipmentFormConfig';
import { EQUIPMENT_FORM_SECTIONS, fieldsBySection } from './equipmentFormSections';

describe('equipment form sections', () => {
  it('keeps the configured section order and field order for every supported type', () => {
    for (const tipo of EQUIP_TYPES) {
      const sections = fieldsBySection(tipo);
      expect(Object.keys(sections)).toEqual([...EQUIPMENT_FORM_SECTIONS]);

      for (const section of EQUIPMENT_FORM_SECTIONS) {
        const expected = FIELD_CONFIGS.filter((field) => field.section === section && field.tipos.includes(tipo));
        expect(sections[section]).toEqual(expected);
        expect(sections[section].every((field) => field.tipos.includes(tipo))).toBe(true);
      }
    }
  });

  it('preserves representative conditional fields and input types', () => {
    expect(fieldsBySection('Extintor').dadosTecnicos.map((field) => field.name)).toContain('modeloExtintor');
    expect(fieldsBySection('Extintor').inspecaoManutencao.map((field) => field.type)).toEqual(['date', 'date', 'date']);
    expect(fieldsBySection('Hidrante').dadosTecnicos.map((field) => field.name)).toContain('tipoHidrante');
    expect(fieldsBySection('Mangueira').inspecaoManutencao.map((field) => field.name)).toEqual([
      'dataTesteHidrostatico',
      'dataValidadeTeste',
    ]);
    expect(fieldsBySection('Outro').dadosTecnicos.map((field) => field.name)).toEqual(['nomeModelo', 'descricaoTecnica']);
  });
});
