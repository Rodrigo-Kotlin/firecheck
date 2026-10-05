import { describe, it, expect } from 'vitest';
import { getControlCenterIndicators } from './controlCenterIndicators';
import type { ControlCenterIndicators, Equipment, Inspection, ActionPlan, ActionPlanItem } from './controlCenterIndicators';

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'EQ-001',
    tipo: 'Extintor',
    subtipo: 'PQS 6kg',
    local: 'Bloco A',
    setor: 'Administrativo',
    status: 'regular',
    dataProximaInspecao: '2026-12-31',
    dataUltimaInspecao: '2026-06-15',
    pendingDelete: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeInspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'INSP-001',
    equipmentId: 'EQ-001',
    data: '2026-06-15',
    inspetor: 'Ricardo Silva',
    status: 'regular',
    createdAt: '2026-06-15T10:00:00Z',
    ...overrides,
  };
}

function makeActionPlan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    id: 'PAC-INSP-001',
    equipmentId: 'EQ-001',
    local: 'Bloco A',
    descricao: 'Trocar extintor',
    criticidade: 'Médio',
    responsavel: 'João',
    prazo: '2026-07-15',
    status: 'Aberta',
    createdAt: '2026-06-15',
    ...overrides,
  };
}

function makeActionPlanItem(overrides: Partial<ActionPlanItem> = {}): ActionPlanItem {
  return {
    id: 'PAI-001',
    planId: 'PLAN-001',
    deviationKey: 'item-1',
    checklistItemKey: 'item-1',
    tipoDesvio: 'nonconformity',
    descricaoDesvio: 'Corrigir',
    acaoCorretiva: '',
    solucaoAdotada: '',
    responsavel: '',
    prazo: '',
    status: 'Aberta',
    createdAt: '2026-06-20',
    ...overrides,
  };
}

const today = '2026-06-20';

function runIndicators(
  equipments: Equipment[],
  inspections: Inspection[],
  actionPlans: ActionPlan[],
  options: Parameters<typeof getControlCenterIndicators>[3] = {}
): ControlCenterIndicators {
  return getControlCenterIndicators(equipments, inspections, actionPlans, { todayYmd: today, ...options });
}

