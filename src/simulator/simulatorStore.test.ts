import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimulatorStore } from './simulatorStore';

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
});
