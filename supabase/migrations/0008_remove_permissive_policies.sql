-- =============================================================================
-- FireCheck · Remove permissive FOR ALL policies (lint fix)
-- =============================================================================
-- Migration 0001 created `p_all_*` policies with USING(true) WITH CHECK(true)
-- on all tables. Migration 0003 dropped them and replaced with `p_auth_*`, and
-- 0007 replaced those with granular per-operation policies.
--
-- If `p_all_*` policies still exist in a given database (migrations may not
-- have been applied sequentially), the Supabase Database Linter warns:
--   "RLS Always True — policy uses USING(true) WITH CHECK(true)"
--
-- This migration definitively removes any leftover permissive policies.
-- It is idempotent and safe to re-run.
-- =============================================================================

-- Remove FOR ALL policies from 0001 (carry-over safety)
drop policy if exists "p_all_equipamentos"   on public.equipamentos;
drop policy if exists "p_all_inspetores"     on public.inspetores;
drop policy if exists "p_all_inspecoes"      on public.inspecoes;
drop policy if exists "p_all_planos"         on public.planos_acao;
drop policy if exists "p_all_fotos"          on public.fotos_inspecao;

-- Remove FOR ALL policies from 0003 (already gone on fresh apply but harmless)
drop policy if exists "p_auth_equipamentos"  on public.equipamentos;
drop policy if exists "p_auth_inspetores"    on public.inspetores;
drop policy if exists "p_auth_inspecoes"     on public.inspecoes;
drop policy if exists "p_auth_planos"        on public.planos_acao;
drop policy if exists "p_auth_fotos"         on public.fotos_inspecao;
