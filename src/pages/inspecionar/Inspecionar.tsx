import { useState, useMemo, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { compressImage, PHOTO_MAX_WIDTH } from '../../services/photoService';
import { showToast } from '../../hooks/useToasts';
import {
  ChevronLeft,
  ShieldCheck,
  Camera,
  Trash2,
  Calendar,
  Scan,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minus,
  MapPin,
  MessageSquare,
  Plus,
  Info,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EquipmentStatus } from '../../types';

type ChecklistValue = 'OK' | 'ATENCAO' | 'REPROVADO' | 'N.A.';

// Checklists item text arrays
const CHECKLIST_EXTINTOR = [
  'Acesso livre e desobstruído',
  'Fixado no suporte correto',
  'Sinalização visível',
  'Lacre íntegro',
  'Pino de segurança presente',
  'Manômetro na faixa verde',
  'Mangueira sem danos',
  'Difusor/esguicho íntegro',
  'Cilindro sem corrosão',
  'Rótulo legível',
  'Carga na validade',
  'Teste hidrostático válido',
  'Compatível com risco do local',
  'Instalação adequada',
  'Sem sinais de uso'
];

const CHECKLIST_HIDRANTE = [
  'Acesso livre',
  'Abrigo em ordem',
  'Porta abre normalmente',
  'Sinalização visível',
  'Mangueira presente e íntegra',
  'Mangueira acondicionada corretamente',
  'Esguicho presente',
  'Chave storz presente',
  'Registro sem vazamento',
  'Volante íntegro',
  'Conexões ok',
  'Sem corrosão crítica',
  'Lacre presente',
  'Validade da mangueira ok',
  'Local limpo'
];

const CHECKLIST_ALARME = [
  'Acesso livre',
  'Sinalização visível',
  'Equipamento íntegro',
  'Identificação legível',
  'Altura adequada',
  'Funcionamento testado',
  'Comunicação com central',
  'Alarme operacional',
  'Sem obstrução'
];

const CHECKLIST_ILUMINACAO = [
  'Instalação correta',
  'Estrutura íntegra',
  'Lente sem danos',
  'Aciona em falta de energia',
  'Autonomia verificada',
  'Bateria ok',
  'Sem fios expostos',
  'Sem obstrução visual'
];

const CHECKLIST_VALUES: readonly ChecklistValue[] = ['OK', 'ATENCAO', 'REPROVADO', 'N.A.'];

const STATUS_CONFIGS: Record<
  ChecklistValue,
  { label: string; pillClass: string; selectedClass: string; icon: LucideIcon }
> = {
  OK: {
    label: 'OK',
    pillClass: 'bg-green-100 text-success',
    selectedClass: 'bg-green-100 text-success',
    icon: CheckCircle2,
  },
  ATENCAO: {
    label: 'Atenção',
    pillClass: 'bg-amber-100 text-pending',
    selectedClass: 'bg-amber-100 text-pending',
    icon: AlertTriangle,
  },
  REPROVADO: {
    label: 'Falha',
    pillClass: 'bg-red-100 text-critical',
    selectedClass: 'bg-red-100 text-critical',
    icon: XCircle,
  },
  'N.A.': {
    label: 'N.A.',
    pillClass: 'bg-gray-100 text-gray-500',
    selectedClass: 'bg-gray-200 text-gray-600',
    icon: Minus,
  },
};

const EQUIPMENT_STATUS_CONFIGS: Record<
  EquipmentStatus,
  { label: string; pillClass: string; borderClass: string; icon: LucideIcon }
> = {
  regular: {
    label: 'EM DIA',
    pillClass: 'bg-green-100 text-success',
    borderClass: 'border-l-success',
    icon: CheckCircle2,
  },
  pendente: {
    label: 'PENDENTE',
    pillClass: 'bg-amber-100 text-pending',
    borderClass: 'border-l-pending',
    icon: AlertTriangle,
  },
  vencido: {
    label: 'VENCIDO',
    pillClass: 'bg-red-100 text-critical',
    borderClass: 'border-l-critical',
    icon: XCircle,
  },
  observacao: {
    label: 'OBSERVAÇÃO',
    pillClass: 'bg-blue-100 text-blue-600',
    borderClass: 'border-l-blue-500',
    icon: Info,
  },
  em_manutencao: {
    label: 'EM MANUTENÇÃO',
    pillClass: 'bg-blue-100 text-blue-600',
    borderClass: 'border-l-blue-500',
    icon: Info,
  },
  inativo: {
    label: 'INATIVO',
    pillClass: 'bg-gray-200 text-gray-600',
    borderClass: 'border-l-gray-400',
    icon: XCircle,
  },
  substituido: {
    label: 'SUBSTITUÍDO',
    pillClass: 'bg-purple-100 text-purple-600',
    borderClass: 'border-l-purple-500',
    icon: Info,
  },
  extraviado: {
    label: 'EXTRAVIADO',
    pillClass: 'bg-red-100 text-red-600',
    borderClass: 'border-l-red-500',
    icon: XCircle,
  },
};

// ---------------------------------------------------------------------------
// PhotoCapture — capture / preview / replace / remove flow for inspection
// evidence photos. Mobile-first: a primary "Tirar foto" button uses
// `capture="environment"` to launch the rear camera on phones, and a
// secondary "Escolher da galeria" button opens the file picker. The preview
// shows the resized dimensions + size, a green "Foto pronta" badge, and two
// clear actions — "Trocar foto" (replaces) and "Remover" (with confirm).
//
// The actual compression/resize/encode logic lives in `compressImage()`
// (services/photoService.ts) so it can be reused and unit-tested. We only
// keep UI-level concerns here: validation, loading state, error display.
// ---------------------------------------------------------------------------

const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB upload limit

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type PhotoCaptureProps = {
  value: string | null;
  onChange: (base64: string | null) => void;
  disabled?: boolean;
};

function PhotoCapture({ value, onChange, disabled = false }: PhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ width: number; height: number; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      const msg = 'Selecione um arquivo de imagem válido (JPG, PNG ou HEIC).';
      setError(msg);
      showToast({ kind: 'error', title: 'Formato inválido', description: msg });
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      const msg = `A imagem é muito grande (${formatBytes(file.size)}). O limite é ${formatBytes(PHOTO_MAX_BYTES)}.`;
      setError(msg);
      showToast({ kind: 'error', title: 'Arquivo muito grande', description: msg });
      return;
    }
    setLoading(true);
    try {
      // All resize / re-encode work happens in the service so the same logic
      // can be reused by batch flows (relatórios, etc.) and unit-tested.
      const compressed = await compressImage(file);
      setMeta({ width: compressed.width, height: compressed.height, size: compressed.size });
      onChange(compressed.dataUrl);
      if (compressed.ratio > 1.1) {
        showToast({
          kind: 'success',
          title: 'Foto otimizada',
          description: `Reduzida em ${Math.round((1 - 1 / compressed.ratio) * 100)}% (${compressed.width}×${compressed.height}, ${formatBytes(compressed.size)}).`,
          duration: 3000,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível processar a imagem.';
      setError(msg);
      showToast({ kind: 'error', title: 'Falha ao processar foto', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setMeta(null);
    setConfirmRemove(false);
    setError(null);
  };

  const resetInput = (input: HTMLInputElement | null) => {
    // Allow re-selecting the same file (e.g. to retry after an error).
    if (input) input.value = '';
  };

  // -- Preview state --
  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
          <img
            src={value}
            alt="Evidência fotográfica da inspeção"
            className="w-full h-48 sm:h-56 object-cover"
          />
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
            <CheckCircle2 className="w-3 h-3" />
            Foto pronta
          </div>
          {meta && (
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold tabular-nums">
              {meta.width}×{meta.height} · {formatBytes(meta.size)}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-critical flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-critical flex-1 leading-snug">{error}</span>
          </div>
        )}

        {!confirmRemove ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={disabled}
              className="btn-ghost btn-sm btn-auto"
            >
              <ImagePlus className="w-4 h-4" />
              Trocar foto
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={disabled}
              className="btn-ghost btn-sm btn-auto text-critical hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-critical flex-shrink-0" />
            <span className="text-xs font-bold text-critical flex-1">Remover esta foto?</span>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="btn-ghost btn-sm text-critical hover:bg-red-100"
            >
              Sim, remover
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              disabled={disabled}
              className="btn-ghost btn-sm"
            >
              Cancelar
            </button>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            resetInput(e.target);
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            resetInput(e.target);
          }}
        />
      </div>
    );
  }

  // -- Empty / loading state --
  return (
    <div className="space-y-2">
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 sm:p-5 transition-all ${
          loading
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-300'
        }`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-3" role="status" aria-live="polite">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
              Processando imagem...
            </span>
            <span className="text-[10px] text-blue-600/80 font-medium">
              Redimensionando para {PHOTO_MAX_WIDTH}px
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="w-full flex flex-col items-center justify-center gap-1.5 py-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Tirar foto"
          >
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
              <Camera className="w-6 h-6 text-gray-500" />
            </div>
            <span className="text-sm font-black text-gray-800 uppercase tracking-wider">
              Adicionar Evidência
            </span>
            <span className="text-[11px] text-gray-500 font-medium text-center">
              Tire uma foto ou escolha da galeria
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg" role="alert">
          <AlertTriangle className="w-4 h-4 text-critical flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-critical leading-snug">{error}</p>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="text-[10px] font-black text-critical underline uppercase tracking-wider mt-1"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="btn-primary btn-sm btn-auto"
          >
            <Camera className="w-4 h-4" />
            Tirar foto
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={disabled}
            className="btn-ghost btn-sm btn-auto"
          >
            <ImagePlus className="w-4 h-4" />
            Escolher da galeria
          </button>
        </div>
      )}

      <span className="field-hint">
        JPG, PNG ou HEIC · até {formatBytes(PHOTO_MAX_BYTES)} · a foto é redimensionada automaticamente
      </span>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          resetInput(e.target);
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          resetInput(e.target);
        }}
      />
    </div>
  );
}

export default function Inspecionar() {
  const { equipments, addInspection, user } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('id');

  const [eqId, setEqId] = useState(preSelectedId || '');
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>({});
  const [validadeDate, setValidadeDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedEquipment = equipments.find((e) => e.id === eqId);

  // Build checklist item list based on the selected equipment type.
  const checklistItems = useMemo<string[]>(() => {
    if (!selectedEquipment) return [];
    const tipoLower = selectedEquipment.tipo.toLowerCase();
    if (tipoLower.includes('extintor')) return CHECKLIST_EXTINTOR;
    if (tipoLower.includes('hidrante') || tipoLower.includes('mangueira') || tipoLower.includes('esguicho')) return CHECKLIST_HIDRANTE;
    if (tipoLower.includes('alarme') || tipoLower.includes('acionador')) return CHECKLIST_ALARME;
    return CHECKLIST_ILUMINACAO;
  }, [selectedEquipment]);

  const checklistKey = checklistItems.join('|');

  // Re-seed checklist whenever the equipment type changes (React 19 pattern:
  // adjust state during render instead of in an effect).
  const [prevChecklistKey, setPrevChecklistKey] = useState(checklistKey);
  if (checklistKey !== prevChecklistKey) {
    setPrevChecklistKey(checklistKey);
    if (checklistItems.length === 0) {
      setChecklist({});
    } else {
      const initial: Record<string, ChecklistValue> = {};
      checklistItems.forEach((item) => { initial[item] = 'OK'; });
      setChecklist(initial);
    }
  }

  // Set a default expiration date on first render only.
  const [hasSetDefaultDate, setHasSetDefaultDate] = useState(false);
  if (!hasSetDefaultDate && !validadeDate) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setValidadeDate(futureDate.toISOString().split('T')[0]);
    setHasSetDefaultDate(true);
  }

  // Aggregate checklist counts for the summary header.
  const checklistCounts = useMemo(() => {
    const counts: Record<ChecklistValue, number> = { OK: 0, ATENCAO: 0, REPROVADO: 0, 'N.A.': 0 };
    Object.values(checklist).forEach((val) => {
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }, [checklist]);

  const handleFinalize = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) {
      setErrorMsg('Por favor, selecione um equipamento.');
      return;
    }

    // Prevent double-click
    if (isSaving) return;

    // Determine status logic.
    // REPROVADO > ATENCAO > date warnings > regular.
    let finalStatus: EquipmentStatus = 'regular';
    const hasReprovado = Object.values(checklist).some((val) => val === 'REPROVADO');
    const hasAtencao = Object.values(checklist).some((val) => val === 'ATENCAO');

    if (hasReprovado) {
      finalStatus = 'vencido';
    } else if (hasAtencao) {
      finalStatus = 'pendente';
    } else if (validadeDate) {
      const today = new Date();
      const expDate = new Date(validadeDate);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        finalStatus = 'vencido';
      } else if (diffDays <= 30) {
        finalStatus = 'observacao';
      }
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await addInspection({
        equipmentId: selectedEquipment.id,
        data: new Date().toISOString().split('T')[0],
        inspetor: user?.nome || 'Inspetor',
        status: finalStatus,
        observacoes,
        userId: user?.id,
        photoBase64,
        dataProximaInspecao: validadeDate || undefined,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar inspeção. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewInspection = () => {
    setSuccess(false);
    setObservacoes('');
    setPhotoBase64(null);

    // Reset date to today + 30 days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    setValidadeDate(futureDate.toISOString().split('T')[0]);

    // Re-seed checklist with all "OK"
    if (selectedEquipment && checklistItems.length > 0) {
      const initial: Record<string, ChecklistValue> = {};
      checklistItems.forEach((item) => { initial[item] = 'OK'; });
      setChecklist(initial);
    } else {
      setChecklist({});
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const backTarget = preSelectedId ? `/equipamentos/${preSelectedId}` : '/';
  const equipConfig = selectedEquipment
    ? EQUIPMENT_STATUS_CONFIGS[selectedEquipment.status] || EQUIPMENT_STATUS_CONFIGS.observacao
    : null;
  const EquipStatusIcon = equipConfig?.icon;

  return (
    <div className="space-y-4 sm:space-y-6 pb-40 lg:pb-24">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate(backTarget)}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Inspeção</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Nova Inspeção
          </h1>
        </div>
      </header>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {success ? (
        <div className="card-subtle bg-white py-10 px-6 flex flex-col items-center justify-center text-center gap-5 border-l-4 border-l-success">
          <div className="w-20 h-20 bg-green-50 text-success rounded-full flex items-center justify-center">
            <ShieldCheck className="w-12 h-12" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Inspeção Registrada!</h3>
            <p className="text-xs text-gray-500 mt-1.5 font-bold uppercase tracking-wider">
              {navigator.onLine ? '✓ Salvo · Sincronizando' : '⏳ Salvo offline · Pendente sincronização'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
            <button
              type="button"
              onClick={() => navigate(backTarget)}
              className="btn-ghost btn-auto flex-1"
            >
              {preSelectedId ? 'Ver Equipamento' : 'Voltar ao Início'}
            </button>
            <button
              type="button"
              onClick={handleNewInspection}
              className="btn-primary btn-auto flex-1"
            >
              <Plus className="w-4 h-4" />
              Nova Inspeção
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFinalize} className="space-y-4 sm:space-y-6">
          {/* Equipment selector — only when not pre-selected and nothing picked yet */}
          {!preSelectedId && !selectedEquipment && (
            <div className="card-subtle bg-white space-y-3">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Equipamento</span>
              <div className="relative">
                <select
                  id="eqSelector"
                  value={eqId}
                  onChange={(e) => setEqId(e.target.value)}
                  className="field-input pr-10"
                  aria-label="Selecionar equipamento"
                >
                  <option value="">Selecione um equipamento...</option>
                  {equipments.map((e) => (
                    <option key={e.id} value={e.id}>
                      [{e.id}] {e.tipo} ({e.local})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                  <Scan className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Equipment summary — hero card with status border */}
          {selectedEquipment && equipConfig && EquipStatusIcon && (
            <div className={`card-subtle border-l-[4px] ${equipConfig.borderClass} p-4 sm:p-5 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs sm:text-sm font-extrabold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded tracking-tight">
                  {selectedEquipment.id}
                </span>
                <span className={`pill ${equipConfig.pillClass} flex-shrink-0`}>
                  <EquipStatusIcon className="w-3 h-3" />
                  {equipConfig.label}
                </span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                  {selectedEquipment.tipo}
                </h2>
                {selectedEquipment.subtipo && (
                  <p className="text-sm text-gray-500 mt-0.5">{selectedEquipment.subtipo}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 pt-3 border-t border-gray-50">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">
                  {selectedEquipment.local}
                  <span className="text-gray-300 mx-1">·</span>
                  {selectedEquipment.setor}
                </span>
              </div>
            </div>
          )}

          {/* Checklist */}
          {selectedEquipment && checklistItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <span className="label-uppercase">Checklist Técnico</span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {checklistItems.length} itens · toque em cada ponto para classificar
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CHECKLIST_VALUES.map((value) => {
                    const count = checklistCounts[value];
                    if (count === 0) return null;
                    const config = STATUS_CONFIGS[value];
                    const Icon = config.icon;
                    return (
                      <span key={value} className={`pill ${config.pillClass}`}>
                        <Icon className="w-3 h-3" />
                        {count} {config.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checklistItems.map((item, index) => {
                  const val = checklist[item];
                  return (
                    <div key={item} className="card-subtle bg-white space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-gray-800 leading-snug flex-1">
                          {item}
                        </span>
                        <span className="text-[10px] font-bold text-gray-300 tabular-nums flex-shrink-0">
                          {String(index + 1).padStart(2, '0')}/{String(checklistItems.length).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded-xl">
                        {CHECKLIST_VALUES.map((value) => {
                          const config = STATUS_CONFIGS[value];
                          const Icon = config.icon;
                          const isSelected = val === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setChecklist((prev) => ({ ...prev, [item]: value }))}
                              className={`flex flex-col items-center justify-center gap-0.5 h-12 rounded-lg transition-all ${
                                isSelected
                                  ? `${config.selectedClass} shadow-sm`
                                  : 'text-gray-400 hover:text-gray-600 active:scale-95'
                              }`}
                              aria-pressed={isSelected}
                              aria-label={config.label}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight">
                                {config.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date, photo and observations — only when equipment is selected */}
          {selectedEquipment && (
            <>
              {/* Date */}
              <div className="card-subtle bg-white space-y-2">
                <label htmlFor="validadeDate" className="field-label flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Data de Validade *
                </label>
                <div className="relative">
                  <input
                    id="validadeDate"
                    type="date"
                    required
                    value={validadeDate}
                    onChange={(e) => setValidadeDate(e.target.value)}
                    className="field-input pr-10"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                    <Calendar className="w-5 h-5" />
                  </span>
                </div>
              </div>

              {/* Photo */}
              <div className="card-subtle bg-white space-y-2">
                <span className="field-label flex items-center gap-1.5">
                  <Camera className="w-4 h-4" />
                  Evidência Visual
                  <span className="text-gray-400 text-[10px] font-medium normal-case ml-1">
                    (opcional)
                  </span>
                </span>
                <PhotoCapture value={photoBase64} onChange={setPhotoBase64} />
              </div>

              {/* Observations — prominent section */}
              <div className="card-subtle bg-white space-y-3">
                <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  <div>
                    <h2 className="label-uppercase">Observações</h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">Anomalias, condições ou detalhes técnicos</p>
                  </div>
                </div>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: Lacre rompido, manômetro fora da faixa verde..."
                  rows={4}
                  className="field-textarea"
                />
              </div>
            </>
          )}

          {/* Sticky submit */}
          {selectedEquipment && (
            <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Salvando inspeção...</>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /> Finalizar Inspeção</>
                )}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
