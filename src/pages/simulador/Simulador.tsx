import { useEffect, useMemo } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, CircleAlert, GraduationCap, RotateCcw, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { setRuntimeMode } from '../../runtime/runtimeMode';
import { useSimulatorStore } from '../../simulator/simulatorStore';
import { calculateProgress, calculateScore, getTemporalStatus, RESULT_LABELS, STEP_LABELS, type SimulatorResult } from '../../simulator/simulatorEngine';
import { formatDateBR, getLocalDateISO } from '../../utils/date';

const RESULT_OPTIONS: SimulatorResult[] = ['conforme', 'observacao', 'nao_conforme'];
const RESULT_STYLES: Record<SimulatorResult, string> = {
  conforme: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  observacao: 'border-amber-200 bg-amber-50 text-amber-800',
  nao_conforme: 'border-red-200 bg-red-50 text-red-800',
};

function ResultLabel({ result }: { result: SimulatorResult }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${RESULT_STYLES[result]}`}><span aria-hidden="true">{result === 'conforme' ? '✓' : result === 'observacao' ? '!' : '×'}</span>{RESULT_LABELS[result]}</span>;
}

function TrainingBanner() {
  return (
    <section className="rounded-2xl bg-slate-900 text-white p-5 sm:p-7 shadow-lg border border-slate-700" aria-label="Ambiente de treinamento">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center flex-shrink-0"><GraduationCap className="w-5 h-5" /></div>
          <div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Ambiente de treinamento</span><h2 className="text-xl sm:text-2xl font-black mt-1">Modo simulador</h2><p className="text-sm text-slate-300 mt-2 max-w-2xl">Treine inspeções e decisões sem alterar dados reais. Tudo nesta atividade fica somente em memória.</p></div>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-200 whitespace-nowrap">100% em memória</span>
      </div>
    </section>
  );
}

export default function Simulador() {
  const navigate = useNavigate();
  const { scenarios, activeSession, startSession, setStep, setChecklistAnswer, setInspectionResult, completeSession, resetSession, reset } = useSimulatorStore();
  useEffect(() => { setRuntimeMode('simulator'); return () => setRuntimeMode('operational'); }, []);

  const scenario = useMemo(() => scenarios.find((item) => item.id === activeSession?.scenarioId), [scenarios, activeSession?.scenarioId]);
  const leaveSimulator = () => { reset(); navigate('/'); };
  const returnToCatalog = () => { resetSession(); reset(); };
  const beginScenario = (id: string) => {
    if (activeSession && !window.confirm('Descartar o treinamento atual e iniciar outro cenário?')) return;
    startSession(id);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      <TrainingBanner />
      {activeSession && scenario ? (
        <TrainingSession scenario={scenario} onBack={returnToCatalog} onExit={leaveSimulator} onReset={resetSession} setStep={setStep} setChecklistAnswer={setChecklistAnswer} setInspectionResult={setInspectionResult} completeSession={completeSession} />
      ) : (
        <ScenarioCatalog scenarios={scenarios} onStart={beginScenario} />
      )}
    </div>
  );
}

function ScenarioCatalog({ scenarios, onStart }: { scenarios: readonly ReturnType<typeof useSimulatorStore.getState>['scenarios'][number][]; onStart: (id: string) => void }) {
  return (
    <>
      <section className="card-subtle bg-white p-5 sm:p-7"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpen className="w-5 h-5" /></div><div><span className="label-uppercase">Catálogo de cenários</span><h2 className="text-xl font-black text-slate-900 mt-1">Escolha uma situação para praticar</h2><p className="text-sm text-slate-600 mt-2 max-w-2xl">Cada cenário conduz você por contexto, identificação, checklist, classificação e feedback técnico.</p></div></div></section>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label="Cenários de treinamento">
        {scenarios.map((item) => <article key={item.id} className="card-subtle bg-white p-5 flex flex-col gap-4 border border-slate-100"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-primary"><Target className="w-5 h-5" /></div><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{item.id}</span></div><div className="flex-1"><h3 className="text-base font-black text-slate-900">{item.title}</h3><p className="text-sm text-slate-600 mt-2">{item.description}</p><div className="flex flex-wrap gap-2 mt-4"><span className="pill bg-slate-100 text-slate-600">{item.difficulty}</span><span className="pill bg-slate-100 text-slate-600">{item.estimatedMinutes} min</span></div></div><div className="border-t border-slate-100 pt-3"><p className="text-[11px] font-bold text-slate-500 mb-3">Objetivo: <span className="font-normal">{item.objective}</span></p><button type="button" onClick={() => onStart(item.id)} className="btn-primary w-full justify-center">Iniciar treinamento <ArrowRight className="w-4 h-4" /></button></div></article>)}
      </section>
    </>
  );
}

function TrainingSession({ scenario, onBack, onExit, onReset, setStep, setChecklistAnswer, setInspectionResult, completeSession }: {
  scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number];
  onBack: () => void; onExit: () => void; onReset: () => void; setStep: (step: number) => void;
  setChecklistAnswer: (id: string, answer: { selectedResult: SimulatorResult; studentNote: string }) => void;
  setInspectionResult: (result: SimulatorResult) => void; completeSession: () => void;
}) {
  const session = useSimulatorStore((state) => state.activeSession);
  if (!session) return null;
  const progress = calculateProgress(session);
  const allAnswered = scenario.checklist.every((item) => session.answers[item.id]?.selectedResult);
  const temporal = getTemporalStatus(scenario.initialEquipment.nextInspectionDate, getLocalDateISO());
  const next = () => setStep(Math.min(6, session.currentStep + 1));
  const previous = () => setStep(Math.max(0, session.currentStep - 1));

  return (
    <>
      <section className="card-subtle bg-white p-4 sm:p-5 space-y-3" aria-label="Progresso do treinamento"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><span className="label-uppercase">{scenario.id} · Ambiente de treinamento</span><h2 className="text-lg font-black text-slate-900 mt-1">{scenario.title}</h2></div><span className="text-sm font-black text-primary">Etapa {session.currentStep + 1} de {STEP_LABELS.length}</span></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={`Progresso: ${progress}%`}><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><div className="grid grid-cols-4 sm:grid-cols-7 gap-1">{STEP_LABELS.map((label, index) => <span key={label} className={`text-[9px] sm:text-[10px] text-center font-bold ${index <= session.currentStep ? 'text-primary' : 'text-slate-400'}`}>{label}</span>)}</div></section>
      {session.currentStep === 0 && <StepContext scenario={scenario} onNext={next} />}
      {session.currentStep === 1 && <StepEquipment scenario={scenario} temporal={temporal} onNext={next} onBack={previous} />}
      {session.currentStep === 2 && <StepChecklist scenario={scenario} session={session} allAnswered={allAnswered} setChecklistAnswer={setChecklistAnswer} onNext={next} onBack={previous} />}
      {session.currentStep === 3 && <StepClassification scenario={scenario} onNext={next} onBack={previous} />}
      {session.currentStep === 4 && <StepReview scenario={scenario} session={session} onNext={next} onBack={previous} />}
      {session.currentStep === 5 && <StepResult scenario={scenario} selected={session.inspectionResult} setResult={setInspectionResult} onConfirm={completeSession} onBack={previous} />}
      {session.currentStep === 6 && <StepFeedback scenario={scenario} session={session} onReset={onReset} onBack={onBack} onExit={onExit} />}
    </>
  );
}

function StepShell({ eyebrow, title, children, footer }: { eyebrow: string; title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return <section className="card-subtle bg-white p-5 sm:p-7"><span className="label-uppercase">{eyebrow}</span><h2 className="text-xl font-black text-slate-900 mt-1">{title}</h2><div className="mt-5">{children}</div><div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 border-t border-slate-100 mt-7 pt-5">{footer}</div></section>;
}

function StepContext({ scenario, onNext }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; onNext: () => void }) {
  return <StepShell eyebrow="Etapa 1 · Contexto" title="Entenda a situação antes de decidir" footer={<button type="button" onClick={onNext} className="btn-primary btn-auto sm:ml-auto">Identificar equipamento <ArrowRight className="w-4 h-4" /></button>}><div className="rounded-xl bg-slate-50 border border-slate-100 p-5"><p className="text-sm leading-6 text-slate-700">{scenario.context}</p></div><div className="grid sm:grid-cols-3 gap-3 mt-4">{scenario.completionCriteria.map((criterion) => <div key={criterion} className="flex gap-2 text-xs text-slate-600"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" />{criterion}</div>)}</div></StepShell>;
}

function StepEquipment({ scenario, temporal, onNext, onBack }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; temporal: string; onNext: () => void; onBack: () => void }) {
  const equipment = scenario.initialEquipment;
  return <StepShell eyebrow="Etapa 2 · Identificação" title="Conheça o equipamento" footer={<><button type="button" onClick={onBack} className="btn-ghost btn-auto"><ArrowLeft className="w-4 h-4" /> Voltar</button><button type="button" onClick={onNext} className="btn-primary btn-auto">Abrir checklist <ArrowRight className="w-4 h-4" /></button></>}><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[['TAG', equipment.id], ['Tipo', `${equipment.tipo} · ${equipment.modelo}`], ['Setor / local', equipment.local], ['Status operacional', equipment.operationalStatus]].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-100 p-4"><p className="label-uppercase">{label}</p><p className="text-sm font-black text-slate-800 mt-1">{value}</p></div>)}</div><div className="flex flex-col sm:flex-row gap-3 mt-4"><div className="rounded-xl bg-slate-50 p-4 flex-1"><p className="label-uppercase">Próxima inspeção</p><p className="text-sm font-black text-slate-800 mt-1">{formatDateBR(equipment.nextInspectionDate)}</p></div><div className={`rounded-xl p-4 flex-1 ${temporal === 'vencido' ? 'bg-red-50 text-red-800' : temporal === 'proximo' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}><p className="label-uppercase">Situação temporal</p><p className="text-sm font-black mt-1">{temporal === 'vencido' ? 'Prazo vencido' : temporal === 'proximo' ? 'Próximo do vencimento' : 'Prazo regular'}</p></div></div><p className="text-sm text-slate-600 mt-4">{equipment.description}</p></StepShell>;
}

