import { getLocalDateISO } from '../utils/date';

export type SimulatorResult = 'conforme' | 'observacao' | 'nao_conforme';
export type SimulatorDifficulty = 'Básico' | 'Intermediário';
export type TemporalStatus = 'normal' | 'proximo' | 'vencido';
export type SimulatorNetworkMode = 'online' | 'offline';
export type SimulatorSyncState = 'not_applicable' | 'pending' | 'synced';
export type SimulatorActionItemStatus = 'Aberta' | 'Em andamento' | 'Concluída';
export const MAX_SIMULATOR_EVIDENCE = 4;

export interface SimulatorChecklistItem {
  id: string;
  label: string;
  description?: string;
  expectedResult: SimulatorResult;
  evidenceRequired?: boolean;
}

export interface SimulatorCapabilities {
  evidence?: boolean;
  actionPlan?: boolean;
  draft?: boolean;
  offline?: boolean;
}

export interface SimulatorEvidence {
  id: string;
  blob: Blob;
  previewUrl: string;
  checklistItemId?: string;
  note?: string;
  createdAt: string;
}

export interface SimulatorActionItem {
  id: string;
  deviationKey: string;
  description: string;
  correctiveAction: string;
  adoptedSolution: string;
  responsible: string;
  deadline: string;
  status: SimulatorActionItemStatus;
  completedAt: string | null;
}

export interface SimulatorActionPlan {
  id: string;
  scenarioId: string;
  equipmentId: string;
  status: SimulatorActionItemStatus;
  items: SimulatorActionItem[];
  createdAt: string;
}

export interface ScenarioEquipment {
  id: string;
  tipo: string;
  modelo: string;
  local: string;
  operationalStatus: string;
  nextInspectionDate: string;
  description: string;
}

export interface SimulatorScenario {
  id: string;
  title: string;
  description: string;
  objective: string;
  difficulty: SimulatorDifficulty;
  estimatedMinutes: number;
  equipmentType: string;
  initialEquipment: ScenarioEquipment;
  context: string;
  checklist: readonly SimulatorChecklistItem[];
  expectedResult: SimulatorResult;
  learningPoints: readonly string[];
  hints: readonly string[];
  completionCriteria: readonly string[];
  features: SimulatorCapabilities;
}

export interface SimulatorAnswer {
  selectedResult: SimulatorResult | null;
  studentNote: string;
}

export interface SimulatorSession {
  scenarioId: string;
  startedAt: string;
  currentStep: number;
  answers: Record<string, SimulatorAnswer>;
  selectedEquipment: ScenarioEquipment;
  inspectionResult: SimulatorResult | null;
  completed: boolean;
  feedback: SimulatorFeedback | null;
  evidence: SimulatorEvidence[];
  actionPlan: SimulatorActionPlan | null;
  networkMode: SimulatorNetworkMode;
  simulatedSyncState: SimulatorSyncState;
  completionMessage: string | null;
}

export interface SimulatorDraft {
  scenarioId: string;
  savedAt: string;
  session: SimulatorSession;
}

export interface SimulatorFeedback {
  correct: boolean;
  expectedResult: SimulatorResult;
  selectedResult: SimulatorResult;
  itemReviews: readonly SimulatorItemReview[];
  explanation: string;
}

export interface SimulatorItemReview {
  itemId: string;
  label: string;
  selectedResult: SimulatorResult | null;
  expectedResult: SimulatorResult;
  correct: boolean;
}

const RESULT_SEVERITY: Record<SimulatorResult, number> = {
  conforme: 0,
  observacao: 1,
  nao_conforme: 2,
};

export const RESULT_LABELS: Record<SimulatorResult, string> = {
  conforme: 'Conforme',
  observacao: 'Observação',
  nao_conforme: 'Não Conforme',
};

export const STEP_LABELS = ['Contexto', 'Equipamento', 'Checklist', 'Classificação', 'Revisão', 'Resultado', 'Feedback'] as const;

function addDays(date: Date, offset: number): string {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  return getLocalDateISO(result);
}

