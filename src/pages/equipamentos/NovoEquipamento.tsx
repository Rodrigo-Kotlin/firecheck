import { useState, type ReactNode } from 'react';
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
  Save,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import QrCodePrintCard from '../../components/QrCodePrintCard';
import type { Equipment } from '../../types';

const EQUIP_TYPES = [
  'Extintor', 'Hidrante', 'Mangueira', 'Abrigo de mangueira', 'Esguicho',
  'Chave storz', 'Acionador manual', 'Alarme', 'Central de alarme',
  'Iluminação de emergência', 'Sinalização', 'Sprinkler', 'Bomba',
  'Porta corta-fogo', 'Detector de fumaça', 'Detector de calor'
];

const CARGA_TYPES = [
  'N/A', 'Água Pressurizada', 'CO2', 'PQS', 'Espuma', 'Classe K'
];

const schema = z.object({
  id: z.string().min(3, { message: 'Código deve conter no mínimo 3 caracteres' }).toUpperCase(),
  tipo: z.string().min(1, { message: 'Selecione o tipo do equipamento' }),
  subtipo: z.string().optional(),
  local: z.string().min(3, { message: 'Localização é obrigatória' }),
  setor: z.string().min(3, { message: 'Setor é obrigatório' }),
  pavimento: z.string().optional(),
  fabricante: z.string().optional(),
  numSerie: z.string().optional(),
  capacidade: z.string().optional(),
  tipoCarga: z.string().optional(),
  dataFabricacao: z.string().optional(),
  dataUltimaManutencao: z.string().optional(),
  dataProximaManutencao: z.string().optional(),
  dataProximaInspecao: z.string().optional(),
  qrcode: z.string().optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

/* ----- Local form primitives -----
   FormSection: card with a tinted icon + section title.
   FormField: label (with required indicator) + control slot + error/hint. */

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

export default function NovoEquipamento() {
  const navigate = useNavigate();
  const { addEquipment, equipments } = useAppStore();
  const [createdEquipment, setCreatedEquipment] = useState<Equipment | null>(null);
  const [duplicateError, setDuplicateError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoCarga: 'N/A',
      tipo: ''
    }
  });

  const onSubmit = (data: FormData) => {
    const isDuplicate = equipments.some((e) => e.id.toUpperCase() === data.id.toUpperCase());
    if (isDuplicate) {
      setDuplicateError('Este código de equipamento já está cadastrado.');
      return;
    }
    setDuplicateError('');

    const newEquipment: Equipment = {
      id: data.id,
      tipo: data.tipo,
      subtipo: data.subtipo || '',
      local: data.local,
      setor: data.setor,
      status: 'regular',
      pavimento: data.pavimento,
      fabricante: data.fabricante,
      numSerie: data.numSerie,
      capacidade: data.capacidade,
      tipoCarga: data.tipoCarga,
      dataFabricacao: data.dataFabricacao,
      dataUltimaManutencao: data.dataUltimaManutencao,
      dataProximaManutencao: data.dataProximaManutencao,
      dataProximaInspecao: data.dataProximaInspecao,
      qrcode: data.qrcode,
      observacoes: data.observacoes
    };

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Seção 1: Identificação */}
            <FormSection title="Identificação" icon={Tag}>
              <FormField label="Código / ID" required error={errors.id?.message} htmlFor="id">
                <input
                  id="id"
                  type="text"
                  {...register('id')}
                  placeholder="Ex: EXT-110"
                  className={`field-input ${errors.id ? 'border-critical' : ''}`}
                />
              </FormField>

              <FormField label="Tipo" required error={errors.tipo?.message} htmlFor="tipo">
                <select
                  id="tipo"
                  {...register('tipo')}
                  className={`field-input ${errors.tipo ? 'border-critical' : ''}`}
                >
                  <option value="">Selecione o tipo...</option>
                  {EQUIP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Subtipo / Modelo" htmlFor="subtipo">
                <input
                  id="subtipo"
                  type="text"
                  {...register('subtipo')}
                  placeholder="Ex: PQS 6kg"
                  className="field-input"
                />
              </FormField>
            </FormSection>

            {/* Seção 2: Localização */}
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

            {/* Seção 3: Dados técnicos */}
            <FormSection title="Dados Técnicos" icon={Wrench}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Fabricante" htmlFor="fabricante">
                  <input
                    id="fabricante"
                    type="text"
                    {...register('fabricante')}
                    placeholder="Ex: Resil"
                    className="field-input"
                  />
                </FormField>

                <FormField label="Nº Série" htmlFor="numSerie">
                  <input
                    id="numSerie"
                    type="text"
                    {...register('numSerie')}
                    placeholder="Ex: 987654"
                    className="field-input"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Capacidade" htmlFor="capacidade">
                  <input
                    id="capacidade"
                    type="text"
                    {...register('capacidade')}
                    placeholder="Ex: 6kg / 20m"
                    className="field-input"
                  />
                </FormField>

                <FormField label="Tipo de Carga" htmlFor="tipoCarga">
                  <select id="tipoCarga" {...register('tipoCarga')} className="field-input">
                    {CARGA_TYPES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            {/* Seção 4: Cronograma */}
            <FormSection title="Cronograma" icon={Calendar}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Fabricação" htmlFor="dataFabricacao">
                  <input id="dataFabricacao" type="date" {...register('dataFabricacao')} className="field-input" />
                </FormField>
                <FormField label="Última Manutenção" htmlFor="dataUltimaManutencao">
                  <input id="dataUltimaManutencao" type="date" {...register('dataUltimaManutencao')} className="field-input" />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Próxima Manutenção" htmlFor="dataProximaManutencao">
                  <input id="dataProximaManutencao" type="date" {...register('dataProximaManutencao')} className="field-input" />
                </FormField>
                <FormField label="Próxima Inspeção" htmlFor="dataProximaInspecao">
                  <input id="dataProximaInspecao" type="date" {...register('dataProximaInspecao')} className="field-input" />
                </FormField>
              </div>
            </FormSection>
          </div>

          {/* Seção 5: Outros — full width */}
          <FormSection title="Outros" icon={FileText}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FormField label="QR Code Vinculado" htmlFor="qrcode">
                <input
                  id="qrcode"
                  type="text"
                  {...register('qrcode')}
                  placeholder="Código QR escaneado"
                  className="field-input"
                />
              </FormField>

              <div>
                <label htmlFor="foto" className="field-label">Foto do Equipamento</label>
                <div
                  id="foto"
                  className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 text-xs text-gray-400 font-bold uppercase tracking-wider h-[44px] lg:h-[48px] flex items-center justify-center"
                >
                  Upload de Imagem (em breve)
                </div>
              </div>
            </div>

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

          {/* Submit button — sticky on mobile */}
          <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
            <button
              type="submit"
              className="btn-primary"
            >
              <Save className="w-5 h-5" />
              Salvar Equipamento
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
