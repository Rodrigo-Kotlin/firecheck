import type { Equipment, Inspector, Stats, Inspection } from '../types';

export const equipamentos: Equipment[] = [
  { id: "EXT-001", tipo: "Extintor", subtipo: "PQS 6kg", local: "Bloco A, Piso 1", setor: "Administrativo", status: "regular" },
  { id: "HID-042", tipo: "Hidrante", subtipo: "Parede", local: "Garagem, Nível -1", setor: "Estacionamento", status: "pendente" },
  { id: "EXT-109", tipo: "Extintor", subtipo: "CO2 4kg", local: "CPD, Sala Técnica", setor: "TI", status: "vencido" },
  { id: "ALM-005", tipo: "Acionador", subtipo: "Manual", local: "Bloco B, Recepção", setor: "Comercial", status: "regular" },
  { id: "ILU-018", tipo: "Iluminação", subtipo: "Emergência", local: "Escada 2", setor: "Circulação", status: "observacao" }
];

export const inspetores: Inspector[] = [
  { id: "1", nome: "Ricardo Silva", cargo: "Inspetor Líder" },
  { id: "2", nome: "Ana Paula", cargo: "Inspetora Plena" },
  { id: "3", nome: "Marcos Rocha", cargo: "Inspetor Técnico" }
];

export const estatisticas: Stats = {
  total: 150,
  emDia: 132,
  pendentes: 12,
  vencidos: 6,
  conformidade: 88
};

export const inspecoes: Inspection[] = [
  {
    id: "INSP-001",
    equipmentId: "EXT-001",
    data: "2026-06-01",
    inspetor: "Ricardo Silva",
    status: "regular",
    observacoes: "Manômetro na faixa verde, lacre intacto."
  },
  {
    id: "INSP-002",
    equipmentId: "ILU-018",
    data: "2026-06-03",
    inspetor: "Ana Paula",
    status: "observacao",
    observacoes: "Autonomia de bateria ligeiramente abaixo do esperado, agendar troca preventiva."
  }
];
