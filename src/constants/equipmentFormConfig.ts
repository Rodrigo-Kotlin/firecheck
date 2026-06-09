export const EQUIP_TYPES = [
  'Extintor',
  'Hidrante',
  'Mangueira',
  'Abrigo de mangueira',
  'Esguicho',
  'Chave storz',
  'Acionador manual',
  'Alarme',
  'Central de alarme',
  'Iluminação de emergência',
  'Sinalização',
  'Sprinkler',
  'Bomba',
  'Porta corta-fogo',
  'Detector de fumaça',
  'Detector de calor',
  'Outro',
] as const;

export const EQUIP_STATUS = [
  'regular',
  'pendente',
  'vencido',
  'observacao',
  'em_manutencao',
  'inativo',
  'substituido',
  'extraviado',
] as const;

export const STATUS_LABEL: Record<string, string> = {
  regular: 'Conforme',
  pendente: 'Pendente',
  vencido: 'Vencido',
  observacao: 'Com observação',
  em_manutencao: 'Em manutenção',
  inativo: 'Inativo',
  substituido: 'Substituído',
  extraviado: 'Extraviado',
};

// ---------------------------------------------------------------------------
// Option lists for select fields
// ---------------------------------------------------------------------------

export const EXTINTOR_MODELOS = [
  'AMPOLA - CO₂ OU N₂',
  'AP',
  'API',
  'CLASSE D',
  'CLASSE K',
  'CO₂',
  'ESPUMA MECÂNICA',
  'ESPUMA MECÂNICA INDIRETA',
  'FE36',
  'LÍTIO AB',
  'PQS ABC',
  'PQS BC',
  'PQSI ABC',
  'PQSI BC',
  'OUTRO',
] as const;

export const CAPACIDADES_EXTINTOR = [
  '1 kg',
  '2 kg',
  '4 kg',
  '6 kg',
  '8 kg',
  '12 kg',
  '20 kg',
  '25 kg',
  '50 kg',
  '6 L',
  '9 L',
  '10 L',
  '75 L',
  '150 L',
  'OUTRO',
] as const;

export const CLASSES_FOGO = [
  'A',
  'B',
  'C',
  'D',
  'K',
  'A / B',
  'B / C',
  'A / B / C',
  'OUTRO',
] as const;

export const TIPOS_HIDRANTE = [
  'Hidrante de parede',
  'Hidrante de recalque',
  'Hidrante urbano',
  'Hidrante de coluna',
  'Hidrante industrial',
  'Hidrante interno',
  'Hidrante externo',
  'OUTRO',
] as const;

export const TIPOS_MANGUEIRA = [
  'Tipo 1',
  'Tipo 2',
  'Tipo 3',
  'Tipo 4',
  'Tipo 5',
  'OUTRO',
] as const;

export const DIAMETROS = [
  '1.1/2"',
  '2.1/2"',
  'OUTRO',
] as const;

export const COMPRIMENTOS_MANGUEIRA = [
  '15 m',
  '20 m',
  '30 m',
  'OUTRO',
] as const;

export const TIPOS_ABRIGO = [
  'Abrigo de sobrepor',
  'Abrigo de embutir',
  'Abrigo externo',
  'Abrigo metálico',
  'Abrigo em alvenaria',
  'OUTRO',
] as const;

export const TIPOS_ESGUICHO = [
  'Esguicho regulável',
  'Esguicho jato sólido',
  'Esguicho neblina',
  'Esguicho universal',
  'OUTRO',
] as const;

export const TIPOS_CHAVE_STORZ = [
  'Chave storz simples',
  'Chave storz dupla',
  'Chave storz universal',
  'OUTRO',
] as const;

export const TIPOS_ACIONADOR = [
  'Acionador manual convencional',
  'Acionador manual endereçável',
  'Acionador manual quebra-vidro',
  'Acionador manual rearmável',
  'OUTRO',
] as const;

export const TIPOS_ALARME = [
  'Alarme sonoro',
  'Alarme audiovisual',
  'Alarme convencional',
  'Alarme endereçável',
  'OUTRO',
] as const;

