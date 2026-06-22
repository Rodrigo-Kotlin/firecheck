-- =============================================================================
-- FireCheck · Remove sync metadata leaked into dados_tecnicos
-- =============================================================================
-- Corrige registros que podem ter recebido metadados de sincronização local
-- dentro do campo `dados_tecnicos` (JSONB) devido a versões anteriores do
-- mapeamento que não filtravam esses campos.
--
-- Idempotente: pode ser re-aplicado sem risco.
-- =============================================================================

update public.equipamentos
set dados_tecnicos =
  dados_tecnicos
    - 'sincronizado'
    - 'pendingDelete'
    - 'syncAction'
    - 'statusUpdatePending'
    - 'syncError'
    - 'deletedAt'
    - 'deletedBy'
    - 'createdAt'
    - 'updatedAt'
where dados_tecnicos is not null
  and (
    dados_tecnicos ? 'sincronizado'
    or dados_tecnicos ? 'pendingDelete'
    or dados_tecnicos ? 'syncAction'
    or dados_tecnicos ? 'statusUpdatePending'
    or dados_tecnicos ? 'syncError'
    or dados_tecnicos ? 'deletedAt'
    or dados_tecnicos ? 'deletedBy'
    or dados_tecnicos ? 'createdAt'
    or dados_tecnicos ? 'updatedAt'
  );

notify pgrst, 'reload schema';
