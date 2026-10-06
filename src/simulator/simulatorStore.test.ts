import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulatorStore } from './simulatorStore';
import { SIMULATOR_ASSESSMENT_QUESTIONS } from './simulatorTraining';

describe('simulator store', () => {
  beforeEach(() => useSimulatorStore.getState().reset());

  it('starts a cloned session without mutating the catalog', () => {
    const store = useSimulatorStore.getState();
    const original = store.scenarios[0].initialEquipment.description;
    store.startSession('S02-01');
    const session = useSimulatorStore.getState().activeSession;
    expect(session?.scenarioId).toBe('S02-01');
    expect(session?.selectedEquipment).not.toBe(store.scenarios[0].initialEquipment);
    expect(useSimulatorStore.getState().scenarios[0].initialEquipment.description).toBe(original);
  });

  it('preserves answers until reset and then clears the session', () => {
    const store = useSimulatorStore.getState();
    store.startSession('S02-02');
    store.setChecklistAnswer('CHK-SIM-02-02', { selectedResult: 'observacao', studentNote: 'Desgaste visível.' });
    expect(useSimulatorStore.getState().activeSession?.answers['CHK-SIM-02-02'].studentNote).toBe('Desgaste visível.');
    store.resetSession();
    expect(useSimulatorStore.getState().activeSession?.answers).toEqual({});
  });

  it('allows an incorrect result and explains it after completion', () => {
    const store = useSimulatorStore.getState();
    store.startSession('S02-03');
    store.setChecklistAnswer('CHK-SIM-03-01', { selectedResult: 'nao_conforme', studentNote: '' });
    store.addEvidence(new Blob(['photo'], { type: 'image/jpeg' }), 'CHK-SIM-03-01');
    store.setInspectionResult('conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().activeSession?.completed).toBe(true);
    expect(useSimulatorStore.getState().activeSession?.feedback?.correct).toBe(false);
  });

  it('keeps evidence in memory, enforces the limit and revokes removed previews', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const store = useSimulatorStore.getState();
    store.startSession('S02-03');
    for (let index = 0; index < 5; index += 1) expect(store.addEvidence(new Blob([String(index)], { type: 'image/jpeg' }), 'CHK-SIM-03-01')).toBe(index < 4);
    const evidence = useSimulatorStore.getState().activeSession?.evidence ?? [];
    expect(evidence).toHaveLength(4);
    store.removeEvidence(evidence[0].id);
    expect(useSimulatorStore.getState().activeSession?.evidence).toHaveLength(3);
    expect(revoke).toHaveBeenCalledWith(evidence[0].previewUrl);
    revoke.mockRestore();
  });

  it('replaces an accepted in-memory preview before revoking the old one', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const store = useSimulatorStore.getState();
    store.startSession('S02-03');
    store.addEvidence(new Blob(['old'], { type: 'image/jpeg' }), 'CHK-SIM-03-01');
    const before = useSimulatorStore.getState().activeSession!.evidence[0];
    expect(store.replaceEvidence(before.id, new Blob(['new'], { type: 'image/jpeg' }))).toBe(true);
    const after = useSimulatorStore.getState().activeSession!.evidence[0];
    expect(after.previewUrl).not.toBe(before.previewUrl);
    expect(after.blob.size).toBe(3);
    expect(revoke).toHaveBeenCalledWith(before.previewUrl);
    revoke.mockRestore();
  });

  it('requires evidence for S02-03 and permits completion after adding it', () => {
    const store = useSimulatorStore.getState();
    store.startSession('S02-03');
    store.setInspectionResult('nao_conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().activeSession?.completed).toBe(false);
    expect(useSimulatorStore.getState().activeSession?.completionMessage).toContain('evidência');
    store.addEvidence(new Blob(['photo'], { type: 'image/jpeg' }), 'CHK-SIM-03-01');
    store.completeSession();
    expect(useSimulatorStore.getState().activeSession?.completed).toBe(true);
  });

  it('creates one simulated parent plan with one item per selected deviation', () => {
    const store = useSimulatorStore.getState();
    store.startSession('S02-04');
    store.setChecklistAnswer('CHK-SIM-04-01', { selectedResult: 'observacao', studentNote: '' });
    store.setChecklistAnswer('CHK-SIM-04-02', { selectedResult: 'nao_conforme', studentNote: '' });
    store.setChecklistAnswer('CHK-SIM-04-03', { selectedResult: 'conforme', studentNote: '' });
    store.setInspectionResult('nao_conforme');
    store.completeSession();
    const plan = useSimulatorStore.getState().activeSession?.actionPlan;
    expect(plan?.id).toBe('PAC-SIM-S02-04');
    expect(plan?.items).toHaveLength(2);
    store.updateActionItem(plan!.items[0].id, { status: 'Concluída', correctiveAction: 'Trocar componente', adoptedSolution: 'Substituição simulada' });
    const firstItem = useSimulatorStore.getState().activeSession?.actionPlan?.items[0];
    expect(firstItem?.correctiveAction).not.toBe(firstItem?.adoptedSolution);
    expect(useSimulatorStore.getState().activeSession?.actionPlan?.status).toBe('Em andamento');
    store.updateActionItem(plan!.items[1].id, { status: 'Concluída' });
    expect(useSimulatorStore.getState().activeSession?.actionPlan?.status).toBe('Concluída');
  });

  it('interrupts and resumes S02-07 without a persistence service', () => {
    const store = useSimulatorStore.getState();
    store.startSession('S02-07');
    store.setChecklistAnswer('CHK-SIM-07-01', { selectedResult: 'conforme', studentNote: 'ok' });
    store.setChecklistAnswer('CHK-SIM-07-02', { selectedResult: 'observacao', studentNote: 'desgaste' });
    store.simulateInterruption();
    expect(useSimulatorStore.getState().activeSession).toBeNull();
    expect(useSimulatorStore.getState().simulatedDraft?.session.answers['CHK-SIM-07-02'].studentNote).toBe('desgaste');
    store.resumeDraft();
    expect(useSimulatorStore.getState().activeSession?.answers['CHK-SIM-07-01'].studentNote).toBe('ok');
    store.discardDraft();
  });

  it('simulates offline pending and synced states without changing navigator', () => {
    const original = navigator.onLine;
    const store = useSimulatorStore.getState();
    store.startSession('S02-08');
    store.simulateOffline();
    store.setInspectionResult('conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().activeSession?.networkMode).toBe('offline');
    expect(useSimulatorStore.getState().activeSession?.simulatedSyncState).toBe('pending');
    store.simulateOnline();
    expect(useSimulatorStore.getState().activeSession?.simulatedSyncState).toBe('synced');
    expect(navigator.onLine).toBe(original);
  });

  it('starts a temporary guided training with participant data only in the store', () => {
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria Silva', role: 'Brigadista' }, 'guided');
    expect(useSimulatorStore.getState().training).toMatchObject({ mode: 'guided', participant: { name: 'Maria Silva', role: 'Brigadista' }, status: 'in_progress' });
  });

  it('keeps guided scenarios in the configured order while allowing free mode independently', () => {
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria', role: '' }, 'guided');
    store.startSession('S02-02');
    expect(useSimulatorStore.getState().activeSession).toBeNull();
    store.startSession('S02-01');
    expect(useSimulatorStore.getState().activeSession?.scenarioId).toBe('S02-01');
    store.resetTraining();
    store.startTraining({ name: 'Maria', role: '' }, 'free');
    store.startSession('S02-08');
    expect(useSimulatorStore.getState().activeSession?.scenarioId).toBe('S02-08');
  });

  it('increments attempts and preserves the best scenario score', () => {
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria', role: '' }, 'guided');
    store.startSession('S02-01');
    store.setInspectionResult('conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().training?.scenarioResults['S02-01'].attempts).toBe(1);
    store.resetSession();
    store.setInspectionResult('conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().training?.scenarioResults['S02-01'].attempts).toBe(2);
    expect(useSimulatorStore.getState().training?.scenarioResults['S02-01'].bestScore).toBe(30);
  });

  it('blocks incomplete assessment, locks submitted answers and supports a new attempt', () => {
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria', role: '' }, 'guided');
    const training = useSimulatorStore.getState().training!;
    useSimulatorStore.setState({ training: { ...training, scenarioResults: Object.fromEntries(store.scenarios.map((scenario) => [scenario.id, { scenarioId: scenario.id, attempts: 1, score: 100, bestScore: 100, completed: true, startedAt: training.startedAt, completedAt: training.startedAt, selectedResult: scenario.expectedResult, expectedResult: scenario.expectedResult, checklistCorrect: scenario.checklist.length, checklistTotal: scenario.checklist.length, evidenceRegistered: false, actionPlanProgress: null }])) } });
    store.resetAssessment();
    expect(store.submitAssessment()).toBe(false);
    expect(useSimulatorStore.getState().assessmentMessage).toContain('Faltam 8');
    for (const question of SIMULATOR_ASSESSMENT_QUESTIONS) store.setAssessmentAnswer(question.id, question.correctOptionId);
    expect(store.submitAssessment()).toBe(true);
    expect(useSimulatorStore.getState().training?.finalAssessment).toMatchObject({ score: 100, correct: 8, submitted: true, attempts: 1 });
    store.setAssessmentAnswer('ASSESS-SIM-01', 'b');
    expect(useSimulatorStore.getState().training?.finalAssessment?.answers['ASSESS-SIM-01']).toBe('a');
    store.resetAssessment();
    expect(useSimulatorStore.getState().training?.finalAssessment?.submitted).toBe(false);
  });

  it('resetTraining removes participant, results, drafts and active session', () => {
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria', role: '' }, 'guided');
    store.startSession('S02-07');
    store.simulateInterruption();
    store.resetTraining();
    expect(useSimulatorStore.getState().training).toBeNull();
    expect(useSimulatorStore.getState().activeSession).toBeNull();
    expect(useSimulatorStore.getState().simulatedDraft).toBeNull();
  });

  it('cleans in-memory evidence when the simulator is exited', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const store = useSimulatorStore.getState();
    store.startTraining({ name: 'Maria', role: '' }, 'free');
    store.startSession('S02-03');
    store.addEvidence(new Blob(['photo'], { type: 'image/jpeg' }), 'CHK-SIM-03-01');
    const preview = useSimulatorStore.getState().activeSession!.evidence[0].previewUrl;
    store.reset();
    expect(revoke).toHaveBeenCalledWith(preview);
    expect(useSimulatorStore.getState().training).toBeNull();
    revoke.mockRestore();
  });
});
