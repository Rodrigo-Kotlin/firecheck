import type { SimulatorResult } from './simulatorEngine';

export type SimulatorTrainingMode = 'free' | 'guided';
export type SimulatorTrainingStatus = 'not_started' | 'in_progress' | 'completed';

export interface SimulatorParticipant {
  name: string;
  role: string;
}

export interface SimulatorScenarioResult {
  scenarioId: string;
  attempts: number;
  score: number;
  bestScore: number;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
  selectedResult: SimulatorResult | null;
  expectedResult: SimulatorResult;
  checklistCorrect: number;
  checklistTotal: number;
  evidenceRegistered: boolean;
  actionPlanProgress: { completed: number; total: number } | null;
}

export interface SimulatorAssessmentOption {
  id: string;
  label: string;
}

export interface SimulatorAssessmentQuestion {
  id: string;
  question: string;
  options: readonly SimulatorAssessmentOption[];
  correctOptionId: string;
  explanation: string;
  topic: string;
}

export interface SimulatorAssessmentResult {
  answers: Record<string, string>;
  score: number;
  correct: number;
  total: number;
  submitted: boolean;
  attempts: number;
  submittedAt: string | null;
}

export interface SimulatorTraining {
  participant: SimulatorParticipant;
  mode: SimulatorTrainingMode;
  startedAt: string;
  completedAt: string | null;
  scenarioResults: Record<string, SimulatorScenarioResult>;
  finalAssessment: SimulatorAssessmentResult | null;
  status: SimulatorTrainingStatus;
}

const option = (id: string, label: string): SimulatorAssessmentOption => ({ id, label });

export const SIMULATOR_ASSESSMENT_QUESTIONS: readonly SimulatorAssessmentQuestion[] = [
  { id: 'ASSESS-SIM-01', topic: 'Conforme', question: 'Quando o resultado global deve ser Conforme?', options: [option('a', 'Quando todos os itens atendem aos critérios'), option('b', 'Sempre que o prazo estiver vencido'), option('c', 'Quando houver qualquer não conformidade')], correctOptionId: 'a', explanation: 'Conforme representa uma condição técnica sem desvios nos itens avaliados.', },
  { id: 'ASSESS-SIM-02', topic: 'Observação', question: 'Qual situação é melhor classificada como Observação?', options: [option('a', 'Uma condição que impede o uso seguro'), option('b', 'Uma condição que requer acompanhamento, sem impedir o uso imediato'), option('c', 'Qualquer prazo vencido')], correctOptionId: 'b', explanation: 'Observação registra acompanhamento sem equivaler automaticamente a uma não conformidade crítica.', },
  { id: 'ASSESS-SIM-03', topic: 'Evidência', question: 'Qual é a finalidade didática da evidência fotográfica?', options: [option('a', 'Substituir a decisão técnica'), option('b', 'Registrar visualmente um desvio observado'), option('c', 'Enviar uma foto ao Storage')], correctOptionId: 'b', explanation: 'A evidência apoia o registro do desvio; nesta simulação ela permanece somente em memória.', },
  { id: 'ASSESS-SIM-04', topic: 'Plano consolidado', question: 'Como os desvios de uma inspeção devem formar um plano simulado?', options: [option('a', 'Um plano pai para cada desvio'), option('b', 'Um único plano pai com várias pendências'), option('c', 'Nenhuma pendência individual')], correctOptionId: 'b', explanation: 'Uma inspeção gera um plano consolidado e cada desvio relevante vira uma pendência.', },
  { id: 'ASSESS-SIM-05', topic: 'Prazo próximo', question: 'O que um prazo próximo altera automaticamente?', options: [option('a', 'O resultado técnico'), option('b', 'A dimensão temporal, não a condição técnica'), option('c', 'A evidência do checklist')], correctOptionId: 'b', explanation: 'Prazo e condição técnica são dimensões independentes.', },
  { id: 'ASSESS-SIM-06', topic: 'Prazo vencido', question: 'Um equipamento pode estar em qual combinação?', options: [option('a', 'Conforme tecnicamente e com prazo vencido'), option('b', 'Vencido é sempre Não Conforme'), option('c', 'Prazo vencido não pode ser exibido')], correctOptionId: 'a', explanation: 'O prazo vencido é um alerta temporal e não substitui a classificação técnica observada.', },
  { id: 'ASSESS-SIM-07', topic: 'Rascunho', question: 'Qual é a função do rascunho simulado?', options: [option('a', 'Persistir dados após F5'), option('b', 'Permitir retomar um preenchimento enquanto a SPA está viva'), option('c', 'Criar uma inspeção operacional')], correctOptionId: 'b', explanation: 'O rascunho didático preserva o ponto da sessão somente em memória.', },
  { id: 'ASSESS-SIM-08', topic: 'Offline', question: 'O que o offline simulado representa?', options: [option('a', 'Desconectar a internet do dispositivo'), option('b', 'Continuar localmente e representar sincronização posterior'), option('c', 'Executar uma fila real de sync')], correctOptionId: 'b', explanation: 'O cenário representa operação local e estados de sincronização sem alterar a rede ou executar sync real.', },
];

export function createSimulatorTraining(participant: SimulatorParticipant, mode: SimulatorTrainingMode, now = new Date()): SimulatorTraining {
  return { participant: { name: participant.name.trim(), role: participant.role.trim() }, mode, startedAt: now.toISOString(), completedAt: null, scenarioResults: {}, finalAssessment: null, status: 'in_progress' };
}

export function calculateTrainingProgress(training: SimulatorTraining | null, total = 8): { completed: number; total: number; percent: number } {
  const completed = training ? Object.values(training.scenarioResults).filter((result) => result.completed).length : 0;
  return { completed, total, percent: total ? Math.round((completed / total) * 1000) / 10 : 0 };
}

export function calculateAverageScenarioScore(training: SimulatorTraining | null): number {
  const scores = training ? Object.values(training.scenarioResults).filter((result) => result.completed).map((result) => result.bestScore) : [];
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
}

export function calculateAssessmentScore(answers: Record<string, string>, questions = SIMULATOR_ASSESSMENT_QUESTIONS): { correct: number; total: number; percent: number } {
  const correct = questions.filter((question) => answers[question.id] === question.correctOptionId).length;
  return { correct, total: questions.length, percent: questions.length ? Math.round((correct / questions.length) * 1000) / 10 : 0 };
}

export function isTrainingComplete(training: SimulatorTraining | null, total = 8): boolean {
  return Boolean(training && calculateTrainingProgress(training, total).completed === total && training.finalAssessment?.submitted);
}

export function getTrainingDurationMinutes(training: SimulatorTraining, now = new Date()): number {
  const end = training.completedAt ? new Date(training.completedAt) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(training.startedAt).getTime()) / 60000));
}

export function getReviewTopics(training: SimulatorTraining | null, questions = SIMULATOR_ASSESSMENT_QUESTIONS): string[] {
  if (!training) return [];
  const lowScores = Object.values(training.scenarioResults).filter((result) => result.completed && result.bestScore < 70).map((result) => result.scenarioId);
  const assessmentTopics = training.finalAssessment?.submitted ? questions.filter((question) => training.finalAssessment?.answers[question.id] !== undefined && training.finalAssessment.answers[question.id] !== question.correctOptionId).map((question) => question.topic) : [];
  return [...new Set([...lowScores, ...assessmentTopics])].slice(0, 5);
}
