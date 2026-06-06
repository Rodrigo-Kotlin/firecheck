import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store';
import { db } from '../../db';
import { ChevronLeft, ShieldCheck, Camera, Trash2, Calendar, Scan } from 'lucide-react';
import type { EquipmentStatus } from '../../types';

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

export default function Inspecionar() {
  const { equipments, addInspection, user } = useAppStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedId = searchParams.get('id');

  const [eqId, setEqId] = useState(preSelectedId || '');
  const [checklist, setChecklist] = useState<Record<string, 'OK' | 'REPROVADO' | 'N.A.'>>({});
  const [validadeDate, setValidadeDate] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
      const initial: Record<string, 'OK' | 'REPROVADO' | 'N.A.'> = {};
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

  // Image handling and canvas compression
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        // Resize proportional scaling
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setPhotoBase64(compressedBase64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) {
      setErrorMsg('Por favor, selecione um equipamento.');
      return;
    }

    // Determine status logic
    let finalStatus: EquipmentStatus = 'regular';
    const hasReprovado = Object.values(checklist).some((val) => val === 'REPROVADO');

    if (hasReprovado) {
      finalStatus = 'vencido';
    } else {
      // Check document date warning
      if (validadeDate) {
        const today = new Date();
        const expDate = new Date(validadeDate);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          finalStatus = 'vencido'; // inspection vencida
        } else if (diffDays <= 30) {
          finalStatus = 'observacao';
        }
      }
    }

    const inspectionId = `INSP-${Date.now()}`;
    const inspectionData = {
      id: inspectionId,
      equipmentId: selectedEquipment.id,
      data: new Date().toISOString().split('T')[0],
      inspetor: user?.nome || 'Rodrigo Silva',
      status: finalStatus,
      observacoes,
      sincronizado: false
    };

    try {
      // 1. Save locally to Dexie IndexedDB
      await db.inspecoes.add(inspectionData);
      
      // Update equipment mirror locally
      await db.equipamentos.put({
        ...selectedEquipment,
        status: finalStatus,
        dataProximaInspecao: validadeDate,
        sincronizado: false,
      });

      if (photoBase64) {
        await db.fotos.add({
          id: inspectionId,
          inspectionId: inspectionId,
          base64: photoBase64
        });
      }

      // 2. Update Zustand store (reactive state)
      addInspection({
        equipmentId: selectedEquipment.id,
        data: inspectionData.data,
        inspetor: inspectionData.inspetor,
        status: finalStatus,
        observacoes: observacoes
      });

      setSuccess(true);
      setErrorMsg('');

      // Trigger background sync with Supabase (no-op if offline/unconfigured)
      void useAppStore.getState().triggerSync();

      setTimeout(() => {
        setSuccess(false);
        navigate('/');
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar no banco offline.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="page-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center text-gray-600 hover:text-gray-900 bg-gray-50 rounded-lg p-2 min-h-0 min-w-0"
          aria-label="Fechar"
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
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm font-bold text-critical">
          {errorMsg}
        </div>
      )}

      {success ? (
        <div className="card-subtle bg-white py-12 flex flex-col items-center justify-center text-center gap-4 border-l-4 border-l-success animate-pulse">
          <div className="w-16 h-16 bg-green-50 text-success rounded-full flex items-center justify-center">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Inspeção Registrada!</h3>
            <p className="text-xs text-gray-500 mt-1 font-bold uppercase tracking-wider">
              Salvo no IndexedDB {navigator.onLine ? '· Sincronizando...' : '· Pendente Online'}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleFinalize} className="space-y-4 sm:space-y-6 pb-24">

          {/* Layout: equipment card on top, then 2-col grid (checklist + side panel) on lg */}
          <div className="card-subtle bg-white space-y-4">
            <span className="label-uppercase block border-b border-gray-50 pb-1">Equipamento Avaliado</span>

            {!preSelectedId ? (
              <div className="relative">
                <select
                  id="eqSelector"
                  value={eqId}
                  onChange={(e) => setEqId(e.target.value)}
                  className="field-input pr-10"
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
            ) : null}

            {selectedEquipment && (
              <div className="bg-gray-50 p-4 rounded-xl space-y-1.5 border border-gray-100">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-black text-gray-900 truncate">{selectedEquipment.id}</span>
                  <span className="pill bg-gray-200 text-gray-600 flex-shrink-0">{selectedEquipment.status}</span>
                </div>
                <div className="text-sm font-bold text-gray-700">{selectedEquipment.tipo} · {selectedEquipment.subtipo || 'Modelo N/A'}</div>
                <div className="text-xs text-gray-500 font-semibold">{selectedEquipment.local} ({selectedEquipment.setor})</div>
              </div>
            )}
          </div>

          {selectedEquipment && checklistItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Checklist — 2 columns on lg */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="label-uppercase">Checklist Técnico</span>
                  <span className="pill bg-gray-100 text-gray-500">{checklistItems.length} itens</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {checklistItems.map((item) => {
                    const val = checklist[item];
                    return (
                      <div key={item} className="card-subtle bg-white flex flex-col gap-2.5">
                        <span className="text-sm font-bold text-gray-800 leading-snug">{item}</span>

                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setChecklist(prev => ({ ...prev, [item]: 'OK' }))}
                            className={`h-11 border-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                              val === 'OK'
                                ? 'bg-green-50 border-success text-success'
                                : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'
                            }`}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklist(prev => ({ ...prev, [item]: 'REPROVADO' }))}
                            className={`h-11 border-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                              val === 'REPROVADO'
                                ? 'bg-red-50 border-critical text-critical'
                                : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'
                            }`}
                          >
                            Falha
                          </button>
                          <button
                            type="button"
                            onClick={() => setChecklist(prev => ({ ...prev, [item]: 'N.A.' }))}
                            className={`h-11 border-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                              val === 'N.A.'
                                ? 'bg-gray-100 border-gray-400 text-gray-500'
                                : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'
                            }`}
                          >
                            N.A.
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side panel — date, photo, observations */}
              <div className="space-y-3">
                <span className="label-uppercase block">Detalhes</span>

                <div className="card-subtle bg-white">
                  <label className="field-label">
                    Data de Validade *
                  </label>
                  <div className="relative">
                    <input
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

                <div className="card-subtle bg-white space-y-3">
                  <span className="label-uppercase block">Evidência Visual</span>

                  {!photoBase64 ? (
                    <label className="border-2 border-dashed border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all min-h-[120px]">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Tirar Foto / Anexar</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">JPG ou PNG</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-gray-100">
                      <img src={photoBase64} alt="Preview do Equipamento" className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoBase64(null)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-lg p-2 hover:bg-red-700 transition-colors shadow min-h-0 min-w-0"
                        aria-label="Remover foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="card-subtle bg-white">
                  <label className="field-label">Observações</label>
                  <textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Descreva qualquer anomalia ou detalhe técnico relevante..."
                    rows={5}
                    className="field-textarea"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedEquipment && (
            <div className="sticky bottom-20 lg:bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-neutralBg lg:bg-transparent lg:px-0 lg:py-0 lg:mx-0">
              <button
                type="submit"
                className="btn-primary"
              >
                <ShieldCheck className="w-5 h-5" />
                Finalizar e Salvar Inspeção
              </button>
            </div>
          )}

        </form>
      )}
    </div>
  );
}
