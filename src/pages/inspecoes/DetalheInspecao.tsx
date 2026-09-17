import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { canViewInspection, canEditInspection } from '../../services/permissions';
import { db, type LocalInspectionPhoto } from '../../db';
import { downloadInspectionPhoto } from '../../services/photoService';
import { showToast } from '../../hooks/useToasts';
import { STATUS_LABEL } from '../../constants/equipmentFormConfig';
import {
  AlertOctagon,
  AlertTriangle,
  Calendar,
  Camera,
  ChevronLeft,
  Eye,
  FileText,
  MapPin,
  Pencil,
  Tag,
  User,
  X,
} from 'lucide-react';

function formatData(value: string | undefined | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

function formatHorario(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19).replace('T', ' ');
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusPillClass(status: string): string {
  if (status === 'regular') return 'bg-green-100 text-success';
  if (status === 'pendente') return 'bg-amber-100 text-pending';
  if (status === 'vencido') return 'bg-red-100 text-critical';
  return 'bg-blue-100 text-blue-600';
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <div className="label-uppercase mb-1">{label}</div>
      <div className="text-sm text-gray-700 font-semibold">{children}</div>
    </div>
  );
}

/** Foto com download sob demanda — o Blob baixado é cacheado no IndexedDB
 *  SEM tocar em `sincronizado`/`syncAction` (exibição não vira upload). */
