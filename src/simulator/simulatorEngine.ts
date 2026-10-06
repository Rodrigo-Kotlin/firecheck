import { getLocalDateISO } from '../utils/date';

export type SimulatorResult = 'conforme' | 'observacao' | 'nao_conforme';
export type SimulatorDifficulty = 'Básico' | 'Intermediário';
export type TemporalStatus = 'normal' | 'proximo' | 'vencido';

export interface SimulatorChecklistItem {
  id: string;
  label: string;
  description?: string;
  expectedResult: SimulatorResult;
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

function checklist(id: string, label: string, expectedResult: SimulatorResult, description?: string): SimulatorChecklistItem {
  return { id, label, expectedResult, ...(description ? { description } : {}) };
}

export function getSimulatorScenarios(now = new Date()): readonly SimulatorScenario[] {
  const next = addDays(now, 30);
  return [
    {
      id: 'S02-01', title: 'Inspeção totalmente conforme', description: 'Pratique o fluxo normal quando todos os itens atendem aos critérios.', objective: 'Conduzir uma inspeção sem desvios.', difficulty: 'Básico', estimatedMinutes: 4, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-001', 'Área de treinamento', 'Equipamento em condição regular.', next), context: 'Você está realizando a inspeção periódica de um extintor em área de treinamento. Avalie todos os itens antes de classificar o resultado.',
      checklist: [checklist('CHK-SIM-01-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-01-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-01-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['O resultado técnico representa a condição observada na inspeção.', 'Uma inspeção sem desvios resulta em Conforme.'], hints: ['Observe cada item antes de classificar o conjunto.'], completionCriteria: ['Responder todos os itens.', 'Escolher o resultado global.'],
    },
    {
      id: 'S02-02', title: 'Inspeção com observação', description: 'Aprenda quando uma condição requer acompanhamento sem ser a mais grave.', objective: 'Diferenciar Observação de Não Conforme.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-002', 'Laboratório simulado', 'Há uma condição que exige acompanhamento.', next), context: 'Durante a inspeção, você identifica desgaste superficial na sinalização. O equipamento continua disponível, mas a condição deve ser acompanhada.',
      checklist: [checklist('CHK-SIM-02-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-02-02', 'Sinalização', 'observacao', 'A identificação está legível, porém apresenta desgaste.'), checklist('CHK-SIM-02-03', 'Estado geral', 'conforme')], expectedResult: 'observacao', learningPoints: ['Observação registra uma condição que requer acompanhamento.', 'Nem toda irregularidade exige classificar o equipamento como Não Conforme.'], hints: ['Pergunte se a condição impede o uso seguro agora.'], completionCriteria: ['Identificar o item em observação.', 'Escolher Observação como resultado global.'],
    },
    {
      id: 'S02-03', title: 'Inspeção com não conformidade', description: 'Reconheça uma condição técnica que exige ação corretiva.', objective: 'Identificar uma não conformidade evidente.', difficulty: 'Básico', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-003', 'Almoxarifado simulado', 'O lacre está rompido e o acesso está comprometido.', next), context: 'Você encontra um extintor com lacre rompido durante a inspeção. Determine a gravidade técnica da condição observada.',
      checklist: [checklist('CHK-SIM-03-01', 'Lacre e pino de segurança', 'nao_conforme', 'O lacre está rompido.'), checklist('CHK-SIM-03-02', 'Acesso ao equipamento', 'conforme'), checklist('CHK-SIM-03-03', 'Sinalização', 'conforme')], expectedResult: 'nao_conforme', learningPoints: ['Uma condição que compromete a segurança é Não Conforme.', 'A identificação do item crítico orienta a decisão global.'], hints: ['Lacre rompido é uma evidência técnica relevante.'], completionCriteria: ['Reconhecer a não conformidade.', 'Escolher Não Conforme.'],
    },
    {
      id: 'S02-04', title: 'Múltiplos desvios', description: 'Combine observação e não conformidade em uma mesma inspeção.', objective: 'Aplicar a ordem de severidade entre desvios.', difficulty: 'Intermediário', estimatedMinutes: 6, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-004', 'Oficina simulada', 'Existem duas condições diferentes no mesmo equipamento.', next), context: 'A inspeção encontrou desgaste na sinalização e uma mangueira auxiliar danificada. Avalie os desvios e determine qual condição prevalece.',
      checklist: [checklist('CHK-SIM-04-01', 'Sinalização', 'observacao', 'A placa está legível, mas desgastada.'), checklist('CHK-SIM-04-02', 'Mangueira e componentes', 'nao_conforme', 'O componente apresenta dano evidente.'), checklist('CHK-SIM-04-03', 'Acesso ao equipamento', 'conforme')], expectedResult: 'nao_conforme', learningPoints: ['Não Conforme prevalece sobre Observação.', 'O resultado global é determinado pela condição mais crítica.'], hints: ['Compare os desvios antes de escolher o resultado global.'], completionCriteria: ['Registrar os dois tipos de desvio.', 'Escolher Não Conforme.'],
    },
    {
      id: 'S02-05', title: 'Equipamento com prazo próximo', description: 'Separe a condição técnica do calendário de inspeção.', objective: 'Reconhecer que Conforme e prazo próximo coexistem.', difficulty: 'Intermediário', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-005', 'Sala técnica simulada', 'Condição técnica regular; próxima inspeção em breve.', addDays(now, 2)), context: 'O equipamento atende aos critérios técnicos, mas sua próxima inspeção ocorrerá em poucos dias. Registre as duas dimensões sem misturá-las.',
      checklist: [checklist('CHK-SIM-05-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-05-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-05-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['Resultado técnico e situação temporal são dimensões separadas.', 'Conforme não significa que o próximo prazo esteja distante.'], hints: ['Primeiro avalie a condição; depois observe a data.'], completionCriteria: ['Responder o checklist.', 'Exibir Conforme e prazo próximo simultaneamente.'],
    },
    {
      id: 'S02-06', title: 'Equipamento com prazo vencido', description: 'Pratique a distinção entre resultado técnico e prazo vencido.', objective: 'Manter o resultado técnico separado da situação temporal.', difficulty: 'Intermediário', estimatedMinutes: 5, equipmentType: 'Extintor',
      initialEquipment: equipment('EXT-SIM-006', 'Depósito simulado', 'Condição técnica regular; prazo já vencido.', addDays(now, -1)), context: 'A condição atual do equipamento está regular, mas a data da próxima inspeção já passou. Faça a classificação técnica e observe o alerta temporal.',
      checklist: [checklist('CHK-SIM-06-01', 'Lacre e pino de segurança', 'conforme'), checklist('CHK-SIM-06-02', 'Sinalização e acesso', 'conforme'), checklist('CHK-SIM-06-03', 'Estado geral', 'conforme')], expectedResult: 'conforme', learningPoints: ['Prazo vencido não altera automaticamente a condição técnica observada.', 'Conforme e Vencido podem coexistir em dimensões diferentes.'], hints: ['Não use vencido como resultado técnico deste cenário.'], completionCriteria: ['Escolher Conforme.', 'Identificar o prazo como vencido.'],
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
  return { scenarioId: scenario.id, startedAt: now.toISOString(), currentStep: 0, answers: {}, selectedEquipment: { ...scenario.initialEquipment }, inspectionResult: null, completed: false, feedback: null };
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