export const TIPOS_CENTRAL = [
  'Central convencional',
  'Central endereçável',
  'Central monitorada',
  'Central de alarme de incêndio',
  'OUTRO',
] as const;

export const MODELOS_ILUMINACAO = [
  'BLOCO AUTÔNOMO',
  'BLOCO AUTÔNOMO COM FARÓIS',
  'BLOCO AUTÔNOMO LED',
  'BLOCO AUTÔNOMO DUPLO FAROL',
  'LUMINÁRIA DE EMERGÊNCIA',
  'LUMINÁRIA DE ACLARAMENTO',
  'LUMINÁRIA DE BALIZAMENTO',
  'LUMINÁRIA DE SINALIZAÇÃO',
  'PLACA DE SAÍDA ILUMINADA',
  'PLACA DE ROTA DE FUGA ILUMINADA',
  'SISTEMA CENTRALIZADO COM BATERIA',
  'SISTEMA CENTRALIZADO COM GRUPO MOTOGERADOR',
  'PROJETOR DE EMERGÊNCIA',
  'FAROL DE EMERGÊNCIA',
  'OUTRO',
] as const;

export const FUNCOES_ILUMINACAO = [
  'Aclaramento',
  'Balizamento',
  'Sinalização de saída',
  'Rota de fuga',
  'Anti-pânico',
  'OUTRO',
] as const;

export const AUTONOMIAS = [
  '30 minutos',
  '60 minutos',
  '90 minutos',
  '120 minutos',
  '180 minutos',
  'Não informado',
  'OUTRO',
] as const;

export const TIPOS_SINALIZACAO = [
  'Saída de emergência',
  'Rota de fuga',
  'Extintor',
  'Hidrante',
  'Alarme de incêndio',
  'Proibido obstruir',
  'Escada de emergência',
  'Ponto de encontro',
  'Risco elétrico',
  'Inflamáveis',
  'OUTRO',
] as const;

export const TIPOS_SPRINKLER = [
  'Pendente',
  'Upright',
  'Sidewall',
  'Embutido',
  'Oculto',
  'Resposta rápida',
  'Resposta padrão',
  'OUTRO',
] as const;

export const TIPOS_BOMBA = [
  'Bomba principal',
  'Bomba reserva',
  'Bomba jockey',
  'Bomba diesel',
  'Bomba elétrica',
  'Conjunto de bombas de incêndio',
  'OUTRO',
] as const;

export const TIPOS_PORTA = [
  'Porta corta-fogo P-30',
  'Porta corta-fogo P-60',
  'Porta corta-fogo P-90',
  'Porta corta-fogo P-120',
  'Porta simples',
  'Porta dupla',
  'OUTRO',
] as const;

export const TIPOS_DETECTOR_FUMACA = [
  'Detector óptico de fumaça',
  'Detector iônico de fumaça',
  'Detector endereçável',
  'Detector convencional',
  'OUTRO',
] as const;

export const TIPOS_DETECTOR_CALOR = [
  'Detector termovelocimétrico',
  'Detector temperatura fixa',
  'Detector convencional',
  'Detector endereçável',
  'OUTRO',
] as const;

export const ESTADOS_GERAIS = [
  'Bom',
  'Regular',
  'Ruim',
  'Crítico',
  'OUTRO',
] as const;

export const SIM_NAO = ['Sim', 'Não'] as const;

// ---------------------------------------------------------------------------
// Field configuration: defines which fields are shown per equipment type
// ---------------------------------------------------------------------------

export type FieldSection = 'identificacao' | 'localizacao' | 'dadosTecnicos' | 'inspecaoManutencao' | 'observacoes';

export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date';
  section: FieldSection;
  tipos: string[];
  options?: readonly string[];
  placeholder?: string;
}

