# FireCheck — Memória Técnica do Projeto

> Documento de referência para IAs e desenvolvedores.
> Leia antes de sugerir mudanças ou iniciar novas sessões.
> Última atualização: 2026-06-21 · Prompt 07 (Controle básico de conflito por updated_at) concluído.

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
| Banco local | Dexie 4 (IndexedDB, schema v5) |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |
| Estilo | TailwindCSS 4 + design system próprio (`index.css`) |
| Scanner QR | html5-qrcode |
| QR | qrcode (canvas/DataURL) |
| PDF | jsPDF + html2canvas |
| Forms | react-hook-form + zod |
| PWA | Service Worker manual (`public/sw.js`, cache-first) |
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
  data: string;             // ISO date
  inspetor: string;
  status: EquipmentStatus;
  observacoes?: string;
  userId?: string;
}
```

Inspeções atualizam o status operacional do equipamento via RPC segura (`apply_equipment_inspection_status`). Se o status for `vencido` ou `pendente`, um plano de ação é criado automaticamente.

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
| `canEdit/Delete Inspection` | ✅ | ✅ se `userId === user.id` | ❌ | ❌ |
| `canEdit/Delete ActionPlan` | ✅ | ✅ se `userId === user.id` | ❌ | ❌ |
| `canManageUsers` | ✅ | ❌ | ❌ | ❌ |

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

7. **UI (próxima etapa)**:
   - Badge de conflito nas telas de equipamentos e planos de ação.
   - Contagem de conflitos no índice de pendências.

**Limitações sem Realtime**:  
O auto-sync não é instantâneo — depende de eventos de foco/visibilidade/online/intervalo. Supabase Realtime pode ser avaliado como evolução futura para propagação imediata.

---

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
| `fix/firecheck-05-qrcode-scanner-rastreabilidade` | Ativa |
| `fix/firecheck-06-auto-sync-confiavel` | Ativa |

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

### Schema v5

```ts
db.version(5).stores({
  equipamentos: 'id, tipo, status, sincronizado',
  inspecoes:    'id, equipmentId, sincronizado',
  planosAcao:   'id, equipmentId, status, sincronizado, pendingDelete, syncAction, deletedAt',
  fotos:        'id, inspectionId',
  acoes_pendentes: '++id, type, timestamp',
});
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

Mesma estrutura para `LocalActionPlan` e `LocalInspection`.

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
  ├── pushInspections()            // inclui RPC de status
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
- `statusUpdatePending`: tratado em `pushInspections` via RPC, não em `pushEquipments`.

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

### Service Worker (`public/sw.js`)

Estratégia **cache-first com atualização em background** (stale-while-revalidate):

1. `install`: pré-carrega assets estáticos no cache `firecheck-v2`, `skipWaiting()`.
2. `activate`: limpa caches antigos, `clients.claim()`.
3. `fetch`: serve do cache se disponível; fetch em background para atualizar.
4. `message`: escuta `SKIP_WAITING` para ativar novo worker.

### Registro (`src/registerSW.ts`)

Apenas em produção (`import.meta.env.PROD`). Callback `onUpdateAvailable` exibe toast "Nova versão disponível" com ação "Atualizar".

### Hook `usePwaUpdate`

- Registra SW com callback de atualização.
- Escuta `appinstalled` para toast de sucesso.

### Hook `usePwaInstall`

Máquina de estados: `unavailable` → `available` → `installed`. Detecta iOS para instruções manuais.

### Indicadores de sincronização

| Componente | Onde | Função |
|-----------|------|--------|
| `OfflineBanner` | Topo (mobile + desktop) | Faixa âmbar informando modo offline |
| `SyncStatusBadge` | Top bar (≥768px) | Pill compacto com estado do sync |
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

---

## 19. Próximos Passos Recomendados

1. **Prompt 07 — Controle básico de conflito por `updated_at`/versão**:
   - Implementar comparação de `updated_at` entre local e remoto durante o pull.
   - Resolver conflito: o mais recente vence, ou exibir UI de merge.
2. **Prompt 08 — Testes finais, listeners duplicados, cache/PWA, PR e checklist de deploy**:
   - Revisar Service Worker para garantir chamadas Supabase são NetworkOnly.
   - Validar PWA/cache não serve bundle obsoleto.
   - Testar multiusuário completo:
     - Admin cria equipamento.
     - Usuário comum inspeciona.
     - Status persiste entre dispositivos via RPC.
     - Exclusão propaga corretamente.
3. **Revisar RLS** de `planos_acao`.
4. **Avaliar Supabase Realtime** como evolução para propagação imediata.
5. **Avaliar migração estrutural**:
   - `id UUID` como PK.
   - `tag TEXT UNIQUE` para identificação.
   - FKs por UUID.
   - Scanner por tag.
6. **Criar release estável** (tag + changelog).

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
| 2026-06-21 | `fix/firecheck-07-controle-conflitos-updated-at` | Controle de conflito por updated_at | `syncBaseUpdatedAt`, `syncConflict`, `fetchById` com `not_found`, conflito bloqueia push/delete, pull preserva conflitos, `ServiceResult<T>` genérico, `conflictCounts` no store | Concluído | Prompt 07 — Partes 10-11: badge de conflito + contagem integrada na UI |

---

## 25. Critérios para Considerar o FireCheck Estável

- [ ] `npm run lint` sem erros.
- [ ] `npm run build` OK.
- [ ] Todas as migrations (`0001`–`0014`) aplicadas no Supabase remoto.
- [ ] Cadastro de equipamento sem duplicidade (local + remoto).
- [ ] Inspeção sem duplicidade no histórico.
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
