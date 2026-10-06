import { describe, expect, it } from 'vitest';
import { calculateAssessmentScore, calculateAverageScenarioScore, calculateTrainingProgress, createSimulatorTraining, getReviewTopics, getTrainingDurationMinutes, isTrainingComplete, SIMULATOR_ASSESSMENT_QUESTIONS } from './simulatorTraining';

describe('simulator training helpers', () => {
  it('calculates guided progress independently from score', () => {
    const training = createSimulatorTraining({ name: 'Ana', role: 'Técnica' }, 'guided', new Date('2026-10-06T10:00:00.000Z'));
    training.scenarioResults['S02-01'] = { scenarioId: 'S02-01', attempts: 1, score: 10, bestScore: 10, completed: true, startedAt: training.startedAt, completedAt: '2026-10-06T10:10:00.000Z', selectedResult: 'conforme', expectedResult: 'conforme', checklistCorrect: 0, checklistTotal: 3, evidenceRegistered: false, actionPlanProgress: null };
    expect(calculateTrainingProgress(training)).toEqual({ completed: 1, total: 8, percent: 12.5 });
  });

  it('calculates assessment scores with stable question ids', () => {
    expect(SIMULATOR_ASSESSMENT_QUESTIONS).toHaveLength(8);
    expect(new Set(SIMULATOR_ASSESSMENT_QUESTIONS.map((question) => question.id)).size).toBe(8);
    const allCorrect = Object.fromEntries(SIMULATOR_ASSESSMENT_QUESTIONS.map((question) => [question.id, question.correctOptionId]));
    expect(calculateAssessmentScore(allCorrect)).toEqual({ correct: 8, total: 8, percent: 100 });
    expect(calculateAssessmentScore({})).toEqual({ correct: 0, total: 8, percent: 0 });
  });

  it('keeps average, completion and review topics deterministic', () => {
    const training = createSimulatorTraining({ name: 'Ana', role: '' }, 'guided', new Date('2026-10-06T10:00:00.000Z'));
    training.scenarioResults['S02-03'] = { scenarioId: 'S02-03', attempts: 2, score: 30, bestScore: 40, completed: true, startedAt: training.startedAt, completedAt: '2026-10-06T10:20:00.000Z', selectedResult: 'conforme', expectedResult: 'nao_conforme', checklistCorrect: 1, checklistTotal: 3, evidenceRegistered: true, actionPlanProgress: null };
    training.finalAssessment = { answers: { 'ASSESS-SIM-04': 'a' }, score: 0, correct: 0, total: 8, submitted: true, attempts: 1, submittedAt: '2026-10-06T10:30:00.000Z' };
    expect(calculateAverageScenarioScore(training)).toBe(40);
    expect(isTrainingComplete(training)).toBe(false);
    expect(getReviewTopics(training)).toEqual(['S02-03', 'Plano consolidado']);
    expect(getTrainingDurationMinutes({ ...training, completedAt: '2026-10-06T10:42:00.000Z' })).toBe(42);
  });
});
