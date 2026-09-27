import { describe, expect, it } from 'vitest';
import type { ActionPlan, Equipment, Inspection } from '../types';
import { getControlCenterCharts } from './controlCenterCharts';
import { getControlCenterIndicators } from './controlCenterIndicators';

const today = '2026-06-20';

function equipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'EQ-1',
    tipo: 'Extintor',
    local: 'Bloco A',
    setor: 'Administrativo',
    status: 'regular',
    dataProximaInspecao: '2026-12-31',
    ...overrides,
  };
}

function inspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'INSP-1',
    equipmentId: 'EQ-1',
    data: '2026-06-15',
    inspetor: 'Teste',
    status: 'regular',
    createdAt: '2026-06-15T10:00:00Z',
    ...overrides,
  };
}

function plan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    id: 'PAC-1',
    equipmentId: 'EQ-1',
    local: 'Bloco A',
    descricao: 'Corrigir equipamento',
    criticidade: 'Médio',
    responsavel: 'Teste',
    prazo: '2026-06-30',
    status: 'Aberta',
    createdAt: '2026-06-01',
    ...overrides,
  };
}

function charts(
  equipments: Equipment[],
  inspections: Inspection[] = [],
  plans: ActionPlan[] = [],
  options: Parameters<typeof getControlCenterCharts>[3] = {},
) {
  return getControlCenterCharts(equipments, inspections, plans, {
    todayYmd: today,
    ...options,
  });
}

function valueOf(data: { label: string; value: number }[], label: string): number {
  return data.find(item => item.label === label)?.value ?? 0;
}

