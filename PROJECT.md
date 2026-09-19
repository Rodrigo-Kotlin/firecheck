# FireCheck — Memória Técnica do Projeto

> Documento de referência para IAs e desenvolvedores.
> Leia antes de sugerir mudanças ou iniciar novas sessões.
> Última atualização: 2026-09-16 · Prompt 11 (Inspeções compartilhadas, edição, rastreabilidade e conflitos) concluído.

---

## 1. Visão Geral

**FireCheck** é uma PWA (Progressive Web App) **offline-first** para gestão, cadastro, inspeção, QR Code, histórico, planos de ação e relatórios de equipamentos de combate a incêndio (extintores, hidrantes, mangueiras, alarmes, iluminação de emergência, etc.).

- **Público-alvo**: técnicos de manutenção, brigadistas e engenheiros de segurança.
- **Modelo de uso**: local-first. Toda operação (cadastro, inspeção, plano de ação) acontece no navegador e persiste no IndexedDB (Dexie). O Supabase é usado apenas para sincronizar entre dispositivos.
- **Hospedagem**: GitHub Pages (`https://rodrigo-kotlin.github.io/firecheck/`).
- **Idioma da UI, código e commits**: PT-BR.
- **Licença**: MIT.

---

## 2. Objetivo da Aplicação

- Cadastrar equipamentos de combate a incêndio com identificação única por TAG/QR Code.
- Realizar inspeções periódicas e registrar histórico.
- Atualizar status operacional do equipamento via inspeção (RPC segura).
- Gerar e imprimir QR Codes individuais ou em lote.
- Criar planos de ação com criticidade inferida automaticamente.
- Funcionar offline completo — todas as escritas vão para IndexedDB instantaneamente.
- Sincronizar dados entre dispositivos e usuários quando a conexão retorna.
- Preservar rastreabilidade (sem hard delete, sem reuso de TAG).
- Evitar duplicidades e perda de dados.
- Relatórios em PDF com jsPDF + html2canvas.

---

