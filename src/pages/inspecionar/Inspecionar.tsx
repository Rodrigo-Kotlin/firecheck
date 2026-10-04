import { useState, useMemo, useRef, useEffect, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  compressInspectionImage,
  PHOTO_MAX_WIDTH,
} from '../../services/photoService';
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
  MapPin,
  MessageSquare,
  Plus,
  Info,
  ImagePlus,
  Loader2,
  User,
  WifiOff,
  History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EquipmentStatus, Criticidade } from '../../types';
import { deleteInspectionDraft, deleteInspectionDraftByKey, loadInspectionDraft, saveInspectionDraft, createInspectionDraft, getInspectionDraftKey, type InspectionDraft } from '../../services/inspectionDraftService';
import { InspectionDraftSession } from '../../services/inspectionDraftSession';
import { buildActionPlanDescription, toActionPlanCandidate, type ActionPlanCandidate } from './inspectionActionPlanMapper';
import { INSPECTOR_OPTIONS } from '../../config/inspectors';
import { buildInspectionNotes, buildInspectionPayload, deriveEvidenceRequirement, deriveInspectionReadiness, deriveInspectionStatus, getChecklistProgress, getChecklistRemainingMessage, getDeviationDescriptionMessage, getDeviationValidationMessage, getEvidenceInstruction, getEvidenceValidationMessage, getInspectionDeviations, getInspectionResultPresentation, isChecklistComplete, validateInspectionResult, type ChecklistValue, type EvidenceRequirement, type InspectionDeviation, type InspectionResult } from './inspectionWorkflow';
import { InspectionChecklist } from './InspectionChecklist';
import {
  createPreviewUrl,
  formatBytes,
  PHOTO_ERROR_MSG,
  PHOTO_MAX_BYTES,
  revokePreviewUrl,
  type PhotoDraft,
} from './inspectionPhoto';

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

function formatInspectionDate(value: string): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getDefaultNextInspectionDate(): string {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  return futureDate.toISOString().split('T')[0];
}

const EQUIPMENT_STATUS_CONFIGS: Record<
  EquipmentStatus,
  { label: string; pillClass: string; borderClass: string; icon: LucideIcon }
> = {
  regular: {
    label: 'Em dia',
    pillClass: 'bg-green-100 text-success',
    borderClass: 'border-l-success',
    icon: CheckCircle2,
  },
  pendente: {
    label: 'Pendente',
    pillClass: 'bg-amber-100 text-pending',
    borderClass: 'border-l-pending',
    icon: AlertTriangle,
  },
  vencido: {
    label: 'Vencido',
    pillClass: 'bg-red-100 text-critical',
    borderClass: 'border-l-critical',
    icon: XCircle,
  },
  observacao: {
    label: 'Em observação',
    pillClass: 'bg-blue-100 text-blue-600',
    borderClass: 'border-l-blue-500',
    icon: Info,
  },
  em_manutencao: {
    label: 'Em manutenção',
    pillClass: 'bg-blue-100 text-blue-600',
    borderClass: 'border-l-blue-500',
    icon: Info,
  },
  inativo: {
    label: 'Inativo',
    pillClass: 'bg-gray-200 text-gray-600',
    borderClass: 'border-l-gray-400',
    icon: XCircle,
  },
  substituido: {
    label: 'Substituído',
    pillClass: 'bg-purple-100 text-purple-600',
    borderClass: 'border-l-purple-500',
    icon: Info,
  },
  extraviado: {
    label: 'Extraviado',
    pillClass: 'bg-red-100 text-red-600',
    borderClass: 'border-l-red-500',
    icon: XCircle,
  },
};

const INSPECTION_RESULT_OPTIONS: Array<{
  value: InspectionResult;
  label: string;
  description: string;
  selectedClass: string;
  icon: LucideIcon;
}> = [
  {
    value: 'regular',
    label: 'Conforme',
    description: 'Todos os itens estão OK ou N.A.',
    selectedClass: 'border-success bg-green-50 text-success',
    icon: CheckCircle2,
  },
  {
    value: 'observacao',
    label: 'Em observação',
    description: 'Há pelo menos um item que exige atenção.',
    selectedClass: 'border-pending bg-amber-50 text-pending',
    icon: AlertTriangle,
  },
  {
    value: 'vencido',
    label: 'Não conforme',
    description: 'Há pelo menos um item reprovado.',
    selectedClass: 'border-critical bg-red-50 text-critical',
    icon: XCircle,
  },
];

const EVIDENCE_REQUIREMENT_CONFIG: Record<EvidenceRequirement, {
  label: string;
  badgeClass: string;
}> = {
  optional: {
    label: 'Opcional',
    badgeClass: 'bg-gray-100 text-gray-600',
  },
  recommended: {
    label: 'Recomendada',
    badgeClass: 'bg-amber-100 text-pending',
  },
  required: {
    label: 'Obrigatória',
    badgeClass: 'bg-red-100 text-critical',
  },
};

const ACTION_PLAN_CRITICIDADE_OPTIONS: Criticidade[] = ['Crítico', 'Alto', 'Médio', 'Baixo'];

// ---------------------------------------------------------------------------
// PhotoCapture — capture / preview / replace / remove flow for inspection
// evidence photos. Mobile-first: a primary "Tirar foto" button uses
// `capture="environment"` to launch the rear camera on phones, and a
// secondary "Escolher da galeria" button opens the file picker. The preview
// shows the final dimensions + size, a green "Foto pronta" badge, and two
// clear actions — "Trocar foto" (replaces) and "Remover" (with confirm).
//
// The actual compression/resize/encode pipeline lives in
// `compressInspectionImage()` (services/photoService.ts) and returns a Blob
// (not base64) so the bytes can go straight into IndexedDB without a second
// base64 round-trip. The preview is an Object URL (`URL.createObjectURL`) that
// the owner screen revokes when the draft is replaced, removed or unmounted.
// We only keep UI-level concerns here: validation, loading state, error
// display and the offline hint.
// ---------------------------------------------------------------------------

