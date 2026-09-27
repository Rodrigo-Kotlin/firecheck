import { describe, expect, it } from 'vitest';
import type { ActionPlan, Equipment, Inspection } from '../types';
import { getControlCenterCharts } from './controlCenterCharts';
import { getControlCenterIndicators } from './controlCenterIndicators';
import { getControlCenterEquipmentViewIds } from './controlCenterDrilldown';
import {
  filterControlCenterData,
  getControlCenterFilterOptions,
  parseControlCenterFilters,
  withControlCenterParams,
} from './controlCenterFilters';

function eq(id: string, overrides: Partial<Equipment> = {}): Equipment {
  return { id, tipo: 'Extintor', local: 'Área externa', setor: 'Estacionamento', status: 'regular', dataProximaInspecao: '2026-12-31', ...overrides };
}

function insp(id: string, equipmentId: string, overrides: Partial<Inspection> = {}): Inspection {
  return { id, equipmentId, data: '2026-06-15', inspetor: 'Teste', status: 'regular', createdAt: '2026-06-15T10:00:00Z', ...overrides };
}

function plan(id: string, equipmentId: string, overrides: Partial<ActionPlan> = {}): ActionPlan {
  return { id, equipmentId, local: 'Área externa', descricao: 'Ajuste', criticidade: 'Médio', responsavel: 'Teste', prazo: '2026-06-30', status: 'Aberta', createdAt: '2026-06-01', ...overrides };
}

describe('D05 global filters and drill-down contracts', () => {
  const equipments = [
    eq('EQ-1'),
    eq('EQ-2', { setor: 'Administrativo', local: 'Área  interna', tipo: 'Hidrante' }),
    eq('EQ-3', { setor: 'Estacionamento', local: 'Área externa', tipo: 'Extintor', status: 'em_manutencao' }),
    eq('EQ-4', { deletedAt: '2026-06-20' }),
  ];
  const inspections = [
    insp('I-1', 'EQ-1', { status: 'pendente' }),
    insp('I-2', 'EQ-2', { status: 'pendente' }),
    insp('I-3', 'EQ-3', { status: 'regular' }),
  ];
  const plans = [plan('P-1', 'EQ-2')];

  it('deduplicates options by irrelevant whitespace and keeps usable labels', () => {
    const options = getControlCenterFilterOptions(equipments.concat(eq('EQ-5', { setor: 'Estacionamento  ', local: ' Área externa', tipo: 'Extintor ' })));
    expect(options.setor).toEqual(['Administrativo', 'Estacionamento']);
    expect(options.local).toEqual(['Área externa', 'Área interna']);
    expect(options.tipo).toEqual(['Extintor', 'Hidrante']);
  });

  it('combines sector, location and type against active equipment only', () => {
    const data = filterControlCenterData(equipments, inspections, plans, { setor: ' estacionamento ', local: 'Área externa', tipo: 'Extintor' });
    expect(data.equipments.map(item => item.id)).toEqual(['EQ-1', 'EQ-3']);
    expect(data.inspections.map(item => item.id)).toEqual(['I-1', 'I-3']);
    expect(data.actionPlans).toEqual([]);
  });

  it('rejects invalid URL values and encodes special characters without manual concatenation', () => {
    const options = getControlCenterFilterOptions(equipments);
    const parsed = parseControlCenterFilters(new URLSearchParams('setor=Inventado&local=%C3%81rea%20externa&tipo=Extintor'), options);
    expect(parsed).toEqual({ setor: '', local: 'Área externa', tipo: 'Extintor' });
    const url = withControlCenterParams('/equipamentos?view=registered', { setor: 'Área externa', local: 'Bloco A & B', tipo: 'Extintor' }, { ccView: 'no-inspection' });
    const params = new URL(url, 'https://firecheck.local').searchParams;
    expect(params.get('setor')).toBe('Área externa');
    expect(params.get('local')).toBe('Bloco A & B');
    expect(params.get('ccView')).toBe('no-inspection');
    expect(url).toContain('view=registered');
  });

  it('uses exactly the same IDs for D02 cards and equipment drill-down', () => {
    const indicators = getControlCenterIndicators(equipments, inspections, plans, { todayYmd: '2026-06-20' });
    const attentionIds = getControlCenterEquipmentViewIds(equipments, inspections, plans, 'attention', '2026-06-20');
    const noInspectionIds = getControlCenterEquipmentViewIds(equipments, inspections, plans, 'no-inspection', '2026-06-20');
    expect(attentionIds).toEqual(indicators.equipment.requiresAttention.ids);
    expect(noInspectionIds).toEqual(indicators.equipment.noInspection.ids);
  });

  it('keeps attention as a union of distinct equipment IDs', () => {
    const data = [eq('A'), eq('B', { dataProximaInspecao: '2026-06-19' })];
    const dataInspections = [insp('A-I', 'A', { status: 'pendente' }), insp('B-I', 'B', { status: 'regular' })];
    const dataPlans = [plan('A-P', 'A', { status: 'Vencida', prazo: '2026-06-19' })];
    const result = getControlCenterIndicators(data, dataInspections, dataPlans, { todayYmd: '2026-06-20' });
    expect(new Set(result.equipment.requiresAttention.ids).size).toBe(result.equipment.requiresAttention.count);
    expect(result.equipment.requiresAttention.ids).toEqual(['A', 'B']);
  });

  it('reproduces chart category IDs and sector grouping', () => {
    const chart = getControlCenterCharts(equipments, inspections, plans, { todayYmd: '2026-06-20', period: '30d' });
    expect(getControlCenterEquipmentViewIds(equipments, inspections, plans, 'situation:em_dia', '2026-06-20')).toEqual(chart.equipmentSituationIds.em_dia);
    expect(chart.sectorEquipmentIds.Estacionamento).toEqual(['EQ-1']);
    expect(getControlCenterEquipmentViewIds(equipments, inspections, plans, 'sector', '2026-06-20', '30d', 'Estacionamento')).toEqual(['EQ-1']);
  });

  it('does not change current inventory totals when the historical period changes', () => {
    const current = getControlCenterIndicators(equipments, inspections, plans, { todayYmd: '2026-06-20' });
    const short = getControlCenterCharts(equipments, inspections, plans, { todayYmd: '2026-06-20', period: '30d' });
    const long = getControlCenterCharts(equipments, inspections, plans, { todayYmd: '2026-06-20', period: '12m' });
    expect(current.equipment.registered.count).toBe(3);
    expect(short.equipmentSituation.reduce((sum, item) => sum + item.value, 0)).toBe(3);
    expect(long.equipmentSituation.reduce((sum, item) => sum + item.value, 0)).toBe(3);
  });
});
