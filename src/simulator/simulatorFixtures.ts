import type { EquipmentStatus } from '../types';

export interface SimulatorEquipment {
  id: string;
  tipo: string;
  modelo: string;
  local: string;
  status: EquipmentStatus;
  descricao: string;
}

export const SIMULATOR_EQUIPMENT_FIXTURES: readonly SimulatorEquipment[] = [
  {
    id: 'EXT-SIM-001',
    tipo: 'Extintor',
    modelo: 'ABC 6 kg',
    local: 'Área de treinamento',
    status: 'regular',
    descricao: 'Equipamento fictício para treinamento de inspeção regular.',
  },
  {
    id: 'EXT-SIM-002',
    tipo: 'Extintor',
    modelo: 'CO2 6 kg',
    local: 'Laboratório simulado',
    status: 'observacao',
    descricao: 'Cenário didático com item em observação.',
  },
  {
    id: 'EXT-SIM-003',
    tipo: 'Extintor',
    modelo: 'ABC 12 kg',
    local: 'Almoxarifado simulado',
    status: 'vencido',
    descricao: 'Cenário didático de não conformidade.',
  },
  {
    id: 'EXT-SIM-004',
    tipo: 'Extintor',
    modelo: 'Pó químico',
    local: 'Oficina simulada',
    status: 'vencido',
    descricao: 'Cenário didático de equipamento vencido.',
  },
  {
    id: 'HID-SIM-001',
    tipo: 'Hidrante',
    modelo: 'Abrigo simples',
    local: 'Corredor de treinamento',
    status: 'regular',
    descricao: 'Equipamento fictício para treinamento de hidrantes.',
  },
  {
    id: 'EXT-SIM-005',
    tipo: 'Extintor',
    modelo: 'ABC 6 kg',
    local: 'Sala técnica simulada',
    status: 'regular',
    descricao: 'Equipamento regular com prazo próximo para treinamento.',
  },
  {
    id: 'EXT-SIM-006',
    tipo: 'Extintor',
    modelo: 'ABC 6 kg',
    local: 'Depósito simulado',
    status: 'regular',
    descricao: 'Equipamento regular com prazo vencido para treinamento.',
  },
];