function PhotoThumb({ photo }: { photo: LocalInspectionPhoto }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const materialize = async () => {
      if (photo.blob) {
        objectUrl = URL.createObjectURL(photo.blob);
        setUrl(objectUrl);
        return;
      }
      if (photo.storagePath) {
        setLoading(true);
        const blob = await downloadInspectionPhoto(photo.storagePath);
        if (cancelled) return;
        setLoading(false);
        if (!blob) {
          setFailed(true);
          return;
        }
        // Cache para exibição futura (sem alterar flags de sync).
        db.fotos.update(photo.id, { blob }).catch(() => undefined);
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        return;
      }
      setFailed(true);
    };

    void materialize();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.blob, photo.storagePath]);

  if (loading) {
    return (
      <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (failed || !url) {
    return (
      <div className="aspect-square rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
        <Camera className="w-6 h-6" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank', 'noopener')}
      className="aspect-square rounded-xl overflow-hidden bg-gray-50"
      aria-label="Abrir foto em nova aba"
    >
      <img src={url} alt="Foto da inspeção" className="w-full h-full object-cover" />
    </button>
  );
}

export default function DetalheInspecao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { inspections, equipments, user, resolveInspectionConflictKeepLocal, resolveInspectionConflictUseRemote } = useAppStore();

  const [photos, setPhotos] = useState<LocalInspectionPhoto[]>([]);

  const inspection = inspections.find((i) => i.id === id);
  const equipment = inspection
    ? equipments.find((e) => e.id === inspection.equipmentId)
    : undefined;

  const hasPermission = canViewInspection(user);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    db.fotos
      .where('inspectionId')
      .equals(id)
      .sortBy('createdAt')
      .then((rows) => {
        if (!cancelled) setPhotos(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!inspection) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Inspeção não encontrada</h3>
        <p className="text-sm text-gray-500">A inspeção solicitada não existe no histórico atual.</p>
        <button onClick={() => navigate('/equipamentos')} className="btn-primary max-w-xs mx-auto">
          Voltar
        </button>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Sem permissão</h3>
        <p className="text-sm text-gray-500">Apenas administradores e inspetores podem visualizar inspeções.</p>
      </div>
    );
  }

  const isConflict = inspection.syncConflict || inspection.syncError === 'conflict';

  const resolveKeepLocal = async () => {
    if (!inspection) return;
    if (!confirm('Tem certeza que deseja manter sua versão local? Isso irá sobrescrever a versão mais recente do servidor.')) return;
    try {
      await resolveInspectionConflictKeepLocal(inspection.id);
      showToast({ kind: 'success', title: 'Conflito resolvido', description: 'Sua versão foi enviada ao servidor.' });
    } catch (err) {
      showToast({ kind: 'error', title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao resolver conflito.' });
    }
  };

  const resolveUseRemote = async () => {
    if (!inspection) return;
    if (!confirm('Tem certeza que deseja usar a versão do servidor? Sua alteração local será descartada.')) return;
    try {
      await resolveInspectionConflictUseRemote(inspection.id);
      showToast({ kind: 'success', title: 'Conflito resolvido', description: 'Versão do servidor restaurada.' });
    } catch (err) {
      showToast({ kind: 'error', title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao resolver conflito.' });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <button
          type="button"
          onClick={() => navigate(equipment ? `/equipamentos/${equipment.id}` : '/equipamentos')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Inspeções</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Detalhes da Inspeção
          </h1>
        </div>
        {canEditInspection(user, inspection) && (
          <button
            type="button"
            onClick={() => navigate(`/inspecoes/${inspection.id}/editar`)}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-dark min-h-0"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        )}
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

      {/* Equipamento — read-only */}
      {equipment && (
        <div className="card-subtle bg-white">
          <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-4">
            <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4" />
            </span>
            <h2 className="label-uppercase">Equipamento inspecionado</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="TAG">
              <span className="font-mono">{equipment.id}</span>
            </Field>
            <Field label="Tipo">{equipment.tipo}</Field>
            <Field label="Local">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                {equipment.local || '—'}
              </span>
            </Field>
            <Field label="Setor">{equipment.setor || '—'}</Field>
          </div>
        </div>
      )}

      {/* Inspeção */}
      <div className="card-subtle bg-white">
        <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-4">
          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </span>
          <h2 className="label-uppercase">Dados da inspeção</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Data">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formatData(inspection.data)}
            </span>
          </Field>
          <Field label="Status">
            <span className={`pill ${statusPillClass(inspection.status)}`}>
              {STATUS_LABEL[inspection.status] || inspection.status}
            </span>
          </Field>
          <Field label="Realizado por">
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-gray-400" />
              {inspection.inspetor}
            </span>
          </Field>
        </div>
        {inspection.observacoes && (
          <div className="mt-4">
            <div className="label-uppercase mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Observações
            </div>
            <p className="text-sm text-gray-700 font-medium leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3">
              {inspection.observacoes}
            </p>
          </div>
        )}
      </div>

      {/* Rastreabilidade */}
      <div className="card-subtle bg-amber-50 border border-amber-200">
        <div className="flex items-center gap-2.5 border-b border-amber-100 pb-3 mb-4">
          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Eye className="w-4 h-4" />
          </span>
          <h2 className="label-uppercase text-amber-800">Rastreabilidade</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Realizado originalmente por">
            <span className="inline-flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-gray-400" />
              {inspection.inspetor}
            </span>
          </Field>
          <Field label="Registrada em">{formatData(inspection.createdAt)}</Field>
          <Field label="Última alteração">
            {inspection.updatedByName ? (
              <span className="text-violet-700">
                {inspection.updatedByName} · {formatHorario(inspection.updatedAt)}
              </span>
            ) : (
              <span className="text-gray-400">Sem alterações posteriores</span>
            )}
          </Field>
        </div>
        <p className="text-[11px] text-amber-700 mt-3 leading-relaxed">
          O inspetor responsável e a data registrada na inspeção são preservados.
          As alterações feitas posteriormente ficam registradas acima para rastreabilidade.
        </p>
      </div>

      {/* Fotos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label-uppercase">Fotos da inspeção</span>
          <span className="pill bg-gray-100 text-gray-500">
            {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
          </span>
        </div>
        {photos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {photos.map((photo) => (
              <PhotoThumb key={photo.id} photo={photo} />
            ))}
          </div>
        ) : (
          <div className="card-subtle bg-white text-center py-8 text-sm text-gray-400">
            Nenhuma foto registrada nesta inspeção.
          </div>
        )}
      </div>

      {/* Voltar ao equipamento */}
      <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
        <button
          type="button"
          onClick={() => navigate(equipment ? `/equipamentos/${equipment.id}` : '/equipamentos')}
          className="btn-secondary"
        >
          <X className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}