## 3. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Estado | Zustand 5 (com `persist` v3 no localStorage) |
| Banco local | Dexie 4 (IndexedDB, schema v7) |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Estilo | TailwindCSS 4 + design system próprio (`index.css`) |
| Scanner QR | html5-qrcode |
| QR | qrcode (canvas/DataURL) |
| PDF | jsPDF + html2canvas |
| Forms | react-hook-form + zod |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`, autoUpdate, manifest próprio em `public/manifest.json`) |
| Ícones | Lucide React |
| CI/CD | GitHub Actions (`ci.yml` + `deploy.yml`) |
| Deploy | GitHub Pages |

---

## 4. Arquitetura Offline-First

```
┌─────────────────────────────────────────────────────────────┐
│                     UI (React 19)                            │
│   pages/* + components/* + hooks/*                          │
└───────────────────────────┬─────────────────────────────────┘
                           │ estados / eventos
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               Zustand (src/store/index.ts)                   │
│   equipments[], inspections[], actionPlans[], user, etc.    │
│   É a camada de apresentação. Recarrega de Dexie via sync. │
└──────────┬──────────────────────────────────────┬───────────┘
           │ leituras/escritas                     │ persist v3
           ▼                                       ▼
┌──────────────────────────┐              ┌─────────────────────┐
│  Dexie (IndexedDB)       │              │ localStorage        │
│  Fonte primária de dados │              │ firecheck-storage   │
│  v5: equipamentos,       │              │ (config + users)    │
│  inspecoes, planosAcao,  │              │ firecheck-auth-...  │
│  fotos, acoes_pendentes  │              │ (sessão Supabase)   │
└──────────┬───────────────┘              └─────────────────────┘
           │ sync (oportunístico)
           ▼
┌──────────────────────────┐
│  Supabase (PostgreSQL +  │
│  Storage + RLS + Auth)   │
│  public.equipamentos     │
│  public.inspecoes        │
│  public.planos_acao      │
│  public.profiles         │
└──────────────────────────┘
```

### Princípios

- **Dexie/IndexedDB** é a base local principal e fonte primária de dados.
- **Zustand** é estado de UI — recarregado de Dexie após cada sync.
- **Supabase** é fonte remota compartilhada entre dispositivos.
- O app funciona **100% offline** sem Supabase.
- Alterações locais recebem metadados de sync: `sincronizado`, `pendingDelete`, `syncAction`, `syncError`, `statusUpdatePending`.
- O sync faz push local (Dexie → Supabase) e pull remoto (Supabase → Dexie).
- **Nunca usar `clear()` destrutivo** (exceto `clearLocalData()` acionado pelo usuário).
- **Dados pendentes nunca são sobrescritos** por pull remoto.
- **Nunca marcar como sincronizado sem confirmação remota.**

---

## 5. Entidades Principais

### 5.1 Equipment (`src/types/index.ts`)

```ts
interface Equipment {
  id: string;              // TAG oficial (ex.: "EXT-001")
  tipo: string;            // "Extintor", "Hidrante", etc.
  subtipo?: string;
  local: string;
  setor: string;
  status: EquipmentStatus; // 'regular' | 'pendente' | 'vencido' | ...
  pavimento?: string;
  fabricante?: string;
  numSerie?: string;
  // ... dezenas de campos opcionais por tipo de equipamento
  dataProximaInspecao?: string;
  dataUltimaInspecao?: string;
  qrcode?: string;         // sempre igual a id (compatibilidade)
  qrCode?: string;         // sempre igual a id (compatibilidade)
  fotoUrl?: string;
  observacoes?: string;
  dadosTecnicos?: Record<string, string | number | boolean | null>;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  pendingDelete?: boolean;  // local only, never persists
  syncError?: string;       // local only (ex.: 'duplicate')
  statusUpdatePending?: boolean; // local only
}
```

**Decisão arquitetural**: `id` é a TAG oficial do equipamento (ex.: `EXT-001`). `qrCode` e `qrcode` são mantidos apenas para compatibilidade e refletem o mesmo valor de `id`. Futura evolução recomendada: `id UUID` + `tag TEXT UNIQUE`.

### 5.2 Inspection

```ts
interface Inspection {
  id: string;               // "INSP-{UUID}"
  equipmentId: string;      // ref. Equipment.id
  data: string;             // ISO date (civil YYYY-MM-DD)
  inspetor: string;         // responsável original — imutável após criação
  status: EquipmentStatus;
  observacoes?: string;
  userId?: string;          // quem criou (gravado como `user_id` no insert)
  createdAt?: string;
  updatedAt?: string;       // última alteração remota (base do CAS)
  updatedBy?: string;       // quem editou por último
  updatedByName?: string;   // nome legível do responsável pela alteração
  // flags de sync (local only, não persistem no Supabase):
  syncConflict?: boolean;
  syncConflictReason?: string;
  remoteUpdatedAtAtConflict?: string;
  syncError?: string;
  syncBaseUpdatedAt?: string;
}
```

Inspeções atualizam o status operacional do equipamento via RPC segura (`apply_equipment_inspection_status` / `recalculate_equipment_from_latest_inspection`). Se o status for `vencido` ou `pendente`, um plano de ação é criado automaticamente.

**Modelo compartilhado (Prompt 11)**: inspeções são visíveis e editáveis por
qualquer admin/inspetor (não mais atreladas ao criador). A edição preserva o
responsável original (`inspetor`/`user_id`/`created_at`) e registra
`updated_by`/`updated_by_name`/`updated_at` para rastreabilidade. DELETE é
restrito a admin. O gate de escrita usa CAS (compare-and-set) por
`updated_at`; edição offline é enfileirada e conflitos são sinalizados
(`syncConflict`) com resolução "manter local" ou "usar servidor".

### 5.3 ActionPlan

```ts
interface ActionPlan {
  id: string;               // "PAC-{timestamp}-{random}"
  equipmentId: string;
  local: string;
  descricao: string;
  criticidade: Criticidade; // 'Crítico' | 'Alto' | 'Médio' | 'Baixo'
  responsavel: string;
  prazo: string;
  status: ActionPlanStatus; // 'Aberta' | 'Em andamento' | 'Concluída' | 'Vencida'
  createdAt: string;
  userId?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}
```

Planos de ação foram migrados do Zustand/localStorage para Dexie, com push/pull completo, soft delete e reconciliação entre dispositivos.

### 5.4 UserProfile

```ts
interface UserProfile {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. Supabase e Segurança

### Autenticação

- **Supabase Auth** com senha + recovery OTP por e-mail.
- Sessão gerenciada pelo client Supabase, persistida em `localStorage['firecheck-auth']`.
- Refresh automático a cada ~50min.
- Login/registro/recovery exigem rede (identidade está no Supabase); dados continuam offline-first.

### Fluxo de identidade

```
auth.users (Supabase Auth, bcrypt, JWT)
  │ 1:1
  ▼
public.profiles (trigger handle_new_user cria no signup)
  ├─ id, email, nome, cargo, role, created_at
  └─ RLS: select autenticado / update self (sem role) / update admin / delete admin (exceto self)
```

- **Primeiro usuário** a se cadastrar vira admin (trigger). Demais são `inspector`.
- **E-mail** é case-insensitive (normalizado no client) e único globalmente.
- **Política de senha** (client-side): ≥ 8 caracteres, 1 letra, 1 dígito.

### Tabelas principais

| Tabela | Finalidade |
|--------|-----------|
| `public.equipamentos` | Cadastro de equipamentos |
| `public.inspecoes` | Histórico de inspeções |
| `public.planos_acao` | Planos de ação |
| `public.profiles` | Perfis de usuário (1:1 com auth.users) |
| `storage.buckets` | Bucket `fotos` para upload de imagens |

### RLS (Row Level Security)

Todas as policies exigem `auth.role() = 'authenticated'`. A edição cadastral do equipamento é restrita a admin/dono (`eq.createdBy = auth.uid()`). A atualização operacional por inspeção (status, datas) é permitida via RPC `apply_equipment_inspection_status` (SECURITY DEFINER).

### Matriz de permissões

| Ação | Admin | Inspector (dono) | Inspector (outro) | Sem login |
|------|-------|-----------------|-------------------|-----------|
| `canEdit/Delete Equipment` | ✅ | ✅ se `createdBy === user.id` | ❌ (read-only) | ❌ |
| `canEdit/Delete Inspection` | ✅ | ✅ (editar qualquer) | ✅ (editar qualquer) | ❌ |
| `canDeleteInspection` (exclusão de relatório) | ✅ somente admin | ❌ | ❌ | ❌ |
| `canEdit/Delete ActionPlan` | ✅ | ✅ se `userId === user.id` | ❌ | ❌ |
| `canManageUsers` | ✅ | ❌ | ❌ | ❌ |

**Nota (Prompt 11)**: a edição de inspeção passou a ser compartilhada
(admin/inspector) — `canEditInspection(user, inspection)` não considera
ownership. A exclusão de inspeção permanece exclusiva de admin
(`canDeleteInspection`). O write remoto ainda exige `updated_by`/`user_id`
coerentes (RLS + trigger `inspecoes_audit`).

**Nunca expor `.env`, tokens ou chaves.** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são configuradas via variáveis de ambiente GitHub Pages.

---

## 7. Migrations Supabase

As migrations ficam em `supabase/migrations/`. **Nunca editar migrations antigas depois de aplicadas** — criar nova migration.

| Migration | Finalidade | Observação |
|-----------|-----------|------------|
| `0001_init_schema.sql` | Tabelas `equipamentos`, `inspecoes`, `inspetores` + RLS permissivo + bucket `fotos` + triggers | Idempotente |
| `0002_seed_data.sql` | Dados de exemplo (inspetores, equipamentos) | Seed inicial |
| `0003_supabase_auth.sql` | `profiles`, `is_admin()`, RPC `admin_delete_user`, RLS auth | Idempotente |
| `0004_add_modelo_extintor.sql` | Coluna `modelo_extintor` em equipamentos | Aditiva |
| `0005_add_equipment_fields.sql` | Campos operacionais + `qr_code` (legado como `qrcode`) | Aditiva |
| `0006_fix_equipamentos_rls.sql` | Corrige políticas RLS de equipamentos | Corretiva |
| `0007_security_linter_fixes.sql` | Ajustes de segurança detectados por linter | Corretiva |
| `0008_remove_permissive_policies.sql` | Remove `FOR ALL` policies permissivas | Corretiva |
| `0009_add_dados_tecnicos_equipamentos.sql` | Coluna `dados_tecnicos` (JSONB) + coluna `qr_code` (text) | Aditiva |
| `0010_add_soft_delete_to_equipamentos.sql` | Soft delete com `deleted_at`, `deleted_by` + ajuste RLS | Aditiva |
| `0011_apply_equipment_inspection_status.sql` | RPC `apply_equipment_inspection_status` (SECURITY DEFINER) | Aditiva |
| `0012_clean_sync_metadata_from_dados_tecnicos.sql` | Remove metadados de sync vazados em `dados_tecnicos` | Corretiva |
| `0013_add_soft_delete_to_planos_acao.sql` | `deleted_at`, `deleted_by` em planos_acao | Aditiva |
| `0014_normalize_equipment_qrcode_fields.sql` | Normaliza `qr_code` para refletir `id` (TAG oficial) | Corretiva (Prompt 05) |
| `0015_create_soft_delete_equipment_rpc.sql` | RPC de soft delete de equipamento | Aditiva |
| `0016_harden_soft_delete_equipment_rpc.sql` | Reforço de segurança do RPC de soft delete | Corretiva |
| `0017_fotos_inspecao_storage_policies.sql` | Fotos de inspeção: bucket `inspection-photos` + policies por pasta/owner + colunas `mime_type/size_bytes/created_by` | Aditiva (Prompt 09) |
| `0018_shared_inspection_permissions_and_audit.sql` | Inspeções compartilhadas: colunas `updated_by`/`updated_by_name` + trigger de auditoria `inspecoes_audit` (imutáveis + `updated_at`/`updated_by`/`updated_by_name`), autores (quem edita = `updated_by`, quem cria = `user_id` fixado), RLS SELECT/INSERT/UPDATE (admin e inspetores) e DELETE (admin apenas), SELECT de `fotos_inspecao` e do Storage compartilhado via `can_access_inspection(inspection_id)`, remoção defensiva das policies amplas de Storage, RPC `recalculate_equipment_from_latest_inspection` (ordem data/created_at/id, `UNAUTH`/`PFORB`/`NOEQPT`/`BADTRIG`, `p_next` só pela vencedora) | Aditiva (Prompt 11/12) |

> A dependência futura descrita na versão anterior deste arquivo (autorizar fotos
> por permissão sobre a inspeção, e não por pasta/owner) foi implementada na
> migration `0018`: a policy `p_fotos_select` e a policy de Storage
> `p_storage_select_shared` usam `can_access_inspection()` (join de
> `fotos_inspecao.storage_path` com `storage.objects.name`) para liberar a
> leitura das fotos quando o usuário pode ver a inspeção correspondente.

### Fotos de inspeção

- Blob no Dexie;
- ObjectURL no preview (`URL.createObjectURL`, revogada em troca/remoção/unmount);
- Storage remoto (`inspection-photos`, bucket não-público);
- retry idempotente;
- storagePath persistido antes do metadata upsert;
- Base64 somente legado (`legacyBase64`, `blobToDataUrl`/`dataUrlToBlob` mantidos);
- migration atual das fotos = `0017`;
- próxima migration disponível = `0019`;
- fotos compartilhadas entre contas liberadas via `can_access_inspection()` (migration `0018`);
- download remoto de fotos sob demanda (`downloadInspectionPhoto`) com cache local em Blob — UI em `DetalheInspecao.tsx`.

---

## 8. Problemas Críticos Já Encontrados e Corrigidos

### 8.1 Duplicidade de inspeções

- **Causa**: persistência duplicada em `Inspecionar.tsx` (gravação direta Dexie + chamada `addInspection`) + duplo clique no botão finalizar.
- **Correção**: `addInspection` virou ponto único de escrita; `isSaving` bloqueia reentrância; ID único com `crypto.randomUUID()`; trava de sync.

### 8.2 Equipamentos excluídos continuavam aparecendo

- **Causa**: hard delete remoto sem tombstone; outros clientes mantinham registro no IndexedDB.
- **Correção**: soft delete com `deleted_at`; pull respeita tombstone (migration `0010`); reconciliação de órfãos.

### 8.3 Auto-sync não atualizava UI sem F5

- **Causa**: pull atualizava Dexie, mas Zustand/tela não recarregava.
- **Correção**: `useAutoSync` (foco, visibilidade, online, intervalo); Zustand recarregado de Dexie após sync.

### 8.4 TAG duplicada e falso sucesso

- **Causa**: TAG validada apenas no Zustand (não em Dexie/Supabase); uso de `upsert` perigoso; sucesso exibido antes de confirmação remota.
- **Correção**: normalização de TAG (`normalizeTag`); validação em Zustand + Dexie + Supabase; `insert` para criação, `update` para edição; `syncAction`; QR = TAG.

### 8.5 RLS bloqueava atualização de status por inspeção

- **Causa**: RLS permitia update apenas a admin/dono; inspeção de usuário comum alterava status local e não persistia remotamente.
- **Correção**: RPC `apply_equipment_inspection_status` (SECURITY DEFINER, migration `0011`); flag `statusUpdatePending`; `pushInspections()` chama RPC após enviar inspeção.

### 8.6 Pull vazio deixava itens fantasmas

- **Causa**: `pullEquipments()` e `pullInspections()` retornavam antes da reconciliação quando remoto vinha `[]`.
- **Correção**: `FetchResult` com `ok` + `data`; pull diferencia erro remoto de resposta vazia válida; reconcilia órfãos.

### 8.7 Metadados vazavam para `dados_tecnicos`

- **Causa**: objetos locais com `sincronizado`, `pendingDelete` etc. iam para o mapper remoto.
- **Correção**: `stripSyncMeta()`; `SYNC_META_FIELDS`; migration `0012` para limpar dados contaminados.

### 8.8 Planos de ação eram locais por dispositivo

- **Causa**: ficavam no Zustand/localStorage; não havia pull; `fetchActionPlans()` não era chamado.
- **Correção**: migração para Dexie (schema v5); push/pull completos; soft delete; contador de pendências; migration `0013`.

### 8.9 QR Code e rastreabilidade da TAG

- **Causa**: `qr_code` no Supabase podia divergir de `id` (TAG); scanner buscava apenas no Zustand; equipamentos excluídos podiam ser encontrados.
- **Correção (em andamento, Prompt 05)**: utilitário `equipmentIdentity.ts` com funções centralizadas; `syncEquipmentQrFields()` aplicado em pull/loader; `equipmentToDb` sempre usa `id` para `qr_code`; scanner busca em Zustand → Dexie → Supabase, rejeita `pendingDelete`/`deletedAt`; migration `0014`.

---

## 9. Histórico de Correções por Prompt

### Prompt 01 — TAG única, create/update e falso sucesso

**Branch**: `fix/firecheck-01-tag-unica-create-update`  
**Status**: concluído  
**Principais entregas**:
- `normalizeTag()` em `tagGenerator.ts`
- Validação local (Zustand + Dexie) e remota (Supabase) de TAG duplicada
- `createEquipmentRemote()` com `insert`
- `updateEquipmentRemote()` com `update`
- `syncAction` ('create' | 'update' | 'delete')
- QR Code = TAG
- Scanner busca por identidade normalizada

### Prompt 02 — RLS e status por inspeção

**Branch**: `fix/firecheck-02-rls-status-inspecao`  
**Status**: concluído  
**Principais entregas**:
- Migration `0011` com RPC `apply_equipment_inspection_status`
- `applyEquipmentInspectionStatusRemote()`
- Flag `statusUpdatePending`
- `pushInspections()` chama RPC após enviar inspeção

### Prompt 03 — Pull vazio, órfãos e metadados

**Branch**: `fix/firecheck-03-pull-reconciliacao-metadados`  
**Status**: concluído  
**Principais entregas**:
- `FetchResult<T>` com `ok` + `data`
- Pull diferencia erro de resposta vazia
- Reconciliação de órfãos locais
- Migration `0012` para limpar metadados contaminados em `dados_tecnicos`

### Prompt 04 — Planos de ação no Dexie e sync completo

**Branch**: `fix/firecheck-04-planos-acao-dexie-sync`  
**Status**: concluído  
**Principais entregas**:
- Dexie schema v5 com tabela `planosAcao`
- Migração automática de localStorage → Dexie (uma vez)
- `pushActionPlans()` com create/update/soft delete
- `pullActionPlans()` com reconciliação
- `pendingSyncCount()` incluindo planos
- Migration `0013` (colunas `deleted_at`, `deleted_by`)

### Prompt 05 — QR Code, scanner e rastreabilidade

**Branch**: `fix/firecheck-05-qrcode-scanner-rastreabilidade`  
**Status**: em andamento  
**Principais entregas**:
- `src/utils/equipmentIdentity.ts` com `normalizeEquipmentTag()`, `syncEquipmentQrFields()`, `matchesEquipmentIdentity()`, etc.
- `equipmentToDb()` sempre usa `eq.id` para `qr_code` (migration `0014`)
- `syncEquipmentQrFields()` aplicado em `carregarEquipamentos()` e `pullEquipments()`
- Scanner (`ScanQr.tsx`) busca em 3 camadas (Zustand → Dexie → Supabase), rejeita excluídos
- Migration `0014_normalize_equipment_qrcode_fields.sql`

### Prompt 06 — Auto-sync confiável, atualização de Zustand e logs de diagnóstico

**Branch**: `fix/firecheck-06-auto-sync-confiavel`  
**Status**: concluído  
**Objetivo**: validar auto-sync real entre dispositivos; confirmar atualização de Zustand sem F5; logs DEV; possivelmente Supabase Realtime.

**Problema identificado**:  
O auto-sync não disparava na montagem do hook `useAutoSync` — apenas registrava listeners de foco/visibilidade/online/intervalo, mas nunca chamava sync na inicialização. Além disso:
- A constante `isOnline` era congelada em tempo de render (não reativa), fazendo o hook ignorar mudanças de conectividade.
- Havia listener `online` duplicado no store (sem throttle), competindo com o hook.
- A variável `pushApErrors` em `syncAll` era `const = 0` (nunca recebia erros reais).

**Correções aplicadas**:

1. **`useAutoSync.ts`** — reescrito com:
   - `triggerAutoSync('mount')` na montagem do hook.
   - `useSyncExternalStore` para `isOnline` reativo.
   - Throttle de 8s entre execuções.
   - Logs DEV detalhados por trigger, skip, início e conclusão.
   - Limpeza completa no unmount.

2. **`store/index.ts`** — removido listener `online`/`offline` duplicado (linhas 800-808). O hook centraliza todos os gatilhos automáticos.

3. **`sync.ts`** — corrigido bug: `pushApErrors` agora é `let` e recebe `apR.errors`. Adicionados logs DEV detalhados por fase (push equipamentos/inspeções/planos, pull equipamentos/inspeções/planos) com contagem e identificação dos itens.

4. **Gatilhos do auto-sync**: mount, focus, visibility, online, interval (30s).  
   **Throttle**: 8s mínimo entre execuções.  
   **Trava de concorrência**: `_syncInProgress` no módulo sync (já existente).  
   **Atualização de Zustand**: `runSync()` no store recarrega equipamentos/inspeções/planos do Dexie após `syncAll()` e chama `set()` com os dados frescos.

---

### Prompt 07 — Controle básico de conflito por updated_at

**Branch**: `fix/firecheck-07-controle-conflitos-updated-at`  
**Status**: concluído  
**Objetivo**: impedir que alterações offline sejam enviadas cegamente ao servidor quando outro dispositivo já modificou o mesmo registro; preservar alterações locais em conflito; notificar usuário via badge.

**Problema identificado**:  
O push não verificava se o registro remoto foi alterado desde a última sincronização. Um dispositivo A podia editar offline, dispositivo B editava online, e ao sincronizar A, seu cambio sobrescrevia o de B sem aviso. Pull também não registrava a versão base dos registros importados.

**Solução implementada**:

1. **Modelo de dados (`db/index.ts`)**:
   - `LocalEquipment` e `LocalActionPlan` ganharam campos: `syncBaseUpdatedAt`, `syncConflict`, `syncConflictReason`, `remoteUpdatedAtAtConflict`.

2. **Mappers (`services/mappers.ts`)**:
   - `SYNC_META_FIELDS` e `stripActionPlanSyncMeta` incluem os novos campos.

3. **Serviço remoto (`equipmentService.ts`, `actionPlanService.ts`)**:
   - `ServiceResult` tornou-se genérico `ServiceResult<T = Equipment>`.
   - `fetchEquipmentById` e `fetchActionPlanById` retornam `ServiceResult` com `code: 'not_found'` quando o registro não existe no servidor.

4. **Push (`sync.ts`)**
   - `pushEquipments` e `pushActionPlans`: antes de update/delete, buscam o registro remoto e comparam `syncBaseUpdatedAt` com `updated_at` remoto.
   - Se diferente: marca `syncConflict: true`, `syncError: 'conflict'`, `sincronizado: false`, não envia a alteração, não incrementa `errors` (conflito é condição controlada).
   - Se remoto não existe: converte update em create.
   - Create: registra `syncBaseUpdatedAt` após sucesso.
   - Delete: reconcilia se já deletado remotamente.

5. **Pull (`sync.ts`)**
   - `pullEquipments` e `pullActionPlans`: pulam registros com `syncConflict: true` (não sobrescrevem conflito local).
   - Registram `syncBaseUpdatedAt` no momento da importação.

6. **Store (`store/index.ts`)**:
   - `stripSyncMeta` no `runSync` inclui novos campos.
   - `refreshConflictCount` expõe contagem de conflitos por entidade.
   - `conflictCounts` no estado Zustand.

7. **UI de conflito**:
   - Badge "Conflito" (ícone `AlertOctagon`) nos cards de equipamentos e planos de ação quando `syncConflict === true` ou `syncError === 'conflict'`.
   - Alerta expandido na tela de detalhes do equipamento com motivo, timestamps (local base, remoto no conflito, local atual) e orientação.
   - Painel de conflitos no Dashboard com botões de atalho para equipamentos/planos em conflito.
   - Indicador de conflitos no Sidebar (área de status do Supabase) com contagem total.
   - `conflictCounts` (`{ equipments: number; actionPlans: number }`) no estado Zustand, populado por `refreshConflictCount()`.
8. **Riscos remanescentes**:
   - Nenhum merge visual avançado implementado — conflito apenas detectado e bloqueado.
   - Resolução manual requer que o usuário faça o equipamento "vencer" o conflito (ex.: editar e forçar sync, ou usar o botão "Resolver" — ainda não implementado).
   - Inspeções estão fora de escopo para conflito (append-only).

**Limitações sem Realtime**:  
O auto-sync não é instantâneo — depende de eventos de foco/visibilidade/online/intervalo. Supabase Realtime pode ser avaliado como evolução futura para propagação imediata.

---

### Prompt 08 — Resolução manual de conflitos + auditoria PWA/cache

**Branch**: `fix/firecheck-08-resolucao-manual-conflitos`

**Objetivo**: Implementar resolução manual de conflito (manter local / usar servidor) para equipamentos e planos de ação; adicionar UI de resolução nos cards e detalhes; realizar auditoria final de regressão (migrations, PWA, listeners, lint, build).

**Mudanças realizadas**:

1. **Resolução manual de conflito**:
   - `resolveEquipmentConflictKeepLocal(id)`: sobrescreve remoto com dados locais via `updateEquipmentRemote`; limpa flags de conflito e marca `sincronizado: true`.
   - `resolveEquipmentConflictUseRemote(id)`: busca remoto via `fetchEquipmentById`, substitui local no Dexie, limpa flags de conflito e marca `sincronizado: true`.
   - `resolveActionPlanConflictKeepLocal(id)`: análogo para planos de ação via `updateActionPlanRemote`.
   - `resolveActionPlanConflictUseRemote(id)`: busca remoto via `fetchActionPlanById`, substitui local no Dexie.
   - Se a resolução "usar servidor" falha com `not_found`, a UI exibe o erro e o conflito permanece.
   - Logs DEV com prefixo `[conflict-resolution]`.
   - Toast de sucesso/erro após cada tentativa.

2. **UI de resolução**:
   - `DetalhesEquipamento.tsx`: dois botões (`"Manter minha versão"` / `"Usar versão do servidor"`) no alerta de conflito, com `confirm()` antes da ação.
   - `PlanoDeAcao.tsx`: mesmos botões no card do plano, exibidos quando `syncConflict || syncError === 'conflict'`.
   - Botões seguem o padrão visual do app (bg-red-600 white / bg-white border-red-200 critical).

3. **Auditoria de migrations** (14 arquivos, Supabase):
   - Todas as migrations são idempotentes (usam `IF NOT EXISTS`, `OR REPLACE`, `IF EXISTS`).
   - Nenhuma migration altera schema de forma destrutiva após 2025.
   - Nenhuma migration antiga foi editada.

4. **Auditoria SW/PWA**:
   - `vite.config.ts`: Supabase configurado como `NetworkOnly` no runtime caching.
   - `navigateFallback: 'index.html'` (relativo — resolve contra o scope do SW, funciona em `/` e `/firecheck/`); `cleanupOutdatedCaches: true`. Evita o erro Workbox `non-precached-url :: [{"url":"/"}]`.
   - `manifest.json`: `display: standalone`, ícones 16–512px, `start_url: '.'`, cores definidas.

5. **Auditoria de listeners**:
   - `useAutoSync.ts` é o único ponto central de listeners (`online`, `offline`, `visibilitychange`).
   - Store não adiciona listeners `online`/`offline` duplicados.
   - `onAuthStateChange` do Supabase nunca é removido pois o SDK gerencia o ciclo de vida.
   - Nenhum vazamento de listener identificado.

6. **Cobertura de conflitos**:
   - `conflictCounts` (`{ equipments: number; actionPlans: number }`) no estado Zustand.
   - `refreshConflictCount()` chamado em `hydrate` e `runSync`.
   - `conflictCount()` em `sync.ts` conta registros com `syncError === 'conflict' && !sincronizado`.
   - Conflito não incrementa `errors` no relatório de sync.

7. **Riscos remanescentes**:
   - Nenhum merge visual avançado (campo a campo) implementado — resolução é binária "tudo local" ou "tudo servidor".
   - Resolução com falha de rede não limpa conflito — registro permanece `sincronizado: false`.
   - Inspeções permanecem fora de escopo (append-only).
   - Não há Supabase Realtime — conflito só é detectado durante pull, não em tempo real.

`npm run lint`: 0 erros, 1 warning pré-existente (NovoEquipamento.tsx:278 — `react-hooks/incompatible-library`).
`npm run build`: tsc + vite build sem erros; PWA gera sw.js com Workbox.

**Pós-auditoria**: 12 `console.log`/`warn` informacionais em `sync.ts` sanitizados — envolvidos em `if (import.meta.env.DEV)`. `console.error` de erros reais mantidos em produção. (Commit `fe9507f`.)

---

### 8. Atualização pós-auditoria — Seleção de inspetor nas inspeções

**Data**: 2026-06-22 · **Branch**: `fix/firecheck-08-resolucao-manual-conflitos`

**Contexto**: Com o login compartilhado (usuário padrão para todos os inspetores), o campo `inspetor` era populado automaticamente com `user?.nome || 'Inspetor'`, impossibilitando identificar qual inspetor de fato realizou a inspeção.

**Solução**:
1. **`src/config/inspectors.ts`** — arquivo de configuração com os 4 inspetores fixos (ALLAN HENNING, DANILLO UCHÔA, DAVID HILL, YWERNG SOUZA).
2. **`Inspecionar.tsx`** — select obrigatório "Inspetor Responsável" inserido entre a escolha do equipamento e a data de validade, com placeholder `Selecione o inspetor responsável`.
3. **Validação** — impede submeter sem selecionar um inspetor.
4. **Persistência local** — último inspetor escolhido salvo em `localStorage` (`firecheck_last_inspector_name`) para pré-preenchimento na próxima inspeção.
5. **Valor remoto** — `inspetor` agora envia o nome selecionado em vez de `user?.nome`.
6. **Nenhuma migration necessária**: a coluna `inspetor text` já existe em `public.inspecoes` desde a migration `0001_init_schema.sql`.

**Arquivos alterados**:
- `src/config/inspectors.ts` (criado)
- `src/pages/inspecionar/Inspecionar.tsx` (modificado)

**Fallback em UI de histórico/relatórios**: `inspecao.inspetor || profile.nome || user.email || 'Não informado'` — não implementado nesta etapa pois o fluxo existente já exibe `insp.inspetor` diretamente (válido tanto para inspeções novas quanto antigas).

### Prompt 09 — Fotos de inspeção (captura Blob + Storage + hardening pre-merge)

**Branch**: `fix/firecheck-fotos-inspecao`  
**Status**: concluído  
**Objetivo**: estabilizar captura, compressão (Blob, sem Base64 no novo fluxo), persistência local (Dexie v6) e sincronização (Supabase Storage + `fotos_inspecao`) das fotos de inspeção.

**Principais entregas**:
- `compressInspectionImage()` (Blob pipeline) com `createImageBitmap` + orientação EXIF, resize para 1280px, cap de 25 MP no canvas, WebP com fallback JPEG e loop de qualidade ≤ 800 KB.
- Schema Dexie v6: `LocalInspectionPhoto` (`blob`, `sincronizado`, `syncAction`, `storagePath`); upgrade migra fotos `base64` → `legacyBase64` e as marca pendentes de sync.
- `addInspection()` com transação `'rw'` atômica (inspeção + foto + equipamento) e `SaveInspectionResult` — sucesso só é reportado após o commit; em rollback a mensagem é única ("Nenhuma alteração foi concluída").
- `pushInspectionPhotos()` / `pullInspectionPhotos()`: push eq → ins → fotos → planos; `storagePath` persistido no Dexie imediatamente após o upload (retry só refaz o upsert de metadados); `sincronizado` só após storage + metadados confirmados.
- Preview via Object URL (`URL.createObjectURL`) com revogação em troca/remoção/unmount; Base64 somente legado.
- Migration `0017` (bucket `inspection-photos` + policies por pasta/owner + colunas de metadados). Próxima migration disponível = `0018`.
- Extensão de Storage derivada do MIME (`mimeToExtension`: jpeg→.jpg, webp→.webp, png→.png).
- Zustand só é atualizado após o commit da transação Dexie.

**Riscos registrados**: fotos 48 MP precisam validação em dispositivo real (cap limita o canvas, não o decode inicial); compartilhamento de fotos entre contas depende do futuro modelo de inspeções compartilhadas; download remoto sob demanda ainda sem UI (pull é metadata-only).

`npm run lint`: 0 erros, 2 warnings pré-existentes (NovoEquipamento e EditarEquipamento — `react-hooks/incompatible-library` no `watch()` do RHF).  
`npm run build`: tsc + vite build sem erros.

---

### Prompt 10 — Dashboard clicável e filtros (KPIs confiáveis + drill-down)

**Branches**: `fix/firecheck-fotos-inspecao` (base consolidada) → `feat/firecheck-dashboard-filtros`  
**Status**: concluído  
**Objetivo**: transformar os cards do Dashboard em KPIs operacionais clicáveis (CADASTRADOS, INSPECIONADOS, EM DIA, PENDENTES) que abrem `/equipamentos?view=...`, com fonte única de verdade garantindo contagem do card == contagem da lista.

**Principais entregas**:
- `src/utils/equipmentFilters.ts` (criado): selectors puros compartilhados por Dashboard e `Equipamentos.tsx` — `getEquipmentDashboardGroups()`, `getLatestInspectionForEquipment()`, `getDashboardGroupByView()`, `isEquipmentDashboardView()`, `EquipmentDashboardView` (`registered | inspected | up-to-date | pending`).
- **Definições finais** (matriz real `EquipmentStatus`):
  - Ativo = sem `pendingDelete` e sem `deletedAt`.
  - CADASTRADOS = todos os ativos.
  - INSPECIONADOS = ativos com ≥ 1 inspeção (distintos).
  - EM DIA = ativo + tem inspeção + última condição `regular` + próxima inspeção não vencida (`status === 'regular'` sozinho não basta).
  - PENDENTES = ativo + (nunca inspecionado OU última condição `pendente`/`vencido` OU próxima inspeção vencida). Disjunto de EM DIA por construção.
- **Data civil**: comparações em `YYYY-MM-DD` (string) — `normalizeYmd()`/`getTodayYmd()` evitam o bug de fuso do `new Date('YYYY-MM-DD')`.
- Dashboard: 4 cards clicáveis via `<Link>` (aria-label, hover, `focus-visible`, botão "Ver equipamentos →") apontando para `/equipamentos?view=...`.
- `Equipamentos.tsx`: lê `view` (inválida é ignorada), título contextual ("Em dia", "Pendentes"…), contador `X de Y itens`, botão "Limpar filtro" (remove só `view`, preserva `q`), busca movida para query `?q=` aplicada SOBRE o conjunto do view, chips de categoria existentes mantidos, empty states por visão, breadcrumb de contagem refletindo `filtered.length`.
- Nenhuma gravação de status, nenhuma migration (0018 continua reservada), nenhuma alteração em fotos/sync/RPC/RLS.

**Nota (limitação documentada)**: a entidade `Inspection` não possui `createdAt` na app — o desempate de "última inspeção" com mesma data usa `id` (determinístico e constante entre Dashboard e lista).

`npm run lint`: 0 erros, 2 warnings pré-existentes (mesmos do Prompt 09).  
`npm run build`: tsc + vite build sem erros.

---

### Prompt 11 — Inspeções compartilhadas, edição, rastreabilidade e conflitos

**Branch**: `feat/firecheck-inspecoes-compartilhadas`  
**Status**: concluído  
**Objetivo**: permitir que qualquer admin/inspetor visualize e edite qualquer inspeção (não apenas a própria), com edição offline-first protegida por CAS (compare-and-set via `updated_at`), rastreabilidade de quem editou e quando, exclusão exclusiva de admin, fotos compartilhadas sob demanda, e UI de conflito com resolução manual — sem regressão de status por edição de inspeção antiga e sem merge automático.

**Problema identificado (diagnóstico)**: inspeções eram append-only e a edição era exclusiva do criador; os datilografados de `SomenteLeitura` impediam alterações; editar uma inspeção antiga via UPDATE simples reordenaria a lista por `updated_at` inválido ou poderia regredir o status do equipamento; fotos eram protegidas por pasta/owner (incompatível com inspeções compartilhadas); conflitos de inspeção eram ignorados pelo sync (append-only).

**Migration `0018`** (idempotente):
- Colunas `updated_by uuid`, `updated_by_name text` em `public.inspecoes` + índices.
- `is_inspector_or_admin()` (papel em `profiles.role`); `can_access_inspection(p_inspection_id text)` (inspeção existe + usuário autorizado). No Storage, a policy compartilhada casa `fotos_inspecao.storage_path = storage.objects.name` e então chama o helper pelo `inspection_id`.
- Trigger `inspecoes_audit`: BEFORE INSERT força `user_id = auth.uid()` e `created_at`; BEFORE UPDATE grava `updated_at = now()`, `updated_by = auth.uid()`, `updated_by_name = coalesce(new, old)` e RAISE `IMMUT` exceção se `id/equipment_id/user_id/inspetor/created_at` mudarem.
- RLS inspecoes: SELECT/INSERT (admin + inspetores), UPDATE (mesmo autores, sem ownership), DELETE (admin apenas). Novas RLS destruídas e recriadas (drop policy if exists) para segurança.
- Storage `inspection-photos`: policy compartilhada `p_storage_select_shared` via `can_access_inspection`.
- RPC `recalculate_equipment_from_latest_inspection(p_equipment_id, p_next_inspection_date, p_trigger_inspection_id)` — recalcula status/datas pela inspeção mais recente com ordem determinística **`data DESC, created_at DESC, id DESC`** (`updated_at` NÃO define cronologia operacional); valida autenticação (`UNAUTH`), `is_inspector_or_admin()` (`PFORB`), existência do equipamento (`NOEQPT`) e que o trigger existe e pertence ao equipamento (`BADTRIG`); aplica `p_next` só quando `p_next IS NOT NULL AND p_trigger IS NOT NULL AND p_trigger = vencedora`; equipamento soft-deleted → `applied:false` (não ressuscita status); sem inspeções → `applied:false`. `revoke ... from public` + `grant execute ... to authenticated`.
- Storage: além da policy compartilhada, remove defensivamente as policies legadas amplas `p_storage_select/insert/update/delete` (0001/0003) — em banco com 0017 aplicada é no-op; mutações seguem owner/admin.

**Frontend**:
- `Inspection` ganhou campos de auditoria e de conflito (`types/index.ts`); `LocalInspection` estendida + **Dexie v7** (índices `syncAction, syncConflict, updatedAt`) com upgrade vazio preservando dados.
- `permissions.ts`: `canViewInspection`/`canEditInspection` (role-based, sem ownership) e `canDeleteInspection` (admin-only).
- `inspectionService.ts`: `upsertInspection` com `select().maybeSingle()`; `fetchInspectionById`; `fetchInspectionRowById`; `updateInspectionRemote` (CAS com distinção `conflict`/`not_found`); `recalculateEquipmentFromLatestInspectionRemote`; `carregarInspecoes` grava `syncBaseUpdatedAt`.
- `sync.ts`: `pushInspections` reescrito (create com upsert+returning + recalc RPC com `p_next`/`p_trigger`; update via CAS + recalc; delete com pré-checagem de conflito + row-confirm + recalc; `markConflict`; `reconcileStaleStatusFlags` para limpar `statusUpdatePending` órfão); `pullInspections` grava base e preserva linhas em conflito/pendentes.
- `photoService.ts`: `downloadInspectionPhoto(storagePath)` — download remoto sob demanda com cache Blob (sem tocar flags de sync).
- Páginas: `DetalheInspecao.tsx` (read-only com rastreabilidade, banner de conflito com KeepLocal/UseRemote e fotos sob demanda) e `EditarInspecao.tsx` (data civil com regex `^\d{4}-\d{2}-\d{2}$`, status 4 opções, observações, editor obrigatório com prefill localStorage) + rotas `/inspecoes/:id` e `/inspecoes/:id/editar` em `App.tsx`.
- `DetalhesEquipamento.tsx`: badge "Editada", linha "Editada por", Eye → detalhe da inspeção e lápis → editar.
- `Relatorios.tsx`: pill "Conflito" + botões de resolução no histórico; `Dashboard.tsx`/`Sidebar.tsx`: `conflictCounts.inspections`.
- `store/index.ts`: `updateInspection` (`InspectionSaveResult {ok, mode:'local'|'cloud', conflict?, message?}`) com **pipeline único** — persiste Dexie/Zustand, dispara `await runSync()` e relê `db.inspecoes.get(id)` para decidir `cloud`/`conflict`/`local` (sem writer direto concorrente); `deleteInspection` é `async` e segue a ordem obrigatória (Dexie `pendingDelete`/`syncAction:'delete'` → Zustand → `await runSync()` → refresh de contadores); `resolveInspectionConflictKeepLocal/UseRemote`; guardas de permissão em `deleteInspection`/`addInspection`.

**Regras de engenharia aplicadas**: datas civis nunca passam por `new Date('YYYY-MM-DD')`; CAS usa o `updated_at` remoto exato (microssegundos) sem reformatação; **todo UPDATE remoto de inspeção é CAS** (`.eq('updated_at', base).select('*').maybeSingle()`) — quando não há base (registro legado) o serviço faz `fetchInspectionRowById` e adota o `updated_at` remoto como base (nunca UPDATE cego); ordem de exclusão: persistir `pendingDelete`/`syncAction:'delete'` antes de sincronizar; sem UPDATE direto do Supabase dentro de páginas (tudo via store/services); sucesso exige `.select().maybeSingle()`; conflitos não contam como erros de sync.

**Validação**: `npm run lint` 0 erros (2 warnings pré-existentes) e `npm run build` OK. Scripts de validação: `scripts/simulate-inspection-cas.mjs` (standalone, sem credenciais — 9 checagens `[PASS]`) e `scripts/validate-inspection-sharing.mjs` (integração RLS/CAS/RPC/fotos com clientes anon autenticados; requer `.env.test.local`). Migration `0018` criada, revisada e **aplicada** ao projeto remoto via `supabase db push`.

## 10. Branches de Trabalho

| Branch | Status |
|--------|--------|
| `main` | Produção |
| `fix/firecheck-sync-equipamentos` | Concluída |
| `fix/firecheck-inspecoes-sync` | Concluída |
| `fix/firecheck-01-tag-unica-create-update` | Concluída |
| `fix/firecheck-02-rls-status-inspecao` | Concluída |
| `fix/firecheck-03-pull-reconciliacao-metadados` | Concluída |
| `fix/firecheck-04-planos-acao-dexie-sync` | Concluída |
| `fix/firecheck-05-qrcode-scanner-rastreabilidade` | Concluída |
| `fix/firecheck-06-auto-sync-confiavel` | Concluída |
| `fix/firecheck-07-controle-conflitos-updated-at` | Concluída |
| `fix/firecheck-08-resolucao-manual-conflitos` | Concluída |
| `fix/firecheck-fotos-inspecao` | Ativa (fotos de inspeção — aguardando merge) |
| `feat/firecheck-dashboard-filtros` | Ativa (dashboard clicável e filtros — aguardando merge) |
| `feat/firecheck-inspecoes-compartilhadas` | Ativa (inspeções compartilhadas + edição + rastreabilidade — aguardando merge) |

---

## 11. Regras de Desenvolvimento

1. Nunca usar `clear()` destrutivo no Dexie (exceto `clearLocalData()` acionado pelo usuário).
2. Nunca sobrescrever dados locais pendentes (`!sincronizado`, `pendingDelete`, `syncAction`, `statusUpdatePending`, `syncError`).
3. Nunca marcar como sincronizado sem confirmação remota.
4. Nunca usar `upsert` para criação de equipamento — usar `insert`.
5. Equipamento novo usa `insert` + `syncAction: 'create'`.
6. Equipamento editado usa `update` + `syncAction: 'update'`.
7. TAG duplicada deve ser bloqueada local (Zustand + Dexie) e remotamente (Supabase).
8. QR Code deve sempre codificar a TAG oficial (`id`).
9. Scanner nunca deve abrir equipamento excluído (rejeitar `pendingDelete`/`deletedAt`).
10. Pull remoto vazio válido deve reconciliar órfãos locais.
11. Erro remoto deve preservar dados locais intactos.
12. Migrations antigas não devem ser editadas.
13. `.env` nunca deve ser enviado em ZIP, commit ou documentação.
14. Sempre rodar `npm run lint` e `npm run build` antes de commit.
15. Não usar `any` — usar `unknown` + narrowing.
16. Não usar `class`, `enum`, `namespace` (TypeScript `erasableSyntaxOnly: true`).
17. Strings em PT-BR sempre com acentos corretos.

---

## 12. Camada Local: Dexie (`src/db/index.ts`)

### Schema

```
v5 (base):  equipamentos 'id, tipo, status, sincronizado'
            inspecoes    'id, equipmentId, sincronizado'
            planosAcao   'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt'
            fotos        'id, inspectionId'
            acoes_pendentes '++id, type, timestamp'
v6 (Prompt 09): fotos 'id, inspectionId, sincronizado, syncAction, storagePath'
v7 (Prompt 11): inspecoes 'id, equipmentId, sincronizado, syncAction, syncConflict, updatedAt'
```

### LocalEquipment (Dexie row)

```ts
type LocalEquipment = Equipment & {
  sincronizado: boolean;
  pendingDelete?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  syncAction?: 'create' | 'update' | 'delete';
  syncError?: string;
  statusUpdatePending?: boolean;
};
```

Mesma estrutura para `LocalActionPlan` e `LocalInspection`. Estruturas de sync estendidas no Prompt 11: `updatedBy`, `updatedByName`, `syncBaseUpdatedAt`, `syncConflict`, `syncConflictReason`, `remoteUpdatedAtAtConflict`, `syncError`, `syncAction`.

### Mappers (`src/services/mappers.ts`)

- `dbToEquipment()`: converte snake_case do Supabase para camelCase da app. Mapeia `qr_code` para ambos `qrCode` e `qrcode`.
- `equipmentToDb()`: converte camelCase para snake_case. `qr_code` sempre recebe `eq.id` (a TAG oficial).
- `stripSyncMeta()`: remove campos locais de sync antes de retornar para a UI.
- `stripActionPlanSyncMeta()`: mesmo para planos de ação.

---

## 13. Sincronização Supabase (`src/services/sync.ts`)

Bidirecional, **fire-and-forget**. Nunca joga exceção para o caller. Concorrência prevenida por flag `_syncInProgress`.

### Fluxo

```
syncAll(options?)
  ├── if _syncInProgress          → return skip('sync-in-progress')
  ├── if !canSync()                → return skip('offline' | 'supabase-not-configured')
  ├── _syncInProgress = true
  ├── pushEquipments()             // local pendentes → Supabase
  ├── pushInspections()            // create (upsert+returning), update (CAS por updated_at), delete, recalc RPC, concilia statusUpdatePending
  ├── pushActionPlans()            // create/update/soft delete
  ├── pullEquipments()             // cloud → Dexie + reconciliação
  ├── pullInspections()            // cloud → Dexie + reconciliação
  ├── pullActionPlans()            // cloud → Dexie + reconciliação
  └── _syncInProgress = false
```

### Push

- Busca linhas com `!sincronizado` ou `pendingDelete`.
- `pendingDelete`: soft delete remoto via `deleted_at`.
- `syncAction === 'create'`: `insert`.
- `syncAction === 'update'`: `update`.
- Legacy (sem `syncAction`): tenta detectar via `findEquipmentById`.
- `syncError = 'duplicate'` em caso de conflito — mantém dados intactos.
- `statusUpdatePending`: tratado em `pushInspections` via atualização da inspeção mais recente (create/update) com recalc RPC; flags órfãs são reconciliadas ao fim do push (`reconcileStaleStatusFlags`).
- Inspeções compartilhadas: update usa CAS por `updated_at`; `syncError='conflict'` quando a versão remota divergiu; delete exige admin e pré-checagem de conflito com row-confirm.

### Pull

- `fetchEquipments()` retorna `FetchResult` (diferencia erro de vazio).
- Para cada linha cloud: se local não existe → insere; se local sincronizado → sobrescreve; se local pendente → preserva.
- Tombstones (`deletedAt`) no cloud propagam para local.
- Reconciliação de órfãos: itens locais sincronizados que não existem no cloud recebem `deletedAt`.
- `syncEquipmentQrFields()` é aplicado em todos os equipamentos importados do cloud.

### Auto-sync

- `window.addEventListener('online')` → `triggerSync()`.
- `useAutoSync` hook escuta foco, visibilidade, online/offline e intervalo.
- Botão manual "Sincronizar agora" no sidebar.

---

## 14. Estado Global: Zustand (`src/store/index.ts`)

### Partialize (persistido no localStorage)

```ts
{
  config: AppConfig,
  users: PublicUser[],  // cache de perfis do Supabase
}
```

Equipamentos, inspeções e planos de ação vivem no Dexie e são carregados via `hydrate()`. A identidade do usuário atual não é persistida pela store — vive em `localStorage['firecheck-auth']` (gerenciado pelo client Supabase).

### Ações principais

| Ação | Comportamento |
|------|-------------|
| `hydrate()` | Carrega equipamentos/inspeções/planos do Dexie + perfis do Supabase. Resolve sessão. Migra planos legados. |
| `addEquipment(eq)` | Estampa `createdBy`. Persiste no Dexie com `syncAction: 'create'`. Tenta push imediato. |
| `updateEquipment(id, updates)` | Marca `syncAction: 'update'`. Tenta push imediato. |
| `deleteEquipment(id)` | Marca `pendingDelete: true` + `syncAction: 'delete'`. Dispara sync. |
| `addInspection(data)` | Gera ID único. Persiste inspeção + foto. Atualiza status do equipamento (statusUpdatePending). Cria PA se vencido/pendente. Dispara sync. |
| `addActionPlan(p)` | Gera ID. Persiste no Dexie com `syncAction: 'create'`. Dispara sync. |
| `triggerSync()` | `void syncAll()` (fire-and-forget). |

### Subscrição Auth

```ts
supabase.auth.onAuthStateChange((event, session) => {
  // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED → re-resolve perfil
  // SIGNED_OUT → zera user
  // PASSWORD_RECOVERY → mantém authReady
});
```

---

## 15. Roteamento (`src/App.tsx`)

```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/cadastro" element={<Cadastro />} />
  <Route path="/recuperar-senha" element={<RecuperarSenha />} />
  <Route path="/redefinir-senha" element={<RedefinirSenha />} />
  <Route path="/" element={<AppLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="equipamentos" element={<Equipamentos />} />
    <Route path="equipamentos/novo" element={<NovoEquipamento />} />
    <Route path="equipamentos/:id" element={<DetalhesEquipamento />} />
    <Route path="inspecionar/:id" element={<Inspecionar />} />
    <Route path="inspecionar" element={<Inspecionar />} />
    <Route path="scan" element={<ScanQr />} />
    <Route path="qrcodes" element={<QrCodes />} />
    <Route path="relatorios" element={<Relatorios />} />
    <Route path="planodeacao" element={<PlanoDeAcao />} />
    <Route path="configuracoes" element={<Configuracoes />} />
    <Route path="admin/usuarios" element={<AdminUsuarios />} />
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

---

## 16. QR Code e Identidade do Equipamento

### Utilitário central (`src/utils/equipmentIdentity.ts`)

```ts
normalizeEquipmentTag(tag: string): string     // trim + uppercase + hífen
getEquipmentTag(eq): string                     // retorna eq.id
getEquipmentQrPayload(eq): string              // retorna eq.id
syncEquipmentQrFields(eq): T                   // garante qrCode = qrcode = id
matchesEquipmentIdentity(eq, code): boolean    // compara com id, qrCode, qrcode
```

### Onde é usado

- **Cadastro** (`NovoEquipamento.tsx`): TAG gerada automaticamente por tipo. `qrCode` deriva de `id`. Campo QR é read-only espelho da TAG.
- **Impressão** (`QrCodePrintCard.tsx`): QR codifica `equipment.id`.
- **Scanner** (`ScanQr.tsx`): normaliza código escaneado, busca em Zustand → Dexie → Supabase, rejeita `pendingDelete`/`deletedAt`.
- **Detalhes** (`DetalhesEquipamento.tsx`): QR gerado com `eq.id`.
- **Mappers** (`mappers.ts`): `equipmentToDb` sempre escreve `eq.id` em `qr_code`.
- **Pull/Loader**: `syncEquipmentQrFields()` corrige dados legados durante importação.

### Regras

- QR Code deve sempre codificar a TAG oficial (`id`).
- Scanner nunca deve abrir equipamento excluído.
- `qrCode`/`qrcode`/`qr_code` devem sempre refletir `id`.
- Futura evolução recomendada: `id UUID` + `tag TEXT UNIQUE` separada.

---

## 17. PWA (Progressive Web App)

### Service Worker (`vite-plugin-pwa` → `dist/sw.js`)

Gerado via `vite-plugin-pwa` (Workbox, modo `generateSW`, `registerType: 'autoUpdate'`):

1. `workbox.globPatterns`: `**/*.{js,css,html,ico,png,svg,json}`.
2. `navigateFallback: 'index.html'` — relativo, resolve contra o scope do SW e funciona tanto para a base `/` (deploy normal) quanto para `/firecheck/` (GitHub Pages). Evita o erro `non-precached-url :: [{"url":"/"}]`.
3. `cleanupOutdatedCaches: true` — remove caches de versões anteriores do precache.
4. `runtimeCaching` Supabase → `NetworkOnly`: requisições à nuvem nunca leem cache.
5. `manifest: false` — o manifesto fica em `public/manifest.json` e é referenciado por `index.html` com `%BASE_URL%`.

### Registro (`src/hooks/usePwaUpdate.ts` + `virtual:pwa-register`)

Registro via `registerSW` do `virtual:pwa-register` (bundle principal, `import.meta.env.PROD`).
Callback `onUpdateAvailable` exibe toast "Nova versão disponível" com ação "Atualizar".

### Hook `usePwaUpdate`

- Registra SW com callback de atualização (`autoUpdate`).
- Escuta `appinstalled` para toast de sucesso.

### Hook `usePwaInstall`

Máquina de estados: `unavailable` → `available` → `installed`. Detecta iOS para instruções manuais.

### Resilência offline / sincronização (Prompt 13)

- `src/services/network.ts` — classificação de erros de rede: rejects de `fetch` (`TypeError`/`FetchError`/`AbortError`), códigos HTTP funcionalmente de rede, e mensagens típicas (`Failed to fetch`, `net::ERR_*`, timeouts). Códigos funcionais (401/403/409/`42501`/`23505`, conflitos CAS) são tratados como NÃO-rede.
- `src/services/networkState.ts` — circuit breaker singleton: `canAttemptNetwork()`, backoff progressivo de 15s→30s→60s→120s→300s após falha real de rede, `clearCooldown()` no evento `online` e na tentativa manual.
- `src/services/sync.ts` — `syncAll` com short-circuit em cascata: qualquer etapa que comprove backend inalcançável (`network: true`) interrompe a rodada, abre o breaker e retorna `report.networkUnavailable`.
- `src/store/index.ts` — campo `networkUnavailable` (não persistido) alimenta o `SyncStatusBadge` ("Aguardando conexão"); `hydrate`/gates usam `canAttemptNetwork()` em vez de somente `navigator.onLine`.
- `src/services/authService.ts` — `resolveSession` tolerante offline: fallback para `user_metadata` quando o breaker está aberto (não desloga o usuário num reload sem internet); `listUsers` gateado por `canAttemptNetwork()`.
- `src/hooks/useAutoSync.ts` — janela de sync com gate de `canAttemptNetwork()`; no evento `online` chama `clearCooldown()` antes da tentativa.

### Indicadores de sincronização

| Componente | Onde | Função |
|-----------|------|--------|
| `OfflineBanner` | Topo (mobile + desktop) | Faixa âmbar informando modo offline |
| `SyncStatusBadge` | Top bar (≥768px) | Pill compacto com estado do sync (Sincronizando/Offline/Aguardando conexão/N pendentes/Sincronizado) |
| `SyncNowButton` | Sidebar | Botão "Sincronizar agora" com contagem |
| Badge Supabase | Sidebar | Status da conexão com nuvem |

---

## 18. Riscos Remanescentes

1. **`id` ainda é a TAG** — não há UUID separado para chave primária. Reuso de TAG por outro cliente pode causar conflito (embora bloqueado localmente).
2. **Conflitos offline complexos** ainda não têm resolução visual completa — `syncError: 'duplicate'` sinaliza, mas não há UI de merge.
3. **Auto-sync não é realtime** — dependente de `navigator.onLine` + eventos de foco/visibilidade + clique manual. Para tempo real, adicionar Supabase Realtime.
4. **Supabase Realtime** ainda não foi implementado como alternativa/evolução.
5. **RLS precisa ser testada em perfis reais** — as policies de `planos_acao` em produção podem precisar de ajustes.
6. **Cache/PWA** pode servir bundle antigo se service worker estiver desatualizado (stale-while-revalidate).
7. **Migrations** precisam ser aplicadas manualmente no Supabase — não há CLI/automation.
8. **Planos de ação** têm RLS que precisa ser revisada — atualmente usam `user_id` mas a policy pode não estar alinhada com a de equipamentos.
9. **Scanner** busca no Supabase apenas por `findEquipmentById` (precisa do código exato) — não faz busca fuzzy.
10. **Fotos grandes** (>5 MB) em base64 no IndexedDB podem estourar quota do browser.
11. **Fotos 48 MP** precisam validação em dispositivo real — o cap de 25 MP limita o canvas, mas o decode inicial ainda aloca a resolução original.
12. ~~Fotos compartilhadas entre contas~~ — resolvido no Prompt 11 (migration `0018`, `can_access_inspection()`).
13. ~~Download de fotos remotas sob demanda~~ — resolvido no Prompt 11 (`downloadInspectionPhoto` + `DetalheInspecao.tsx`).
14. **Migration `0018` aplicada no Supabase remoto** via `supabase db push` em 2026-09-17. Pós-validação recomendada com as queries da seção 22.
15. **Edição de inspeção** depende do CAS por `updated_at`: se dois dispositivos editam a mesma inspeção simultaneamente, o segundo entra em conflito (resolve manualmente) — sem merge campo a campo.

---

## 19. Próximos Passos Recomendados

1. **Prompt 12 — Testes finais e deploy**:
   - Aplicar a migration `0018` no Supabase remoto (validação SQL: policies, trigger, RPC recalc).
   - Testar multiusuário completo:
     - Admin cria equipamento.
     - Usuário comum inspeciona.
     - Status persiste entre dispositivos via RPC.
     - Exclusão propaga corretamente.
     - Conflito com resolução manual (equipamentos, planos e inspeções).
     - Validação de CAS por simulação standalone de concorrência.
   - Relatório final com queries SQL de validação.
   - Criar release estável (tag + changelog) e PR.
2. **Avaliar Supabase Realtime** como evolução para propagação imediata.
3. **Avaliar migração estrutural**:
   - `id UUID` como PK.
   - `tag TEXT UNIQUE` para identificação.
   - FKs por UUID.
   - Scanner por tag.

---

## 20. Checklist de Testes Obrigatórios

### Equipamentos

- [ ] Criar equipamento online → aparece no Supabase.
- [ ] Criar equipamento offline → `sincronizado: false`.
- [ ] Sincronizar equipamento offline → `sincronizado: true`.
- [ ] Bloquear TAG duplicada (local + remoto).
- [ ] TAG normalizada (trim, uppercase, hífen).
- [ ] QR = TAG no cadastro, impressão, detalhes.
- [ ] Excluir equipamento → `deleted_at` + sumir de outros dispositivos.
- [ ] Equipamento excluído não aparece no scanner.

### Inspeções

- [ ] Realizar inspeção como admin → status persiste via RPC.
- [ ] Realizar inspeção como usuário comum em equipamento de admin.
- [ ] Sem duplicidade no histórico.
- [ ] Plano de ação criado automaticamente se vencido/pendente.

### Planos de Ação

- [ ] Criar plano em dispositivo A → aparece em B após sync.
- [ ] Editar plano em B → propaga para A.
- [ ] Excluir/concluir plano → soft delete.
- [ ] Contador de pendências correto.

### QR Code

- [ ] Imprimir QR → conteúdo = TAG.
- [ ] Escanear offline → encontra equipamento (Zustand + Dexie).
- [ ] Escanear online → encontra equipamento (Supabase fallback).
- [ ] Bloquear equipamento excluído no scanner.
- [ ] Bloquear código não cadastrado.

### Sync

- [ ] Testar sem F5 (Zustand atualizado após pull).
- [ ] Testar foco/visibilidade (trocar aba e voltar).
- [ ] Testar online → offline → online.
- [ ] Verificar console sem loop agressivo.
- [ ] Dados pendentes preservados após pull.
- [ ] Órfãos reconciliados após pull vazio.

---

## 21. Comandos Úteis

```bash
npm install              # instalar dependências
npm run dev              # Vite dev server (http://localhost:5173)
npm run lint             # ESLint (tseslint recommended)
npm run build            # tsc -b && vite build → dist/
npm run preview          # servir o build localmente
```

> ⚠️ Antes de qualquer commit, rode `npm run lint && npm run build`. O CI falha se algum quebrar.

---

## 22. Queries SQL Úteis

### Verificar tabelas

```sql
select
  to_regclass('public.equipamentos') as equipamentos,
  to_regclass('public.inspecoes') as inspecoes,
  to_regclass('public.planos_acao') as planos_acao;
