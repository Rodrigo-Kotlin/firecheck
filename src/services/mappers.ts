import type { Equipment, Inspection, ActionPlan, Inspector } from '../types';

export interface DbEquipamento {
  id: string;
  tipo: string;
  subtipo: string | null;
  local: string;
  setor: string;
  pavimento: string | null;
  fabricante: string | null;
  num_serie: string | null;
  capacidade: string | null;
  tipo_carga: string | null;
  modelo_extintor: string | null;
  classe_fogo: string | null;
  selo_lacre: string | null;
  manometro: string | null;
  suporte: string | null;
  sinalizacao: string | null;
  acesso_desobstruido: string | null;
  estado_geral: string | null;
  tipo_hidrante: string | null;
  tipo_abrigo_vinculado: string | null;
  registro: string | null;
  valvula: string | null;
  adaptador: string | null;
  tampao: string | null;
  pressao: string | null;
  tipo_mangueira: string | null;
  diametro: string | null;
  comprimento: string | null;
  tipo_uniao: string | null;
  estado_mangueira: string | null;
  acondicionamento: string | null;
  possui_etiqueta_inspecao: string | null;
  tipo_abrigo: string | null;
  material: string | null;
  estado_porta: string | null;
  estado_visor: string | null;
  possui_mangueira: string | null;
  possui_esguicho: string | null;
  possui_chave_storz: string | null;
  possui_registro: string | null;
  tipo_esguicho: string | null;
  estado_roscas: string | null;
  estado_vedacao: string | null;
  compatibilidade_mangueira: string | null;
  local_acondicionamento: string | null;
  tipo_chave_storz: string | null;
  diametro_compativel: string | null;
  estado_fisico: string | null;
  tipo_acionador: string | null;
  endereco_zona: string | null;
  estado_tampa: string | null;
  estado_botao: string | null;
  altura_instalacao: string | null;
  funcionamento_testado: string | null;
  tipo_alarme: string | null;
  sirene_audiovisual: string | null;
  sirene_sonora: string | null;
  sinalizador_visual: string | null;
  zona_laco: string | null;
  fonte_alimentacao: string | null;
  tipo_central: string | null;
  quantidade_lacos_zonas: string | null;
  bateria_backup: string | null;
  comunicacao_dispositivos: string | null;
  status_painel: string | null;
  local_instalacao: string | null;
  modelo_iluminacao: string | null;
  funcao_iluminacao: string | null;
  autonomia: string | null;
  tipo_instalacao: string | null;
  potencia: string | null;
  tipo_sinalizacao: string | null;
  codigo_placa: string | null;
  fotoluminescente: string | null;
  visibilidade: string | null;
  estado_conservacao: string | null;
  fixacao_adequada: string | null;
  tipo_sprinkler: string | null;
  temperatura_acionamento: string | null;
  posicao_instalacao: string | null;
  estado_bulbo: string | null;
  obstrucao: string | null;
  corrosao: string | null;
  vazamento: string | null;
  area_protegida: string | null;
  tipo_bomba: string | null;
  vazao: string | null;
  alimentacao_eletrica: string | null;
  painel_comando: string | null;
  bomba_jockey: string | null;
  bomba_principal: string | null;
  bomba_reserva: string | null;
  tipo_porta: string | null;
  tempo_resistencia_fogo: string | null;
  barra_antipanico: string | null;
  dobradicas: string | null;
  mola_aerea: string | null;
  fechamento_automatico: string | null;
  vedacao: string | null;
  tipo_detector_fumaca: string | null;
  tipo_detector_calor: string | null;
  nome_modelo: string | null;
  descricao_tecnica: string | null;
  data_fabricacao: string | null;
  data_ultima_manutencao: string | null;
  data_proxima_manutencao: string | null;
  data_ultimo_teste: string | null;
  data_proximo_teste: string | null;
  data_teste_hidrostatico: string | null;
  data_validade_teste: string | null;
  data_proxima_inspecao: string | null;
  data_ultima_inspecao: string | null;
  status: Equipment['status'];
  qrcode: string | null;
  foto_url: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbInspecao {
  id: string;
  equipment_id: string;
  data: string;
  inspetor: string;
  status: Equipment['status'];
  observacoes: string | null;
  checklist_json: unknown;
  sincronizado: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPlanoAcao {
  id: string;
  equipment_id: string;
  local: string;
  descricao: string;
  criticidade: ActionPlan['criticidade'];
  responsavel: string;
  prazo: string | null;
  status: ActionPlan['status'];
  created_at: string;
  updated_at: string;
}

export interface DbInspetor {
  id: string;
  nome: string;
  cargo: string;
  role?: 'admin' | 'inspector';
}

const emptyToUndef = (v: string | null | undefined): string | undefined =>
  v === null || v === undefined || v === '' ? undefined : v;

export function dbToEquipment(row: DbEquipamento): Equipment {
  return {
    id: row.id,
    tipo: row.tipo,
    subtipo: emptyToUndef(row.subtipo),
    local: row.local,
    setor: row.setor,
    pavimento: emptyToUndef(row.pavimento),
    fabricante: emptyToUndef(row.fabricante),
    numSerie: emptyToUndef(row.num_serie),
    capacidade: emptyToUndef(row.capacidade),
    tipoCarga: emptyToUndef(row.tipo_carga),
    modeloExtintor: emptyToUndef(row.modelo_extintor),
    classeFogo: emptyToUndef(row.classe_fogo),
    seloLacre: emptyToUndef(row.selo_lacre),
    manometro: emptyToUndef(row.manometro),
    suporte: emptyToUndef(row.suporte),
    sinalizacao: emptyToUndef(row.sinalizacao),
    acessoDesobstruido: emptyToUndef(row.acesso_desobstruido),
    estadoGeral: emptyToUndef(row.estado_geral),
    tipoHidrante: emptyToUndef(row.tipo_hidrante),
    tipoAbrigoVinculado: emptyToUndef(row.tipo_abrigo_vinculado),
    registro: emptyToUndef(row.registro),
    valvula: emptyToUndef(row.valvula),
    adaptador: emptyToUndef(row.adaptador),
    tampao: emptyToUndef(row.tampao),
    pressao: emptyToUndef(row.pressao),
    tipoMangueira: emptyToUndef(row.tipo_mangueira),
    diametro: emptyToUndef(row.diametro),
    comprimento: emptyToUndef(row.comprimento),
    tipoUniao: emptyToUndef(row.tipo_uniao),
    estadoMangueira: emptyToUndef(row.estado_mangueira),
    acondicionamento: emptyToUndef(row.acondicionamento),
    possuiEtiquetaInspecao: emptyToUndef(row.possui_etiqueta_inspecao),
    tipoAbrigo: emptyToUndef(row.tipo_abrigo),
    material: emptyToUndef(row.material),
    estadoPorta: emptyToUndef(row.estado_porta),
    estadoVisor: emptyToUndef(row.estado_visor),
    possuiMangueira: emptyToUndef(row.possui_mangueira),
    possuiEsguicho: emptyToUndef(row.possui_esguicho),
    possuiChaveStorz: emptyToUndef(row.possui_chave_storz),
    possuiRegistro: emptyToUndef(row.possui_registro),
    tipoEsguicho: emptyToUndef(row.tipo_esguicho),
    estadoRoscas: emptyToUndef(row.estado_roscas),
    estadoVedacao: emptyToUndef(row.estado_vedacao),
    compatibilidadeMangueira: emptyToUndef(row.compatibilidade_mangueira),
    localAcondicionamento: emptyToUndef(row.local_acondicionamento),
    tipoChaveStorz: emptyToUndef(row.tipo_chave_storz),
    diametroCompativel: emptyToUndef(row.diametro_compativel),
    estadoFisico: emptyToUndef(row.estado_fisico),
    tipoAcionador: emptyToUndef(row.tipo_acionador),
    enderecoZona: emptyToUndef(row.endereco_zona),
    estadoTampa: emptyToUndef(row.estado_tampa),
    estadoBotao: emptyToUndef(row.estado_botao),
    alturaInstalacao: emptyToUndef(row.altura_instalacao),
    funcionamentoTestado: emptyToUndef(row.funcionamento_testado),
    tipoAlarme: emptyToUndef(row.tipo_alarme),
    sireneAudiovisual: emptyToUndef(row.sirene_audiovisual),
    sireneSonora: emptyToUndef(row.sirene_sonora),
    sinalizadorVisual: emptyToUndef(row.sinalizador_visual),
    zonaLaco: emptyToUndef(row.zona_laco),
    fonteAlimentacao: emptyToUndef(row.fonte_alimentacao),
    tipoCentral: emptyToUndef(row.tipo_central),
    quantidadeLacosZonas: emptyToUndef(row.quantidade_lacos_zonas),
    bateriaBackup: emptyToUndef(row.bateria_backup),
    comunicacaoDispositivos: emptyToUndef(row.comunicacao_dispositivos),
    statusPainel: emptyToUndef(row.status_painel),
    localInstalacao: emptyToUndef(row.local_instalacao),
    modeloIluminacao: emptyToUndef(row.modelo_iluminacao),
    funcaoIluminacao: emptyToUndef(row.funcao_iluminacao),
    autonomia: emptyToUndef(row.autonomia),
    tipoInstalacao: emptyToUndef(row.tipo_instalacao),
    potencia: emptyToUndef(row.potencia),
    tipoSinalizacao: emptyToUndef(row.tipo_sinalizacao),
    codigoPlaca: emptyToUndef(row.codigo_placa),
    fotoluminescente: emptyToUndef(row.fotoluminescente),
    visibilidade: emptyToUndef(row.visibilidade),
    estadoConservacao: emptyToUndef(row.estado_conservacao),
    fixacaoAdequada: emptyToUndef(row.fixacao_adequada),
    tipoSprinkler: emptyToUndef(row.tipo_sprinkler),
    temperaturaAcionamento: emptyToUndef(row.temperatura_acionamento),
    posicaoInstalacao: emptyToUndef(row.posicao_instalacao),
    estadoBulbo: emptyToUndef(row.estado_bulbo),
    obstrucao: emptyToUndef(row.obstrucao),
    corrosao: emptyToUndef(row.corrosao),
    vazamento: emptyToUndef(row.vazamento),
    areaProtegida: emptyToUndef(row.area_protegida),
    tipoBomba: emptyToUndef(row.tipo_bomba),
    vazao: emptyToUndef(row.vazao),
    alimentacaoEletrica: emptyToUndef(row.alimentacao_eletrica),
    painelComando: emptyToUndef(row.painel_comando),
    bombaJockey: emptyToUndef(row.bomba_jockey),
    bombaPrincipal: emptyToUndef(row.bomba_principal),
    bombaReserva: emptyToUndef(row.bomba_reserva),
    tipoPorta: emptyToUndef(row.tipo_porta),
    tempoResistenciaFogo: emptyToUndef(row.tempo_resistencia_fogo),
    barraAntipanico: emptyToUndef(row.barra_antipanico),
    dobradicas: emptyToUndef(row.dobradicas),
    molaAerea: emptyToUndef(row.mola_aerea),
    fechamentoAutomatico: emptyToUndef(row.fechamento_automatico),
    vedacao: emptyToUndef(row.vedacao),
    tipoDetectorFumaca: emptyToUndef(row.tipo_detector_fumaca),
    tipoDetectorCalor: emptyToUndef(row.tipo_detector_calor),
    nomeModelo: emptyToUndef(row.nome_modelo),
    descricaoTecnica: emptyToUndef(row.descricao_tecnica),
    dataFabricacao: emptyToUndef(row.data_fabricacao),
    dataUltimaManutencao: emptyToUndef(row.data_ultima_manutencao),
    dataProximaManutencao: emptyToUndef(row.data_proxima_manutencao),
    dataUltimoTeste: emptyToUndef(row.data_ultimo_teste),
    dataProximoTeste: emptyToUndef(row.data_proximo_teste),
    dataTesteHidrostatico: emptyToUndef(row.data_teste_hidrostatico),
    dataValidadeTeste: emptyToUndef(row.data_validade_teste),
    dataProximaInspecao: emptyToUndef(row.data_proxima_inspecao),
    dataUltimaInspecao: emptyToUndef(row.data_ultima_inspecao),
    status: row.status,
    qrcode: emptyToUndef(row.qrcode),
    fotoUrl: emptyToUndef(row.foto_url),
    observacoes: emptyToUndef(row.observacoes),
  };
}

export function equipmentToDb(eq: Partial<Equipment>): Partial<DbEquipamento> {
  const row: Partial<DbEquipamento> = {};
  if (eq.id !== undefined) row.id = eq.id;
  if (eq.tipo !== undefined) row.tipo = eq.tipo;
  if (eq.subtipo !== undefined) row.subtipo = eq.subtipo ?? null;
  if (eq.local !== undefined) row.local = eq.local;
  if (eq.setor !== undefined) row.setor = eq.setor;
  if (eq.pavimento !== undefined) row.pavimento = eq.pavimento ?? null;
  if (eq.fabricante !== undefined) row.fabricante = eq.fabricante ?? null;
  if (eq.numSerie !== undefined) row.num_serie = eq.numSerie ?? null;
  if (eq.capacidade !== undefined) row.capacidade = eq.capacidade ?? null;
  if (eq.tipoCarga !== undefined) row.tipo_carga = eq.tipoCarga ?? null;
  if (eq.modeloExtintor !== undefined) row.modelo_extintor = eq.modeloExtintor ?? null;
  if (eq.classeFogo !== undefined) row.classe_fogo = eq.classeFogo ?? null;
  if (eq.seloLacre !== undefined) row.selo_lacre = eq.seloLacre ?? null;
  if (eq.manometro !== undefined) row.manometro = eq.manometro ?? null;
  if (eq.suporte !== undefined) row.suporte = eq.suporte ?? null;
  if (eq.sinalizacao !== undefined) row.sinalizacao = eq.sinalizacao ?? null;
  if (eq.acessoDesobstruido !== undefined) row.acesso_desobstruido = eq.acessoDesobstruido ?? null;
  if (eq.estadoGeral !== undefined) row.estado_geral = eq.estadoGeral ?? null;
  if (eq.tipoHidrante !== undefined) row.tipo_hidrante = eq.tipoHidrante ?? null;
  if (eq.tipoAbrigoVinculado !== undefined) row.tipo_abrigo_vinculado = eq.tipoAbrigoVinculado ?? null;
  if (eq.registro !== undefined) row.registro = eq.registro ?? null;
  if (eq.valvula !== undefined) row.valvula = eq.valvula ?? null;
  if (eq.adaptador !== undefined) row.adaptador = eq.adaptador ?? null;
  if (eq.tampao !== undefined) row.tampao = eq.tampao ?? null;
  if (eq.pressao !== undefined) row.pressao = eq.pressao ?? null;
  if (eq.tipoMangueira !== undefined) row.tipo_mangueira = eq.tipoMangueira ?? null;
  if (eq.diametro !== undefined) row.diametro = eq.diametro ?? null;
  if (eq.comprimento !== undefined) row.comprimento = eq.comprimento ?? null;
  if (eq.tipoUniao !== undefined) row.tipo_uniao = eq.tipoUniao ?? null;
  if (eq.estadoMangueira !== undefined) row.estado_mangueira = eq.estadoMangueira ?? null;
  if (eq.acondicionamento !== undefined) row.acondicionamento = eq.acondicionamento ?? null;
  if (eq.possuiEtiquetaInspecao !== undefined) row.possui_etiqueta_inspecao = eq.possuiEtiquetaInspecao ?? null;
  if (eq.tipoAbrigo !== undefined) row.tipo_abrigo = eq.tipoAbrigo ?? null;
  if (eq.material !== undefined) row.material = eq.material ?? null;
  if (eq.estadoPorta !== undefined) row.estado_porta = eq.estadoPorta ?? null;
  if (eq.estadoVisor !== undefined) row.estado_visor = eq.estadoVisor ?? null;
  if (eq.possuiMangueira !== undefined) row.possui_mangueira = eq.possuiMangueira ?? null;
  if (eq.possuiEsguicho !== undefined) row.possui_esguicho = eq.possuiEsguicho ?? null;
  if (eq.possuiChaveStorz !== undefined) row.possui_chave_storz = eq.possuiChaveStorz ?? null;
  if (eq.possuiRegistro !== undefined) row.possui_registro = eq.possuiRegistro ?? null;
  if (eq.tipoEsguicho !== undefined) row.tipo_esguicho = eq.tipoEsguicho ?? null;
  if (eq.estadoRoscas !== undefined) row.estado_roscas = eq.estadoRoscas ?? null;
  if (eq.estadoVedacao !== undefined) row.estado_vedacao = eq.estadoVedacao ?? null;
  if (eq.compatibilidadeMangueira !== undefined) row.compatibilidade_mangueira = eq.compatibilidadeMangueira ?? null;
  if (eq.localAcondicionamento !== undefined) row.local_acondicionamento = eq.localAcondicionamento ?? null;
  if (eq.tipoChaveStorz !== undefined) row.tipo_chave_storz = eq.tipoChaveStorz ?? null;
  if (eq.diametroCompativel !== undefined) row.diametro_compativel = eq.diametroCompativel ?? null;
  if (eq.estadoFisico !== undefined) row.estado_fisico = eq.estadoFisico ?? null;
  if (eq.tipoAcionador !== undefined) row.tipo_acionador = eq.tipoAcionador ?? null;
  if (eq.enderecoZona !== undefined) row.endereco_zona = eq.enderecoZona ?? null;
  if (eq.estadoTampa !== undefined) row.estado_tampa = eq.estadoTampa ?? null;
  if (eq.estadoBotao !== undefined) row.estado_botao = eq.estadoBotao ?? null;
  if (eq.alturaInstalacao !== undefined) row.altura_instalacao = eq.alturaInstalacao ?? null;
  if (eq.funcionamentoTestado !== undefined) row.funcionamento_testado = eq.funcionamentoTestado ?? null;
  if (eq.tipoAlarme !== undefined) row.tipo_alarme = eq.tipoAlarme ?? null;
  if (eq.sireneAudiovisual !== undefined) row.sirene_audiovisual = eq.sireneAudiovisual ?? null;
  if (eq.sireneSonora !== undefined) row.sirene_sonora = eq.sireneSonora ?? null;
  if (eq.sinalizadorVisual !== undefined) row.sinalizador_visual = eq.sinalizadorVisual ?? null;
  if (eq.zonaLaco !== undefined) row.zona_laco = eq.zonaLaco ?? null;
  if (eq.fonteAlimentacao !== undefined) row.fonte_alimentacao = eq.fonteAlimentacao ?? null;
  if (eq.tipoCentral !== undefined) row.tipo_central = eq.tipoCentral ?? null;
  if (eq.quantidadeLacosZonas !== undefined) row.quantidade_lacos_zonas = eq.quantidadeLacosZonas ?? null;
  if (eq.bateriaBackup !== undefined) row.bateria_backup = eq.bateriaBackup ?? null;
  if (eq.comunicacaoDispositivos !== undefined) row.comunicacao_dispositivos = eq.comunicacaoDispositivos ?? null;
  if (eq.statusPainel !== undefined) row.status_painel = eq.statusPainel ?? null;
  if (eq.localInstalacao !== undefined) row.local_instalacao = eq.localInstalacao ?? null;
  if (eq.modeloIluminacao !== undefined) row.modelo_iluminacao = eq.modeloIluminacao ?? null;
  if (eq.funcaoIluminacao !== undefined) row.funcao_iluminacao = eq.funcaoIluminacao ?? null;
  if (eq.autonomia !== undefined) row.autonomia = eq.autonomia ?? null;
  if (eq.tipoInstalacao !== undefined) row.tipo_instalacao = eq.tipoInstalacao ?? null;
  if (eq.potencia !== undefined) row.potencia = eq.potencia ?? null;
  if (eq.tipoSinalizacao !== undefined) row.tipo_sinalizacao = eq.tipoSinalizacao ?? null;
  if (eq.codigoPlaca !== undefined) row.codigo_placa = eq.codigoPlaca ?? null;
  if (eq.fotoluminescente !== undefined) row.fotoluminescente = eq.fotoluminescente ?? null;
  if (eq.visibilidade !== undefined) row.visibilidade = eq.visibilidade ?? null;
  if (eq.estadoConservacao !== undefined) row.estado_conservacao = eq.estadoConservacao ?? null;
  if (eq.fixacaoAdequada !== undefined) row.fixacao_adequada = eq.fixacaoAdequada ?? null;
  if (eq.tipoSprinkler !== undefined) row.tipo_sprinkler = eq.tipoSprinkler ?? null;
  if (eq.temperaturaAcionamento !== undefined) row.temperatura_acionamento = eq.temperaturaAcionamento ?? null;
  if (eq.posicaoInstalacao !== undefined) row.posicao_instalacao = eq.posicaoInstalacao ?? null;
  if (eq.estadoBulbo !== undefined) row.estado_bulbo = eq.estadoBulbo ?? null;
  if (eq.obstrucao !== undefined) row.obstrucao = eq.obstrucao ?? null;
  if (eq.corrosao !== undefined) row.corrosao = eq.corrosao ?? null;
  if (eq.vazamento !== undefined) row.vazamento = eq.vazamento ?? null;
  if (eq.areaProtegida !== undefined) row.area_protegida = eq.areaProtegida ?? null;
  if (eq.tipoBomba !== undefined) row.tipo_bomba = eq.tipoBomba ?? null;
  if (eq.vazao !== undefined) row.vazao = eq.vazao ?? null;
  if (eq.alimentacaoEletrica !== undefined) row.alimentacao_eletrica = eq.alimentacaoEletrica ?? null;
  if (eq.painelComando !== undefined) row.painel_comando = eq.painelComando ?? null;
  if (eq.bombaJockey !== undefined) row.bomba_jockey = eq.bombaJockey ?? null;
  if (eq.bombaPrincipal !== undefined) row.bomba_principal = eq.bombaPrincipal ?? null;
  if (eq.bombaReserva !== undefined) row.bomba_reserva = eq.bombaReserva ?? null;
  if (eq.tipoPorta !== undefined) row.tipo_porta = eq.tipoPorta ?? null;
  if (eq.tempoResistenciaFogo !== undefined) row.tempo_resistencia_fogo = eq.tempoResistenciaFogo ?? null;
  if (eq.barraAntipanico !== undefined) row.barra_antipanico = eq.barraAntipanico ?? null;
  if (eq.dobradicas !== undefined) row.dobradicas = eq.dobradicas ?? null;
  if (eq.molaAerea !== undefined) row.mola_aerea = eq.molaAerea ?? null;
  if (eq.fechamentoAutomatico !== undefined) row.fechamento_automatico = eq.fechamentoAutomatico ?? null;
  if (eq.vedacao !== undefined) row.vedacao = eq.vedacao ?? null;
  if (eq.tipoDetectorFumaca !== undefined) row.tipo_detector_fumaca = eq.tipoDetectorFumaca ?? null;
  if (eq.tipoDetectorCalor !== undefined) row.tipo_detector_calor = eq.tipoDetectorCalor ?? null;
  if (eq.nomeModelo !== undefined) row.nome_modelo = eq.nomeModelo ?? null;
  if (eq.descricaoTecnica !== undefined) row.descricao_tecnica = eq.descricaoTecnica ?? null;
  if (eq.dataFabricacao !== undefined) row.data_fabricacao = eq.dataFabricacao ?? null;
  if (eq.dataUltimaManutencao !== undefined) row.data_ultima_manutencao = eq.dataUltimaManutencao ?? null;
  if (eq.dataProximaManutencao !== undefined) row.data_proxima_manutencao = eq.dataProximaManutencao ?? null;
  if (eq.dataUltimoTeste !== undefined) row.data_ultimo_teste = eq.dataUltimoTeste ?? null;
  if (eq.dataProximoTeste !== undefined) row.data_proximo_teste = eq.dataProximoTeste ?? null;
  if (eq.dataTesteHidrostatico !== undefined) row.data_teste_hidrostatico = eq.dataTesteHidrostatico ?? null;
  if (eq.dataValidadeTeste !== undefined) row.data_validade_teste = eq.dataValidadeTeste ?? null;
  if (eq.dataProximaInspecao !== undefined) row.data_proxima_inspecao = eq.dataProximaInspecao ?? null;
  if (eq.dataUltimaInspecao !== undefined) row.data_ultima_inspecao = eq.dataUltimaInspecao ?? null;
  if (eq.status !== undefined) row.status = eq.status;
  if (eq.qrcode !== undefined) row.qrcode = eq.qrcode ?? null;
  if (eq.fotoUrl !== undefined) row.foto_url = eq.fotoUrl ?? null;
  if (eq.observacoes !== undefined) row.observacoes = eq.observacoes ?? null;
  return row;
}

export function dbToInspection(row: DbInspecao): Inspection {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    data: row.data,
    inspetor: row.inspetor,
    status: row.status,
    observacoes: emptyToUndef(row.observacoes),
  };
}

export function inspectionToDb(insp: Partial<Inspection>): Partial<DbInspecao> {
  const row: Partial<DbInspecao> = {};
  if (insp.id !== undefined) row.id = insp.id;
  if (insp.equipmentId !== undefined) row.equipment_id = insp.equipmentId;
  if (insp.data !== undefined) row.data = insp.data;
  if (insp.inspetor !== undefined) row.inspetor = insp.inspetor;
  if (insp.status !== undefined) row.status = insp.status;
  if (insp.observacoes !== undefined) row.observacoes = insp.observacoes ?? null;
  return row;
}

export function dbToActionPlan(row: DbPlanoAcao): ActionPlan {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    local: row.local,
    descricao: row.descricao,
    criticidade: row.criticidade,
    responsavel: row.responsavel,
    prazo: emptyToUndef(row.prazo) ?? '',
    status: row.status,
    createdAt: row.created_at.split('T')[0],
  };
}

export function actionPlanToDb(plan: Partial<ActionPlan>): Partial<DbPlanoAcao> {
  const row: Partial<DbPlanoAcao> = {};
  if (plan.id !== undefined) row.id = plan.id;
  if (plan.equipmentId !== undefined) row.equipment_id = plan.equipmentId;
  if (plan.local !== undefined) row.local = plan.local;
  if (plan.descricao !== undefined) row.descricao = plan.descricao;
  if (plan.criticidade !== undefined) row.criticidade = plan.criticidade;
  if (plan.responsavel !== undefined) row.responsavel = plan.responsavel;
  if (plan.prazo !== undefined) row.prazo = plan.prazo ?? null;
  if (plan.status !== undefined) row.status = plan.status;
  return row;
}

export function dbToInspector(row: DbInspetor): Inspector {
  return { id: row.id, nome: row.nome, cargo: row.cargo, role: row.role ?? 'inspector' };
}
