import { getControlCenterIndicators } from './controlCenterIndicators';
import type { Equipment, Inspection, ActionPlan } from './controlCenterIndicators';

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: `EQ-${Math.random().toString(36).slice(2, 9)}`,
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
    id: `INSP-${Math.random().toString(36).slice(2, 9)}`,
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
    id: `PAC-${Math.random().toString(36).slice(2, 9)}`,
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

function generateDataset(equipmentCount: number, inspectionsPerEquipment: number = 3, plansPerEquipment: number = 1) {
  const equipments: Equipment[] = [];
  const inspections: Inspection[] = [];
  const actionPlans: ActionPlan[] = [];

  const statuses: Equipment['status'][] = ['regular', 'pendente', 'vencido', 'observacao', 'em_manutencao', 'inativo', 'substituido', 'extraviado'];
  const planStatuses: ActionPlan['status'][] = ['Aberta', 'Em andamento', 'Concluída', 'Vencida'];

  for (let i = 0; i < equipmentCount; i++) {
    const eqId = `EQ-${String(i + 1).padStart(5, '0')}`;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const hasInspections = Math.random() > 0.1;
    const nextDate = status === 'regular' ? '2026-12-31' : (status === 'vencido' ? '2026-06-10' : '2026-12-31');

    equipments.push(makeEquipment({
      id: eqId,
      status,
      dataProximaInspecao: nextDate,
    }));

    if (hasInspections) {
      for (let j = 0; j < inspectionsPerEquipment; j++) {
        const inspDate = `2026-${String(Math.floor(Math.random() * 6) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;
        const inspStatus = statuses[Math.floor(Math.random() * 4)];
        inspections.push(makeInspection({
          id: `INSP-${eqId}-${j}`,
          equipmentId: eqId,
          data: inspDate,
          status: inspStatus,
          createdAt: `${inspDate}T10:00:00Z`,
        }));
      }
    }

    if (status === 'pendente' || status === 'vencido') {
      for (let j = 0; j < plansPerEquipment; j++) {
        actionPlans.push(makeActionPlan({
          id: `PAC-${eqId}-${j}`,
          equipmentId: eqId,
          status: planStatuses[Math.floor(Math.random() * planStatuses.length)],
          prazo: Math.random() > 0.5 ? '2026-07-15' : '2026-06-10',
        }));
      }
    }
  }

  return { equipments, inspections, actionPlans };
}

function benchmark(name: string, equipmentCount: number, iterations: number = 5) {
  const { equipments, inspections, actionPlans } = generateDataset(equipmentCount);
  console.log(`\n=== ${name} (${equipmentCount} equipamentos, ${inspections.length} inspeções, ${actionPlans.length} planos) ===`);

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    getControlCenterIndicators(equipments, inspections, actionPlans, { todayYmd: '2026-06-20' });
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`  Média: ${avg.toFixed(2)}ms`);
  console.log(`  Mín: ${min.toFixed(2)}ms`);
  console.log(`  Máx: ${max.toFixed(2)}ms`);
  console.log(`  Execuções: ${iterations}`);

  return { avg, min, max };
}

console.log('Iniciando benchmarks do motor de indicadores...');

benchmark('Pequeno', 100, 10);
benchmark('Médio', 1000, 10);
benchmark('Grande', 10000, 5);

console.log('\n=== Resumo ===');
console.log('Todos os benchmarks concluídos com sucesso.');