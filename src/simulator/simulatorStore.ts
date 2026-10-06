import { create } from 'zustand';
import { SIMULATOR_EQUIPMENT_FIXTURES, type SimulatorEquipment } from './simulatorFixtures';
import {
  createSimulatorSession,
  evaluateSession,
  getActionPlanStatus,
  getSimulatorScenarios,
  MAX_SIMULATOR_EVIDENCE,
  type SimulatorAnswer,
  type SimulatorEvidence,
  type SimulatorResult,
  type SimulatorScenario,
  type SimulatorSession,
  type SimulatorDraft,
} from './simulatorEngine';

interface SimulatorState {
  equipment: SimulatorEquipment[];
  selectedEquipmentId: string | null;
  scenario: string;
  scenarios: readonly SimulatorScenario[];
  activeSession: SimulatorSession | null;
  simulatedDraft: SimulatorDraft | null;
  selectEquipment: (id: string | null) => void;
  updateEquipmentStatus: (id: string, status: SimulatorEquipment['status']) => void;
  startSession: (scenarioId: string) => void;
  setStep: (step: number) => void;
  setChecklistAnswer: (itemId: string, answer: SimulatorAnswer) => void;
  setInspectionResult: (result: SimulatorResult) => void;
  addEvidence: (blob: Blob, checklistItemId?: string, note?: string) => boolean;
  replaceEvidence: (evidenceId: string, blob: Blob, note?: string) => boolean;
  removeEvidence: (evidenceId: string) => void;
  completeSession: () => void;
  updateActionItem: (itemId: string, update: Partial<Pick<import('./simulatorEngine').SimulatorActionItem, 'correctiveAction' | 'adoptedSolution' | 'responsible' | 'deadline' | 'status'>>) => void;
  simulateInterruption: () => void;
  resumeDraft: () => void;
  discardDraft: () => void;
  simulateOffline: () => void;
  simulateOnline: () => void;
  resetSession: () => void;
  reset: () => void;
}

function createInitialEquipment(): SimulatorEquipment[] {
  return SIMULATOR_EQUIPMENT_FIXTURES.map((equipment) => ({ ...equipment }));
}

function revokeEvidence(evidence: readonly SimulatorEvidence[]): void {
  if (typeof URL.revokeObjectURL !== 'function') return;
  evidence.forEach((item) => { if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl); });
}

function previewFor(blob: Blob, id: string): string {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : `simulator://${id}`;
}

