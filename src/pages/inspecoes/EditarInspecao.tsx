import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { canEditInspection } from '../../services/permissions';
import { INSPECTOR_OPTIONS } from '../../config/inspectors';
import { showToast } from '../../hooks/useToasts';
import { STATUS_LABEL } from '../../constants/equipmentFormConfig';
import type { Equipment, EquipmentStatus, Inspection } from '../../types';
import {
  AlertCircle,
  AlertOctagon,
  Calendar,
  ChevronLeft,
  MapPin,
  PenLine,
  Save,
  Tag,
  User,
} from 'lucide-react';

/** Datas de inspeção são armazenadas como YYYY-MM-DD civil (sem timezone).
 *  Nunca passamos por `new Date('YYYY-MM-DD')` para não deslocar o dia. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const INSPECTION_STATUS_OPTIONS = ['regular', 'pendente', 'vencido', 'observacao'] as const;

function formatData(value: string | undefined | null): string {
  return value ? value.slice(0, 10) : '—';
}

interface InspectionFormProps {
  inspection: Inspection;
  equipment?: Equipment;
  updatedByName: string;
  onUpdatedByNameChange: (v: string) => void;
}

/** Formulário de edição — monta com estado semeado pela inspeção e só recebe
 *  a prop uma vez (key = inspection.id), evitando re-seed durante a edição. */
