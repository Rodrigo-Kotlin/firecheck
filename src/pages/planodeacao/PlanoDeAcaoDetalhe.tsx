import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useAppStore } from '../../store';
import type { ActionPlanItemStatus } from '../../types';
import { getActionPlanProgress } from '../../services/actionPlanItems';
import { canEditActionPlan } from '../../services/permissions';

const statuses: ActionPlanItemStatus[] = ['Aberta', 'Em andamento', 'Concluída'];

export default function PlanoDeAcaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { actionPlans, actionPlanItems, updateActionPlanItem, user } = useAppStore();
  const plan = actionPlans.find((item) => item.id === id);
  const items = useMemo(() => actionPlanItems.filter((item) => item.planId === id && !item.deletedAt), [actionPlanItems, id]);
  const progress = getActionPlanProgress(items);
  const [editing, setEditing] = useState<string | null>(null);

  if (!plan || (plan.userId !== undefined && !canEditActionPlan(user, plan))) {
    return <main className="p-6"><Link to="/planodeacao" className="text-primary">Voltar aos planos</Link><p className="mt-6">Plano de ação não encontrado.</p></main>;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 pb-24 sm:p-6">
      <Link to="/planodeacao" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary"><ArrowLeft size={16} /> Planos de ação</Link>
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Plano consolidado</p><h1 className="mt-1 text-xl font-bold text-gray-900">{plan.local}</h1><p className="mt-1 text-sm text-gray-500">{plan.inspectionId ?? plan.id}</p></div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{progress.percentual}% concluído</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percentual}%` }} /></div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500"><span>{progress.total} pendências</span><span>{progress.concluidas} concluídas</span><span>{progress.vencidas} vencidas</span></div>
      </header>
      <section className="space-y-3">
        {items.map((item) => {
          const isEditing = editing === item.id;
          return <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              {item.status === 'Concluída' ? <CheckCircle2 className="mt-0.5 text-success" size={20} /> : item.status === 'Em andamento' ? <Clock className="mt-0.5 text-primary" size={20} /> : <Circle className="mt-0.5 text-gray-400" size={20} />}
              <div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-gray-900">{item.descricaoDesvio}</h2><button type="button" className="text-sm font-medium text-primary" onClick={() => setEditing(isEditing ? null : item.id)}>{isEditing ? 'Fechar' : 'Editar'}</button></div><p className="mt-1 text-xs text-gray-500">{item.tipoDesvio === 'warning' ? 'Observação' : 'Não conforme'} · {item.deviationKey}</p>
                {isEditing && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-gray-600">Status<select className="mt-1 w-full rounded-lg border border-gray-300 p-2" value={item.status} onChange={(e) => updateActionPlanItem(item.id, { status: e.target.value as ActionPlanItemStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm text-gray-600">Prazo<input type="date" className="mt-1 w-full rounded-lg border border-gray-300 p-2" value={item.prazo} onChange={(e) => updateActionPlanItem(item.id, { prazo: e.target.value })} /></label><label className="text-sm text-gray-600 sm:col-span-2">Ação corretiva<textarea className="mt-1 w-full rounded-lg border border-gray-300 p-2" rows={2} value={item.acaoCorretiva} onChange={(e) => updateActionPlanItem(item.id, { acaoCorretiva: e.target.value })} /></label></div>}
              </div>
            </div>
          </article>;
        })}
        {items.length === 0 && <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Este plano não possui pendências filhas.</div>}
      </section>
    </main>
  );
}
