import { beforeEach, describe, expect, it } from 'vitest';
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
    store.setInspectionResult('conforme');
    store.completeSession();
    expect(useSimulatorStore.getState().activeSession?.completed).toBe(true);
    expect(useSimulatorStore.getState().activeSession?.feedback?.correct).toBe(false);
  });
});