export const FIELD_CONFIGS: FieldConfig[] = [
  // ---- Identificação (shown for all types) ----
  { name: 'fabricante', label: 'Fabricante', type: 'text', section: 'identificacao', tipos: EQUIP_TYPES as unknown as string[], placeholder: 'Ex: Resil' },
  { name: 'numSerie', label: 'Nº de Série', type: 'text', section: 'identificacao', tipos: EQUIP_TYPES as unknown as string[], placeholder: 'Ex: 987654' },

  // ---- Dados Técnicos - Extintor ----
  { name: 'modeloExtintor', label: 'Modelo do Extintor', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: EXTINTOR_MODELOS },
  { name: 'capacidade', label: 'Capacidade', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: CAPACIDADES_EXTINTOR },
  { name: 'classeFogo', label: 'Classe de Fogo', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: CLASSES_FOGO },

  { name: 'seloLacre', label: 'Selo / Lacre', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: SIM_NAO },
  { name: 'manometro', label: 'Manômetro', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: ['OK', 'Defeito', 'Inexistente'] },
  { name: 'suporte', label: 'Suporte', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor'], options: ESTADOS_GERAIS },
  { name: 'sinalizacao', label: 'Sinalização', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor', 'Hidrante', 'Abrigo de mangueira', 'Acionador manual', 'Porta corta-fogo', 'Detector de fumaça', 'Detector de calor'], options: SIM_NAO },
  { name: 'acessoDesobstruido', label: 'Acesso Desobstruído', type: 'select', section: 'dadosTecnicos', tipos: ['Extintor', 'Hidrante', 'Abrigo de mangueira'], options: SIM_NAO },
  { name: 'estadoGeral', label: 'Estado Geral', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante', 'Abrigo de mangueira', 'Esguicho', 'Chave storz', 'Porta corta-fogo'], options: ESTADOS_GERAIS },

  // ---- Dados Técnicos - Hidrante ----
  { name: 'tipoHidrante', label: 'Tipo de Hidrante', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante'], options: TIPOS_HIDRANTE },
  { name: 'tipoAbrigoVinculado', label: 'Tipo de Abrigo Vinculado', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante'], options: TIPOS_ABRIGO },
  { name: 'registro', label: 'Registro', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante', 'Abrigo de mangueira'], options: ESTADOS_GERAIS },
  { name: 'valvula', label: 'Válvula', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante'], options: ESTADOS_GERAIS },
  { name: 'adaptador', label: 'Adaptador', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante'], options: ESTADOS_GERAIS },
  { name: 'tampao', label: 'Tampão', type: 'select', section: 'dadosTecnicos', tipos: ['Hidrante'], options: ESTADOS_GERAIS },
  { name: 'pressao', label: 'Pressão', type: 'text', section: 'dadosTecnicos', tipos: ['Hidrante'], placeholder: 'Ex: 4 kgf/cm²' },

  // ---- Dados Técnicos - Mangueira ----
  { name: 'tipoMangueira', label: 'Tipo de Mangueira', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira'], options: TIPOS_MANGUEIRA },
  { name: 'diametro', label: 'Diâmetro', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira', 'Esguicho'], options: DIAMETROS },
  { name: 'comprimento', label: 'Comprimento', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira'], options: COMPRIMENTOS_MANGUEIRA },
  { name: 'tipoUniao', label: 'Tipo de União', type: 'text', section: 'dadosTecnicos', tipos: ['Mangueira'], placeholder: 'Ex: Storz' },
  { name: 'estadoMangueira', label: 'Estado da Mangueira', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira'], options: ESTADOS_GERAIS },
  { name: 'acondicionamento', label: 'Acondicionamento', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira', 'Esguicho', 'Chave storz'], options: ['Adequado', 'Inadequado'] },
  { name: 'possuiEtiquetaInspecao', label: 'Possui Etiqueta de Inspeção', type: 'select', section: 'dadosTecnicos', tipos: ['Mangueira'], options: SIM_NAO },

  // ---- Dados Técnicos - Abrigo de mangueira ----
  { name: 'tipoAbrigo', label: 'Tipo de Abrigo', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: TIPOS_ABRIGO },
  { name: 'material', label: 'Material', type: 'text', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira', 'Sinalização'], placeholder: 'Ex: Aço, Acrílico' },
  { name: 'estadoPorta', label: 'Estado da Porta', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: ESTADOS_GERAIS },
  { name: 'estadoVisor', label: 'Estado do Visor', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: ESTADOS_GERAIS },
  { name: 'possuiMangueira', label: 'Possui Mangueira', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: SIM_NAO },
  { name: 'possuiEsguicho', label: 'Possui Esguicho', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: SIM_NAO },
  { name: 'possuiChaveStorz', label: 'Possui Chave Storz', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: SIM_NAO },
  { name: 'possuiRegistro', label: 'Possui Registro', type: 'select', section: 'dadosTecnicos', tipos: ['Abrigo de mangueira'], options: SIM_NAO },

  // ---- Dados Técnicos - Esguicho ----
  { name: 'tipoEsguicho', label: 'Tipo de Esguicho', type: 'select', section: 'dadosTecnicos', tipos: ['Esguicho'], options: TIPOS_ESGUICHO },
  { name: 'estadoRoscas', label: 'Estado da Rosca', type: 'select', section: 'dadosTecnicos', tipos: ['Esguicho'], options: ESTADOS_GERAIS },
  { name: 'estadoVedacao', label: 'Estado da Vedação', type: 'select', section: 'dadosTecnicos', tipos: ['Esguicho'], options: ESTADOS_GERAIS },
  { name: 'compatibilidadeMangueira', label: 'Compatibilidade com Mangueira', type: 'select', section: 'dadosTecnicos', tipos: ['Esguicho'], options: SIM_NAO },
  { name: 'localAcondicionamento', label: 'Local de Acondicionamento', type: 'text', section: 'dadosTecnicos', tipos: ['Esguicho', 'Chave storz'], placeholder: 'Ex: Abrigo do hidrante' },

  // ---- Dados Técnicos - Chave storz ----
  { name: 'tipoChaveStorz', label: 'Tipo de Chave', type: 'select', section: 'dadosTecnicos', tipos: ['Chave storz'], options: TIPOS_CHAVE_STORZ },
  { name: 'diametroCompativel', label: 'Diâmetro Compatível', type: 'select', section: 'dadosTecnicos', tipos: ['Chave storz'], options: DIAMETROS },
  { name: 'estadoFisico', label: 'Estado Físico', type: 'select', section: 'dadosTecnicos', tipos: ['Chave storz', 'Detector de fumaça', 'Detector de calor'], options: ESTADOS_GERAIS },

  // ---- Dados Técnicos - Acionador manual ----
  { name: 'tipoAcionador', label: 'Tipo de Acionador', type: 'select', section: 'dadosTecnicos', tipos: ['Acionador manual'], options: TIPOS_ACIONADOR },
  { name: 'enderecoZona', label: 'Endereço / Zona', type: 'text', section: 'dadosTecnicos', tipos: ['Acionador manual', 'Alarme', 'Central de alarme', 'Detector de fumaça', 'Detector de calor'], placeholder: 'Ex: Zona 03' },
  { name: 'estadoTampa', label: 'Estado da Tampa', type: 'select', section: 'dadosTecnicos', tipos: ['Acionador manual'], options: ESTADOS_GERAIS },
  { name: 'estadoBotao', label: 'Estado do Botão', type: 'select', section: 'dadosTecnicos', tipos: ['Acionador manual'], options: ESTADOS_GERAIS },
  { name: 'alturaInstalacao', label: 'Altura de Instalação', type: 'text', section: 'dadosTecnicos', tipos: ['Acionador manual', 'Sinalização', 'Detector de fumaça', 'Detector de calor'], placeholder: 'Ex: 1,60 m' },
  { name: 'funcionamentoTestado', label: 'Funcionamento Testado', type: 'select', section: 'dadosTecnicos', tipos: ['Acionador manual', 'Alarme', 'Iluminação de emergência', 'Detector de fumaça', 'Detector de calor'], options: SIM_NAO },

  // ---- Dados Técnicos - Alarme ----
  { name: 'tipoAlarme', label: 'Tipo de Alarme', type: 'select', section: 'dadosTecnicos', tipos: ['Alarme'], options: TIPOS_ALARME },
  { name: 'sireneAudiovisual', label: 'Sirene Audiovisual', type: 'select', section: 'dadosTecnicos', tipos: ['Alarme'], options: ESTADOS_GERAIS },
  { name: 'sireneSonora', label: 'Sirene Sonora', type: 'select', section: 'dadosTecnicos', tipos: ['Alarme'], options: ESTADOS_GERAIS },
  { name: 'sinalizadorVisual', label: 'Sinalizador Visual', type: 'select', section: 'dadosTecnicos', tipos: ['Alarme'], options: ESTADOS_GERAIS },
  { name: 'zonaLaco', label: 'Zona / Laço', type: 'text', section: 'dadosTecnicos', tipos: ['Alarme'], placeholder: 'Ex: Laço 01' },
  { name: 'fonteAlimentacao', label: 'Fonte de Alimentação', type: 'text', section: 'dadosTecnicos', tipos: ['Alarme', 'Central de alarme', 'Iluminação de emergência'], placeholder: 'Ex: 127V / Bateria' },

  // ---- Dados Técnicos - Central de alarme ----
  { name: 'tipoCentral', label: 'Tipo de Central', type: 'select', section: 'dadosTecnicos', tipos: ['Central de alarme'], options: TIPOS_CENTRAL },
  { name: 'quantidadeLacosZonas', label: 'Qtd. de Laços / Zonas', type: 'text', section: 'dadosTecnicos', tipos: ['Central de alarme'], placeholder: 'Ex: 4' },
  { name: 'bateriaBackup', label: 'Bateria Backup', type: 'select', section: 'dadosTecnicos', tipos: ['Central de alarme'], options: ['OK', 'Defeito', 'Inexistente'] },
  { name: 'comunicacaoDispositivos', label: 'Comunicação com Dispositivos', type: 'select', section: 'dadosTecnicos', tipos: ['Central de alarme'], options: ['OK', 'Falha parcial', 'Falha total'] },
  { name: 'statusPainel', label: 'Status do Painel', type: 'select', section: 'dadosTecnicos', tipos: ['Central de alarme'], options: ['Normal', 'Alarme', 'Falha', 'Supervisório'] },
  { name: 'localInstalacao', label: 'Local de Instalação', type: 'text', section: 'dadosTecnicos', tipos: ['Central de alarme', 'Sinalização', 'Bomba'], placeholder: 'Ex: Sala de segurança' },

  // ---- Dados Técnicos - Iluminação de emergência ----
  { name: 'modeloIluminacao', label: 'Modelo da Iluminação', type: 'select', section: 'dadosTecnicos', tipos: ['Iluminação de emergência'], options: MODELOS_ILUMINACAO },
  { name: 'funcaoIluminacao', label: 'Função', type: 'select', section: 'dadosTecnicos', tipos: ['Iluminação de emergência'], options: FUNCOES_ILUMINACAO },
  { name: 'autonomia', label: 'Autonomia', type: 'select', section: 'dadosTecnicos', tipos: ['Iluminação de emergência'], options: AUTONOMIAS },
  { name: 'tipoInstalacao', label: 'Tipo de Instalação', type: 'text', section: 'dadosTecnicos', tipos: ['Iluminação de emergência', 'Sprinkler'], placeholder: 'Ex: Sobrepor' },
  { name: 'potencia', label: 'Potência', type: 'text', section: 'dadosTecnicos', tipos: ['Iluminação de emergência', 'Bomba'], placeholder: 'Ex: 20W / 5CV' },

  // ---- Dados Técnicos - Sinalização ----
  { name: 'tipoSinalizacao', label: 'Tipo de Sinalização', type: 'select', section: 'dadosTecnicos', tipos: ['Sinalização'], options: TIPOS_SINALIZACAO },
  { name: 'codigoPlaca', label: 'Código / Descrição da Placa', type: 'text', section: 'dadosTecnicos', tipos: ['Sinalização'], placeholder: 'Ex: SE-01' },
  { name: 'fotoluminescente', label: 'Fotoluminescente', type: 'select', section: 'dadosTecnicos', tipos: ['Sinalização'], options: SIM_NAO },
  { name: 'visibilidade', label: 'Visibilidade', type: 'select', section: 'dadosTecnicos', tipos: ['Sinalização'], options: ['Boa', 'Regular', 'Ruim', 'Obstruída'] },
  { name: 'estadoConservacao', label: 'Estado de Conservação', type: 'select', section: 'dadosTecnicos', tipos: ['Sinalização'], options: ESTADOS_GERAIS },
  { name: 'fixacaoAdequada', label: 'Fixação Adequada', type: 'select', section: 'dadosTecnicos', tipos: ['Sinalização'], options: SIM_NAO },

  // ---- Dados Técnicos - Sprinkler ----
  { name: 'tipoSprinkler', label: 'Tipo de Sprinkler', type: 'select', section: 'dadosTecnicos', tipos: ['Sprinkler'], options: TIPOS_SPRINKLER },
  { name: 'temperaturaAcionamento', label: 'Temperatura de Acionamento', type: 'text', section: 'dadosTecnicos', tipos: ['Sprinkler', 'Detector de calor'], placeholder: 'Ex: 68°C' },
  { name: 'posicaoInstalacao', label: 'Posição de Instalação', type: 'text', section: 'dadosTecnicos', tipos: ['Sprinkler'], placeholder: 'Ex: Teto' },
  { name: 'estadoBulbo', label: 'Estado do Bulbo', type: 'select', section: 'dadosTecnicos', tipos: ['Sprinkler'], options: ['Íntegro', 'Danificado', 'Vazamento'] },
  { name: 'obstrucao', label: 'Obstrução', type: 'select', section: 'dadosTecnicos', tipos: ['Sprinkler', 'Porta corta-fogo'], options: ['Sim', 'Não'] },
  { name: 'corrosao', label: 'Corrosão', type: 'select', section: 'dadosTecnicos', tipos: ['Sprinkler'], options: ['Sim', 'Não'] },
  { name: 'vazamento', label: 'Vazamento', type: 'select', section: 'dadosTecnicos', tipos: ['Sprinkler'], options: ['Sim', 'Não'] },
  { name: 'areaProtegida', label: 'Área Protegida', type: 'text', section: 'dadosTecnicos', tipos: ['Sprinkler'], placeholder: 'Ex: Hall de entrada' },

  // ---- Dados Técnicos - Bomba ----
  { name: 'tipoBomba', label: 'Tipo de Bomba', type: 'select', section: 'dadosTecnicos', tipos: ['Bomba'], options: TIPOS_BOMBA },
  { name: 'vazao', label: 'Vazão', type: 'text', section: 'dadosTecnicos', tipos: ['Bomba'], placeholder: 'Ex: 500 L/min' },
  { name: 'pressao', label: 'Pressão', type: 'text', section: 'dadosTecnicos', tipos: ['Bomba'], placeholder: 'Ex: 6 kgf/cm²' },
  { name: 'alimentacaoEletrica', label: 'Alimentação Elétrica', type: 'text', section: 'dadosTecnicos', tipos: ['Bomba'], placeholder: 'Ex: 220V trifásico' },
  { name: 'painelComando', label: 'Painel de Comando', type: 'select', section: 'dadosTecnicos', tipos: ['Bomba'], options: ['OK', 'Defeito', 'Inexistente'] },
  { name: 'bombaJockey', label: 'Bomba Jockey', type: 'select', section: 'dadosTecnicos', tipos: ['Bomba'], options: ESTADOS_GERAIS },
  { name: 'bombaPrincipal', label: 'Bomba Principal', type: 'select', section: 'dadosTecnicos', tipos: ['Bomba'], options: ESTADOS_GERAIS },
  { name: 'bombaReserva', label: 'Bomba Reserva', type: 'select', section: 'dadosTecnicos', tipos: ['Bomba'], options: ESTADOS_GERAIS },

  // ---- Dados Técnicos - Porta corta-fogo ----
  { name: 'tipoPorta', label: 'Tipo de Porta', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: TIPOS_PORTA },
  { name: 'tempoResistenciaFogo', label: 'Tempo de Resistência ao Fogo', type: 'text', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], placeholder: 'Ex: 60 min' },
  { name: 'barraAntipanico', label: 'Barra Antipânico', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: ESTADOS_GERAIS },
  { name: 'dobradicas', label: 'Dobradiças', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: ESTADOS_GERAIS },
  { name: 'molaAerea', label: 'Mola Aérea', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: ESTADOS_GERAIS },
  { name: 'fechamentoAutomatico', label: 'Fechamento Automático', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: ['Funcionando', 'Defeito', 'Inexistente'] },
  { name: 'vedacao', label: 'Vedação', type: 'select', section: 'dadosTecnicos', tipos: ['Porta corta-fogo'], options: ['Adequada', 'Inadequada', 'Danificada'] },

  // ---- Dados Técnicos - Detector de fumaça ----
  { name: 'tipoDetectorFumaca', label: 'Tipo de Detector', type: 'select', section: 'dadosTecnicos', tipos: ['Detector de fumaça'], options: TIPOS_DETECTOR_FUMACA },

  // ---- Dados Técnicos - Detector de calor ----
  { name: 'tipoDetectorCalor', label: 'Tipo de Detector', type: 'select', section: 'dadosTecnicos', tipos: ['Detector de calor'], options: TIPOS_DETECTOR_CALOR },

  // ---- Dados Técnicos - Outro ----
  { name: 'nomeModelo', label: 'Nome / Modelo do Equipamento', type: 'text', section: 'dadosTecnicos', tipos: ['Outro'], placeholder: 'Ex: Central de incêndio modelo X' },
  { name: 'descricaoTecnica', label: 'Descrição Técnica', type: 'text', section: 'dadosTecnicos', tipos: ['Outro'], placeholder: 'Descrição detalhada do equipamento' },

  // ---- Datas de fabricação / manutenção (Extintor) ----
  { name: 'dataFabricacao', label: 'Data de Fabricação', type: 'date', section: 'inspecaoManutencao', tipos: ['Extintor'] },
  { name: 'dataUltimaManutencao', label: 'Data da Última Manutenção', type: 'date', section: 'inspecaoManutencao', tipos: ['Extintor'] },
  { name: 'dataProximaManutencao', label: 'Data da Próxima Manutenção', type: 'date', section: 'inspecaoManutencao', tipos: ['Extintor'] },

  // ---- Teste hidrostático (Mangueira) ----
  { name: 'dataTesteHidrostatico', label: 'Data do Teste Hidrostático', type: 'date', section: 'inspecaoManutencao', tipos: ['Mangueira'] },
  { name: 'dataValidadeTeste', label: 'Data de Validade do Teste', type: 'date', section: 'inspecaoManutencao', tipos: ['Mangueira'] },

  // ---- Testes (Acionador manual, Alarme, Central, Iluminação, Bomba, Detector fum/calor) ----
  { name: 'dataUltimoTeste', label: 'Data do Último Teste', type: 'date', section: 'inspecaoManutencao', tipos: ['Acionador manual', 'Alarme', 'Central de alarme', 'Iluminação de emergência', 'Bomba', 'Detector de fumaça', 'Detector de calor'] },
  { name: 'dataProximoTeste', label: 'Data do Próximo Teste', type: 'date', section: 'inspecaoManutencao', tipos: ['Acionador manual', 'Alarme', 'Central de alarme', 'Iluminação de emergência', 'Bomba', 'Detector de fumaça', 'Detector de calor'] },
];