function InspectionForm({ inspection, equipment, updatedByName, onUpdatedByNameChange }: InspectionFormProps) {
  const navigate = useNavigate();
  const { updateInspection, resolveInspectionConflictKeepLocal, resolveInspectionConflictUseRemote } = useAppStore();

  const [data, setData] = useState(inspection.data ?? '');
  const [status, setStatus] = useState<string>(inspection.status);
  const [observacoes, setObservacoes] = useState(inspection.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isConflict = inspection.syncConflict || inspection.syncError === 'conflict';

  const resolveKeepLocal = async () => {
    if (!confirm('Tem certeza que deseja manter sua versão local? Isso irá sobrescrever a versão mais recente do servidor.')) return;
    try {
      await resolveInspectionConflictKeepLocal(inspection.id);
      showToast({ kind: 'success', title: 'Conflito resolvido', description: 'Sua versão foi enviada ao servidor.' });
    } catch (err) {
      showToast({ kind: 'error', title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao resolver conflito.' });
    }
  };

  const resolveUseRemote = async () => {
    if (!confirm('Tem certeza que deseja usar a versão do servidor? Sua alteração local será descartada.')) return;
    try {
      await resolveInspectionConflictUseRemote(inspection.id);
      showToast({ kind: 'success', title: 'Conflito resolvido', description: 'Versão do servidor restaurada.' });
    } catch (err) {
      showToast({ kind: 'error', title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao resolver conflito.' });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    if (!DATE_PATTERN.test(data)) {
      setErrorMsg('Informe uma data válida.');
      setSubmitting(false);
      return;
    }
    if (!status) {
      setErrorMsg('Selecione o status da inspeção.');
      setSubmitting(false);
      return;
    }
    if (!updatedByName) {
      setErrorMsg('Selecione quem está realizando esta alteração.');
      setSubmitting(false);
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('firecheck_last_inspector_name', updatedByName);
    }

    const result = await updateInspection(inspection.id, {
      data,
      status: status as EquipmentStatus,
      observacoes,
      updatedByName,
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.message || 'Não foi possível salvar as alterações. Tente novamente.');
      return;
    }

    if (result.conflict) {
      showToast({
        kind: 'warning',
        title: 'Conflito de sincronização',
        description: result.message,
      });
      return;
    }

    showToast({
      kind: 'success',
      title: result.mode === 'cloud'
        ? 'Inspeção atualizada com sucesso.'
        : 'Alteração salva neste dispositivo. Será sincronizada quando houver conexão.',
    });
    navigate(`/inspecoes/${inspection.id}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <button
          type="button"
          onClick={() => navigate(`/inspecoes/${inspection.id}`)}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Inspeções</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Editar Inspeção
          </h1>
        </div>
      </header>

      {/* Banner de conflito */}
      {isConflict && (
        <div className="card-subtle bg-red-50 border border-red-200 border-l-[4px] border-l-red-500">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-critical flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-xs font-black text-critical uppercase tracking-wider">Conflito de sincronização</div>
              <p className="text-xs text-critical font-medium leading-relaxed">
                {inspection.syncConflictReason ??
                  'Esta inspeção foi alterada em outro dispositivo depois da última sincronização. Revise as versões antes de continuar.'}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => void resolveKeepLocal()}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 border-none cursor-pointer"
                >
                  Manter minha versão
                </button>
                <button
                  type="button"
                  onClick={() => void resolveUseRemote()}
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-white border border-red-200 text-critical hover:bg-red-50 cursor-pointer"
                >
                  Usar versão do servidor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Cabeçalho somente-leitura */}
        <div className="card-subtle bg-amber-50 border border-amber-200 border-l-[4px] border-l-amber-400">
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-amber-700 uppercase tracking-wider">
                TAG: <span className="font-mono text-sm">{inspection.equipmentId}</span>
                {equipment && (
                  <span className="ml-2 normal-case font-bold text-amber-600">· {equipment.tipo}</span>
                )}
              </div>
              {equipment?.local && (
                <div className="flex items-center gap-1 text-[11px] text-amber-600 font-medium mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {equipment.local}
                </div>
              )}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                  Data original: <span className="font-black">{formatData(inspection.data)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                  <User className="w-3.5 h-3.5" />
                  Realizado por: <span className="font-black">{inspection.inspetor}</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-2 leading-relaxed">
                O responsável e a data registrada na inspeção são preservados. Suas alterações ficam registradas
                em &ldquo;Última alteração&rdquo; ({inspection.updatedByName ?? 'ainda não editada'}) para rastreabilidade.
              </p>
            </div>
          </div>
        </div>

        {/* Campos editáveis */}
        <div className="card-subtle bg-white space-y-4">
          <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <PenLine className="w-4 h-4" />
            </span>
            <div>
              <h2 className="label-uppercase">Alterações</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Apenas estes campos são editáveis</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="editDate" className="field-label">
                Data da inspeção *
              </label>
              <input
                id="editDate"
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="field-input"
              />
            </div>

            <div>
              <label htmlFor="editStatus" className="field-label">
                Status *
              </label>
              <select
                id="editStatus"
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field-input appearance-none"
              >
                <option value="" disabled>Selecione o status...</option>
                {INSPECTION_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="editObservacoes" className="field-label">
              Observações (laudo)
            </label>
            <textarea
              id="editObservacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anomalias, condições ou detalhes técnicos..."
              rows={4}
              className="field-textarea"
            />
          </div>

          <div>
            <label htmlFor="editEditorName" className="field-label flex items-center gap-1.5">
              <User className="w-4 h-4" />
              Quem está realizando esta alteração? *
            </label>
            <select
              id="editEditorName"
              required
              value={updatedByName}
              onChange={(e) => onUpdatedByNameChange(e.target.value)}
              className={`field-input appearance-none ${!updatedByName ? 'text-gray-400' : ''}`}
            >
              <option value="" disabled>Selecione o responsável pela alteração</option>
              {INSPECTOR_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.nome}>{opt.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit — sticky */}
        <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0 flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/inspecoes/${inspection.id}`)}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={submitting || isConflict}>
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {submitting ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EditarInspecao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, equipments, user, authReady } = useAppStore();

  const [updatedByName, setUpdatedByName] = useState(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem('firecheck_last_inspector_name') || '' : ''),
  );

  const inspection = inspections.find((i) => i.id === id);
  const equipment = inspection
    ? equipments.find((e) => e.id === inspection.equipmentId)
    : undefined;

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Inspeção não encontrada</h3>
        <p className="text-sm text-gray-500">A inspeção solicitada não existe no histórico atual.</p>
        <button onClick={() => navigate('/equipamentos')} className="btn-primary max-w-xs mx-auto">
          Voltar
        </button>
      </div>
    );
  }

  if (!canEditInspection(user, inspection)) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Sem permissão</h3>
        <p className="text-sm text-gray-500">Apenas administradores e inspetores podem editar inspeções.</p>
        <button onClick={() => navigate(`/inspecoes/${inspection.id}`)} className="btn-primary max-w-xs mx-auto">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <InspectionForm
      key={inspection.id}
      inspection={inspection}
      equipment={equipment}
      updatedByName={updatedByName}
      onUpdatedByNameChange={setUpdatedByName}
    />
  );
}