```

### Verificar migrations remotas

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

### Verificar policies

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### Verificar metadados contaminados

```sql
select id, dados_tecnicos
from public.equipamentos
where dados_tecnicos ? 'sincronizado'
   or dados_tecnicos ? 'pendingDelete'
   or dados_tecnicos ? 'syncAction'
   or dados_tecnicos ? 'statusUpdatePending'
   or dados_tecnicos ? 'syncError'
   or dados_tecnicos ? 'deletedAt'
   or dados_tecnicos ? 'deletedBy'
   or dados_tecnicos ? 'createdAt'
   or dados_tecnicos ? 'updatedAt';
```

### Verificar divergência QR/TAG

```sql
select id, qr_code, deleted_at
from public.equipamentos
where deleted_at is null
  and (
    qr_code is null
    or upper(trim(qr_code)) <> upper(trim(id))
  )
order by id;
```

### Verificar planos de ação

```sql
select id, equipment_id, status, created_at, updated_at, deleted_at
from public.planos_acao
order by updated_at desc nulls last, created_at desc nulls last
limit 20;
```

---

## 23. Como a IA Deve Usar Este Arquivo

Sempre que iniciar nova sessão neste projeto:

1. Leia este `PROJECT.md` primeiro.
2. Verifique o estado atual com `git status`, `git branch`, `npm run lint`, `npm run build`.
3. Confira qual foi o último prompt executado (seção 9).
4. Não repita correções já concluídas.
5. Não avance para a próxima etapa sem validar a anterior.
6. Não faça merge automático.
7. Atualize este arquivo ao final de cada etapa.

---

## 24. Log de Atualizações

| Data | Branch | Etapa | Alteração | Status | Próximo passo |
|------|--------|-------|-----------|--------|---------------|
| 2026-06-21 | `fix/firecheck-05-qrcode-scanner-rastreabilidade` | Criação/atualização do `PROJECT.md` | Documentação completa do projeto com histórico de correções, riscos, próximos passos | Concluído | Prompt 06 — auto-sync confiável |
| 2026-06-21 | `fix/firecheck-06-auto-sync-confiavel` | Auto-sync confiável | `useAutoSync` com mount trigger, `isOnline` reativo, listeners centralizados, logs DEV, bug `pushApErrors` corrigido | Concluído | Prompt 07 — controle básico de conflito por updated_at/versão |
| 2026-06-21 | `fix/firecheck-07-controle-conflitos-updated-at` | Controle de conflito por updated_at + UI de conflito | `syncBaseUpdatedAt`, `syncConflict`, `fetchById` com `not_found`, conflito bloqueia push/delete, pull preserva conflitos, `ServiceResult<T>` genérico, `conflictCounts` no store, badge "Conflito" em equipamentos/planos, alerta em detalhes, painel Dashboard, indicador Sidebar | Concluído | Prompt 08 — resolução manual de conflito (forçar sync ou descartar alteração local) |
| 2026-06-21 | `fix/firecheck-08-resolucao-manual-conflitos` | Resolução manual de conflitos + auditoria PWA | `resolveEquipmentConflictKeepLocal/UseRemote`, `resolveActionPlanConflictKeepLocal/UseRemote`, UI de resolução em DetalhesEquipamento e PlanoDeAcao, auditoria migrations (14 seguras), SW/PWA (navigateFallback + NetworkOnly), listeners (sem duplicatas), console.log sanitizados (12 em DEV guard), lint 0 erros, build ok | Concluído | --- |
| 2026-06-22 | `fix/firecheck-08-resolucao-manual-conflitos` | Seleção de inspetor nas inspeções | `src/config/inspectors.ts` com 4 inspetores fixos; select obrigatório em `Inspecionar.tsx`; persistência em localStorage do último inspetor; `inspetor` agora envia nome selecionado em vez de `user?.nome`; nenhuma migration necessária (coluna já existia); lint 0 erros, build ok | Concluído | Revisão para main |
| 2026-09-16 | `fix/firecheck-fotos-inspecao` | Fotos de inspeção — captura Blob + Storage | `compressInspectionImage` (pipeline Blob), Dexie v6 com `LocalInspectionPhoto` (migração `base64`→`legacyBase64`), transação atômica + `SaveInspectionResult`, `pushInspectionPhotos`/`pullInspectionPhotos`, preview via Object URL com revogação, storagePath-first no retry, migration `0017` | Concluído | Merge em `main` (Prompt 11 — testes finais e deploy) |
| 2026-09-16 | `feat/firecheck-dashboard-filtros` | Dashboard clicável e filtros (KPIs confiáveis + drill-down) | `src/utils/equipmentFilters.ts` (fonte única de verdade: `getEquipmentDashboardGroups`, `getLatestInspectionForEquipment`, `getDashboardGroupByView`); 4 cards clicáveis (CADASTRADOS, INSPECIONADOS, EM DIA, PENDENTES) → `/equipamentos?view=...`; busca `?q=` sobre o conjunto do view; títulos contextuais, "Limpar filtro", empty states por visão; data civil `YYYY-MM-DD` (sem bug de fuso); sem migration/backend/fotos; lint 0 erros, build ok | Concluído | Merge em `main` (Prompt 12 — testes finais e deploy) |
| 2026-09-16 | `feat/firecheck-inspecoes-compartilhadas` | Inspeções compartilhadas, edição, rastreabilidade e conflitos | diagnóstico da auditoria (§2); migration `0018` (updated_by/updated_by_name, trigger `inspecoes_audit`, RLS compartilhada + DELETE admin-only, storage shared, RPC recalc); campos de auditoria/conflito em `Inspection`/`LocalInspection` + Dexie v7; CAS em `updateInspectionRemote`; `pushInspections` reescrito (create/update/delete/recalc/reconcile); `pullInspections` com base; resolvers de conflito no store; `DetalheInspecao`/`EditarInspecao` + rotas; badge "Editada" e lápis em DetalhesEquipamento; pill de conflito + resolução em Relatorios; Dashboard/Sidebar com `conflictCounts.inspections`; lint 0 erros, build ok | Concluído | Aplicar migration `0018` no Supabase remoto e teste multiusuário (Prompt 12 — testes finais e deploy) |
| 2026-09-18 | `feat/firecheck-inspecoes-compartilhadas` | Hardening offline/PWA (Prompt 13) | circuit breaker + backoff progressivo (`networkState.ts`, 15s→300s); classificação de erros de rede (`utils/network.ts`); `syncAll` com short-circuit em cascata e `networkUnavailable` no report; serviços (equipamentos/inspeções/planos/fotos) propagam `network` e marcam brea em vez de gravar `syncError`; logout preservado offline via `inspectorFromSession`; `useAutoSync` com gate `canAttemptNetwork` + `clearCooldown` no `online`; badge "Aguardando conexão"; `navigateFallback: 'index.html'` + `cleanupOutdatedCaches` (corrige `non-precached-url`); favicons/manifest com `%BASE_URL%`; manifest `id:"./"`; docs atualizadas; lint 0 erros, build ok | Concluído | --- |
| 2026-09-18 | `feat/firecheck-inspecoes-compartilhadas` | Idempotência de submissão de inspeções (anti-duplicidade) | causa provável: `if (isSaving) return` dependia do render; cada submit gerava novo `INSP-${uuid}`; lock síncrono `submitLockRef` + `submissionIdRef`/`inspectionIdRef` (estáveis por tentativa, reset só em "Nova Inspeção"); `addInspection({ inspectionId })` + guarda idempotente no store (sucesso idempotente/colisão explícita); IDs derivados `FOTO-<inspectionId>`/`PAC-<inspectionId>`; transação Dexie mantida; push create já idempotente (`onConflict:'id'`); `scripts/simulate-inspection-idempotency.mjs` (24 checks, TODOS PASS); lint 0 erros, build ok | Concluído | TESTE 18 de `validate-inspection-sharing.mjs`: conta de teste `firecheck.admin.teste@efetiva.com` está `role=inspector` no remoto (policy exige `is_admin()`); sonda read-only confirmou; exigiria ajuste de role — não executado por regra de imutabilidade de dados |
| 2026-09-18 | `feat/firecheck-inspecoes-compartilhadas` | Atomicidade do plano de ação + fechamento 56/56 (Prompt 17) | `addInspection`: planosAcao ENTROU na transação Dexie (`inspecoes+fotos+equipamentos+planosAcao`); fim do fire-and-forget (`void db.planosAcao.put`) no `set()` do Zustand; falso sucesso eliminado (falha no plano → rollback TOTAL de inspeção/foto/equipamento/plano); guarda idempotente fortalecida com repair controlado de `PAC-<inspectionId>` ausente (`idempotent + repairedActionPlan`) SEM sobrescrever plano existente; sem repair de foto (atomicidade documentada); sem backfill; `validate-inspection-sharing.mjs` com preflight de roles (TEST ENV MISCONFIGURED aborta antes de E2E); conta de teste `firecheck.admin.teste@efetiva.com` promovida a `role=admin` (autorização explícita, único profile alterado); simulação idempotência 64 checks + CAS 9/9 + remoto **56/56 PASS**; lint 0 erros; tsc+build ok | Concluído | Review/main no próximo merge |
| 2026-09-18 | `release/firecheck-stabilization` | Integração das 3 branches + smoke staging (Prompt 18) | Grafo auditado: fotos (`e40e556`) e dashboard (`ec6316d`) são **ancestrais completos** de inspecoes-compartilhadas (merge-bases = heads → SKIPPED — already ancestor/included); merge único `--no-ff` de `feat/firecheck-inspecoes-compartilhadas` (contém fotos + dashboard + compartilhamento + offline + idempotência + atomicidade), **sem merge redundante**; migrations `0017`/`0018` idênticas às validadas (diff vazio) e intactas, sem `0019`; smoke staging E2E: preflight roles 3/3 PASS, equipamento/foto/QR/inspeção/plano/dashboard/CAS/conflito A/B/RASTREABILIDADE 56/56 + idempotência 64/64 + CAS 9/9; integridade antes/depois: equipamentos 41→42→41, QR intactos, históricos intactos, **0 linhas reais alteradas**; cleanup E2E completo; lint 0 erros, tsc+build ok, dist/sw.js com `createHandlerBoundToURL("index.html")` | Concluído | Prompt 19 — preflight de produção |
| 2026-09-19 | `release/firecheck-stabilization` | Preflight de produção (Prompt 19) — auditoria RLS `profiles` + race do primeiro admin | Auditoria de enumeração de `profiles` (SELECT direto, dump de profiles, RLS, `listUsers`, `fetchOwnProfile`, darwin, RPC): **sem escalada real** — o caminho operacional usa inspeções/equipamentos/fotos compartilhadas (RLS própria), não `profiles`; `profiles` só lida por `listUsers` (admin-gated `is_admin()`) e `fetchOwnProfile` (filtro por uid) — auditoria de `0018` e `darwin` não o propagam à UI | Migration `0019_fix_first_admin_race_and_profiles_enumeration.sql` (criada; aplicada **SOMENTE staging** via dry-run→`db push --linked`, ref `sgweag...` staging; **produção intocada**): (a) primeiro admin: `handle_new_user` antes com `count`+`insert` desacoplados → dois admins em corrida (race, P0); agora tudo dentro de transação com `pg_advisory_xact_lock(0x66695265)` + `INSERT ... ON CONFLICT DO UPDATE`/seletivo para garantir um único admin; (b) RLS `profiles`: policy pública `using (true)` antes expunha email/nome/tipo de qualquer inspector ($ P1); agora `is_admin() OR id = auth.uid()` (leitura restrita ao próprio ou admin) — inspector condivide inspeções via policies de inspeção, não de profiles | 0001-0018 INTACTAS (git status: só 0019 untracked; nenhu diff; lint 0, build ok); testes remotos staging pós-0019: validate inspection sharing **56/56 PASS**, CAS **9/9 PASS**, idempotência **64/64 PASS** — policy restrita de profiles NÃO quebrou compartilhamento | Concluído | Prompt 20 — decidir merge de `0019` em produção + aplicar demais pendências app (paginação pull, isolamento por sessão, guard de rota QR) |

---

## 25. Critérios para Considerar o FireCheck Estável

- [ ] `npm run lint` sem erros.
- [ ] `npm run build` OK.
- [ ] Todas as migrations (`0001`–`0018`) aplicadas no Supabase remoto.
- [ ] Cadastro de equipamento sem duplicidade (local + remoto).
- [ ] Inspeção sem duplicidade no histórico.
- [ ] Inspeção compartilhada: inspector edita inspeção de outro usuário e o status não regride (recalc pela mais recente).
- [ ] Rastreabilidade: `updated_by`/`updated_by_name`/`updated_at` visíveis após edição.
- [ ] Conflito de inspeção detectado no CAS e resolvível (manter local / usar servidor).
- [ ] Exclusão de inspeção restrita a admin (RLS + UI).
- [ ] Status por inspeção persiste entre usuários (RPC).
- [ ] Planos de ação sincronizam entre dispositivos.
- [ ] QR Code escaneia corretamente (Zustand → Dexie → Supabase).
- [ ] Exclusão propaga entre dispositivos (tombstone).
- [ ] App funciona offline (criação, inspeção, plano de ação).
- [ ] App sincroniza ao voltar online.
- [ ] Nenhum dado pendente é perdido durante sync.
- [ ] Nenhum falso sucesso é exibido (TAG duplicada bloqueada).
- [ ] Teste multiusuário aprovado (admin + inspector).
- [ ] Scanner rejeita equipamento excluído.
- [ ] QR Code sempre codifica a TAG oficial.

---

## 26. Prevenção de Duplicidade de Inspeções (Idempotência de Submissão)

**Sintoma auditado:** uma única inspeção gerava 2–3 registros no histórico com
mesma data/horário/mensagem (um deles eventualmente editado em teste).

### Causa provável (não há prova exata dos 3 registros originais)

Gap assíncrono de deduplicação: múltiplos `submit` (double-click / Enter
repetido) atravessam a janela entre o primeiro evento e o próximo render do
React. A guarda anterior `if (isSaving) return` dependia de estado (`useState`),
que só atualiza após render. Cada chamada a `addInspection()` gerava um ID novo
(`INSP-${crypto.randomUUID()}`) → cada submit criava uma inspeção distinta.
Confirmado que **StrictMode não é a causa** (event handlers não são
duplamente invocados por StrictMode).

### Atomicidade do plano de ação (Prompt 17)

O plano de ação era criado **fora** da transação (`void db.planosAcao.put(...)`
fire-and-forget dentro do `set()` do Zustand). Isso permitia: inspeção ✅ + foto ✅
+ equipamento ✅ + plano ❌ com retorno de sucesso (falso sucesso), e o caminho
idempotente retornava sucesso sem validar `PAC-<inspectionId>`. Correção:

- `db.transaction('rw', db.inspecoes, db.fotos, db.equipamentos, db.planosAcao, ...)`
  — INSPEÇÃO + FOTO + EQUIPAMENTO + PLANO na MESMA transação. Falha em
  qualquer obrigatório → rollback TOTAL (nada persiste, equipamento reverte).
- Plano criado só para `pendente`/`vencido`, com ID `PAC-${inspectionId}`
  (nunca `Date.now`/`Math.random`/UUID).
- `set()` do Zustand **sem escrita Dexie** — apenas reflete o que JÁ foi
  persistido (PERSISTÊNCIA → COMMIT → ZUSTAND → SYNC).
- Guarda idempotente fortalecida: se `existing.status` é `pendente`/`vencido` e
  `PAC-${inspectionId}` **não existe** → **repair controlado** (cria SÓ o plano
  faltante, com check duplo dentro de transação; retorna `idempotent` +
  `repairedActionPlan`). Sem backfill em massa de históricos antigos.
- Plano existente **nunca** é sobrescrito (responsável/prazo/status
  preservados).
- Foto não tem repair: inspeção+foto são atômicas na mesma transação
  (documentado) — se a inspeção existe, a foto foi gravada junto.

### Camadas implementadas

1. **Lock síncrono de UI** (`submitLockRef` em `Inspecionar.tsx`) — atribuição
   imediata, sem depender do render do React. `isSaving` ficou para aparência.
2. **Identidade estável da tentativa** — `submissionIdRef` (`??= crypto.randomUUID()`)
   e `inspectionIdRef` (`INSP-<submissionId>`). Retry reutiliza os MESMOS IDs.
   Liberação do lock apenas em erro; após sucesso só "Nova Inspeção" reseta.
3. **`addInspection({ inspectionId, ... })`** — o store NÃO gera mais ID: recebe o
   ID determinístico da tentativa.
4. **Guarda idempotente no store** — se `db.inspecoes.get(inspectionId)` já existe:
   - mesmo `equipmentId` → sucesso idempotente (`ok:true, idempotent:true`);
   - `equipmentId` diferente → erro explícito de colisão (nunca gera outro ID);
   - `pendente`/`vencido` sem plano → **repair** (idempotent + repairedActionPlan).
5. **Dexie** — `put()` na chave primária (id). Retry converge para 1 registro.
6. **Foto** — ID derivado `FOTO-<inspectionId>`: 1 tentativa → ≤1 foto de criação
   (atômica com a inspeção).
7. **Plano de ação** — ID derivado `PAC-<inspectionId>`, DENTRO da transação:
   inspeção pendente/vencida → exatamente 1 plano por tentativa.
8. **Transação atômica** (inspeção + foto + status do equipamento + plano).
9. **Sync** — `pushInspections` (create) já usa `upsertInspection` com
   `onConflict: 'id'`; `public.inspecoes.id` é `text primary key` (0001). Retry
   remoto converge para 1 linha. A RPC de recálculo é idempotente por design
   (recalcula pela inspeção mais recente; `p_trigger_inspection_id` preserva
   `data_proxima_inspecao`). O plano gerado na transação sai com
   `sincronizado=false, syncAction='create'` e é empurrado por `pushActionPlans`
   na mesma rodada de sync — que só dispara APÓS o commit.

### Preflight de roles na validação remota (Prompt 17)

`scripts/validate-inspection-sharing.mjs` ganhou **preflight obrigatório**:
antes de qualquer criação de dado E2E, consulta (read-only) o `profiles.role`
de cada conta autenticada e exige `TEST_ADMIN=admin`, `TEST_INSPECTOR_A/B=
inspector`. Se falhar: imprime `TEST ENV MISCONFIGURED`, aborta sem tocar em
dados e retorna código ≠ 0. O script **nunca** promove/demove usuários.
A conta `firecheck.admin.teste@efetiva.com` foi promovida a `role=admin` no
staging (autorização explícita; único profile alterado — conferido por SELECT
antes/depois; `admin` ficou em 2 = conta real + conta de teste, `inspector` em 7).

### Testes automatizáveis

`scripts/simulate-inspection-idempotency.mjs` (sem Supabase, em memória):
1 clique / duplo / triplo / Enter repetido / retry após erro / offline /
foto / plano / nova inspeção / colisão / **rollback por falha do plano** /
**retry após rollback** / **repair de plano ausente** / **plano existente não
sobrescrito** / regular / pendente / vencido / foto+pendente (sucesso 1/1/1 e
falha 0/0/0) / equipamento reverte ao original. Estado: TODOS PASS (64 checks).

`scripts/validate-inspection-sharing.mjs` (remoto, staging): **56/56 PASS**
(inclui TESTE 18 admin-delete após a correção de role).

### Query SQL de diagnóstico (read-only — NÃO é regra de deduplicação)

```sql
-- Inspeções potencialmente duplicadas por proximidade temporal (diagnóstico).
select equipment_id, inspetor, data,
       date_trunc('minute', created_at) as minuto,
       count(*) as qtd,
       string_agg(id, ', ' order by created_at) as ids