/** Foto já processada, pronta para preview + persistência. O preview usa uma
 *  Object URL do Blob (`URL.createObjectURL`) — nunca uma string Base64. */
type PhotoCaptureProps = {
  value: PhotoDraft | null;
  onChange: (draft: PhotoDraft | null) => void;
  requirement: EvidenceRequirement;
  disabled?: boolean;
  /** Network status from the parent's listener (reactive). */
  online?: boolean;
  /** Called while the photo is being compressed/resized (parent may gate the
   *  Finalizar button). */
  onProcessingChange?: (processing: boolean) => void;
};

type ActionPlanCandidateState = ActionPlanCandidate & {
  planId?: string;
  planError?: string;
  creating?: boolean;
};

function PhotoCapture({ value, onChange, requirement, disabled = false, online, onProcessingChange }: PhotoCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const offline = online !== undefined
    ? !online
    : (typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      const msg = 'Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).';
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
    onProcessingChange?.(true);
    try {
      const compressed = await compressInspectionImage(file);
      onChange({
        blob: compressed.blob,
        previewUrl: createPreviewUrl(compressed.blob),
        mimeType: compressed.mimeType,
        width: compressed.width,
        height: compressed.height,
        size: compressed.compressedSize,
      });
      showToast({
        kind: 'success',
        title: 'Foto pronta',
        description: `${compressed.width}×${compressed.height} · ${formatBytes(compressed.compressedSize)}`,
        duration: 2500,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : PHOTO_ERROR_MSG;
      setError(msg);
      showToast({ kind: 'error', title: 'Falha ao processar foto', description: msg });
    } finally {
      setLoading(false);
      onProcessingChange?.(false);
    }
  };

  const handleClear = () => {
    onChange(null);
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
            src={value.previewUrl}
            alt="Evidência fotográfica da inspeção"
            className="w-full h-48 sm:h-56 object-cover"
          />
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
            <CheckCircle2 className="w-3 h-3" />
            Foto pronta
          </div>
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold tabular-nums">
            {value.width}×{value.height} · {formatBytes(value.size)}
          </div>
        </div>

        {offline && (
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
            <WifiOff className="w-4 h-4 text-pending flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-pending flex-1 leading-snug">
              Foto salva no dispositivo. Será sincronizada quando houver conexão.
            </span>
          </div>
        )}

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
              Substituir foto
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={disabled}
              className="btn-ghost btn-sm btn-auto text-critical hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Remover foto
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
              Otimizando imagem...
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
            aria-label={`Tirar foto (${EVIDENCE_REQUIREMENT_CONFIG[requirement].label})`}
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
        JPG, PNG ou WEBP · até {formatBytes(PHOTO_MAX_BYTES)} · a foto é redimensionada automaticamente
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
  const { equipments, addInspection, addActionPlan, user } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('id');

  const [eqId, setEqId] = useState(preSelectedId || '');
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>({});
  const [deviationNotes, setDeviationNotes] = useState<Record<string, string>>({});
  const [touchedDeviationNotes, setTouchedDeviationNotes] = useState<Record<string, boolean>>({});
  const [inspectionResult, setInspectionResult] = useState<InspectionResult>('regular');
  const [validadeDate, setValidadeDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const [success, setSuccess] = useState(false);
  const [actionPlanStage, setActionPlanStage] = useState<'none' | 'offer' | 'review' | 'dismissed'>('none');
  const [actionPlanCandidates, setActionPlanCandidates] = useState<ActionPlanCandidateState[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [inspectorName, setInspectorName] = useState(() => localStorage.getItem('firecheck_last_inspector_name') || '');
  const [isSaving, setIsSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [draftPrompt, setDraftPrompt] = useState<{ draft: InspectionDraft | null; invalid: boolean } | null>(null);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);
  const draftSessionRef = useRef(new InspectionDraftSession());
  const actionPlanCreationLocksRef = useRef(new Set<string>());
  const [visitKey, setVisitKey] = useState(location.key);
  const draftDirtyRef = useRef(false);
  const draftCreatedAtRef = useRef<string | undefined>(undefined);
  const draftUpdatedAtRef = useRef<string | undefined>(undefined);
  const autosaveSequenceRef = useRef(0);

  // Idempotência de submissão: lock síncrono (imediato, sem depender do render)
  // + identidade estável da tentativa (submissionId → inspectionId). Retry da
  // mesma tentativa reutiliza os MESMOS IDs.
  const submitLockRef = useRef(false);
  const submissionIdRef = useRef<string | null>(null);
  const inspectionIdRef = useRef<string | null>(null);
  const completedInspectionDateRef = useRef('');

  const [online, setOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Object URL lifecycle: revogar assim que o preview é trocado/removido ou a
  // tela desmonta. O cleanup captura o URL da renderização anterior — nunca é
  // revogado um URL que o `<img>` ainda está usando (StrictMode não é afetado:
  // a URL só é criada em interação do usuário, após a montagem inicial).
  const photoPreviewUrl = photoDraft?.previewUrl;
  useEffect(() => {
    return () => {
      revokePreviewUrl(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const resetDraftPrompt = () => {
    setDraftPrompt(null);
    setConfirmDiscardDraft(false);
  };

  // A route transition is a new inspection visit even if the router keeps the
  // outlet mounted. This clears only in-memory resume decisions, never Dexie.
  if (visitKey !== location.key) {
    setVisitKey(location.key);
    setDraftPrompt(null);
    setConfirmDiscardDraft(false);
  }

  useEffect(() => {
    draftSessionRef.current.startVisit();
  }, [location.key]);

  const markDraftDirty = () => {
    draftDirtyRef.current = true;
    setDraftStatus('idle');
  };

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
      setChecklist({});
    }
    setDeviationNotes({});
    setTouchedDeviationNotes({});
    setInspectionResult('regular');
  }

  // Set a default expiration date on first render only.
  const [hasSetDefaultDate, setHasSetDefaultDate] = useState(false);
  if (!hasSetDefaultDate && !validadeDate) {
    setValidadeDate(getDefaultNextInspectionDate());
    setHasSetDefaultDate(true);
  }

  const checklistProgress = useMemo(
    () => getChecklistProgress(checklistItems, checklist),
    [checklistItems, checklist],
  );
  const checklistCounts = checklistProgress.counts;
  const evidenceRequirement = deriveEvidenceRequirement(checklist, inspectionResult);
  const evidenceRequirementConfig = EVIDENCE_REQUIREMENT_CONFIG[evidenceRequirement];
  const evidenceInstruction = getEvidenceInstruction(evidenceRequirement, checklistCounts.REPROVADO);
  const evidenceValidationMessage = getEvidenceValidationMessage(evidenceRequirement, Boolean(photoDraft));
  const inspectionDeviations = useMemo<InspectionDeviation[]>(
    () => getInspectionDeviations(checklistItems, checklist, deviationNotes),
    [checklistItems, checklist, deviationNotes],
  );
  const deviationValidationMessage = getDeviationValidationMessage(inspectionDeviations);

  const hasReprovado = checklistCounts.REPROVADO > 0;
  const hasAtencao = checklistCounts.ATENCAO > 0;
  const resultValidationMessage = validateInspectionResult(checklist, inspectionResult);
  const remainingMessage = getChecklistRemainingMessage(checklistProgress.remaining);
  const readiness = deriveInspectionReadiness({
    checklistComplete: isChecklistComplete(checklistProgress),
    checklistMessage: remainingMessage,
    deviationMessage: deviationValidationMessage,
    evidenceMessage: evidenceValidationMessage,
    inspectorName,
    resultMessage: resultValidationMessage,
    inspectionDate: validadeDate,
  });
  const blockingMessage = readiness.message;
  const canFinalize = readiness.ready && !isSaving && !photoProcessing;
  const resultPresentation = getInspectionResultPresentation(checklistProgress, inspectionResult);

  const saveCurrentDraft = async (force = false, photoOverride?: PhotoDraft | null): Promise<boolean> => {
    if (!user?.id || !selectedEquipment || (!force && !draftDirtyRef.current)) return true;
    const sequence = ++autosaveSequenceRef.current;
    setDraftStatus('saving');
    try {
      const currentTime = Date.now();
      const previousTime = draftUpdatedAtRef.current ? Date.parse(draftUpdatedAtRef.current) : 0;
      const now = new Date(Math.max(currentTime, previousTime + 1)).toISOString();
      const draft = createInspectionDraft({
        ownerUserId: user.id,
        equipmentId: selectedEquipment.id,
        checklist,
        deviationNotes,
        inspectionResult,
        inspectorName,
        nextInspectionDate: validadeDate,
        generalNotes: observacoes,
        photo: (photoOverride === undefined ? photoDraft : photoOverride) ? {
          blob: (photoOverride === undefined ? photoDraft : photoOverride)!.blob,
          mimeType: (photoOverride === undefined ? photoDraft : photoOverride)!.mimeType,
          width: (photoOverride === undefined ? photoDraft : photoOverride)!.width,
          height: (photoOverride === undefined ? photoDraft : photoOverride)!.height,
          sizeBytes: (photoOverride === undefined ? photoDraft : photoOverride)!.size,
        } : undefined,
        createdAt: draftCreatedAtRef.current,
        updatedAt: now,
      });
      await saveInspectionDraft(draft);
      if (sequence === autosaveSequenceRef.current) {
        draftCreatedAtRef.current = draft.createdAt;
        draftUpdatedAtRef.current = draft.updatedAt;
        draftDirtyRef.current = false;
        setDraftStatus('saved');
      }
      return true;
    } catch (error) {
      console.error('[inspection-draft] autosave failed', error instanceof Error ? error.message : 'unknown error');
      if (sequence === autosaveSequenceRef.current) setDraftStatus('error');
      return false;
    }
  };
  // Text and checklist edits are coalesced; the repository rejects stale writes.
  useEffect(() => {
    if (!draftDirtyRef.current || !user?.id || !selectedEquipment || success) return;
    const timer = window.setTimeout(() => { void saveCurrentDraft(); }, 450);
    return () => window.clearTimeout(timer);
    // saveCurrentDraft is intentionally the latest render's snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklist, deviationNotes, inspectionResult, inspectorName, validadeDate, observacoes, photoDraft, eqId, user?.id, selectedEquipment, success]);

  useEffect(() => {
    const equipmentId = selectedEquipment?.id;
    if (!user?.id || !equipmentId || success) return;
    const draftContextKey = getInspectionDraftKey(user.id, equipmentId);
    if (!draftSessionRef.current.shouldCheck(draftContextKey)) return;
    // Resolve once per equipment in this mounted session. Autosave may update
    // the database, but it must not turn the current form into a resume prompt.
    let active = true;
    void loadInspectionDraft(user.id, equipmentId).then((result) => {
      if (!active) return;
      if (draftDirtyRef.current) return;
      if (result.draft || result.invalid) setDraftPrompt(result);
    }).catch((error) => {
      console.error('[inspection-draft] load failed', error instanceof Error ? error.message : 'unknown error');
    });
    return () => { active = false; };
  }, [user?.id, selectedEquipment?.id, success, visitKey]);

  const handleChecklistChange = (item: string, value: ChecklistValue) => {
    markDraftDirty();
    const nextChecklist = { ...checklist, [item]: value };
    setChecklist(nextChecklist);
    if (value === 'OK' || value === 'N.A.') {
      setDeviationNotes((current) => {
        if (!(item in current)) return current;
        const next = { ...current };
        delete next[item];
        return next;
      });
      setTouchedDeviationNotes((current) => {
        if (!(item in current)) return current;
        const next = { ...current };
        delete next[item];
        return next;
      });
    }
    setInspectionResult(deriveInspectionStatus(nextChecklist, validadeDate));
  };

  const handleEquipmentChange = async (nextEquipmentId: string) => {
    const saved = await saveCurrentDraft();
    if (!saved) {
      setErrorMsg('Não foi possível salvar o rascunho antes de trocar de equipamento.');
      return;
    }
    if (user?.id && selectedEquipment) {
      // Leaving an equipment ends its active form session. Returning later in
      // this component must perform a fresh, explicit resume check.
      draftSessionRef.current.leave(getInspectionDraftKey(user.id, selectedEquipment.id));
    }
    setDraftPrompt(null);
    setConfirmDiscardDraft(false);
    setEqId(nextEquipmentId);
    setChecklist({});
    setDeviationNotes({});
    setTouchedDeviationNotes({});
    setInspectionResult('regular');
    setInspectorName('');
    setValidadeDate(getDefaultNextInspectionDate());
    setObservacoes('');
    setPhotoDraft(null);
    setDraftStatus('idle');
    draftDirtyRef.current = false;
    draftCreatedAtRef.current = undefined;
    draftUpdatedAtRef.current = undefined;
  };

  const continueDraft = () => {
    const draft = draftPrompt?.draft;
    if (!draft) return;
    setChecklist(draft.checklist);
    setDeviationNotes(draft.deviationNotes);
    setTouchedDeviationNotes({});
    setInspectionResult(validateInspectionResult(draft.checklist, draft.inspectionResult)
      ? deriveInspectionStatus(draft.checklist)
      : draft.inspectionResult);
    setInspectorName(draft.inspectorName);
    setValidadeDate(draft.nextInspectionDate);
    setObservacoes(draft.generalNotes);
    draftCreatedAtRef.current = draft.createdAt;
    draftUpdatedAtRef.current = draft.updatedAt;
    if (draft.photo) {
      try {
        setPhotoDraft({
          blob: draft.photo.blob,
          previewUrl: createPreviewUrl(draft.photo.blob),
          mimeType: draft.photo.mimeType,
          width: draft.photo.width,
          height: draft.photo.height,
          size: draft.photo.sizeBytes,
        });
      } catch {
        setPhotoDraft(null);
      }
    } else {
      setPhotoDraft(null);
    }
    draftDirtyRef.current = false;
    setDraftStatus('saved');
    resetDraftPrompt();
  };

  const discardDraft = async () => {
    if (!user?.id || !selectedEquipment) return;
    try {
      const key = getInspectionDraftKey(user.id, selectedEquipment.id);
      await (draftPrompt?.invalid ? deleteInspectionDraftByKey(key) : deleteInspectionDraft(user.id, selectedEquipment.id));
      setChecklist({});
      setDeviationNotes({});
      setTouchedDeviationNotes({});
      setInspectionResult('regular');
      setInspectorName('');
      setValidadeDate(getDefaultNextInspectionDate());
      setObservacoes('');
      setPhotoDraft(null);
      draftDirtyRef.current = false;
      draftCreatedAtRef.current = undefined;
      draftUpdatedAtRef.current = undefined;
      resetDraftPrompt();
    } catch (error) {
      console.error('[inspection-draft] discard failed', error instanceof Error ? error.message : 'unknown error');
      setErrorMsg('Não foi possível descartar o rascunho neste dispositivo.');
    }
  };

  const openActionPlanReview = () => setActionPlanStage('review');
  const dismissActionPlans = () => setActionPlanStage('dismissed');

  const updateActionPlanCandidate = (item: string, updates: Partial<ActionPlanCandidateState>) => {
    setActionPlanCandidates((current) => current.map((candidate) =>
      candidate.item === item ? { ...candidate, ...updates } : candidate,
    ));
  };

  const createDerivedActionPlan = async (candidate: ActionPlanCandidateState) => {
    if (!selectedEquipment || !inspectionIdRef.current || candidate.creating || candidate.planId || actionPlanCreationLocksRef.current.has(candidate.item)) return;
    actionPlanCreationLocksRef.current.add(candidate.item);
    updateActionPlanCandidate(candidate.item, { creating: true, planError: undefined });
    try {
      const result = await addActionPlan({
        equipmentId: selectedEquipment.id,
        local: `${selectedEquipment.local} (${selectedEquipment.setor})`,
        descricao: buildActionPlanDescription({
          inspectionId: inspectionIdRef.current,
          equipmentId: selectedEquipment.id,
          inspectionDate: completedInspectionDateRef.current || new Date().toISOString().split('T')[0],
          inspectionResult,
          deviation: candidate,
        }),
        criticidade: candidate.criticidade,
        responsavel: candidate.responsavel,
        prazo: candidate.prazo,
        status: 'Aberta',
      });
      if (result.ok) {
        updateActionPlanCandidate(candidate.item, { creating: false, planId: result.id });
      } else {
        updateActionPlanCandidate(candidate.item, { creating: false, planError: result.error ?? 'Não foi possível criar a ação no dispositivo.' });
      }
    } finally {
      actionPlanCreationLocksRef.current.delete(candidate.item);
    }
  };

  const handleFinalize = async (e: FormEvent) => {
    e.preventDefault();

    // LOCK SÍNCRONO — primeira camada de idempotência. Atribuição imediata,
    // sem depender do próximo render do React (defende double/triple click e
    // Enter repetido que atravessam a janela antes de `disabled`/`isSaving`).
    if (submitLockRef.current) {
      if (import.meta.env.DEV) console.log('[inspection-submit] duplicate submit ignored (lock síncrono)');
      return;
    }

    if (!selectedEquipment) {
      setErrorMsg('Por favor, selecione um equipamento.');
      return;
    }

    if (!readiness.ready) {
      setErrorMsg(readiness.message ?? 'Revise os dados obrigatórios para concluir.');
      return;
    }

    submitLockRef.current = true;

    // IDENTIDADE DA TENTATIVA — gerada UMA vez por tentativa. Retry da mesma
    // tentativa reutiliza submissionId/inspectionId (nunca um novo UUID).
    submissionIdRef.current ??= crypto.randomUUID();
    inspectionIdRef.current ??= `INSP-${submissionIdRef.current}`;
    const inspectionId = inspectionIdRef.current;

    if (import.meta.env.DEV) {
      console.log(`[inspection-submit] accepted ${submissionIdRef.current}`);
    }

    const finalStatus: EquipmentStatus = inspectionResult;
    const inspectionDate = new Date().toISOString().split('T')[0];

    setIsSaving(true);
    setErrorMsg('');

    try {
      localStorage.setItem('firecheck_last_inspector_name', inspectorName);
      const result = await addInspection(buildInspectionPayload({
        inspectionId,
        equipmentId: selectedEquipment.id,
        inspectionDate,
        inspectorName,
        status: finalStatus,
        notes: buildInspectionNotes(inspectionDeviations, observacoes),
        userId: user?.id,
        photo: photoDraft
          ? {
              blob: photoDraft.blob,
              mimeType: photoDraft.mimeType,
              width: photoDraft.width,
              height: photoDraft.height,
              size: photoDraft.size,
            }
          : undefined,
        nextInspectionDate: validadeDate || undefined,
      }));

      if (!result.ok) {
        setErrorMsg(result.error ?? 'Erro ao salvar inspeção. Tente novamente.');
        // B) erro antes de persistir → libera lock para nova tentativa da
        // MESMA tentativa (o inspectionId é mantido)
        submitLockRef.current = false;
        if (import.meta.env.DEV) console.log(`[inspection-submit] lock liberado (erro) ${submissionIdRef.current}`);
        return;
      }

      // addInspection reports success only after its local transaction commits.
      // The draft is therefore safe to remove even if remote sync is pending.
      if (user?.id && selectedEquipment) {
        await deleteInspectionDraft(user.id, selectedEquipment.id);
        draftDirtyRef.current = false;
        draftCreatedAtRef.current = undefined;
        draftUpdatedAtRef.current = undefined;
      }

      const candidates = inspectionDeviations
        .map(toActionPlanCandidate)
        .filter((candidate): candidate is ActionPlanCandidate => candidate !== null);
      setActionPlanCandidates(candidates);
      setActionPlanStage(candidates.length > 0 ? 'offer' : 'none');
      completedInspectionDateRef.current = inspectionDate;

      // C) sucesso → lock permanece fechado (mesmo formulário não aceita novo
      // submit). Apenas "Nova Inspeção" reseta lock + IDs.
      setSuccess(true);
      if (result.idempotent) {
        if (import.meta.env.DEV) console.log(`[inspection-submit] submit idempotente absorvido ${submissionIdRef.current}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar inspeção. Tente novamente.');
      submitLockRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewInspection = () => {
    // Reset TOTAL do estado de submissão: nova tentativa → novo submissionId,
    // novo inspectionId, lock reaberto. (Item 10/34/40 do plano de idempotência.)
    submitLockRef.current = false;
    submissionIdRef.current = null;
    inspectionIdRef.current = null;
    completedInspectionDateRef.current = '';

    setSuccess(false);
    setErrorMsg('');
    setIsSaving(false);
    setInspectionResult('regular');
    setDeviationNotes({});
    setTouchedDeviationNotes({});
    setObservacoes('');
    setPhotoDraft(null);
    setPhotoProcessing(false);
    setActionPlanStage('none');
    setActionPlanCandidates([]);
    draftDirtyRef.current = false;
    draftCreatedAtRef.current = undefined;
    draftUpdatedAtRef.current = undefined;
    setDraftStatus('idle');

    // Reset date to today + 30 days
    setValidadeDate(getDefaultNextInspectionDate());

    // A nova inspeção começa sem respostas para exigir avaliação explícita.
    setChecklist({});

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
        {selectedEquipment && draftStatus !== 'idle' && (
          <span className="text-[10px] sm:text-xs font-bold text-gray-500 whitespace-nowrap" role="status" aria-live="polite">
            {draftStatus === 'saving' ? 'Salvando rascunho...' : draftStatus === 'saved' ? 'Rascunho salvo' : 'Não foi possível salvar o rascunho neste dispositivo.'}
          </span>
        )}
      </header>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {draftPrompt && (
        <section className="card-subtle bg-white border-l-4 border-l-primary space-y-4" aria-labelledby="draft-card-title">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <History className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Inspeção em andamento</p>
              <h2 id="draft-card-title" className="text-lg font-black text-gray-900 mt-0.5">Retomar inspeção</h2>
              <p className="text-sm text-gray-600 mt-1">Existe uma inspeção não concluída deste equipamento salva neste dispositivo.</p>
            </div>
          </div>
          {draftPrompt.draft ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs sm:text-sm">
              <p><span className="block text-gray-500">Equipamento</span><strong>{selectedEquipment?.id}</strong></p>
              <p><span className="block text-gray-500">Progresso</span><strong>{getChecklistProgress(checklistItems, draftPrompt.draft.checklist).percentage}%</strong></p>
              <p><span className="block text-gray-500">Salvo em</span><strong>{new Date(draftPrompt.draft.updatedAt).toLocaleString('pt-BR')}</strong></p>
              <p><span className="block text-gray-500">Evidência</span><strong>{draftPrompt.draft.photo ? 'Foto disponível' : 'Nenhuma foto'}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-critical bg-red-50 rounded-lg p-3">Este rascunho não pôde ser recuperado.</p>
          )}
          {!confirmDiscardDraft ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" className="btn-primary btn-auto flex-1" onClick={continueDraft} disabled={!draftPrompt.draft}>Continuar inspeção</button>
              <button type="button" className="btn-ghost btn-auto flex-1 text-critical" onClick={() => setConfirmDiscardDraft(true)}>Descartar rascunho</button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-sm text-gray-700">Descartar este rascunho? Ele será removido apenas deste dispositivo. Nenhuma inspeção concluída será excluída.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" className="btn-ghost btn-auto flex-1" onClick={() => setConfirmDiscardDraft(false)}>Cancelar</button>
                <button type="button" className="btn-primary btn-auto flex-1" onClick={() => void discardDraft()}>Descartar</button>
              </div>
            </div>
          )}
        </section>
      )}

      {success ? (
        <div className="card-subtle bg-white py-10 px-6 flex flex-col items-center justify-center text-center gap-5 border-l-4 border-l-success">
          <div className="w-20 h-20 bg-green-50 text-success rounded-full flex items-center justify-center">
            <ShieldCheck className="w-12 h-12" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">Inspeção Registrada!</h3>
           <p className="text-xs text-gray-500 mt-1.5 font-bold uppercase tracking-wider">
             {online ? '✓ Salvo · Sincronizando' : '⏳ Salvo offline · Pendente sincronização'}
           </p>
          </div>
          {actionPlanStage === 'offer' && (
            <section className="w-full max-w-2xl card-subtle bg-white border-l-4 border-l-pending text-left space-y-4" aria-labelledby="action-plan-offer-title">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-amber-100 text-pending flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <div>
                  <h2 id="action-plan-offer-title" className="text-base font-black text-gray-900">Plano de ação</h2>
                  <p className="text-sm text-gray-600 mt-1">Esta inspeção registrou {actionPlanCandidates.length} {actionPlanCandidates.length === 1 ? 'desvio' : 'desvios'}. Deseja criar ações para tratar as condições identificadas?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <span className="rounded-lg bg-amber-50 text-pending px-3 py-2">Observações: {actionPlanCandidates.filter((candidate) => candidate.severity === 'warning').length}</span>
                <span className="rounded-lg bg-red-50 text-critical px-3 py-2">Não conformidades: {actionPlanCandidates.filter((candidate) => candidate.severity === 'nonconformity').length}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" className="btn-primary btn-auto flex-1" onClick={openActionPlanReview}>Criar planos de ação</button>
                <button type="button" className="btn-ghost btn-auto flex-1" onClick={dismissActionPlans}>Agora não</button>
              </div>
            </section>
          )}
          {actionPlanStage === 'review' && (
            <section className="w-full max-w-3xl card-subtle bg-gray-50 border border-gray-200 text-left space-y-4" aria-labelledby="action-plan-review-title">
              <div>
                <h2 id="action-plan-review-title" className="text-base font-black text-gray-900">Revisar planos de ação</h2>
                <p className="text-sm text-gray-600 mt-1">Confirme cada ação individualmente. Nenhum plano é criado automaticamente.</p>
              </div>
              <div className="space-y-3">
                {actionPlanCandidates.map((candidate) => {
                  const created = Boolean(candidate.planId);
                  return (
                    <article key={candidate.item} className="rounded-xl bg-white border border-gray-200 p-4 space-y-3" aria-labelledby={`action-plan-${candidate.item}`}>
                      <div className="flex items-start gap-2">
                        {candidate.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-pending mt-0.5 flex-shrink-0" aria-hidden="true" /> : <XCircle className="w-4 h-4 text-critical mt-0.5 flex-shrink-0" aria-hidden="true" />}
                        <div className="min-w-0">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${candidate.severity === 'warning' ? 'text-pending' : 'text-critical'}`}>
                            {candidate.severity === 'warning' ? 'Observação' : 'Não conforme'}
                          </span>
                          <h3 id={`action-plan-${candidate.item}`} className="text-sm font-black text-gray-900">{candidate.item}</h3>
                          <p className="text-xs text-gray-600 mt-1">{candidate.description}</p>
                        </div>
                      </div>
                      {created ? (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 text-success px-3 py-2 text-xs font-bold" role="status">
                          <CheckCircle2 className="w-4 h-4" /> Plano criado{candidate.planId ? ` · ${candidate.planId}` : ''}
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="field-label">Criticidade</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                              {ACTION_PLAN_CRITICIDADE_OPTIONS.map((option) => (
                                <button key={option} type="button" aria-pressed={candidate.criticidade === option} onClick={() => updateActionPlanCandidate(candidate.item, { criticidade: option })} className={`rounded-lg border px-2 py-2 text-[10px] font-black ${candidate.criticidade === option ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-500'}`}>
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label htmlFor={`action-responsavel-${candidate.item}`} className="field-label">Responsável</label>
                              <input id={`action-responsavel-${candidate.item}`} value={candidate.responsavel} onChange={(event) => updateActionPlanCandidate(candidate.item, { responsavel: event.target.value })} className="field-input" placeholder="Nome do responsável" />
                            </div>
                            <div>
                              <label htmlFor={`action-prazo-${candidate.item}`} className="field-label">Prazo</label>
                              <input id={`action-prazo-${candidate.item}`} type="date" value={candidate.prazo} onChange={(event) => updateActionPlanCandidate(candidate.item, { prazo: event.target.value })} className="field-input" />
                            </div>
                          </div>
                          {candidate.planError && <p className="text-xs font-semibold text-critical" role="alert">{candidate.planError}</p>}
                          <button type="button" className="btn-primary btn-auto w-full" disabled={candidate.creating} onClick={() => void createDerivedActionPlan(candidate)}>
                            {candidate.creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando ação...</> : 'Criar ação'}
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
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
      ) : draftPrompt ? null : (
        <form onSubmit={handleFinalize} className="space-y-4 sm:space-y-6">
          {/* Equipment selector — only when not pre-selected and nothing picked yet */}
          {!preSelectedId && !selectedEquipment && (
            <div className="card-subtle bg-white space-y-3">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Equipamento</span>
              <div className="relative">
                <select
                  id="eqSelector"
                  value={eqId}
                   onChange={(e) => void handleEquipmentChange(e.target.value)}
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
                <div>
                  <span className="label-uppercase block mb-1">Situação atual</span>
                  <span className="font-mono text-xs sm:text-sm font-extrabold text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded tracking-tight">
                    {selectedEquipment.id}
                  </span>
                </div>
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
            <InspectionChecklist
                items={checklistItems}
                values={checklist}
                progress={checklistProgress}
              onChange={handleChecklistChange}
            />
          )}

          {/* Date, photo and observations — only when equipment is selected */}
          {selectedEquipment && (
            <>
              {inspectionDeviations.length > 0 && (
                <section className="card-subtle bg-white space-y-4" aria-labelledby="deviations-title">
                  <div className="flex items-start gap-2.5 border-b border-gray-50 pb-3">
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-pending flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </span>
                    <div>
                      <h2 id="deviations-title" className="label-uppercase">Registro de desvios</h2>
                      <p className="text-[10px] text-gray-500 mt-0.5">Descreva cada item que exige atenção ou correção.</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {inspectionDeviations.map((deviation, index) => {
                      const isNonconformity = deviation.severity === 'nonconformity';
                      const descriptionId = `deviation-description-${index}`;
                      const helpId = `${descriptionId}-help`;
                      const errorId = `${descriptionId}-error`;
                      const isTouched = touchedDeviationNotes[deviation.item] === true;
                      const descriptionMessage = getDeviationDescriptionMessage(deviation.description, isTouched);
                      const validationError = isTouched ? descriptionMessage : null;
                      return (
                        <div
                          key={deviation.item}
                          className={`rounded-xl border p-3 sm:p-4 space-y-2.5 ${isNonconformity ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}
                        >
                          <div className="flex items-start gap-2">
                            {isNonconformity ? <XCircle className="w-4 h-4 mt-0.5 text-critical flex-shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-pending flex-shrink-0" aria-hidden="true" />}
                            <div className="min-w-0">
                              <span className={`block text-[10px] font-black uppercase tracking-wider ${isNonconformity ? 'text-critical' : 'text-pending'}`}>
                                {isNonconformity ? 'Não conforme' : 'Observação'}
                              </span>
                              <h3 className="text-sm font-bold text-gray-800 leading-snug">{deviation.item}</h3>
                            </div>
                          </div>
                          <label htmlFor={descriptionId} className="sr-only">Descrição do desvio: {deviation.item}</label>
                          <textarea
                            id={descriptionId}
                            value={deviation.description}
                            onChange={(e) => {
                               markDraftDirty();
                               setDeviationNotes((current) => ({ ...current, [deviation.item]: e.target.value }));
                              setTouchedDeviationNotes((current) => ({ ...current, [deviation.item]: true }));
                            }}
                            onBlur={() => setTouchedDeviationNotes((current) => ({ ...current, [deviation.item]: true }))}
                            placeholder={isNonconformity ? 'Descreva a não conformidade identificada e a providência recomendada.' : 'Descreva a condição observada e, se aplicável, a recomendação técnica.'}
                            rows={3}
                            className={`field-textarea ${validationError ? 'border-critical focus:border-critical focus:ring-critical/20' : ''}`}
                            aria-describedby={descriptionMessage ? validationError ? `${errorId} ${helpId}` : helpId : undefined}
                            aria-invalid={Boolean(validationError)}
                          />
                          {descriptionMessage && (
                            <p id={helpId} className={`text-[10px] ${validationError ? 'text-critical font-semibold' : 'text-gray-500'}`}>
                              {descriptionMessage}
                            </p>
                          )}
                          {validationError && (
                            <p id={errorId} className="text-xs font-semibold text-critical" role="alert">{validationError}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <fieldset className="card-subtle bg-white space-y-3" aria-describedby="inspection-result-help">
                <legend className="field-label flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Resultado da inspeção
                </legend>
                <p id="inspection-result-help" className="text-xs text-gray-500">
                  {resultPresentation.state === 'waiting'
                    ? 'Avalie o checklist técnico para determinar o resultado.'
                    : resultPresentation.state === 'partial'
                      ? 'Resultado parcial/provisório, atualizado conforme as respostas.'
                      : 'Resultado final definido com base no checklist técnico.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {INSPECTION_RESULT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = resultPresentation.state !== 'waiting' && inspectionResult === option.value;
                    const disabled = resultPresentation.state === 'waiting'
                      || (hasReprovado ? option.value !== 'vencido' : hasAtencao && option.value === 'regular');
                    return (
                      <label
                        key={option.value}
                        className={`flex items-start gap-2 min-h-16 rounded-lg border p-3 transition-colors ${
                          isSelected ? option.selectedClass : 'border-gray-200 bg-white text-gray-600'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}
                      >
                        <input
                          type="radio"
                          name="inspection-result"
                          value={option.value}
                          checked={isSelected}
                          disabled={disabled}
                           onChange={() => { markDraftDirty(); setInspectionResult(option.value); }}
                          className="sr-only"
                        />
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-bold">{option.label}</span>
                          <span className="block text-[10px] leading-snug mt-0.5 opacity-80">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {/* Inspector */}
              <div className="card-subtle bg-white space-y-2">
                <label htmlFor="inspectorName" className="field-label flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  Inspetor Responsável *
                </label>
                <select
                  id="inspectorName"
                  required
                  value={inspectorName}
                   onChange={(e) => { markDraftDirty(); setInspectorName(e.target.value); }}
                  className={`field-input appearance-none ${!inspectorName ? 'text-gray-400' : ''}`}
                >
                  <option value="" disabled>Selecione o inspetor responsável</option>
                  {INSPECTOR_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.nome}>{opt.nome}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="card-subtle bg-white space-y-2">
                <label htmlFor="validadeDate" className="field-label flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Próxima inspeção *
                </label>
                <div className="relative">
                  <input
                    id="validadeDate"
                    type="date"
                    required
                    value={validadeDate}
                     onChange={(e) => { markDraftDirty(); setValidadeDate(e.target.value); }}
                    className="field-input pr-10"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 pointer-events-none">
                    <Calendar className="w-5 h-5" />
                  </span>
                </div>
                <p className="text-[10px] text-gray-500">Data prevista para a próxima verificação.</p>
              </div>

               {/* Photo */}
               <div className="card-subtle bg-white space-y-2">
                 <div className="flex items-start justify-between gap-3">
                   <div>
                     <span className="field-label flex items-center gap-1.5">
                       <Camera className="w-4 h-4" />
                       Evidência Visual
                     </span>
                     <p className="text-[10px] text-gray-500 mt-0.5">{evidenceInstruction}</p>
                   {evidenceRequirement === 'required' && checklistProgress.remaining > 0 && (
                     <p className="text-[10px] font-semibold text-critical mt-0.5">Evidência será obrigatória para esta inspeção.</p>
                   )}
                   </div>
                   <span className={`pill text-[10px] flex-shrink-0 ${evidenceRequirementConfig.badgeClass}`}>
                     {evidenceRequirementConfig.label}
                   </span>
                 </div>
                 <PhotoCapture
                   value={photoDraft}
                    onChange={(photo) => { markDraftDirty(); setPhotoDraft(photo); void saveCurrentDraft(false, photo); }}
                   requirement={evidenceRequirement}
                   disabled={isSaving}
                   online={online}
                   onProcessingChange={setPhotoProcessing}
                />
              </div>

              {/* General observations — separate from the required deviation records */}
              <div className="card-subtle bg-white space-y-3">
                <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </span>
                  <div>
                    <h2 className="label-uppercase">Observações Gerais</h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">Informações adicionais sobre a inspeção.</p>
                  </div>
                </div>
                <textarea
                  value={observacoes}
                   onChange={(e) => { markDraftDirty(); setObservacoes(e.target.value); }}
                  placeholder="Informações adicionais sobre a inspeção..."
                  rows={4}
                  className="field-textarea"
                />
              </div>

              <section className="card-subtle bg-gray-50 border border-gray-200 space-y-3" aria-labelledby="inspection-summary-title">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="inspection-summary-title" className="label-uppercase">Resumo da inspeção</h2>
                  <span className={`pill text-[10px] ${canFinalize ? 'bg-green-100 text-success' : checklistProgress.remaining > 0 ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-pending'}`}>
                    {canFinalize ? 'Pronta para concluir' : checklistProgress.remaining > 0 ? 'Inspeção incompleta' : 'Pendente'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-xs">
                  <div><span className="block text-gray-500">Checklist</span><strong className="block mt-0.5">{checklistProgress.answered}/{checklistProgress.total} avaliados</strong></div>
                  <div><span className="block text-gray-500">Conforme</span><strong className="block mt-0.5 text-success">{checklistCounts.OK}</strong></div>
                  <div><span className="block text-gray-500">Observação</span><strong className="block mt-0.5 text-pending">{checklistCounts.ATENCAO}</strong></div>
                  <div><span className="block text-gray-500">Não conforme</span><strong className="block mt-0.5 text-critical">{checklistCounts.REPROVADO}</strong></div>
                  <div><span className="block text-gray-500">N.A.</span><strong className="block mt-0.5 text-gray-600">{checklistCounts['N.A.']}</strong></div>
                  <div><span className="block text-gray-500">Resultado</span><strong className="block mt-0.5">{resultPresentation.label}</strong></div>
                  <div><span className="block text-gray-500">Próxima inspeção</span><strong className="block mt-0.5">{formatInspectionDate(validadeDate)}</strong></div>
                  <div>
                    <span className="block text-gray-500">Evidência</span>
                    <strong className={`block mt-0.5 ${photoDraft ? 'text-success' : evidenceRequirement === 'required' ? 'text-critical' : ''}`}>
                      {photoDraft ? 'Adicionada' : evidenceRequirement === 'required' ? 'Pendente · Obrigatória' : evidenceRequirement === 'recommended' ? 'Não adicionada · Recomendada' : 'Não adicionada · Opcional'}
                    </strong>
                  </div>
                  <div><span className="block text-gray-500">Desvios</span><strong className="block mt-0.5">{inspectionDeviations.length}</strong></div>
                  {inspectionDeviations.length > 0 && (
                    <>
                      <div><span className="block text-gray-500">Observações</span><strong className="block mt-0.5 text-pending">{checklistCounts.ATENCAO}</strong></div>
                      <div><span className="block text-gray-500">Não conformidades</span><strong className="block mt-0.5 text-critical">{checklistCounts.REPROVADO}</strong></div>
                    </>
                  )}
                </div>
                {blockingMessage && (
                  <p className="text-xs font-semibold text-gray-600" role="status">{blockingMessage}</p>
                )}
              </section>
            </>
          )}

          {/* Sticky submit */}
          {selectedEquipment && (
            <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
              <button type="submit" className="btn-primary disabled:bg-gray-400 disabled:text-gray-100" disabled={!canFinalize}>
                {isSaving ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Salvando inspeção...</>
                ) : photoProcessing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Preparando foto...</>
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
