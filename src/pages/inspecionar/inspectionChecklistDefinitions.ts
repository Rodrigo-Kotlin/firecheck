export interface ChecklistItemDefinition {
  key: string;
  label: string;
}

export const CHECKLIST_EXTINTOR: readonly ChecklistItemDefinition[] = [
  ['acesso-livre', 'Acesso livre e desobstruído'],
  ['suporte-correto', 'Fixado no suporte correto'],
  ['sinalizacao-visivel', 'Sinalização visível'],
  ['lacre-integro', 'Lacre íntegro'],
  ['pino-seguranca', 'Pino de segurança presente'],
  ['manometro-faixa-verde', 'Manômetro na faixa verde'],
  ['mangueira-sem-danos', 'Mangueira sem danos'],
  ['difusor-integro', 'Difusor/esguicho íntegro'],
  ['cilindro-sem-corrosao', 'Cilindro sem corrosão'],
  ['rotulo-legivel', 'Rótulo legível'],
  ['carga-validade', 'Carga na validade'],
  ['teste-hidrostatico', 'Teste hidrostático válido'],
  ['risco-compativel', 'Compatível com risco do local'],
  ['instalacao-adequada', 'Instalação adequada'],
  ['sem-sinais-uso', 'Sem sinais de uso'],
].map(([key, label]) => ({ key: `extintor.${key}`, label }));

export const CHECKLIST_HIDRANTE: readonly ChecklistItemDefinition[] = [
  ['acesso-livre', 'Acesso livre'],
  ['abrigo-ordem', 'Abrigo em ordem'],
  ['porta-normal', 'Porta abre normalmente'],
  ['sinalizacao-visivel', 'Sinalização visível'],
  ['mangueira-integra', 'Mangueira presente e íntegra'],
  ['mangueira-acondicionada', 'Mangueira acondicionada corretamente'],
  ['esguicho-presente', 'Esguicho presente'],
  ['chave-storz', 'Chave storz presente'],
  ['registro-sem-vazamento', 'Registro sem vazamento'],
  ['volante-integro', 'Volante íntegro'],
  ['conexoes-ok', 'Conexões ok'],
  ['sem-corrosao-critica', 'Sem corrosão crítica'],
  ['lacre-presente', 'Lacre presente'],
  ['validade-mangueira', 'Validade da mangueira ok'],
  ['local-limpo', 'Local limpo'],
].map(([key, label]) => ({ key: `hidrante.${key}`, label }));

export const CHECKLIST_ALARME: readonly ChecklistItemDefinition[] = [
  ['acesso-livre', 'Acesso livre'],
  ['sinalizacao-visivel', 'Sinalização visível'],
  ['equipamento-integro', 'Equipamento íntegro'],
  ['identificacao-legivel', 'Identificação legível'],
  ['altura-adequada', 'Altura adequada'],
  ['funcionamento-testado', 'Funcionamento testado'],
  ['comunicacao-central', 'Comunicação com central'],
  ['alarme-operacional', 'Alarme operacional'],
  ['sem-obstrucao', 'Sem obstrução'],
].map(([key, label]) => ({ key: `alarme.${key}`, label }));

export const CHECKLIST_ILUMINACAO: readonly ChecklistItemDefinition[] = [
  ['instalacao-correta', 'Instalação correta'],
  ['estrutura-integra', 'Estrutura íntegra'],
  ['lente-sem-danos', 'Lente sem danos'],
  ['aciona-falta-energia', 'Aciona em falta de energia'],
  ['autonomia-verificada', 'Autonomia verificada'],
  ['bateria-ok', 'Bateria ok'],
  ['sem-fios-expostos', 'Sem fios expostos'],
  ['sem-obstrucao-visual', 'Sem obstrução visual'],
].map(([key, label]) => ({ key: `iluminacao.${key}`, label }));