describe('D04 control center chart aggregators', () => {
  describe('equipment situation', () => {
    it('handles empty inventory and each operational classification', () => {
      const result = charts([
        equipment({ id: 'regular' }),
        equipment({ id: 'observation', dataProximaInspecao: '2026-12-31' }),
        equipment({ id: 'pending' }),
        equipment({ id: 'expired-inspection' }),
        equipment({ id: 'never' }),
        equipment({ id: 'expired-deadline', dataProximaInspecao: '2026-06-19' }),
        equipment({ id: 'no-deadline', dataProximaInspecao: undefined }),
      ], [
        inspection({ id: 'i-regular', equipmentId: 'regular', status: 'regular' }),
        inspection({ id: 'i-observation', equipmentId: 'observation', status: 'observacao' }),
        inspection({ id: 'i-pending', equipmentId: 'pending', status: 'pendente' }),
        inspection({ id: 'i-expired', equipmentId: 'expired-inspection', status: 'vencido' }),
        inspection({ id: 'i-deadline', equipmentId: 'expired-deadline', status: 'regular' }),
        inspection({ id: 'i-no-deadline', equipmentId: 'no-deadline', status: 'regular' }),
      ]);

      expect(charts([]).equipmentSituation).toEqual([]);
      expect(valueOf(result.equipmentSituation, 'Em dia')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Em observação')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Não conformes')).toBe(2);
      expect(valueOf(result.equipmentSituation, 'Sem inspeção')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Prazo vencido')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Sem prazo')).toBe(1);
    });

    it('excludes tombstones and classifies non-operational status before inspection status', () => {
      const statuses = ['em_manutencao', 'inativo', 'substituido', 'extraviado'] as const;
      const equipments = statuses.map(status => equipment({ id: status, status }))
        .concat(equipment({ id: 'deleted', deletedAt: today }));
      const inspections = statuses.map(status => inspection({
        id: `inspection-${status}`,
        equipmentId: status,
        status: 'regular',
      }));

      const result = charts(equipments, inspections);

      expect(valueOf(result.equipmentSituation, 'Fora de operação')).toBe(4);
      expect(valueOf(result.equipmentSituation, 'Em dia')).toBe(0);
      expect(result.equipmentSituation.reduce((sum, item) => sum + item.value, 0)).toBe(4);
    });

    it('keeps every active equipment in one exclusive chart category', () => {
      const equipments = [
        equipment({ id: 'a' }),
        equipment({ id: 'b', dataProximaInspecao: '2026-06-19' }),
        equipment({ id: 'c', status: 'em_manutencao' }),
        equipment({ id: 'd', deletedAt: today }),
      ];
      const result = charts(equipments, [
        inspection({ id: 'ia', equipmentId: 'a', status: 'regular' }),
        inspection({ id: 'ib', equipmentId: 'b', status: 'pendente' }),
        inspection({ id: 'ic', equipmentId: 'c', status: 'regular' }),
      ]);

      expect(result.equipmentSituation.reduce((sum, item) => sum + item.value, 0)).toBe(3);
      expect(valueOf(result.equipmentSituation, 'Em dia')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Não conformes')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Fora de operação')).toBe(1);
      expect(valueOf(result.equipmentSituation, 'Prazo vencido')).toBe(0);
    });
  });

  describe('inspections by period', () => {
    it('returns the requested empty buckets and does not count duplicate IDs', () => {
      const result = charts([], [
        inspection({ id: 'same', data: '2026-06-19' }),
        inspection({ id: 'same', data: '2026-06-19', status: 'vencido' }),
      ], [], { period: '30d' });

      expect(result.inspectionsByPeriod).toHaveLength(31);
      expect(result.inspectionsByPeriod.reduce((sum, item) => sum + item.total, 0)).toBe(1);
      expect(result.inspectionsByPeriod.reduce((sum, item) => sum + item.regular, 0)).toBe(1);
    });

    it('uses operational data date, not updatedAt, and handles month/year boundaries', () => {
      const result = charts([], [
        inspection({ id: 'old-edited', data: '2025-12-31', updatedAt: '2026-06-20T12:00:00Z' }),
        inspection({ id: 'new-year', data: '2026-01-01' }),
        inspection({ id: 'leap-day', data: '2024-02-29' }),
      ], [], { todayYmd: '2026-01-31', period: '12m' });

      expect(result.inspectionsByPeriod.reduce((sum, item) => sum + item.total, 0)).toBe(2);
      expect(result.inspectionsByPeriod.map(item => item.period)).toContain('dez./2025');
      expect(result.inspectionsByPeriod.map(item => item.period)).toContain('jan./2026');
    });

    it.each([
      ['90d', 91],
      ['6m', 7],
      ['12m', 13],
    ] as const)('creates stable buckets for %s', (period, expectedBuckets) => {
      expect(charts([], [], [], { period }).inspectionsByPeriod).toHaveLength(expectedBuckets);
    });
  });

  describe('action plans', () => {
    it('partitions statuses and counts an overdue plan once', () => {
      const result = charts([equipment()], [], [
        plan({ id: 'open', status: 'Aberta', prazo: '2026-06-30' }),
        plan({ id: 'progress', status: 'Em andamento', prazo: '2026-06-19' }),
        plan({ id: 'expired', status: 'Vencida', prazo: '2026-06-19' }),
        plan({ id: 'done', status: 'Concluída', prazo: '2026-01-01' }),
        plan({ id: 'without-date', status: 'Aberta', prazo: '' }),
        plan({ id: 'deleted', status: 'Aberta', deletedAt: today }),
      ]);

      expect(valueOf(result.actionPlans, 'Aberta')).toBe(2);
      expect(valueOf(result.actionPlans, 'Em andamento')).toBe(1);
      expect(valueOf(result.actionPlans, 'Vencida')).toBe(1);
      expect(valueOf(result.actionPlans, 'Concluída')).toBe(1);
      expect(result.overduePlans[0]?.value).toBe(2);
    });

    it('ignores plans for deleted or non-existent equipment', () => {
      const result = charts([equipment()], [], [
        plan({ id: 'missing-equipment', equipmentId: 'unknown' }),
        plan({ id: 'deleted-equipment', equipmentId: 'EQ-2' }),
      ]);
      expect(result.actionPlans).toEqual([]);
      expect(result.overduePlans).toEqual([]);
    });
  });

  describe('sector occurrences', () => {
    it('counts distinct equipment by latest non-conformity and normalizes sectors', () => {
      const result = charts([
        equipment({ id: 'a', setor: '  Operação   Norte ' }),
        equipment({ id: 'b', setor: 'Operação Norte' }),
        equipment({ id: 'c', setor: '' }),
        equipment({ id: 'd', setor: 'Sem NC' }),
      ], [
        inspection({ id: 'old-a', equipmentId: 'a', data: '2026-06-01', status: 'pendente' }),
        inspection({ id: 'latest-a', equipmentId: 'a', data: '2026-06-15', status: 'regular' }),
        inspection({ id: 'b-1', equipmentId: 'b', status: 'vencido' }),
        inspection({ id: 'c-1', equipmentId: 'c', status: 'pendente' }),
        inspection({ id: 'd-1', equipmentId: 'd', status: 'regular' }),
      ]);

      expect(result.sectorOccurrences).toEqual([
        { setor: 'Não informado', count: 1 },
        { setor: 'Operação Norte', count: 1 },
      ]);
    });

    it('limits output to eight sectors and groups the remainder', () => {
      const equipments = Array.from({ length: 10 }, (_, index) => equipment({
        id: `eq-${index}`,
        setor: `Setor ${String(index).padStart(2, '0')}`,
      }));
      const inspections = equipments.map((eq, index) => inspection({
        id: `insp-${index}`,
        equipmentId: eq.id,
        status: 'pendente',
      }));
      const result = charts(equipments, inspections);

      expect(result.sectorOccurrences).toHaveLength(9);
      expect(result.sectorOccurrences.at(-1)).toEqual({ setor: 'Outros setores', count: 2 });
      expect(result.sectorOccurrences.slice(0, 8).every(item => item.count === 1)).toBe(true);
    });

    it('does not include never-inspected equipment', () => {
      const result = charts([equipment({ setor: 'Vazio' })]);
      expect(result.sectorOccurrences).toEqual([]);
    });
  });

  it('keeps equivalent D02 and D04 universes consistent', () => {
    const equipments = [
      equipment({ id: 'ok' }),
      equipment({ id: 'nc', setor: 'Operação' }),
      equipment({ id: 'maintenance', status: 'em_manutencao' }),
    ];
    const inspections = [
      inspection({ id: 'ok-insp', equipmentId: 'ok', status: 'regular' }),
      inspection({ id: 'nc-insp', equipmentId: 'nc', status: 'pendente' }),
      inspection({ id: 'maintenance-insp', equipmentId: 'maintenance', status: 'regular' }),
    ];
    const plans = [plan({ id: 'nc-plan', equipmentId: 'nc', status: 'Aberta' })];
    const d02 = getControlCenterIndicators(equipments, inspections, plans, { todayYmd: today });
    const d04 = charts(equipments, inspections, plans);

    expect(d02.equipment.operational.count).toBe(2);
    expect(d04.equipmentSituation.reduce((sum, item) => sum + item.value, 0)).toBe(3);
    expect(valueOf(d04.equipmentSituation, 'Em dia')).toBe(d02.equipment.upToDate.count);
    expect(valueOf(d04.equipmentSituation, 'Não conformes')).toBe(d02.equipment.lastInspectionNonConformity.count);
    expect(valueOf(d04.actionPlans, 'Aberta')).toBe(d02.actionPlans.open.count);
    expect(d04.sectorOccurrences.reduce((sum, item) => sum + item.count, 0)).toBe(d02.equipment.lastInspectionNonConformity.count);
  });

  it('records deterministic D02/D04 benchmark samples', () => {
    const samples = [100, 1000, 10000].map(size => {
      const equipments = Array.from({ length: size }, (_, index) => equipment({
        id: `bench-eq-${index}`,
        status: index % 11 === 0 ? 'em_manutencao' : 'regular',
        setor: `Setor ${index % 12}`,
      }));
      const inspections = equipments.flatMap((eq, index) => Array.from({ length: 3 }, (_, revision) => inspection({
        id: `bench-insp-${index}-${revision}`,
        equipmentId: eq.id,
        data: `2026-06-${String(10 + revision).padStart(2, '0')}`,
        status: revision === 2 && index % 5 === 0 ? 'pendente' : 'regular',
      })));
      const plans = equipments.filter((_, index) => index % 5 === 0).map((eq, index) => plan({
        id: `bench-plan-${index}`,
        equipmentId: eq.id,
      }));
      const runs = Array.from({ length: size === 10000 ? 3 : 5 }, () => {
        const d02Start = performance.now();
        getControlCenterIndicators(equipments, inspections, plans, { todayYmd: today });
        const d02Ms = performance.now() - d02Start;
        const d04Start = performance.now();
        charts(equipments, inspections, plans);
        const d04Ms = performance.now() - d04Start;
        return { d02Ms, d04Ms, combinedMs: d02Ms + d04Ms };
      });
      const summarize = (key: 'd02Ms' | 'd04Ms' | 'combinedMs') => {
        const values = runs.map(run => run[key]);
        return {
          average: values.reduce((sum, value) => sum + value, 0) / values.length,
          minimum: Math.min(...values),
          maximum: Math.max(...values),
        };
      };
      return { size, d02: summarize('d02Ms'), d04: summarize('d04Ms'), combined: summarize('combinedMs') };
    });

    console.log(JSON.stringify(samples, null, 2));
    expect(samples).toHaveLength(3);
    expect(samples.every(sample => sample.d02.average >= 0 && sample.d04.average >= 0)).toBe(true);
  }, 30000);
});
