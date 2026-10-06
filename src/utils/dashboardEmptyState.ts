export function getPriorityEmptyStateCopy(hasFilters: boolean) {
  return hasFilters
    ? {
        title: 'Nenhuma prioridade encontrada para os filtros atuais',
        description: 'Ajuste os filtros ou limpe o recorte para consultar todo o universo.',
      }
    : {
        title: 'Nenhuma prioridade identificada',
        description: 'Todos os equipamentos operacionais estão em conformidade.',
      };
}