function equipment(id: string, local: string, description: string, nextInspectionDate: string): ScenarioEquipment {
  return { id, tipo: 'Extintor', modelo: 'ABC 6 kg', local, operationalStatus: 'Em operação', nextInspectionDate, description };
}

function checklist(id: string, label: string, expectedResult: SimulatorResult, description?: string, evidenceRequired = false): SimulatorChecklistItem {
  return { id, label, expectedResult, ...(description ? { description } : {}), ...(evidenceRequired ? { evidenceRequired: true } : {}) };
}

function features(value: SimulatorCapabilities = {}): SimulatorCapabilities { return value; }

export function getSimulatorScenarios(now = new Date()): readonly SimulatorScenario[] {
  const next = addDays(now, 30);
  return [
    {
      id: 'S02-01', title: 'Inspeção totalmente conforme', description: 'Pratique o fluxo normal quando todos os itens atendem aos critérios.', objective: 'Conduzir uma inspeção sem desvios.', difficulty: 'Básico', estimatedMinutes: 4, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-001', 'Área de treinamento', 'Equipamento em condição regular.', next), context: 'Você está realizando a inspeção periódica de um extintor em área de treinamento. Avalie todos os itens antes de classificar o resultado.',
       checklist: [checklist('CHK-SIM-01-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-01-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-01-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['O resultado técnico representa a condição observada na inspeção.', 'Uma inspeção sem desvios resulta em Conforme.'], hints: ['Observe cada item antes de classificar o conjunto.'], completionCriteria: ['Responder todos os itens.', 'Escolher o resultado global.'], features: features(),
    },
    {
      id: 'S02-02', title: 'Inspeção com observação', description: 'Aprenda quando uma condição requer acompanhamento sem ser a mais grave.', objective: 'Diferenciar Observação de Não Conforme.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-002', 'Laboratório simulado', 'Há uma condição que exige acompanhamento.', next), context: 'Durante a inspeção, você identifica desgaste superficial na sinalização. O equipamento continua disponível, mas a condição deve ser acompanhada.',
       checklist: [checklist('CHK-SIM-02-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-02-02', 'Sinalização', 'observacao', 'A identificação está legível, porém apresenta desgaste.'), checklist('CHK-SIM-02-03', 'Estado geral', 'conforme')], expectedResult: 'observacao', learningPoints: ['Observação registra uma condição que requer acompanhamento.', 'Nem toda irregularidade exige classificar o equipamento como Não Conforme.'], hints: ['Pergunte se a condição impede o uso seguro agora.'], completionCriteria: ['Identificar o item em observação.', 'Escolher Observação como resultado global.'], features: features(),
    },
    {
      id: 'S02-03', title: 'Inspeção com não conformidade', description: 'Reconheça uma condição técnica que exige ação corretiva.', objective: 'Identificar uma não conformidade evidente.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-003', 'Almoxarifado simulado', 'O lacre está rompido e o acesso está comprometido.', next), context: 'Você encontra um extintor com lacre rompido durante a inspeção. Determine a gravidade técnica da condição observada.',
       checklist: [checklist('CHK-SIM-03-01', 'Lacre e pino de segurança', 'nao_conforme', 'O lacre está rompido.', true), checklist('CHK-SIM-03-02', 'Acesso ao equipamento', 'conforme'), checklist('CHK-SIM-03-03', 'Sinalização', 'conforme')], expectedResult: 'nao_conforme', learningPoints: ['Uma condição que compromete a segurança é Não Conforme.', 'A identificação do item crítico orienta a decisão global.'], hints: ['Lacre rompido é uma evidência técnica relevante.'], completionCriteria: ['Reconhecer a não conformidade.', 'Escolher Não Conforme.'], features: features({ evidence: true }),
    },
    {
      id: 'S02-04', title: 'Múltiplos desvios', description: 'Combine observação e não conformidade em uma mesma inspeção.', objective: 'Aplicar a ordem de severidade entre desvios.', difficulty: 'Intermediário', estimatedMinutes: 6, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-004', 'Oficina simulada', 'Existem duas condições diferentes no mesmo equipamento.', next), context: 'A inspeção encontrou desgaste na sinalização e uma mangueira auxiliar danificada. Avalie os desvios e determine qual condição prevalece.',
       checklist: [checklist('CHK-SIM-04-01', 'Sinalização', 'observacao', 'A placa está legível, mas desgastada.'), checklist('CHK-SIM-04-02', 'Mangueira e componentes', 'nao_conforme', 'O componente apresenta dano evidente.'), checklist('CHK-SIM-04-03', 'Acesso ao equipamento', 'conforme')], expectedResult: 'nao_conforme', learningPoints: ['Não Conforme prevalece sobre Observação.', 'O resultado global é determinado pela condição mais crítica.'], hints: ['Compare os desvios antes de escolher o resultado global.'], completionCriteria: ['Registrar os dois tipos de desvio.', 'Escolher Não Conforme.'], features: features({ actionPlan: true }),
    },
    {
      id: 'S02-05', title: 'Equipamento com prazo próximo', description: 'Separe a condição técnica do calendário de inspeção.', objective: 'Reconhecer que Conforme e prazo próximo coexistem.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-005', 'Sala técnica simulada', 'Condição técnica regular; próxima inspeção em breve.', addDays(now, 2)), context: 'O equipamento atende aos critérios técnicos, mas sua próxima inspeção ocorrerá em poucos dias. Registre as duas dimensões sem misturá-las.',
       checklist: [checklist('CHK-SIM-05-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-05-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-05-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['Resultado técnico e situação temporal são dimensões separadas.', 'Conforme não significa que o próximo prazo esteja distante.'], hints: ['Primeiro avalie a condição; depois observe a data.'], completionCriteria: ['Responder o checklist.', 'Exibir Conforme e prazo próximo simultaneamente.'], features: features(),
    },
    {
      id: 'S02-06', title: 'Equipamento com prazo vencido', description: 'Pratique a distinção entre resultado técnico e prazo vencido.', objective: 'Manter o resultado técnico separado da situação temporal.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-006', 'Depósito simulado', 'Condição técnica regular; prazo já vencido.', addDays(now, -1)), context: 'A condição atual do equipamento está regular, mas a data da próxima inspeção já passou. Faça a classificação técnica e observe o alerta temporal.',
       checklist: [checklist('CHK-SIM-06-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-06-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-06-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['Prazo vencido não altera automaticamente a condição técnica observada.', 'Conforme e Vencido podem coexistir em dimensões diferentes.'], hints: ['Não use vencido como resultado técnico deste cenário.'], completionCriteria: ['Escolher Conforme.', 'Identificar o prazo como vencido.'], features: features(),
    },
    {
      id: 'S02-07', title: 'Retomada de inspeção', description: 'Interrompa uma inspeção e retome o ponto salvo em memória.', objective: 'Entender a retomada de um preenchimento parcial.', difficulty: 'Intermediário', estimatedMinutes: 6, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-007', 'Área de continuidade', 'Inspeção parcialmente preenchida para retomada didática.', next), context: 'Você começou uma inspeção e precisa interrompê-la. O rascunho simulado conserva o ponto atual enquanto a SPA estiver aberta.', checklist: [checklist('CHK-SIM-07-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-07-02', 'Sinalização', 'observacao'), checklist('CHK-SIM-07-03', 'Estado geral', 'conforme')], expectedResult: 'observacao', learningPoints: ['Rascunho didático é temporário e fica em memória.', 'Retomar não significa persistência após atualizar a página.'], hints: ['Preencha dois itens e simule uma interrupção.'], completionCriteria: ['Responder parte do checklist.', 'Simular interrupção e retomar.'], features: features({ draft: true }),
    },
    {
      id: 'S02-08', title: 'Operação offline', description: 'Continue uma inspeção com perda de conexão representada pelo simulador.', objective: 'Distinguir operação local de sincronização posterior.', difficulty: 'Intermediário', estimatedMinutes: 6, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-008', 'Área sem cobertura simulada', 'A conexão será alterada apenas no estado didático.', next), context: 'Este cenário reproduz o comportamento esperado sem desconectar o dispositivo da internet. A rede do navegador não será alterada.', checklist: [checklist('CHK-SIM-08-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-08-02', 'Sinalização', 'conforme'), checklist('CHK-SIM-08-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['A inspeção pode continuar localmente.', 'A sincronização pendente é somente uma representação didática.'], hints: ['Use a ação de perda simulada e finalize o checklist.'], completionCriteria: ['Simular perda de conexão.', 'Finalizar e simular retorno da conexão.'], features: features({ offline: true }),
    },
  ];
}

export function deriveExpectedOverall(items: readonly SimulatorChecklistItem[]): SimulatorResult {
  return items.reduce<SimulatorResult>((highest, item) => RESULT_SEVERITY[item.expectedResult] > RESULT_SEVERITY[highest] ? item.expectedResult : highest, 'conforme');
}

export function getTemporalStatus(nextInspectionDate: string, today = getLocalDateISO()): TemporalStatus {
  const todayDate = new Date(`${today}T00:00:00`);
  const nextDate = new Date(`${nextInspectionDate}T00:00:00`);
  const days = Math.round((nextDate.getTime() - todayDate.getTime()) / 86400000);
  if (days < 0) return 'vencido';
  if (days <= 3) return 'proximo';
  return 'normal';
}

export function createSimulatorSession(scenario: SimulatorScenario, now = new Date()): SimulatorSession {
  return { scenarioId: scenario.id, startedAt: now.toISOString(), currentStep: 0, answers: {}, selectedEquipment: { ...scenario.initialEquipment }, inspectionResult: null, completed: false, feedback: null, evidence: [], actionPlan: null, networkMode: scenario.features.offline ? 'online' : 'online', simulatedSyncState: scenario.features.offline ? 'not_applicable' : 'not_applicable', completionMessage: null };
}

export function getActionPlanStatus(items: readonly SimulatorActionItem[]): SimulatorActionItemStatus {
  if (items.length > 0 && items.every((item) => item.status === 'Concluída')) return 'Concluída';
  if (items.some((item) => item.status !== 'Aberta')) return 'Em andamento';
  return 'Aberta';
}

export function getActionPlanProgress(plan: SimulatorActionPlan | null): { completed: number; total: number; percent: number } {
  const total = plan?.items.length ?? 0;
  const completed = plan?.items.filter((item) => item.status === 'Concluída').length ?? 0;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function isActionItemOverdue(item: SimulatorActionItem, today = getLocalDateISO()): boolean {
  return item.status !== 'Concluída' && Boolean(item.deadline) && item.deadline < today;
}

export function calculateProgress(session: SimulatorSession): number {
  if (session.completed) return 100;
  return Math.round((session.currentStep / (STEP_LABELS.length - 1)) * 100);
}

export function calculateScore(session: SimulatorSession, scenario: SimulatorScenario): number {
  const answered = scenario.checklist.filter((item) => session.answers[item.id]?.selectedResult);
  const correctItems = answered.filter((item) => session.answers[item.id].selectedResult === item.expectedResult).length;
  const itemScore = scenario.checklist.length ? correctItems / scenario.checklist.length : 0;
  const resultScore = session.inspectionResult === scenario.expectedResult ? 1 : 0;
  return Math.round(((itemScore * 0.7) + (resultScore * 0.3)) * 100);
}

export function evaluateSession(session: SimulatorSession, scenario: SimulatorScenario): SimulatorFeedback | null {
  if (!session.inspectionResult) return null;
  const itemReviews = scenario.checklist.map((item) => ({ itemId: item.id, label: item.label, selectedResult: session.answers[item.id]?.selectedResult ?? null, expectedResult: item.expectedResult, correct: session.answers[item.id]?.selectedResult === item.expectedResult }));
  const correct = session.inspectionResult === scenario.expectedResult;
  return { correct, expectedResult: scenario.expectedResult, selectedResult: session.inspectionResult, itemReviews, explanation: correct ? 'Sua decisão corresponde à condição técnica definida para o cenário.' : `O resultado esperado é ${RESULT_LABELS[scenario.expectedResult]}. Revise os itens mais críticos antes de concluir uma inspeção real.` };
}

export function resetSimulatorSession(scenario: SimulatorScenario, now = new Date()): SimulatorSession {
  return createSimulatorSession({ ...scenario, initialEquipment: { ...scenario.initialEquipment } }, now);
}
