import { create } from 'zustand';
import { SIMULATOR_EQUIPMENT_FIXTURES, type SimulatorEquipment } from './simulatorFixtures';

interface SimulatorState {
  equipment: SimulatorEquipment[];
  selectedEquipmentId: string | null;
  scenario: string;
  selectEquipment: (id: string | null) => void;
  updateEquipmentStatus: (id: string, status: SimulatorEquipment['status']) => void;
  reset: () => void;
}

function createInitialEquipment(): SimulatorEquipment[] {
  return SIMULATOR_EQUIPMENT_FIXTURES.map((equipment) => ({ ...equipment }));
}

export const useSimulatorStore = create<SimulatorState>((set) => ({
  equipment: createInitialEquipment(),
  selectedEquipmentId: null,
  scenario: 'Fundação do modo simulador',
  selectEquipment: (id) => set({ selectedEquipmentId: id }),
  updateEquipmentStatus: (id, status) => set((state) => ({
    equipment: state.equipment.map((equipment) => equipment.id === id ? { ...equipment, status } : equipment),
  })),
  reset: () => set({ equipment: createInitialEquipment(), selectedEquipmentId: null, scenario: 'Fundação do modo simulador' }),
}));
