import { beforeEach, describe, expect, it } from 'vitest';
import { useSimulatorStore } from './simulatorStore';

describe('simulator store', () => {
  beforeEach(() => useSimulatorStore.getState().reset());

  it('loads fictional fixtures and changes only in memory', () => {
    const initial = useSimulatorStore.getState().equipment;
    expect(initial.map((equipment) => equipment.id)).toContain('EXT-SIM-001');

    useSimulatorStore.getState().updateEquipmentStatus('EXT-SIM-001', 'observacao');
    expect(useSimulatorStore.getState().equipment.find((equipment) => equipment.id === 'EXT-SIM-001')?.status).toBe('observacao');
  });

  it('restores fixtures on reset', () => {
    useSimulatorStore.getState().selectEquipment('EXT-SIM-002');
    useSimulatorStore.getState().updateEquipmentStatus('EXT-SIM-002', 'vencido');
    useSimulatorStore.getState().reset();

    expect(useSimulatorStore.getState().selectedEquipmentId).toBeNull();
    expect(useSimulatorStore.getState().equipment.find((equipment) => equipment.id === 'EXT-SIM-002')?.status).toBe('observacao');
  });
});
