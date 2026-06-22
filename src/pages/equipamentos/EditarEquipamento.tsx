import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { showToast } from '../../hooks/useToasts';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  FileText,
  MapPin,
  Save,
  Tag,
  Wrench,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import {
  EQUIP_TYPES,
  EQUIP_STATUS,
  STATUS_LABEL,
  FIELD_CONFIGS,
  type FieldConfig,
} from '../../constants/equipmentFormConfig';
import type { EquipmentStatus } from '../../types';

const schema = z.object({
  tipo: z.string().min(1, { message: 'Selecione o tipo do equipamento' }),
  status: z.string().min(1, { message: 'Selecione o status' }),
  local: z.string().min(3, { message: 'Localização é obrigatória' }),
  setor: z.string().min(3, { message: 'Setor é obrigatório' }),
  pavimento: z.string().optional(),
  fabricante: z.string().optional(),
  numSerie: z.string().optional(),
  dataProximaInspecao: z.string().optional(),
  dataUltimaInspecao: z.string().optional(),
  observacoes: z.string().optional(),
  modeloExtintor: z.string().optional(),
  capacidade: z.string().optional(),
  classeFogo: z.string().optional(),
  tipoCarga: z.string().optional(),
  seloLacre: z.string().optional(),
  manometro: z.string().optional(),
  suporte: z.string().optional(),
  sinalizacao: z.string().optional(),
  acessoDesobstruido: z.string().optional(),
  estadoGeral: z.string().optional(),
  tipoHidrante: z.string().optional(),
  tipoAbrigoVinculado: z.string().optional(),
  registro: z.string().optional(),
  valvula: z.string().optional(),
  adaptador: z.string().optional(),
  tampao: z.string().optional(),
  pressao: z.string().optional(),
  tipoMangueira: z.string().optional(),
  diametro: z.string().optional(),
  comprimento: z.string().optional(),
  tipoUniao: z.string().optional(),
  estadoMangueira: z.string().optional(),
  acondicionamento: z.string().optional(),
  possuiEtiquetaInspecao: z.string().optional(),
  tipoAbrigo: z.string().optional(),
  material: z.string().optional(),
  estadoPorta: z.string().optional(),
  estadoVisor: z.string().optional(),
  possuiMangueira: z.string().optional(),
  possuiEsguicho: z.string().optional(),
  possuiChaveStorz: z.string().optional(),
  possuiRegistro: z.string().optional(),
  tipoEsguicho: z.string().optional(),
  estadoRoscas: z.string().optional(),
  estadoVedacao: z.string().optional(),
  compatibilidadeMangueira: z.string().optional(),
  localAcondicionamento: z.string().optional(),
  tipoChaveStorz: z.string().optional(),
  diametroCompativel: z.string().optional(),
  estadoFisico: z.string().optional(),
  tipoAcionador: z.string().optional(),
  enderecoZona: z.string().optional(),
  estadoTampa: z.string().optional(),
  estadoBotao: z.string().optional(),
  alturaInstalacao: z.string().optional(),
  funcionamentoTestado: z.string().optional(),
  tipoAlarme: z.string().optional(),
  sireneAudiovisual: z.string().optional(),
  sireneSonora: z.string().optional(),
  sinalizadorVisual: z.string().optional(),
  zonaLaco: z.string().optional(),
  fonteAlimentacao: z.string().optional(),
  tipoCentral: z.string().optional(),
  quantidadeLacosZonas: z.string().optional(),
  bateriaBackup: z.string().optional(),
  comunicacaoDispositivos: z.string().optional(),
  statusPainel: z.string().optional(),
  localInstalacao: z.string().optional(),
  modeloIluminacao: z.string().optional(),
  funcaoIluminacao: z.string().optional(),
  autonomia: z.string().optional(),
  tipoInstalacao: z.string().optional(),
  potencia: z.string().optional(),
  tipoSinalizacao: z.string().optional(),
  codigoPlaca: z.string().optional(),
  fotoluminescente: z.string().optional(),
  visibilidade: z.string().optional(),
  estadoConservacao: z.string().optional(),
  fixacaoAdequada: z.string().optional(),
  tipoSprinkler: z.string().optional(),
  temperaturaAcionamento: z.string().optional(),
  posicaoInstalacao: z.string().optional(),
  estadoBulbo: z.string().optional(),
  obstrucao: z.string().optional(),
  corrosao: z.string().optional(),
  vazamento: z.string().optional(),
  areaProtegida: z.string().optional(),
  tipoBomba: z.string().optional(),
  vazao: z.string().optional(),
  alimentacaoEletrica: z.string().optional(),
  painelComando: z.string().optional(),
  bombaJockey: z.string().optional(),
  bombaPrincipal: z.string().optional(),
  bombaReserva: z.string().optional(),
  tipoPorta: z.string().optional(),
  tempoResistenciaFogo: z.string().optional(),
  barraAntipanico: z.string().optional(),
  dobradicas: z.string().optional(),
  molaAerea: z.string().optional(),
  fechamentoAutomatico: z.string().optional(),
  vedacao: z.string().optional(),
  tipoDetectorFumaca: z.string().optional(),
  tipoDetectorCalor: z.string().optional(),
  nomeModelo: z.string().optional(),
  descricaoTecnica: z.string().optional(),
  dataFabricacao: z.string().optional(),
  dataUltimaManutencao: z.string().optional(),
  dataProximaManutencao: z.string().optional(),
  dataUltimoTeste: z.string().optional(),
  dataProximoTeste: z.string().optional(),
  dataTesteHidrostatico: z.string().optional(),
  dataValidadeTeste: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type FormSectionProps = {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
};

function FormSection({ title, icon: Icon, children }: FormSectionProps) {
  return (
    <div className="card-subtle bg-white">
      <div className="flex items-center gap-2.5 border-b border-gray-50 pb-3 mb-5">
        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <h2 className="label-uppercase">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
};

function FormField({ label, required, error, htmlFor, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label flex items-baseline gap-1">
        <span>{label}</span>
        {required && (
          <span className="text-critical text-xs font-black" aria-label="obrigatório">*</span>
        )}
      </label>
      {children}
      {error ? (
        <span className="field-error flex items-center gap-1 mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </span>
      ) : null}
    </div>
  );
}

type FieldRendererProps = {
  field: FieldConfig;
  register: ReturnType<typeof useForm<FormData>>['register'];
  errors: Record<string, { message?: string }>;
};

function FieldRenderer({ field, register, errors }: FieldRendererProps) {
  const error = errors[field.name]?.message;

  if (field.type === 'select' && field.options) {
    return (
      <FormField key={field.name} label={field.label} error={error} htmlFor={field.name}>
        <select id={field.name} {...register(field.name as keyof FormData)} className={`field-input ${error ? 'border-critical' : ''}`}>
          <option value="">Selecione...</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </FormField>
    );
  }

  if (field.type === 'date') {
    return (
      <FormField key={field.name} label={field.label} error={error} htmlFor={field.name}>
        <input id={field.name} type="date" {...register(field.name as keyof FormData)} className={`field-input ${error ? 'border-critical' : ''}`} />
      </FormField>
    );
  }

  return (
    <FormField key={field.name} label={field.label} error={error} htmlFor={field.name}>
      <input
        id={field.name}
        type="text"
        {...register(field.name as keyof FormData)}
        placeholder={field.placeholder}
        className={`field-input ${error ? 'border-critical' : ''}`}
      />
    </FormField>
  );
}

const COMMON_FORM_FIELDS = new Set([
  'tipo', 'status', 'local', 'setor', 'pavimento', 'fabricante', 'numSerie',
  'capacidade', 'tipoCarga',
  'dataFabricacao', 'dataUltimaManutencao', 'dataProximaManutencao',
  'dataProximaInspecao', 'dataUltimaInspecao',
  'dataUltimoTeste', 'dataProximoTeste', 'dataTesteHidrostatico', 'dataValidadeTeste',
  'observacoes',
]);

export default function EditarEquipamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { equipments, updateEquipment } = useAppStore();

  const equipment = equipments.find((e) => e.id === id && !e.pendingDelete && !e.deletedAt);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const defaultValues = useMemo(() => {
    if (!equipment) return {};
    const vals: Record<string, string> = {};
    for (const key of Object.keys(schema.shape)) {
      const val = (equipment as unknown as Record<string, unknown>)[key];
      if (val !== undefined && val !== null) {
        vals[key] = String(val);
      }
    }
    return vals;
  }, [equipment]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const tipoSelecionado = watch('tipo');

  const fieldsPorSecao = useMemo(() => {
    if (!tipoSelecionado) return null as Record<string, FieldConfig[]> | null;
    const secoes = ['identificacao', 'localizacao', 'dadosTecnicos', 'inspecaoManutencao'] as const;
    const map: Record<string, FieldConfig[]> = { identificacao: [], localizacao: [], dadosTecnicos: [], inspecaoManutencao: [] };
    for (const sec of secoes) {
      map[sec] = FIELD_CONFIGS.filter((f) => f.section === sec && f.tipos.includes(tipoSelecionado));
    }
    return map;
  }, [tipoSelecionado]);

  if (!equipment) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="w-14 h-14 bg-red-50 text-critical rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800">Equipamento não encontrado</h3>
        <p className="text-sm text-gray-500">O item solicitado não existe no inventário atual.</p>
        <button onClick={() => navigate('/equipamentos')} className="btn-primary max-w-xs mx-auto">
          Voltar para Lista
        </button>
      </div>
    );
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setErrorMsg('');

    const updates: Record<string, unknown> = {
      tipo: data.tipo,
      status: data.status as EquipmentStatus,
      local: data.local,
      setor: data.setor,
      pavimento: data.pavimento || undefined,
      fabricante: data.fabricante || undefined,
      numSerie: data.numSerie || undefined,
      capacidade: data.capacidade || undefined,
      tipoCarga: data.tipoCarga || undefined,
      dataFabricacao: data.dataFabricacao || undefined,
      dataUltimaManutencao: data.dataUltimaManutencao || undefined,
      dataProximaManutencao: data.dataProximaManutencao || undefined,
      dataProximaInspecao: data.dataProximaInspecao || undefined,
      dataUltimaInspecao: data.dataUltimaInspecao || undefined,
      dataUltimoTeste: data.dataUltimoTeste || undefined,
      dataProximoTeste: data.dataProximoTeste || undefined,
      dataTesteHidrostatico: data.dataTesteHidrostatico || undefined,
      dataValidadeTeste: data.dataValidadeTeste || undefined,
      observacoes: data.observacoes || undefined,
    };

    const dataRecord = data as unknown as Record<string, unknown>;
    const dadosTecnicos: Record<string, unknown> = {};
    for (const key of Object.keys(dataRecord)) {
      if (!COMMON_FORM_FIELDS.has(key)) {
        const val = dataRecord[key];
        if (val !== undefined && val !== '') {
          dadosTecnicos[key] = val;
        }
      }
    }
    if (Object.keys(dadosTecnicos).length > 0) {
      updates.dadosTecnicos = dadosTecnicos;
    }

    const result = await updateEquipment(equipment.id, updates);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMsg(result.message || 'Não foi possível salvar as alterações. Tente novamente.');
      return;
    }

    showToast({
      kind: 'success',
      title: result.mode === 'cloud' ? 'Alteração salva e enviada para sincronização.' : 'Alterações salvas localmente.',
    });
    navigate(`/equipamentos/${encodeURIComponent(equipment.id)}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <button
          onClick={() => navigate(`/equipamentos/${encodeURIComponent(equipment.id)}`)}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamentos</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Editar Equipamento
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* TAG — read-only banner */}
        <div className="card-subtle bg-amber-50 border border-amber-200 border-l-[4px] border-l-amber-400">
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-amber-700 uppercase tracking-wider">
                TAG: <span className="font-mono text-sm">{equipment.id}</span>
              </div>
              <p className="text-[11px] text-amber-600 font-medium mt-1 leading-relaxed">
                A TAG não pode ser alterada nesta versão para preservar QR Code, histórico e rastreabilidade.
              </p>
            </div>
          </div>
        </div>

        {/* Tipo de Equipamento */}
        <div className="card-subtle bg-white">
          <FormField label="Tipo de Equipamento" required error={errors.tipo?.message} htmlFor="tipo">
            <select
              id="tipo"
              {...register('tipo')}
              className={`field-input text-base ${errors.tipo ? 'border-critical' : ''}`}
            >
              <option value="">Selecione o tipo...</option>
              {EQUIP_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </FormField>
        </div>

        {tipoSelecionado && fieldsPorSecao && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <FormSection title="Identificação" icon={Tag}>
                <FormField label="Status" required error={errors.status?.message} htmlFor="status">
                  <select id="status" {...register('status')} className={`field-input ${errors.status ? 'border-critical' : ''}`}>
                    {EQUIP_STATUS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </FormField>

                {fieldsPorSecao.identificacao.map((f) => (
                  <FieldRenderer key={f.name} field={f} register={register} errors={errors} />
                ))}
              </FormSection>

              <FormSection title="Localização" icon={MapPin}>
                <FormField label="Localização Física" required error={errors.local?.message} htmlFor="local">
                  <input
                    id="local"
                    type="text"
                    {...register('local')}
                    placeholder="Ex: Bloco B, Corredor Leste"
                    className={`field-input ${errors.local ? 'border-critical' : ''}`}
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Setor" required error={errors.setor?.message} htmlFor="setor">
                    <input
                      id="setor"
                      type="text"
                      {...register('setor')}
                      placeholder="Ex: TI"
                      className={`field-input ${errors.setor ? 'border-critical' : ''}`}
                    />
                  </FormField>

                  <FormField label="Pavimento" htmlFor="pavimento">
                    <input
                      id="pavimento"
                      type="text"
                      {...register('pavimento')}
                      placeholder="Ex: Piso 2"
                      className="field-input"
                    />
                  </FormField>
                </div>
              </FormSection>

              {fieldsPorSecao.dadosTecnicos.length > 0 && (
                <FormSection title="Dados Técnicos" icon={Wrench}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fieldsPorSecao.dadosTecnicos.map((f) => (
                      <FieldRenderer key={f.name} field={f} register={register} errors={errors} />
                    ))}
                  </div>
                </FormSection>
              )}

              {fieldsPorSecao.inspecaoManutencao.length > 0 && (
                <FormSection title="Inspeção / Manutenção" icon={Calendar}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fieldsPorSecao.inspecaoManutencao.map((f) => (
                      <FieldRenderer key={f.name} field={f} register={register} errors={errors} />
                    ))}
                  </div>
                </FormSection>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <FormSection title="Inspeção / Manutenção" icon={Calendar}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Data da Última Inspeção" htmlFor="dataUltimaInspecao">
                    <input id="dataUltimaInspecao" type="date" {...register('dataUltimaInspecao')} className="field-input" />
                  </FormField>
                  <FormField label="Data da Próxima Inspeção" htmlFor="dataProximaInspecao">
                    <input id="dataProximaInspecao" type="date" {...register('dataProximaInspecao')} className="field-input" />
                  </FormField>
                </div>
              </FormSection>

              <FormSection title="QR Code" icon={Tag}>
                <FormField label="QR Code Vinculado">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <ShieldAlert className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-mono font-bold text-gray-500">
                      {equipment.id}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      Vinculado à TAG
                    </span>
                  </div>
                </FormField>
              </FormSection>
            </div>

            <FormSection title="Observações" icon={FileText}>
              <FormField label="Observações" htmlFor="observacoes">
                <textarea
                  id="observacoes"
                  {...register('observacoes')}
                  placeholder="Adicione observações gerais sobre o estado técnico do equipamento..."
                  rows={4}
                  className="field-textarea"
                />
              </FormField>
            </FormSection>
          </>
        )}

        {/* Submit — sticky */}
        <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0 flex gap-3">
          <button
            type="button"
            onClick={() => navigate(`/equipamentos/${encodeURIComponent(equipment.id)}`)}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
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