function StepChecklist({ scenario, session, allAnswered, setChecklistAnswer, onNext, onBack }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; session: NonNullable<ReturnType<typeof useSimulatorStore.getState>['activeSession']>; allAnswered: boolean; setChecklistAnswer: (id: string, answer: { selectedResult: SimulatorResult; studentNote: string }) => void; onNext: () => void; onBack: () => void }) {
  return <StepShell eyebrow="Etapa 3 · Checklist" title="Avalie cada item" footer={<><button type="button" onClick={onBack} className="btn-ghost btn-auto"><ArrowLeft className="w-4 h-4" /> Voltar</button><button type="button" onClick={onNext} disabled={!allAnswered} className="btn-primary btn-auto disabled:opacity-40">Classificar inspeção <ArrowRight className="w-4 h-4" /></button></>}><div className="space-y-4">{scenario.checklist.map((item, index) => { const answer = session.answers[item.id]; return <fieldset key={item.id} className="rounded-xl border border-slate-100 p-4"><legend className="px-1 text-sm font-black text-slate-800">{index + 1}. {item.label}</legend>{item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">{RESULT_OPTIONS.map((result) => <label key={result} className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-bold cursor-pointer ${answer?.selectedResult === result ? RESULT_STYLES[result] : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><input type="radio" name={item.id} checked={answer?.selectedResult === result} onChange={() => setChecklistAnswer(item.id, { selectedResult: result, studentNote: answer?.studentNote ?? '' })} className="accent-primary" />{RESULT_LABELS[result]}</label>)}</div>{answer?.selectedResult && answer.selectedResult !== 'conforme' && <label className="block mt-3"><span className="field-label">Observação do treinamento</span><input value={answer.studentNote} onChange={(event) => setChecklistAnswer(item.id, { selectedResult: answer.selectedResult!, studentNote: event.target.value.slice(0, 160) })} className="field-input" maxLength={160} placeholder="Registre o que você observou" /></label>}</fieldset>; })}</div></StepShell>;
}

function StepClassification({ scenario, onNext, onBack }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; onNext: () => void; onBack: () => void }) {
  return <StepShell eyebrow="Etapa 4 · Classificação" title="Compare a gravidade dos achados" footer={<><button type="button" onClick={onBack} className="btn-ghost btn-auto"><ArrowLeft className="w-4 h-4" /> Voltar</button><button type="button" onClick={onNext} className="btn-primary btn-auto">Revisar respostas <ArrowRight className="w-4 h-4" /></button></>}><div className="rounded-xl bg-blue-50 border border-blue-100 p-5 text-sm text-blue-900"><div className="flex gap-3"><CircleAlert className="w-5 h-5 shrink-0" /><p>O resultado global segue a condição mais crítica: <strong>Não Conforme</strong> prevalece sobre <strong>Observação</strong>, que prevalece sobre <strong>Conforme</strong>.</p></div></div><p className="text-sm text-slate-600 mt-4">{scenario.hints[0]}</p></StepShell>;
}

function StepReview({ scenario, session, onNext, onBack }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; session: NonNullable<ReturnType<typeof useSimulatorStore.getState>['activeSession']>; onNext: () => void; onBack: () => void }) {
  return <StepShell eyebrow="Etapa 5 · Revisão" title="Revise antes de decidir" footer={<><button type="button" onClick={onBack} className="btn-ghost btn-auto"><ArrowLeft className="w-4 h-4" /> Corrigir checklist</button><button type="button" onClick={onNext} className="btn-primary btn-auto">Escolher resultado <ArrowRight className="w-4 h-4" /></button></>}><div className="space-y-2">{scenario.checklist.map((item) => <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3"><span className="text-sm font-bold text-slate-700">{item.label}</span><ResultLabel result={session.answers[item.id].selectedResult!} /></div>)}</div><p className="text-sm text-slate-600 mt-4">A próxima etapa pede sua decisão global. O simulador não preencherá a resposta por você.</p></StepShell>;
}

function StepResult({ scenario, selected, setResult, onConfirm, onBack }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; selected: SimulatorResult | null; setResult: (result: SimulatorResult) => void; onConfirm: () => void; onBack: () => void }) {
  return <StepShell eyebrow="Etapa 6 · Resultado" title="Qual é o resultado desta inspeção?" footer={<><button type="button" onClick={onBack} className="btn-ghost btn-auto"><ArrowLeft className="w-4 h-4" /> Voltar</button><button type="button" onClick={onConfirm} disabled={!selected} className="btn-primary btn-auto disabled:opacity-40">Confirmar decisão <Check className="w-4 h-4" /></button></>}><p className="text-sm text-slate-600 mb-4">Escolha livremente. Uma resposta incorreta também faz parte do aprendizado.</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{RESULT_OPTIONS.map((result) => <label key={result} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer min-h-16 ${selected === result ? RESULT_STYLES[result] : 'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name="inspection-result" checked={selected === result} onChange={() => setResult(result)} className="accent-primary" /><span className="text-sm font-black">{RESULT_LABELS[result]}</span></label>)}</div><div className="rounded-xl bg-slate-50 p-4 mt-5"><p className="label-uppercase">Dimensão temporal</p><p className="text-sm text-slate-700 mt-1">A próxima inspeção é em {formatDateBR(scenario.initialEquipment.nextInspectionDate)}. Esse prazo é analisado separadamente do resultado técnico.</p></div></StepShell>;
}

function StepFeedback({ scenario, session, onReset, onBack, onExit }: { scenario: ReturnType<typeof useSimulatorStore.getState>['scenarios'][number]; session: NonNullable<ReturnType<typeof useSimulatorStore.getState>['activeSession']>; onReset: () => void; onBack: () => void; onExit: () => void }) {
  const feedback = session.feedback;
  const score = calculateScore(session, scenario);
  const temporal = getTemporalStatus(scenario.initialEquipment.nextInspectionDate, getLocalDateISO());
  if (!feedback) return null;
  return <StepShell eyebrow="Etapa 7 · Feedback" title={feedback.correct ? 'Acertou a decisão técnica' : 'Revise este ponto'} footer={<><button type="button" onClick={onReset} className="btn-ghost btn-auto"><RotateCcw className="w-4 h-4" /> Refazer cenário</button><button type="button" onClick={onBack} className="btn-ghost btn-auto">Voltar aos cenários</button><button type="button" onClick={onExit} className="btn-primary btn-auto">Sair do simulador <ArrowLeft className="w-4 h-4" /></button></>}><div className={`rounded-xl border p-5 ${feedback.correct ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex gap-3"><div className="mt-0.5">{feedback.correct ? <CheckCircle2 className="w-6 h-6 text-emerald-700" /> : <CircleAlert className="w-6 h-6 text-amber-700" />}</div><div><p className="font-black text-slate-900">{feedback.correct ? 'ACERTOU' : 'REVISE ESTE PONTO'}</p><p className="text-sm text-slate-700 mt-1">{feedback.explanation}</p></div></div></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4"><div className="rounded-xl bg-slate-50 p-4"><p className="label-uppercase">Sua resposta</p><div className="mt-2"><ResultLabel result={feedback.selectedResult} /></div></div><div className="rounded-xl bg-slate-50 p-4"><p className="label-uppercase">Esperado</p><div className="mt-2"><ResultLabel result={feedback.expectedResult} /></div></div><div className="rounded-xl bg-slate-50 p-4"><p className="label-uppercase">Pontuação da sessão</p><p className="text-2xl font-black text-primary mt-1">{score}%</p></div></div><div className="mt-5"><h3 className="text-sm font-black text-slate-900">Resumo dos itens</h3><div className="space-y-2 mt-2">{feedback.itemReviews.filter((review) => !review.correct).map((review) => <div key={review.itemId} className="rounded-lg border border-slate-100 px-3 py-3 text-sm"><p className="font-bold text-slate-700">{review.label}</p><p className="text-xs text-slate-500 mt-1">Aluno: {review.selectedResult ? RESULT_LABELS[review.selectedResult] : 'Não respondido'} · Esperado: {RESULT_LABELS[review.expectedResult]}</p></div>)}{feedback.itemReviews.every((review) => review.correct) && <p className="text-sm text-slate-600">Todos os itens foram classificados corretamente.</p>}</div></div><div className="mt-5"><h3 className="text-sm font-black text-slate-900">Pontos-chave</h3><ul className="mt-2 space-y-2">{scenario.learningPoints.map((point) => <li key={point} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />{point}</li>)}</ul></div><div className="rounded-xl bg-slate-50 p-4 mt-5"><p className="text-sm font-black text-slate-800">Resumo temporal</p><p className="text-sm text-slate-600 mt-1">Resultado técnico: {RESULT_LABELS[scenario.expectedResult]} · Prazo: {temporal === 'vencido' ? 'Vencido' : temporal === 'proximo' ? 'Próximo do vencimento' : 'Regular'}.</p></div></StepShell>;
}
