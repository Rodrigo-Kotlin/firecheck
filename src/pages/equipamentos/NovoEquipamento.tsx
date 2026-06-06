import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store';
import { ChevronLeft, Save } from 'lucide-react';
import { useState } from 'react';
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
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical">
              {duplicateError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Seção 1: Identificação */}
            <div className="card-subtle bg-white space-y-4">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Identificação</span>

              <div>
                <label className="field-label">Código / ID *</label>
                <input
                  type="text"
                  {...register('id')}
                  placeholder="Ex: EXT-110"
                  className={`field-input ${errors.id ? 'border-critical focus:ring-1 focus:ring-critical' : ''}`}
                />
                {errors.id && <span className="field-error">{errors.id.message}</span>}
              </div>

              <div>
                <label className="field-label">Tipo *</label>
                <select
                  {...register('tipo')}
                  className={`field-input ${errors.tipo ? 'border-critical' : ''}`}
                >
                  <option value="">Selecione o tipo...</option>
                  {EQUIP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {errors.tipo && <span className="field-error">{errors.tipo.message}</span>}
              </div>

              <div>
                <label className="field-label">Subtipo / Modelo</label>
                <input
                  type="text"
                  {...register('subtipo')}
                  placeholder="Ex: PQS 6kg"
                  className="field-input"
                />
              </div>
            </div>

            {/* Seção 2: Localização */}
            <div className="card-subtle bg-white space-y-4">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Localização</span>

              <div>
                <label className="field-label">Localização Física *</label>
                <input
                  type="text"
                  {...register('local')}
                  placeholder="Ex: Bloco B, Corredor Leste"
                  className={`field-input ${errors.local ? 'border-critical' : ''}`}
                />
                {errors.local && <span className="field-error">{errors.local.message}</span>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Setor *</label>
                  <input
                    type="text"
                    {...register('setor')}
                    placeholder="Ex: TI"
                    className={`field-input ${errors.setor ? 'border-critical' : ''}`}
                  />
                  {errors.setor && <span className="field-error">{errors.setor.message}</span>}
                </div>

                <div>
                  <label className="field-label">Pavimento</label>
                  <input
                    type="text"
                    {...register('pavimento')}
                    placeholder="Ex: Piso 2"
                    className="field-input"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Dados técnicos */}
            <div className="card-subtle bg-white space-y-4">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Dados Técnicos</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Fabricante</label>
                  <input
                    type="text"
                    {...register('fabricante')}
                    placeholder="Ex: Resil"
                    className="field-input"
                  />
                </div>

                <div>
                  <label className="field-label">Nº Série</label>
                  <input
                    type="text"
                    {...register('numSerie')}
                    placeholder="Ex: 987654"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Capacidade</label>
                  <input
                    type="text"
                    {...register('capacidade')}
                    placeholder="Ex: 6kg / 20m"
                    className="field-input"
                  />
                </div>

                <div>
                  <label className="field-label">Tipo de Carga</label>
                  <select {...register('tipoCarga')} className="field-input">
                    {CARGA_TYPES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Seção 4: Datas */}
            <div className="card-subtle bg-white space-y-4">
              <span className="label-uppercase block border-b border-gray-50 pb-1">Cronograma</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Fabricação</label>
                  <input type="date" {...register('dataFabricacao')} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Última Manutenção</label>
                  <input type="date" {...register('dataUltimaManutencao')} className="field-input" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Próxima Manutenção</label>
                  <input type="date" {...register('dataProximaManutencao')} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Próxima Inspeção</label>
                  <input type="date" {...register('dataProximaInspecao')} className="field-input" />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 5: Outros — full width */}
          <div className="card-subtle bg-white space-y-4">
            <span className="label-uppercase block border-b border-gray-50 pb-1">Outros</span>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="field-label">QR Code Vinculado</label>
                <input
                  type="text"
                  {...register('qrcode')}
                  placeholder="Código QR escaneado"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Foto do Equipamento</label>
                <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 text-xs text-gray-400 font-bold uppercase tracking-wider h-[44px] lg:h-[48px] flex items-center justify-center">
                  Upload de Imagem (em breve)
                </div>
              </div>
            </div>

            <div>
              <label className="field-label">Observações</label>
              <textarea
                {...register('observacoes')}
                placeholder="Adicione observações gerais sobre o estado técnico do equipamento..."
                rows={4}
                className="field-textarea"
              />
            </div>
          </div>

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