function buildActionPlan(session: SimulatorSession, scenario: SimulatorScenario): SimulatorSession['actionPlan'] {
  if (!scenario.features.actionPlan) return null;
  const deviations = scenario.checklist.filter((item) => session.answers[item.id]?.selectedResult && session.answers[item.id].selectedResult !== 'conforme');
  return {
    id: `PAC-SIM-${scenario.id}`,
    scenarioId: scenario.id,
    equipmentId: session.selectedEquipment.id,
    status: 'Aberta',
    createdAt: new Date().toISOString(),
    items: deviations.map((item, index) => ({
      id: `PAI-SIM-${scenario.id}-${String(index + 1).padStart(2, '0')}`,
      deviationKey: item.id,
      description: item.description ?? item.label,
      correctiveAction: '', adoptedSolution: '', responsible: '', deadline: '', status: 'Aberta', completedAt: null,
    })),
  };
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
  equipment: createInitialEquipment(), selectedEquipmentId: null, scenario: 'Motor didático do simulador', scenarios: getSimulatorScenarios(), activeSession: null, simulatedDraft: null,
  selectEquipment: (id) => set({ selectedEquipmentId: id }),
  updateEquipmentStatus: (id, status) => set((state) => ({ equipment: state.equipment.map((equipment) => equipment.id === id ? { ...equipment, status } : equipment) })),
  startSession: (scenarioId) => {
    const scenario = get().scenarios.find((candidate) => candidate.id === scenarioId);
    if (!scenario) return;
    const old = get().activeSession;
    if (old) revokeEvidence(old.evidence);
    const draft = get().simulatedDraft;
    if (draft) revokeEvidence(draft.session.evidence);
    set({ activeSession: createSimulatorSession(scenario), simulatedDraft: null });
  },
  setStep: (step) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, currentStep: Math.max(0, Math.min(6, step)) } } : state),
  setChecklistAnswer: (itemId, answer) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, answers: { ...state.activeSession.answers, [itemId]: { selectedResult: answer.selectedResult, studentNote: answer.studentNote } } } } : state),
  setInspectionResult: (result) => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, inspectionResult: result, completionMessage: null } } : state),
  addEvidence: (blob, checklistItemId, note) => {
    const state = get();
    if (!state.activeSession || state.activeSession.evidence.length >= MAX_SIMULATOR_EVIDENCE) return false;
    const id = `EVD-SIM-${state.activeSession.scenarioId}-${Date.now()}-${state.activeSession.evidence.length + 1}`;
    const evidence: SimulatorEvidence = { id, blob, previewUrl: previewFor(blob, id), checklistItemId, note, createdAt: new Date().toISOString() };
    set({ activeSession: { ...state.activeSession, evidence: [...state.activeSession.evidence, evidence], completionMessage: null } });
    return true;
  },
  replaceEvidence: (evidenceId, blob, note) => {
    const state = get();
    if (!state.activeSession) return false;
    const current = state.activeSession.evidence.find((item) => item.id === evidenceId);
    if (!current) return false;
    const nextUrl = previewFor(blob, evidenceId);
    const replacement: SimulatorEvidence = { ...current, blob, previewUrl: nextUrl, note, createdAt: new Date().toISOString() };
    set({ activeSession: { ...state.activeSession, evidence: state.activeSession.evidence.map((item) => item.id === evidenceId ? replacement : item) } });
    revokeEvidence([current]);
    return true;
  },
  removeEvidence: (evidenceId) => set((state) => {
    if (!state.activeSession) return state;
    const removed = state.activeSession.evidence.find((item) => item.id === evidenceId);
    if (removed) revokeEvidence([removed]);
    return { activeSession: { ...state.activeSession, evidence: state.activeSession.evidence.filter((item) => item.id !== evidenceId) } };
  }),
  completeSession: () => set((state) => {
    if (!state.activeSession) return state;
    const scenario = state.scenarios.find((candidate) => candidate.id === state.activeSession?.scenarioId);
    if (!scenario || !state.activeSession.inspectionResult) return state;
    const required = scenario.checklist.filter((item) => item.evidenceRequired);
    const missing = required.find((item) => !state.activeSession?.evidence.some((evidence) => evidence.checklistItemId === item.id));
    if (missing) return { activeSession: { ...state.activeSession, completionMessage: `Adicione uma evidência fotográfica para o item "${missing.label}" antes de concluir.` } };
    const plan = state.activeSession.actionPlan ?? buildActionPlan(state.activeSession, scenario);
    const completedSession = { ...state.activeSession, currentStep: 6, completed: true, feedback: evaluateSession(state.activeSession, scenario), actionPlan: plan, simulatedSyncState: scenario.features.offline && state.activeSession.networkMode === 'offline' ? 'pending' as const : state.activeSession.simulatedSyncState, completionMessage: scenario.features.evidence ? 'Evidência registrada corretamente para o desvio.' : null };
    return { activeSession: completedSession };
  }),
  updateActionItem: (itemId, update) => set((state) => {
    const session = state.activeSession;
    if (!session?.actionPlan) return state;
    const items = session.actionPlan.items.map((item) => {
      if (item.id !== itemId) return item;
      const nextStatus = update.status ?? item.status;
      return { ...item, ...update, status: nextStatus, completedAt: nextStatus === 'Concluída' ? (item.completedAt ?? new Date().toISOString()) : null };
    });
    return { activeSession: { ...session, actionPlan: { ...session.actionPlan, items, status: getActionPlanStatus(items) } } };
  }),
  simulateInterruption: () => set((state) => {
    if (!state.activeSession) return state;
    const scenario = state.scenarios.find((item) => item.id === state.activeSession?.scenarioId);
    if (!scenario?.features.draft) return state;
    return { simulatedDraft: { scenarioId: scenario.id, savedAt: new Date().toISOString(), session: state.activeSession }, activeSession: null };
  }),
  resumeDraft: () => set((state) => state.simulatedDraft ? { activeSession: state.simulatedDraft.session, simulatedDraft: null } : state),
  discardDraft: () => set((state) => {
    if (state.simulatedDraft) revokeEvidence(state.simulatedDraft.session.evidence);
    return { simulatedDraft: null };
  }),
  simulateOffline: () => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, networkMode: 'offline', simulatedSyncState: 'not_applicable' } } : state),
  simulateOnline: () => set((state) => state.activeSession ? { activeSession: { ...state.activeSession, networkMode: 'online', simulatedSyncState: state.activeSession.simulatedSyncState === 'pending' ? 'synced' : state.activeSession.simulatedSyncState } } : state),
  resetSession: () => set((state) => {
    if (!state.activeSession) return state;
    revokeEvidence(state.activeSession.evidence);
    const scenario = state.scenarios.find((candidate) => candidate.id === state.activeSession?.scenarioId);
    return scenario ? { activeSession: createSimulatorSession(scenario), simulatedDraft: null } : { activeSession: null, simulatedDraft: null };
  }),
  reset: () => set((state) => {
    if (state.activeSession) revokeEvidence(state.activeSession.evidence);
    if (state.simulatedDraft) revokeEvidence(state.simulatedDraft.session.evidence);
    return { equipment: createInitialEquipment(), selectedEquipmentId: null, scenario: 'Motor didático do simulador', activeSession: null, simulatedDraft: null };
  }),
}));
