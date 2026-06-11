import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  FileText,
  MapPin,
  RefreshCw,
  Save,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import QrCodePrintCard from '../../components/QrCodePrintCard';
import {
  EQUIP_TYPES,
  EQUIP_STATUS,
  STATUS_LABEL,
  FIELD_CONFIGS,
  type FieldConfig,
  type FieldSection,
} from '../../constants/equipmentFormConfig';
import type { Equipment, EquipmentStatus } from '../../types';
import { generateNextTag, isValidTagForType, TAG_PREFIXES } from '../../utils/tagGenerator';

const schema = z.object({
  id: z.string().min(3, { message: 'Código deve conter no mínimo 3 caracteres' }).toUpperCase(),
  tipo: z.string().min(1, { message: 'Selecione o tipo do equipamento' }),
  status: z.string().min(1, { message: 'Selecione o status' }),
  local: z.string().min(3, { message: 'Localização é obrigatória' }),
  setor: z.string().min(3, { message: 'Setor é obrigatório' }),
  pavimento: z.string().optional(),
  fabricante: z.string().optional(),
  numSerie: z.string().optional(),
  dataProximaInspecao: z.string().optional(),
  dataUltimaInspecao: z.string().optional(),
  qrcode: z.string().optional(),
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

/* ----- Local form primitives ----- */

type FormSectionProps = {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
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
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
};

function FormField({ label, required, error, hint, htmlFor, children }: FormFieldProps) {
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
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

/* ----- Render a single field based on config ----- */

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

/* ----- Page component ----- */

export default function NovoEquipamento() {
  const navigate = useNavigate();
  const { addEquipment, equipments } = useAppStore();
  const [createdEquipment, setCreatedEquipment] = useState<Equipment | null>(null);
  const [duplicateError, setDuplicateError] = useState('');
  const [tagEditadaManualmente, setTagEditadaManualmente] = useState(false);
  const [tagAviso, setTagAviso] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'regular',
      tipo: ''
    }
  });

  const tipoSelecionado = watch('tipo');
  const idAtual = watch('id');

  const existingIds = useMemo(() => equipments.map((e) => e.id), [equipments]);

  const gerarTag = useCallback((tipo: string) => {
    if (!tipo || !TAG_PREFIXES[tipo]) return;
    const tag = generateNextTag(tipo, existingIds);
    setValue('id', tag);
    setTagEditadaManualmente(false);
    setTagAviso('');
  }, [existingIds, setValue]);

  useEffect(() => {
    if (tipoSelecionado && !tagEditadaManualmente) {
      gerarTag(tipoSelecionado);
    }
  }, [tipoSelecionado, tagEditadaManualmente, gerarTag]);

  useEffect(() => {
    if (!tipoSelecionado || !idAtual || !tagEditadaManualmente) {
      setTagAviso('');
      return;
    }
    if (!isValidTagForType(idAtual, tipoSelecionado)) {
      const prefix = TAG_PREFIXES[tipoSelecionado];
      setTagAviso(prefix
        ? `Padrão esperado: ${prefix}-001. A TAG livre será reaproveitada.`
        : ''
      );
    } else {
      setTagAviso('');
    }
  }, [idAtual, tipoSelecionado, tagEditadaManualmente]);

  const fieldsPorSecao = useMemo(() => {
    if (!tipoSelecionado) return null as Record<string, FieldConfig[]> | null;
    const secoes: FieldSection[] = ['identificacao', 'localizacao', 'dadosTecnicos', 'inspecaoManutencao'];
    const map: Record<string, FieldConfig[]> = { identificacao: [], localizacao: [], dadosTecnicos: [], inspecaoManutencao: [] };
    for (const sec of secoes) {
      map[sec] = FIELD_CONFIGS.filter((f) => f.section === sec && f.tipos.includes(tipoSelecionado));
    }
    return map;
  }, [tipoSelecionado]);

  const COMMON_FORM_FIELDS = new Set([
    'id', 'tipo', 'status', 'local', 'setor', 'pavimento', 'fabricante', 'numSerie',
    'capacidade', 'tipoCarga',
    'dataFabricacao', 'dataUltimaManutencao', 'dataProximaManutencao',
    'dataProximaInspecao', 'dataUltimaInspecao',
    'dataUltimoTeste', 'dataProximoTeste', 'dataTesteHidrostatico', 'dataValidadeTeste',
    'qrcode', 'observacoes',
  ]);

  const onSubmit = (data: FormData) => {
    const isDuplicate = equipments.some((e) => e.id.toUpperCase() === data.id.toUpperCase());
    if (isDuplicate) {
      setDuplicateError('Este código de equipamento já está cadastrado.');
      return;
    }
    setDuplicateError('');

    const qrCode = data.qrcode || data.id;

    const newEquipment: Equipment = {
      id: data.id,
      tipo: data.tipo,
      local: data.local,
      setor: data.setor,
      status: data.status as EquipmentStatus,
      pavimento: data.pavimento,
      fabricante: data.fabricante,
      numSerie: data.numSerie,
      capacidade: data.capacidade,
      tipoCarga: data.tipoCarga,
      dataFabricacao: data.dataFabricacao,
      dataUltimaManutencao: data.dataUltimaManutencao,
      dataProximaManutencao: data.dataProximaManutencao,
      dataProximaInspecao: data.dataProximaInspecao,
      dataUltimaInspecao: data.dataUltimaInspecao,
      dataUltimoTeste: data.dataUltimoTeste,
      dataProximoTeste: data.dataProximoTeste,
      dataTesteHidrostatico: data.dataTesteHidrostatico,
      dataValidadeTeste: data.dataValidadeTeste,
      qrcode: qrCode,
      qrCode,
      observacoes: data.observacoes,
      dadosTecnicos: {},
    };

    const dataRecord = data as unknown as Record<string, unknown>;
    for (const key of Object.keys(dataRecord)) {
      if (!COMMON_FORM_FIELDS.has(key)) {
        const val = dataRecord[key];
        if (val !== undefined && val !== '') {
          newEquipment.dadosTecnicos![key] = val as string;
        }
      }
    }

    addEquipment(newEquipment);
    setCreatedEquipment(newEquipment);
  };

  const handleCloseSuccess = () => {
    setCreatedEquipment(null);
    navigate('/equipamentos');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-24">
      <header className="page-header">
        <button
          onClick={() => navigate('/equipamentos')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          type="button"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Equipamentos</div>
          <h1 className="text-base sm:text-lg lg:text-xl font-black text-gray-900 uppercase tracking-wide truncate">
            Novo Equipamento
          </h1>
        </div>
      </header>

      {createdEquipment ? (
        <QrCodePrintCard equipment={createdEquipment} onClose={handleCloseSuccess} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          {duplicateError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {duplicateError}
            </div>
          )}

          {/* Tipo de Equipamento — always visible, always first */}
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

          {!tipoSelecionado && (
            <div className="card-subtle bg-gray-50 border border-dashed border-gray-200 text-center py-10 px-4">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="w-7 h-7 text-primary" />
              </div>
              <p className="text-sm font-bold text-gray-700 mb-1">
                Selecione o tipo de equipamento
              </p>
              <p className="text-xs text-gray-500">
                Escolha acima para carregar os campos específicos do equipamento.
              </p>
            </div>
          )}

          {tipoSelecionado && fieldsPorSecao && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Identificação */}
                <FormSection title="Identificação" icon={Tag}>
                  <div>
                    <label htmlFor="id" className="field-label flex items-baseline gap-1">
                      <span>TAG / Código</span>
                      <span className="text-critical text-xs font-black" aria-label="obrigatório">*</span>
                    </label>

                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          id="id"
                          type="text"
                          {...register('id', {
                            onChange: () => setTagEditadaManualmente(true),
                          })}
                          placeholder="Gerado automaticamente"
                          className={`field-input font-mono tracking-wider pr-10 ${errors.id ? 'border-critical' : ''}`}
                          autoComplete="off"
                          autoCapitalize="characters"
                        />
                        {!tagEditadaManualmente && idAtual && (
                          <span
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-success flex items-center"
                            title="TAG gerada automaticamente"
                          >
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {tipoSelecionado && TAG_PREFIXES[tipoSelecionado] && (
                        <button
                          type="button"
                          onClick={() => gerarTag(tipoSelecionado)}
                          className="flex-shrink-0 w-10 h-11 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors min-h-0 min-w-0"
                          title="Regerar TAG automaticamente"
                          aria-label="Regerar TAG"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {errors.id?.message && (
                      <span className="field-error flex items-center gap-1 mt-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{errors.id.message}</span>
                      </span>
                    )}

                    {tagAviso && !errors.id?.message && (
                      <span className="text-[11px] text-pending font-medium flex items-center gap-1 mt-1.5">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {tagAviso}
                      </span>
                    )}

                    {!tagEditadaManualmente && idAtual && !errors.id?.message && (
                      <span className="field-hint flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-success" />
                        TAG gerada automaticamente · próxima disponível
                      </span>
                    )}
                  </div>

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

                {/* Localização */}
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

                {/* Dados Técnicos */}
                {fieldsPorSecao.dadosTecnicos.length > 0 && (
                  <FormSection title="Dados Técnicos" icon={Wrench}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {fieldsPorSecao.dadosTecnicos.map((f) => (
                        <FieldRenderer key={f.name} field={f} register={register} errors={errors} />
                      ))}
                    </div>
                  </FormSection>
                )}

                {/* Inspeção / Manutenção */}
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

              {/* Datas de inspeção — common for all types */}
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

                {/* Outros / Observações */}
                <FormSection title="Outros" icon={FileText}>
                  <FormField label="QR Code Vinculado" htmlFor="qrcode">
                    <input
                      id="qrcode"
                      type="text"
                      {...register('qrcode')}
                      placeholder="Código QR escaneado"
                      className="field-input"
                    />
                  </FormField>
                </FormSection>
              </div>

              {/* Observações — full width */}
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

          {/* Submit button — sticky on mobile */}
          {tipoSelecionado && (
            <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
              <button type="submit" className="btn-primary">
                <Save className="w-5 h-5" />
                Salvar Equipamento
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