describe('Control Center Indicators Engine', () => {
  describe('Contrato D02B: dimensões independentes', () => {
    it('mantém equipamento conforme em dia mesmo com prazo próximo ou vencido', () => {
      const inspection = makeInspection({ status: 'regular' });
      const near = runIndicators([makeEquipment({ dataProximaInspecao: '2026-06-23' })], [inspection], []);
      const overdue = runIndicators([makeEquipment({ dataProximaInspecao: '2026-06-19' })], [inspection], []);
      expect(near.equipment.upToDate.count).toBe(1);
      expect(near.equipment.requiresAttention.count).toBe(0);
      expect(near.equipment.inspectionsNearDeadline.count).toBe(1);
      expect(overdue.equipment.upToDate.count).toBe(1);
      expect(overdue.equipment.inspectionsOverdue.count).toBe(1);
    });

    it('não inclui sem inspeção em em dia ou requer atenção', () => {
      const result = runIndicators([makeEquipment()], [], []);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.requiresAttention.count).toBe(0);
      expect(result.equipment.noInspection.count).toBe(1);
    });

    it('classifica observação e não conformidade somente pelo resultado técnico', () => {
      const result = runIndicators([
        makeEquipment({ id: 'obs', dataProximaInspecao: '2026-06-22' }),
        makeEquipment({ id: 'nc', dataProximaInspecao: '2026-06-21' }),
      ], [
        makeInspection({ id: 'i-obs', equipmentId: 'obs', status: 'observacao' }),
        makeInspection({ id: 'i-nc', equipmentId: 'nc', status: 'vencido' }),
      ], []);
      expect(result.equipment.requiresAttention.ids).toEqual(['obs', 'nc']);
      expect(result.equipment.inspectionsNearDeadline.ids).toEqual(['obs', 'nc']);
      expect(result.equipment.inspectionsOverdue.count).toBe(0);
    });

    it('separa status legacy vencido de prazo temporal', () => {
      const result = runIndicators([makeEquipment({ dataProximaInspecao: '2026-12-31' })], [makeInspection({ status: 'vencido' })], []);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(1);
      expect(result.equipment.inspectionsOverdue.count).toBe(0);
      expect(result.deadlineClassification.vencido.count).toBe(0);
    });

    it('usa exatamente a janela inclusiva de três dias', () => {
      const dates = ['2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22', '2026-06-23', '2026-06-24'];
      const equipments = dates.map((date, index) => makeEquipment({ id: `EQ-${index}`, dataProximaInspecao: date }));
      const inspections = equipments.map(eq => makeInspection({ id: `I-${eq.id}`, equipmentId: eq.id }));
      const result = runIndicators(equipments, inspections, []);
      expect(result.equipment.inspectionsOverdue.ids).toEqual(['EQ-0']);
      expect(result.equipment.inspectionsNearDeadline.ids).toEqual(['EQ-1', 'EQ-2', 'EQ-3', 'EQ-4']);
    });
  });

  describe('Planos D02B', () => {
    it('conta planos abertos e itens v2 ativos sem duplicar o pai', () => {
      const plans = [
        makeActionPlan({ id: 'PLAN-A', modelVersion: 2 }),
        makeActionPlan({ id: 'PLAN-B', modelVersion: 2 }),
        makeActionPlan({ id: 'PLAN-C', modelVersion: 1, status: 'Aberta' }),
      ];
      const items = [
        makeActionPlanItem({ id: 'A-1', planId: 'PLAN-A', status: 'Concluída' }),
        makeActionPlanItem({ id: 'A-2', planId: 'PLAN-A', status: 'Aberta' }),
        makeActionPlanItem({ id: 'A-3', planId: 'PLAN-A', status: 'Aberta' }),
        makeActionPlanItem({ id: 'B-1', planId: 'PLAN-B', status: 'Concluída' }),
      ];
      const result = runIndicators([makeEquipment()], [], plans, { actionPlanItems: items });
      expect(result.actionPlans.open.count).toBe(2);
      expect(result.actionPlans.pendingItems.count).toBe(2);
    });

    it('aplica filtro real pelo equipamento do plano', () => {
      const equipments = [
        makeEquipment({ id: 'A', setor: 'Administrativo' }),
        makeEquipment({ id: 'B', setor: 'Operacional' }),
      ];
      const plans = [
        makeActionPlan({ id: 'PLAN-A', equipmentId: 'A' }),
        makeActionPlan({ id: 'PLAN-B', equipmentId: 'B' }),
      ];
      const result = runIndicators(equipments, [], plans, { filters: { setor: 'Administrativo' } });
      expect(result.actionPlans.open.ids).toEqual(['PLAN-A']);
    });

    it('reconhece plano consolidado por inspectionId e fallback legacy', () => {
      const equipment = makeEquipment({ status: 'pendente' });
      const inspection = makeInspection({ status: 'pendente' });
      const withCanonical = runIndicators([equipment], [inspection], [makeActionPlan({ id: 'OTHER', inspectionId: inspection.id, originType: 'inspection' })]);
      const withLegacy = runIndicators([equipment], [inspection], [makeActionPlan({ id: `PAC-${inspection.id}-item-1` })]);
      expect(withCanonical.specialCategories.nonConformitiesWithoutPlan.count).toBe(0);
      expect(withLegacy.specialCategories.nonConformitiesWithoutPlan.count).toBe(0);
    });
  });
  describe('Inventário vazio', () => {
    it('deve retornar zeros em todos os indicadores', () => {
      const result = runIndicators([], [], []);
      expect(result.equipment.registered.count).toBe(0);
      expect(result.equipment.operational.count).toBe(0);
      expect(result.equipment.coverage.count).toBe(0);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.requiresAttention.count).toBe(0);
      expect(result.equipment.noInspection.count).toBe(0);
      expect(result.equipment.inObservation.count).toBe(0);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(0);
      expect(result.equipment.inspectionsNearDeadline.count).toBe(0);
      expect(result.equipment.inspectionsOverdue.count).toBe(0);
      expect(result.actionPlans.open.count).toBe(0);
      expect(result.actionPlans.overdue.count).toBe(0);
      expect(result.actionPlans.completed.count).toBe(0);
      expect(result.specialCategories.underMaintenance.count).toBe(0);
      expect(result.specialCategories.inactive.count).toBe(0);
      expect(result.specialCategories.replaced.count).toBe(0);
      expect(result.specialCategories.missing.count).toBe(0);
      expect(result.specialCategories.nonConformitiesWithoutPlan.count).toBe(0);
    });
  });

  describe('Equipamento nunca inspecionado', () => {
    it('deve contar como registrado, operacional, sem inspeção e requer atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.registered.count).toBe(1);
      expect(result.equipment.operational.count).toBe(1);
      expect(result.equipment.coverage.count).toBe(0);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.noInspection.count).toBe(1);
      expect(result.equipment.noInspection.ids).toContain('EQ-001');
      expect(result.equipment.requiresAttention.count).toBe(0);
    });
  });

  describe('Inspeção regular com prazo futuro', () => {
    it('deve contar como em dia, coberto, não requer atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.registered.count).toBe(1);
      expect(result.equipment.operational.count).toBe(1);
      expect(result.equipment.coverage.count).toBe(1);
      expect(result.equipment.upToDate.count).toBe(1);
      expect(result.equipment.upToDate.ids).toContain('EQ-001');
      expect(result.equipment.requiresAttention.count).toBe(0);
      expect(result.equipment.noInspection.count).toBe(0);
    });

    it('mantém prazo futuro como vigente quando a inspeção exige atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'pendente', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'pendente' });
      const result = runIndicators([eq], [insp], []);
      expect(result.deadlineClassification.emDia.ids).toContain('EQ-001');
      expect(result.deadlineClassification.semPrazo.ids).not.toContain('EQ-001');
      expect(result.equipment.requiresAttention.ids).toContain('EQ-001');
    });
  });

  describe('Inspeção regular com prazo ausente', () => {
    it('não deve contar como em dia, deve ir para sem_prazo', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: undefined });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.upToDate.count).toBe(1);
      expect(result.deadlineClassification.semPrazo.count).toBe(1);
      expect(result.deadlineClassification.semPrazo.ids).toContain('EQ-001');
    });

    it('não confunde data inválida com prazo vigente', () => {
      const eq = makeEquipment({ id: 'EQ-001', dataProximaInspecao: 'invalid-date' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'observacao' });
      const result = runIndicators([eq], [insp], []);
      expect(result.deadlineClassification.semPrazo.ids).toContain('EQ-001');
      expect(result.deadlineClassification.emDia.ids).not.toContain('EQ-001');
    });
  });

  describe('Janela de próximos vencimentos', () => {
    it('usa a janela padrão de 30 dias para prazo válido', () => {
      const eq = makeEquipment({ id: 'EQ-001', dataProximaInspecao: '2026-06-23' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.inspectionsNearDeadline.ids).toContain('EQ-001');
    });

    it('não inclui equipamento sem inspeção no indicador de inspeções próximas', () => {
      const eq = makeEquipment({ id: 'EQ-001', dataProximaInspecao: '2026-06-23' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.noInspection.ids).toContain('EQ-001');
      expect(result.equipment.inspectionsNearDeadline.ids).not.toContain('EQ-001');
       expect(result.deadlineClassification.proximoVencimento.ids).toContain('EQ-001');
    });
  });

  describe('Inspeção regular com prazo vencido', () => {
    it('deve contar como vencido e requer atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-06-10' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.upToDate.count).toBe(1);
      expect(result.deadlineClassification.vencido.count).toBe(1);
      expect(result.equipment.inspectionsOverdue.count).toBe(1);
      expect(result.equipment.requiresAttention.count).toBe(0);
    });
  });

  describe('Última inspeção em observação', () => {
    it('deve contar como em observação e requer atenção, não como em dia', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'observacao', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'observacao' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.inObservation.count).toBe(1);
      expect(result.equipment.inObservation.ids).toContain('EQ-001');
      expect(result.equipment.requiresAttention.count).toBe(1);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(0);
    });
  });

  describe('Última inspeção pendente', () => {
    it('deve contar como não conformidade e requer atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'pendente', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'pendente' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(1);
      expect(result.equipment.lastInspectionNonConformity.ids).toContain('EQ-001');
      expect(result.equipment.requiresAttention.count).toBe(1);
    });
  });

  describe('Última inspeção vencida', () => {
    it('deve contar como não conformidade e requer atenção', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'vencido', dataProximaInspecao: '2026-06-10' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'vencido' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.upToDate.count).toBe(0);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(1);
      expect(result.equipment.inspectionsOverdue.count).toBe(1);
      expect(result.equipment.requiresAttention.count).toBe(1);
    });
  });

  describe('Várias inspeções do mesmo equipamento', () => {
    it('deve usar a mais recente pela regra data DESC, createdAt DESC, id DESC', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const inspOld = makeInspection({
        id: 'INSP-OLD',
        equipmentId: 'EQ-001',
        data: '2026-01-01',
        status: 'vencido',
        createdAt: '2026-01-01T10:00:00Z',
      });
      const inspNew = makeInspection({
        id: 'INSP-NEW',
        equipmentId: 'EQ-001',
        data: '2026-06-15',
        status: 'regular',
        createdAt: '2026-06-15T10:00:00Z',
      });
      const result = runIndicators([eq], [inspOld, inspNew], []);
      expect(result.equipment.upToDate.count).toBe(1);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(0);
    });
  });

  describe('Edição recente de inspeção antiga', () => {
    it('não deve tornar a inspeção antiga a mais recente pelo updatedAt', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const inspOld = makeInspection({
        id: 'INSP-OLD',
        equipmentId: 'EQ-001',
        data: '2026-01-01',
        status: 'vencido',
        createdAt: '2026-01-01T10:00:00Z',
        updatedAt: '2026-06-19T10:00:00Z',
      });
      const inspNew = makeInspection({
        id: 'INSP-NEW',
        equipmentId: 'EQ-001',
        data: '2026-06-15',
        status: 'regular',
        createdAt: '2026-06-15T10:00:00Z',
        updatedAt: '2026-06-15T10:00:00Z',
      });
      const result = runIndicators([eq], [inspOld, inspNew], []);
      expect(result.equipment.upToDate.count).toBe(1);
      expect(result.equipment.lastInspectionNonConformity.count).toBe(0);
    });
  });

  describe('Empate de data com createdAt diferente', () => {
    it('deve usar createdAt como desempate', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const insp1 = makeInspection({
        id: 'INSP-1',
        equipmentId: 'EQ-001',
        data: '2026-06-15',
        status: 'vencido',
        createdAt: '2026-06-15T08:00:00Z',
      });
      const insp2 = makeInspection({
        id: 'INSP-2',
        equipmentId: 'EQ-001',
        data: '2026-06-15',
        status: 'regular',
        createdAt: '2026-06-15T10:00:00Z',
      });
      const result = runIndicators([eq], [insp1, insp2], []);
      expect(result.equipment.upToDate.count).toBe(1);
    });
  });

  describe('Equipamento em manutenção', () => {
    it('deve contar como fora de operação, não operacional', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'em_manutencao' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.registered.count).toBe(1);
      expect(result.equipment.operational.count).toBe(0);
      expect(result.specialCategories.underMaintenance.count).toBe(1);
      expect(result.specialCategories.underMaintenance.ids).toContain('EQ-001');
      expect(result.equipment.requiresAttention.count).toBe(0);
    });
  });

  describe('Equipamento inativo', () => {
    it('deve contar como fora de operação', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'inativo' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.operational.count).toBe(0);
      expect(result.specialCategories.inactive.count).toBe(1);
    });
  });

  describe('Equipamento substituído', () => {
    it('deve contar como fora de operação', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'substituido' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.operational.count).toBe(0);
      expect(result.specialCategories.replaced.count).toBe(1);
    });
  });

  describe('Equipamento extraviado', () => {
    it('deve contar como fora de operação', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'extraviado' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.operational.count).toBe(0);
      expect(result.specialCategories.missing.count).toBe(1);
    });
  });

  describe('Equipamento excluído (soft delete)', () => {
    it('não deve aparecer em nenhum indicador', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', deletedAt: '2026-06-10T10:00:00Z' });
      const result = runIndicators([eq], [], []);
      expect(result.equipment.registered.count).toBe(0);
      expect(result.equipment.operational.count).toBe(0);
    });
  });

  describe('Plano aberto', () => {
    it('deve contar como plano aberto', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Aberta' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(1);
      expect(result.actionPlans.open.ids).toContain('PLAN-001');
    });
  });

  describe('Plano em andamento', () => {
    it('deve contar como plano aberto', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Em andamento' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(1);
    });
  });

  describe('Plano concluído', () => {
    it('deve contar como concluído, não como aberto', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Concluída' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.completed.count).toBe(1);
      expect(result.actionPlans.open.count).toBe(0);
    });
  });

  describe('Plano vencido (status)', () => {
    it('deve contar como aberto e atrasado', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Vencida', prazo: '2026-06-10' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(1);
      expect(result.actionPlans.overdue.count).toBe(1);
    });
  });

  describe('Plano com prazo ultrapassado', () => {
    it('deve contar como atrasado mesmo com status Aberta', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Aberta', prazo: '2026-06-10' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(1);
      expect(result.actionPlans.overdue.count).toBe(1);
    });
  });

  describe('Plano sem prazo', () => {
    it('deve identificar como sem prazo', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Aberta', prazo: '' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(1);
      expect(result.actionPlans.withoutDeadline.count).toBe(1);
    });
  });

  describe('Não conformidade sem plano associado', () => {
    it('deve identificar inspeção pendente/vencida sem plano PAC', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'pendente', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'pendente' });
      const result = runIndicators([eq], [insp], []);
      expect(result.specialCategories.nonConformitiesWithoutPlan.count).toBe(1);
      expect(result.specialCategories.nonConformitiesWithoutPlan.ids).toContain('EQ-001');
    });
  });

  describe('Não conformidade COM plano associado', () => {
    it('não deve contar como sem plano', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'pendente', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'pendente' });
      const plan = makeActionPlan({ id: 'PAC-INSP-001', equipmentId: 'EQ-001', status: 'Aberta' });
      const result = runIndicators([eq], [insp], [plan]);
      expect(result.specialCategories.nonConformitiesWithoutPlan.count).toBe(0);
    });
  });

  describe('Equipamento com vários motivos de atenção', () => {
    it('deve contar uma única vez em requiresAttention', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'vencido', dataProximaInspecao: '2026-06-10' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'vencido' });
      const plan = makeActionPlan({ id: 'PAC-INSP-001', equipmentId: 'EQ-001', status: 'Aberta', prazo: '2026-06-10' });
      const result = runIndicators([eq], [insp], [plan]);
      expect(result.equipment.requiresAttention.count).toBe(1);
      expect(result.equipment.requiresAttention.ids).toContain('EQ-001');
    });
  });

  describe('Data inválida', () => {
    it('deve tratar dataProximaInspecao inválida como sem_prazo', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: 'invalid-date' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], []);
      expect(result.deadlineClassification.semPrazo.count).toBe(1);
    });

    it('deve tratar data de inspeção inválida não quebrando a ordenação', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular', data: 'invalid' });
      const result = runIndicators([eq], [insp], []);
      expect(result.equipment.coverage.count).toBe(0);
    });
  });

  describe('Transição de dia na comparação de prazo', () => {
    it('prazo igual a hoje não é vencido', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-06-20' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], [], { todayYmd: '2026-06-20' });
      expect(result.deadlineClassification.vencido.count).toBe(0);
      expect(result.deadlineClassification.proximoVencimento.count).toBe(1);
    });

    it('prazo anterior a hoje é vencido', () => {
      const eq = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-06-19' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq], [insp], [], { todayYmd: '2026-06-20' });
      expect(result.deadlineClassification.vencido.count).toBe(1);
    });
  });

  describe('Filtros por setor, local, tipo', () => {
    it('deve filtrar por setor', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', setor: 'Administrativo' });
      const eq2 = makeEquipment({ id: 'EQ-002', setor: 'TI' });
      const result = runIndicators([eq1, eq2], [], [], { filters: { setor: 'Administrativo' } });
      expect(result.equipment.registered.count).toBe(1);
      expect(result.equipment.registered.ids).toContain('EQ-001');
    });

    it('deve filtrar por local', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', local: 'Bloco A' });
      const eq2 = makeEquipment({ id: 'EQ-002', local: 'Bloco B' });
      const result = runIndicators([eq1, eq2], [], [], { filters: { local: 'Bloco A' } });
      expect(result.equipment.registered.count).toBe(1);
    });

    it('deve filtrar por tipo', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', tipo: 'Extintor' });
      const eq2 = makeEquipment({ id: 'EQ-002', tipo: 'Hidrante' });
      const result = runIndicators([eq1, eq2], [], [], { filters: { tipo: 'Extintor' } });
      expect(result.equipment.registered.count).toBe(1);
    });
  });

  describe('Consistência: invariantes', () => {
    it('inspecionados <= operacionais', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', status: 'regular' });
      const eq2 = makeEquipment({ id: 'EQ-002', status: 'regular' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq1, eq2], [insp], []);
      expect(result.equipment.coverage.count).toBeLessThanOrEqual(result.equipment.operational.count);
    });

    it('em dia <= operacionais', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const eq2 = makeEquipment({ id: 'EQ-002', status: 'regular' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const result = runIndicators([eq1, eq2], [insp], []);
      expect(result.equipment.upToDate.count).toBeLessThanOrEqual(result.equipment.operational.count);
    });

    it('sem inspeção e inspecionados são disjuntos', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', status: 'regular' });
      const eq2 = makeEquipment({ id: 'EQ-002', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const insp = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-002', status: 'regular' });
      const result = runIndicators([eq1, eq2], [insp], []);
      const noInspSet = new Set(result.equipment.noInspection.ids);
      const inspSet = new Set(result.equipment.coverage.inspectedIds);
      for (const id of noInspSet) {
        expect(inspSet.has(id)).toBe(false);
      }
    });

    it('em dia e sem_prazo são disjuntos', () => {
      const eq1 = makeEquipment({ id: 'EQ-001', status: 'regular', dataProximaInspecao: '2026-12-31' });
      const eq2 = makeEquipment({ id: 'EQ-002', status: 'regular', dataProximaInspecao: undefined });
      const insp1 = makeInspection({ id: 'INSP-001', equipmentId: 'EQ-001', status: 'regular' });
      const insp2 = makeInspection({ id: 'INSP-002', equipmentId: 'EQ-002', status: 'regular' });
      const result = runIndicators([eq1, eq2], [insp1, insp2], []);
      const emDiaSet = new Set(result.deadlineClassification.emDia.ids);
      const semPrazoSet = new Set(result.deadlineClassification.semPrazo.ids);
      for (const id of emDiaSet) {
        expect(semPrazoSet.has(id)).toBe(false);
      }
    });

    it('plano concluído não conta como aberto', () => {
      const eq = makeEquipment({ id: 'EQ-001' });
      const plan = makeActionPlan({ id: 'PLAN-001', equipmentId: 'EQ-001', status: 'Concluída' });
      const result = runIndicators([eq], [], [plan]);
      expect(result.actionPlans.open.count).toBe(0);
      expect(result.actionPlans.completed.count).toBe(1);
    });
  });
});
