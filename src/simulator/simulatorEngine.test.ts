import { describe, expect, it } from 'vitest';
import { calculateScore, createSimulatorSession, deriveExpectedOverall, getActionPlanProgress, getActionPlanStatus, getSimulatorScenarios, getTemporalStatus, isActionItemOverdue } from './simulatorEngine';

describe('simulator didactic engine', () => {
  const scenarios = getSimulatorScenarios(new Date(2026, 9, 6));

  it('loads eight stable scenarios', () => {
    expect(scenarios).toHaveLength(8);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(8);
  });

  it('derives the global result by severity', () => {
    expect(deriveExpectedOverall(scenarios[0].checklist)).toBe('conforme');
    expect(deriveExpectedOverall(scenarios[1].checklist)).toBe('observacao');
    expect(deriveExpectedOverall(scenarios[3].checklist)).toBe('nao_conforme');
  });

  it('keeps temporal status separate from technical result', () => {
    expect(scenarios[4].expectedResult).toBe('conforme');
    expect(scenarios[5].expectedResult).toBe('conforme');
    expect(getTemporalStatus(scenarios[4].initialEquipment.nextInspectionDate, '2026-10-06')).toBe('proximo');
    expect(getTemporalStatus(scenarios[5].initialEquipment.nextInspectionDate, '2026-10-06')).toBe('vencido');
  });

  it('calculates a deterministic in-memory score', () => {
    const scenario = scenarios[0];
    const session = { ...createSimulatorSession(scenario, new Date('2026-10-06T12:00:00.000Z')), currentStep: 5, answers: Object.fromEntries(scenario.checklist.map((item) => [item.id, { selectedResult: item.expectedResult, studentNote: '' }])), inspectionResult: scenario.expectedResult };
    expect(calculateScore(session, scenario)).toBe(100);
  });

  it('models consolidated plan status, progress and derived overdue state', () => {
    const items = [
      { id: 'a', deviationKey: 'd1', description: 'a', correctiveAction: '', adoptedSolution: '', responsible: '', deadline: '2026-10-05', status: 'Aberta' as const, completedAt: null },
      { id: 'b', deviationKey: 'd2', description: 'b', correctiveAction: '', adoptedSolution: '', responsible: '', deadline: '2026-10-06', status: 'Concluída' as const, completedAt: '2026-10-06T10:00:00.000Z' },
    ];
    expect(getActionPlanStatus(items)).toBe('Em andamento');
    expect(getActionPlanProgress({ id: 'PAC-SIM-S02-04', scenarioId: 'S02-04', equipmentId: 'EXT-SIM-004', status: 'Em andamento', items, createdAt: '' })).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(isActionItemOverdue(items[0], '2026-10-06')).toBe(true);
    expect(isActionItemOverdue(items[1], '2026-10-06')).toBe(false);
  });
});
