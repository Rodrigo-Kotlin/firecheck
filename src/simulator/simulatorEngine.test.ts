import { describe, expect, it } from 'vitest';
import { calculateScore, deriveExpectedOverall, getSimulatorScenarios, getTemporalStatus } from './simulatorEngine';

describe('simulator didactic engine', () => {
  const scenarios = getSimulatorScenarios(new Date(2026, 9, 6));

  it('loads six stable scenarios', () => {
    expect(scenarios).toHaveLength(6);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(6);
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
    const session = { scenarioId: scenario.id, startedAt: '2026-10-06T12:00:00.000Z', currentStep: 5, answers: Object.fromEntries(scenario.checklist.map((item) => [item.id, { selectedResult: item.expectedResult, studentNote: '' }])), selectedEquipment: { ...scenario.initialEquipment }, inspectionResult: scenario.expectedResult, completed: false, feedback: null };
    expect(calculateScore(session, scenario)).toBe(100);
  });
});