from public.inspecoes
group by equipment_id, inspetor, data, date_trunc('minute', created_at)
having count(*) > 1
order by minuto desc;
```

Registros pré-existentes (inclusive as 3 inspeções observadas) foram **mantidos
intactos** — a correção vale apenas para novas submissões. Equipamentos, QR
Codes e históricos antigos permanecem intactos.

---

## 27. Integração / Stabilization Release (Prompt 18)

### Base

- `main` SHA: `b3ce7bac1bf7439eb794d01ad7438d7d87231cb5` (HEAD de `origin/main` após `git pull --ff-only`).
- Branch de integração: `release/firecheck-stabilization` (local + remota) — criada a partir de `main`, sem merge em `main`.

### Grafo / ancestralidade

| Branch | HEAD | Base comum com main | Commits exclusivos (vs main) | Já contida em `feat/firecheck-inspecoes-compartilhadas`? |
|--------|------|----------------------|------------------------------|--------------------------------------------------------|
| `fix/firecheck-fotos-inspecao` | `e40e556` | `b3ce7ba` (= main) | `c94d53b`, `e40e556` (2) | **SIM** (ancestral) |
| `feat/firecheck-dashboard-filtros` | `ec6316d` | `b3ce7ba` (= main) | `c94d53b`, `e40e556`, `ec6316d` (3) | **SIM** (ancestral) |
| `feat/firecheck-inspecoes-compartilhadas` | `2b0eab9` | `b3ce7ba` (= main) | 10 commits (fotos + dashboard + inspeções compartilhadas + CAS + RLS + edição + offline/PWA + idempotência + atomicidade) | — |

### Estratégia utilizada

- `merge-base fotos × inspecoes = e40e556` (= HEAD de fotos) e `merge-base dashboard × inspecoes = ec6316d` (= HEAD de dashboard) ⇒ **fotos e dashboard são ancestrais completos de inspecoes**. `git log fotos..inspecoes` e `git log dashboard..inspecoes` confirmaram: nenhum commit exclusivo a perder.
- **Mergeado:** somente `feat/firecheck-inspecoes-compartilhadas` → `--no-ff` (rastreabilidade preservada).
- **Puladas (nada a integrar):** `fix/firecheck-fotos-inspecao` e `feat/firecheck-dashboard-filtros` — `SKIPPED — already ancestor/included`.

### Merge commits

| SHA | Descrição |
|-----|-----------|
| `2cffc52` | Merge: integra inspecoes compartilhadas (contem fotos + dashboard + offline + idempotencia + atomicidade) |

### Conflitos

Nenhum — a integração partiu de `main` (ancestral de todas as branches) e a única branch mergeada já continha as demais; merge `ort` trivial (fast-forward-style com `--no-ff`).

### Migrations

- `0017_fotos_inspecao_storage_policies.sql` (80 linhas) e `0018_shared_inspection_permissions_and_audit.sql` (321 linhas) — **idênticas** às versões validadas nas branches de origem (`git diff` vazio vs `origin/fix/firecheck-fotos-inspecao` e `origin/feat/firecheck-inspecoes-compartilhadas`). Nenhuma renumeração, nenhuma edição semântica, **sem 0019** (nenhuma necessidade real constatada). Nenhuma `supabase db push` executada (0018 já está aplicada no staging).

### Funcionalidades preservadas

- **Fotos:** Blob no Dexie, compressão/redimensionamento, preview ObjectURL + revogação, `storagePath`, retry seguro, bucket privado, download compartilhado por permissão da inspeção, sync offline/online (não regride para base64).
- **Dashboard:** `src/utils/equipmentFilters.ts` como fonte única (grupos CADASTRADOS/INSPECIONADOS/EM DIA/PENDENTES), drill-down por `?view=` em `Equipamentos`, busca `?q=`, data civil `YYYY-MM-DD`.
- **Inspeções:** cronologia `data DESC, created_at DESC, id DESC` (nunca `updated_at`); `updated_at` apenas para auditoria/CAS/concorrência.
- **Compartilhamento:** admin+inspector visualizam/editam; só admin exclui; `user_id`/inspetor original/`created_at` imutáveis; `updated_by`/`updated_by_name`/`updated_at`; CAS; UseRemote/KeepLocal.
- **Idempotência:** `submissionId` estável → `inspectionId` estável; double/triple submit → 1 inspeção; retry mesmo ID; IDs derivados `FOTO-<inspectionId>`/`PAC-<inspectionId>` (nunca `Date.now`/`Math.random`/UUID novo).
- **Atomicidade:** `addInspection` com transação única `inspecoes + fotos + equipamentos + planosAcao`; falha de persistência obrigatória → rollback total; Zustand reflete depois do commit; repair controlado de `PAC-<id>` ausente sem sobrescrever plano existente.
- **Hardening offline:** network classifier, circuit breaker, backoff progressivo, `canAttemptNetwork()`/`clearCooldown()`, short-circuit da rodada, `networkUnavailable`, falha de rede não vira conflito nem `syncError` permanente.
- **PWA:** `navigateFallback: 'index.html'`, `cleanupOutdatedCaches: true`, Supabase NetworkOnly, favicons/manifest com `%BASE_URL%`, `id: "./"`.
- **QR Codes:** TAG oficial = `equipment.id`; nenhum QR regenerado.

### Testes

| Pilar | Resultado |
|-------|-----------|
| `npx tsc -b` | PASS |
| `npm run lint` | 0 erros (2 warnings pré-existentes: `react-hooks/incompatible-library`) |
| `npm run build` | PASS (`tsc -b && vite build`; 70 entries precached) |
| `dist/sw.js` | `createHandlerBoundToURL("index.html")` presente; `non-precached-url` ausente |
| CAS (`simulate-inspection-cas.mjs`) | 9/9 PASS |
| Idempotência (`simulate-inspection-idempotency.mjs`) | 64/64 PASS |
| RLS/compartilhamento remoto (`validate-inspection-sharing.mjs`, run `MU72GYOM`) | **56/56 PASS**; preflight roles OK (admin/inspector/inspector); bucket privado; admin-delete OK |
| Smoke integrado | Equipamento E2E criado/editado/excluído; inspeção E2E com CAS A/B; `user_id` imutável; foto upload/download compartilhado; anônimo NEGADO; integridade 41=41; QR intactos; cleanup E2E completo |

Itens que exigem dispositivo/sessão humana (QR físico via celular, toggle offline no DevTools, drill-down por clique na UI, banner de conflito em duas sessões) permanecem como **teste manual documentado** — não foram reafirmados como reexecutados nesta integração.

### Pendências pré-produção (auditadas, sem correção automática)

| Item | Status | Severidade | Observação |
|------|--------|------------|------------|
| Paginação do pull remoto | PENDENTE | Média | Pull sem `limit`/`range` (volume atual pequeno); aplicar paginação quando a base crescer |
| Isolamento de dados locais por sessão/usuário | PENDENTE | Média | Dexie único por origin; múltiplos perfis no mesmo browser compartilham dados locais |
| Policies de `profiles` | RESOLVIDO | — | Migration `0003`: RLS (select autenticado; update self/admin; delete admin-only; sem auto-rebaixamento) |
| Provisionamento do primeiro admin | RESOLVIDO | — | Trigger `handle_new_user` (`0003`): primeiro profile vira `admin`, demais `inspector` |
| Segurança da rota/impressão de QR | PENDENTE | Baixa | `/qrcodes/imprimir` é rota de nível raiz, fora do guard do `AppLayout`; sem dados quando não autenticado, mas sem redirect explícito |
| Migrations antigas com regras de autoria/NULL | PENDENTE | Média | `0018` cobre autoria de inspeções; consolidação de NOT NULL/autoria em `equipamentos`/`planos_acao` não auditada |
| Teste físico de foto em celular/câmera de alta resolução | PENDENTE | Média | Decode de 48 MP ainda aloca resolução original antes do cap de 25 MP; requer dispositivo real |
| Comportamento dos status especiais do Dashboard | RESOLVIDO | — | `equipmentFilters.ts` cobre regular/em dia e pendente/vencido como fonte única de verdade |

### Resultado

- Heads reais consultados (sem assumir os registros anteriores); working tree verificada limpa; nenhum merge redundante; nenhum conflito; migrations 0017/0018 intactas; tsc/lint/build/CAS/idempotência/RLS passando; equipamentos e QRs reais intactos; cleanup 100% E2E.
- **Resultado desta etapa: INTEGRAÇÃO APROVADA.**
- Branch final: `release/firecheck-stabilization` — HEAD `2cffc52`. Próximo passo (separado, com decisão do usuário): produção.
