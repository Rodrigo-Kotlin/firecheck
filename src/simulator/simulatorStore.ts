import { create } from 'zustand';
import { SIMULATOR_EQUIPMENT_FIXTURES, type SimulatorEquipment } from './simulatorFixtures';
import { createSimulatorSession, evaluateSession, getSimulatorScenarios, type SimulatorAnswer, type SimulatorResult, type SimulatorScenario, type SimulatorSession } from './simulatorEngine';

interface SimulatorState {
  equipment: SimulatorEquipment[];
  selectedEquipmentId: string | null;
  scenario: string;
  scenarios: readonly SimulatorScenario[];
  activeSession: SimulatorSession | null;
  selectEquipment: (id: string | null) => void;
  updateEquipmentStatus: (id: string, status: SimulatorEquipment['status']) => void;
  startSession: (scenarioId: string) => void;
  setStep: (step: number) => void;
  setChecklistAnswer: (itemId: string, answer: SimulatorAnswer) => void;
  setInspectionResult: (result: SimulatorResult) => void;
  completeSession: () => void;
  resetSession: () => void;
  reset: () => void;
}

function createInitialEquipment(): SimulatorEquipment[] {
  return SIMULATOR_EQUIPMENT_FIXTURES.map((equipment) => ({ ...equipment }));
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  equipment: createInitialEquipment(), selectedEquipmentId: null, scenario: 'Motor didático do simulador', scenarios: getSimulatorScenarios(), activeSession: null,
  selectEquipment: (id) => set({ selectedEquipmentId: id }),
  updateEquipmentStatus: (id, status) => set((state) => ({ equipment: state.equipment.map((equipment) => equipment.id === id ? { ...equipment, status } : equipment) })),
  startSession: (scenarioId) => {
    const scenario = get().scenarios.find((candidate) => candidate.id === scenarioId);
    if (scenario) set({ activeSession: createSimulatorSession(scenario) });
  },
  setStep: (step) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, currentStep: Math.max(0, Math.min(6, step)) } } : state),
  setChecklistAnswer: (itemId, answer) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, answers: { ...state.activeSession.answers, [itemId]: { selectedResult: answer.selectedResult, studentNote: answer.studentNote } } } } : state),
  setInspectionResult: (result) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, inspectionResult: result } } : state),
  completeSession: () => set((state) => {
    if (!state.activeSession) return state;
    const scenario = state.scenarios.find((candidate) => candidate.id === state.activeSession?.scenarioId);
    if (!scenario || !state.activeSession.inspectionResult) return state;
    return { activeSession: { ...state.activeSession, currentStep: 6, completed: true, feedback: evaluateSession(state.activeSession, scenario) } };
  }),
  resetSession: () => set((state) => {
    if (!state.activeSession) return state;
    const scenario = state.scenarios.find((candidate) => candidate.id === state.activeSession?.scenarioId);
    return scenario ? { activeSession: createSimulatorSession(scenario) } : { activeSession: null };
  }),
  reset: () => set({ equipment: createInitialEquipment(), selectedEquipmentId: null, scenario: 'Motor didático do simulador', activeSession: null }),
}));
