# FireCheck — Contexto do Projeto para IAs

> Documento de referência. Leia antes de sugerir mudanças.
> Última atualização: 2026-06-09 · QR Codes gerenciados, código morto removido.

---

## 1. Visão geral

**FireCheck** é uma PWA (Progressive Web App) para inspeção periódica de equipamentos de combate a incêndio em edificações. Foi pensada para uso em campo, sem rede, com sincronização oportunística para a nuvem quando o dispositivo volta a ficar online.

- **Público-alvo**: técnicos de manutenção, brigadistas e engenheiros de segurança.
- **Modelo de uso**: local-first. Toda a operação (cadastro, inspeção, plano de ação) acontece no navegador; o Supabase é só para sincronizar entre dispositivos.
- **Hospedagem**: GitHub Pages (`https://rodrigo-kotlin.github.io/firecheck/`).
- **Stack**: React 19 + TypeScript 6 + Vite 8 + Tailwind 4 + Dexie 4 + Zustand 5 + Supabase JS 2.
- **Idioma da UI e dos commits**: PT-BR.

---

## 2. Comandos essenciais

```bash
npm install                # instalar deps
npm run dev                # Vite dev server (http://localhost:5173)
npm run lint               # ESLint (regra única: tseslint recommended)
npm run build              # tsc -b && vite build  →  dist/
npm run preview            # servir o build localmente
```

> ⚠️ **Antes de qualquer commit** rode `npm run lint && npm run build`. O CI falha se algum deles quebrar.

---

## 3. Estrutura de pastas

```
firecheck/
├── .github/
│   ├── CODEOWNERS                       # tudo de @Rodrigo-Kotlin
│   └── workflows/
│       ├── ci.yml                       # tsc + lint + build em PR/push
│       └── deploy.yml                   # build & publish em GitHub Pages
├── public/
│   ├── sw.js                            # service worker (cache firecheck-v2)
│   ├── manifest.json                    # PWA manifest
│   ├── favicon.ico                      # multi-size 16+32+48
│   ├── favicon-{16,32,48}.png
│   ├── apple-touch-icon.png             # 180x180
│   └── icon-{192,512,maskable-512}.png
├── tools/
│   ├── icon-source.svg                  # SVG mestre do ícone PWA
│   └── generate-icons.mjs               # Node script: SVG -> PNG/ICO via sharp + to-ico
├── supabase/
│   ├── config.toml                      # project_id = "firecheck"
│   └── migrations/
│       ├── 0001_init_schema.sql         # tabelas + RLS permissivo + triggers
│       ├── 0002_seed_data.sql           # inspetores seed
│       └── 0003_supabase_auth.sql       # profiles + is_admin() + RPC admin + RLS auth
├── src/
│   ├── main.tsx                         # entrypoint (router + Toaster)
│   ├── App.tsx                          # <Routes> + usePwaUpdate
│   ├── index.css                        # design system (CSS variables + classes)
│   ├── registerSW.ts                    # registra sw.js em prod
│   ├── types/
│   │   └── index.ts                     # TODOS os tipos de domínio
│   ├── db/
│   │   └── index.ts                     # Dexie (schema v3)
│   ├── lib/
│   │   └── supabase.ts                  # singleton + isSupabaseConfigured
│   ├── services/
│   │   ├── authService.ts               # Supabase Auth (signInWithPassword / signUp / OTP)
│   │   ├── permissions.ts               # isAdmin, canEdit*, canManageUsers
│   │   ├── equipmentService.ts          # CRUD cloud equipamentos
│   │   ├── inspectionService.ts         # CRUD cloud inspeções
│   │   ├── actionPlanService.ts         # CRUD cloud planos de ação
│   │   ├── photoService.ts              # upload fotos
│   │   ├── mappers.ts                   # snake_case (db) ⇄ camelCase (app)
│   │   └── sync.ts                      # orquestrador push/pull
│   ├── store/
│   │   └── index.ts                     # Zustand (auth + RBAC + UI + sync)
│   ├── hooks/
│   │   ├── useToasts.ts                 # useSyncExternalStore de toasts
│   │   └── usePwaUpdate.ts              # integra registerSW + toast
│   ├── components/
│   │   ├── Toaster.tsx                  # renderiza stack de toasts
│   │   ├── ToggleSwitch.tsx             # switch premium
│   │   ├── PasswordStrengthMeter.tsx    # barra 0–4
│   │   ├── QrCodePrintCard.tsx          # QR do equipamento recém-criado
│   │   └── layout/
│   │       └── AppLayout.tsx            # sidebar + topbar + bottom nav
│   └── pages/
│       ├── login/Login.tsx
│       ├── login/Cadastro.tsx
│       ├── login/RecuperarSenha.tsx
│       ├── login/RedefinirSenha.tsx
│       ├── dashboard/Dashboard.tsx
│       ├── equipamentos/
│       │   ├── Equipamentos.tsx         # grid + busca + chips
│       │   ├── NovoEquipamento.tsx      # form + RHF + zod
│       │   └── DetalhesEquipamento.tsx
│       ├── qrcodes/QrCodes.tsx          # busca, seleção, impressão lote A4
│       ├── inspecionar/Inspecionar.tsx  # scanner + checklist + foto
│       ├── scan/ScanQr.tsx              # html5-qrcode
│       ├── relatorios/Relatorios.tsx    # PDF (jsPDF + html2canvas)
│       ├── planodeacao/PlanoDeAcao.tsx  # CRUD plano
│       ├── configuracoes/Configuracoes.tsx
│       └── admin/AdminUsuarios.tsx      # só admins
├── tsconfig.app.json                    # verbatimModuleSyntax, erasableSyntaxOnly
├── tsconfig.json                        # project references
├── package.json
├── README.md                            # visão geral em PT-BR (para humanos)
└── PROJECT.md                           # ESTE ARQUIVO (para IAs)
```

---

## 4. Modelo de domínio (`src/types/index.ts`)

```ts
type EquipmentStatus = 'regular' | 'pendente' | 'vencido' | 'observacao' | 'em_manutencao' | 'inativo' | 'substituido' | 'extraviado';
type ActionPlanStatus = 'Aberta' | 'Em andamento' | 'Concluída' | 'Vencida';
type Criticidade = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';

interface ActionPlan {
  id: string;
  equipmentId: string;
  local: string;
  descricao: string;
  criticidade: Criticidade;
  responsavel: string;
  prazo: string;
  status: ActionPlanStatus;
  createdAt: string;
  userId?: string;
}

interface AppConfig {
  empresa: string;
  unidade: string;
  offlineMode: boolean;
  notificationsEnabled: boolean;
}

interface Equipment {
  id: string;
  tipo: string;
  subtipo?: string;
  local: string;
  setor: string;
  status: EquipmentStatus;
  pavimento?: string;
  fabricante?: string;
  numSerie?: string;
  capacidade?: string;
  tipoCarga?: string;
  modeloExtintor?: string;
  classeFogo?: string;
  seloLacre?: string;
  manometro?: string;
  suporte?: string;
  sinalizacao?: string;
  acessoDesobstruido?: string;
  estadoGeral?: string;
  tipoHidrante?: string;
  tipoAbrigoVinculado?: string;
  registro?: string;
  valvula?: string;
  adaptador?: string;
  tampao?: string;
  pressao?: string;
  tipoMangueira?: string;
  diametro?: string;
  comprimento?: string;
  tipoUniao?: string;
  estadoMangueira?: string;
  acondicionamento?: string;
  possuiEtiquetaInspecao?: string;
  tipoAbrigo?: string;
  material?: string;
  estadoPorta?: string;
  estadoVisor?: string;
  possuiMangueira?: string;
  possuiEsguicho?: string;
  possuiChaveStorz?: string;
  possuiRegistro?: string;
  tipoEsguicho?: string;
  estadoRoscas?: string;
  estadoVedacao?: string;
  compatibilidadeMangueira?: string;
  localAcondicionamento?: string;
  tipoChaveStorz?: string;
  diametroCompativel?: string;
  estadoFisico?: string;
  tipoAcionador?: string;
  enderecoZona?: string;
  estadoTampa?: string;
  estadoBotao?: string;
  alturaInstalacao?: string;
  funcionamentoTestado?: string;
  tipoAlarme?: string;
  sireneAudiovisual?: string;
  sireneSonora?: string;
  sinalizadorVisual?: string;
  zonaLaco?: string;
  fonteAlimentacao?: string;
  tipoCentral?: string;
  quantidadeLacosZonas?: string;
  bateriaBackup?: string;
  comunicacaoDispositivos?: string;
  statusPainel?: string;
  localInstalacao?: string;
  modeloIluminacao?: string;
  funcaoIluminacao?: string;
  autonomia?: string;
  tipoInstalacao?: string;
  potencia?: string;
  tipoSinalizacao?: string;
  codigoPlaca?: string;
  fotoluminescente?: string;
  visibilidade?: string;
  estadoConservacao?: string;
  fixacaoAdequada?: string;
  tipoSprinkler?: string;
  temperaturaAcionamento?: string;
  posicaoInstalacao?: string;
  estadoBulbo?: string;
  obstrucao?: string;
  corrosao?: string;
  vazamento?: string;
  areaProtegida?: string;
  tipoBomba?: string;
  vazao?: string;
  alimentacaoEletrica?: string;
  painelComando?: string;
  bombaJockey?: string;
  bombaPrincipal?: string;
  bombaReserva?: string;
  tipoPorta?: string;
  tempoResistenciaFogo?: string;
  barraAntipanico?: string;
  dobradicas?: string;
  molaAerea?: string;
  fechamentoAutomatico?: string;
  vedacao?: string;
  tipoDetectorFumaca?: string;
  tipoDetectorCalor?: string;
  nomeModelo?: string;
  descricaoTecnica?: string;
  dataFabricacao?: string;
  dataUltimaManutencao?: string;
  dataProximaManutencao?: string;
  dataUltimoTeste?: string;
  dataProximoTeste?: string;
  dataTesteHidrostatico?: string;
  dataValidadeTeste?: string;
  dataProximaInspecao?: string;
  dataUltimaInspecao?: string;
  qrcode?: string;
  fotoUrl?: string;
  observacoes?: string;
  createdBy?: string;
}

interface Inspection {
  id: string;
  equipmentId: string;
  data: string;
  inspetor: string;
  status: EquipmentStatus;
  observacoes?: string;
  userId?: string;
}

interface Inspector {
  id: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
}

interface UserProfile {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  role: 'admin' | 'inspector';
  createdAt: string;
  updatedAt: string;
}

type PublicUser = UserProfile;

interface Stats {
  total: number;
  emDia: number;
  pendentes: number;
  vencidos: number;
  conformidade: number;
}
```

---

## 5. Autenticação Supabase Auth (`src/services/authService.ts`)

**Decisão arquitetural**: identidade é gerenciada pelo Supabase Auth (senhas com hash bcrypt no servidor, sessões JWT, refresh tokens). A PWA continua offline-first **para dados** (Dexie + Supabase sync), mas **login/registro/recuperação exigem rede**.

A senha nunca passa do input para nenhum storage local — o Supabase faz hash + storage no servidor.

### Fluxo de identidade

```
[auth.users]            ← gerenciado pelo Supabase Auth (bcrypt, JWT, refresh)
   │ 1:1
   ▼
[public.profiles]       ← trigger `handle_new_user` cria a linha no signup
   ├─ id, email, nome, cargo, role, created_at
   └─ RLS: select autenticado / update self (sem mexer no role) /
           update admin / delete admin (exceto self)

[auth.uid()] ── policies usam nas tabelas de domínio (0003)
```

### Regras

1. **Primeiro usuário a se cadastrar no projeto vira admin** (regra do trigger `handle_new_user` em 0003). Demais são `inspector`.
2. **E-mail é case-insensitive** (normalizado no client antes de cada chamada) e único globalmente (constraint `profiles.email UNIQUE` + `auth.users.email UNIQUE` do Supabase).
3. **Sessão** é gerenciada pelo client Supabase e persistida em `localStorage['firecheck-auth']` (chave controlada por `SUPABASE_AUTH_STORAGE_KEY`). Refresh automático a cada ~50min.
4. **`persist` do Zustand** guarda APENAS `actionPlans`, `config`, `users: PublicUser[]` (cache de perfis do Supabase para render instantâneo do admin).
5. **Reage a `onAuthStateChange`** (`store/index.ts`): `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED` / `SIGNED_OUT` / `PASSWORD_RECOVERY` — sempre re-resolve o `user: Inspector` a partir do perfil.

### Política de senha (client-side; Supabase reforça no servidor)

| Regra | Implementação |
|---|---|
| ≥ 8 caracteres | `checkPasswordPolicy` |
| Pelo menos 1 letra | regex |
| Pelo menos 1 dígito | regex |
| Score 0–4 | `getPasswordStrength` (entropia simples) |
| Barra visual | `<PasswordStrengthMeter score={...} />` |

> Em produção, recomende endurecer `password_requirements` em `supabase/config.toml` (`lower_upper_letters_digits_symbols`) ou via painel.

### Recuperação de senha (OTP por e-mail)

Fluxo em 3 etapas, 2 páginas:

```
/recuperar-senha                            /redefinir-senha
┌──────────────────┐    ┌────────────────────────────────────────┐
│ Digita e-mail    │ →  │ Etapa 1: input OTP (6 dígitos)         │
│ signInWithOtp    │    │   verifyOtp({ email, token, 'email' }) │
│ (shouldCreate... │    │   → sessão temporária                  │
│  false)          │    │ Etapa 2: digita nova senha 2x          │
└──────────────────┘    │   updateUser({ password })             │
                       │   → toast + navega para /login         │
                       └────────────────────────────────────────┘
```

Por que OTP em vez de magic link com `resetPasswordForEmail`? O usuário pediu **código de 6 dígitos por e-mail** (decisão do projeto). O fluxo OTP é totalmente self-contained: o usuário digita o código no app, sem precisar abrir o e-mail em outro dispositivo e voltar.

### API pública (`src/services/authService.ts`)

```ts
registerUser({ email, password, nome, cargo }): Promise<Inspector>
loginUser({ email, password }): Promise<Inspector>
logoutUser(): Promise<void>
resolveSession(): Promise<Inspector | null>             // chamado no boot
requestPasswordRecovery(email): Promise<void>           // envia OTP
verifyRecoveryOtp(email, token): Promise<{ email }>     // valida OTP
updateOwnPassword(newPassword): Promise<void>           // redefine
listUsers(): Promise<PublicUser[]>
setUserRole(id: string, role: 'admin' | 'inspector'): Promise<void>
deleteUser(id: string): Promise<void>                   // via RPC admin_delete_user
isSupabaseReady(): Promise<boolean>

// Validação client-side
normalizeEmail / isValidEmail / checkPasswordPolicy / getPasswordStrength
isValidNome / isValidCargo
```

Erros: `authError(code, message)` é uma factory (`erasableSyntaxOnly: true` proíbe `class`). Use `isAuthError(x)` antes de narrowing. `mapSupabaseError` converte erros do client Supabase em `AuthError`.

### Migração do modelo antigo (PBKDF2 local)

A tabela `users` do Dexie (v3) foi **removida** (Dexie v4). O upgrade faz `users.clear()` e apaga `localStorage['firecheck-auth-session']`. Contas existentes precisam ser recadastradas — não há migração automática de hashes (impossível: PBKDF2 não pode ser revertido para texto).

---

## 6. RBAC (`src/services/permissions.ts`)

O RBAC client-side espelha as policies RLS do Supabase. Em produção, **a verdade mora no servidor** — o client apenas esconde controles que o servidor já bloquearia.

```ts
isAdmin(user: Inspector | null): boolean
canManageUsers(user): boolean
canEditEquipment(user, eq: Equipment): boolean
canDeleteEquipment(user, eq): boolean
canEditInspection(user, ins: Inspection): boolean
canDeleteInspection(user, ins): boolean
canEditActionPlan(user, plan): boolean
canDeleteActionPlan(user, plan): boolean
```

### Matriz de permissões

| Ação | Admin | Inspector (dono) | Inspector (de outro) | Sem login |
|---|---|---|---|---|
| `canEdit/Delete Equipment` | ✅ sempre | ✅ se `eq.createdBy === user.id` | ❌ (read-only + lock) | ❌ (redireciona) |
| `canEdit/Delete Inspection` | ✅ sempre | ✅ se `ins.userId === user.id` | ❌ | ❌ |
| `canEdit/Delete ActionPlan` | ✅ sempre | ✅ se `plan.userId === user.id` | ❌ | ❌ |
| `canManageUsers` | ✅ | ❌ | ❌ | ❌ |
| `deleteUser` (Supabase) | ✅ via RPC | ❌ | ❌ | ❌ |
| Ver qualquer página | ✅ | ✅ | ✅ (read-only nos não-próprios) | ❌ → `/login` |

### RLS server-side (Supabase)

Todas as policies de `0003_supabase_auth.sql` exigem `auth.role() = 'authenticated'`. Policies de `profiles`:
- `select` autenticado.
- `update` self (mas não pode mexer no próprio `role`).
- `update` admin (qualquer perfil).
- `delete` admin (exceto self).
- Delete de `auth.users` exposto via RPC `admin_delete_user(uuid)` (SECURITY DEFINER) com checagem de `is_admin()`.

### UI consistente de read-only

- Cards de equipamento: `Lock` + badge "Leitura" (`Equipamentos.tsx`).
- Detalhes: banner âmbar no topo + botão delete escondido (`DetalhesEquipamento.tsx`).
- Plano de ação: `disabled` em inputs e botões + lock badge + "por {nome}" (`PlanoDeAcao.tsx`).

---

## 7. Estado global (`src/store/index.ts`)

Zustand com `persist` (localStorage) em **versão 2** (a primeira v1 carregava `user` direto na store; migração remove o campo).

### Partialize (o que vai pro localStorage)

```ts
{
  actionPlans: ActionPlan[],
  config: AppConfig,
  users: PublicUser[]    // <-- cache de perfis do Supabase para render instantâneo
}
```

> **A identidade do usuário atual NÃO é persistida pela store.** Ela vive em `localStorage['firecheck-auth']` (gerenciado pelo client Supabase) e é re-resolvida via `supabase.auth.getSession()` + `select * from profiles where id = auth.uid()` no boot (`resolveSession()`).

### Ações relevantes

| Ação | Comportamento |
|---|---|
| `hydrate()` | Carrega equipamentos/inspeções do Dexie + perfis do Supabase → store. Resolve sessão. Auto-limpa seed data legado. |
| `login(email, pwd)` | Async. Chama `authService.loginUser` (Supabase signInWithPassword). |
| `register({...})` | Async. Trigger no Supabase cria o profile. Primeiro vira admin. |
| `logout()` | `supabase.auth.signOut()`. Não limpa dados. |
| `loadUsers()` | Recarrega `users: PublicUser[]` do Supabase. |
| `setUserRole(id, role)` | Persiste + reload. Impede self-demote (checado no `AdminUsuarios.tsx`). |
| `deleteUserAccount(id)` | Chama RPC `admin_delete_user`. Impede self-delete. Recarrega lista. |
| `addEquipment(eq)` | Estampa `createdBy: get().user.id`. Persiste no Dexie. Dispara sync. |
| `deleteEquipment(id)` | Remove do estado + Dexie + cascata inspeções/fotos. Dispara sync. |
| `addInspection(ins)` | Estampa `userId`. Gera ID incremental `INSP-NNN`. Atualiza status do equipamento. Cria PA automaticamente se `vencido`/`pendente`. Dispara sync. |
| `addActionPlan(p)` | Gera `id: "PAC-{timestamp}"` + `createdAt` + `status: "Aberta"`. Dispara sync. |
| `updateActionPlan(id, updates)` | Atualiza parcial + marca `sincronizado: false`. Dispara sync. |
| `deleteActionPlan(id)` | Remove do estado + Dexie. Dispara sync. |
| `triggerSync()` | `void syncAll()` (fire-and-forget, nunca joga erro). |
| `refreshPendingCount()` | Soma pendências cloud + action plans não sincronizados. |
| `updateConfig(updates)` | Merge parcial no `AppConfig`. |

### Subscrição ao Supabase Auth

`store/index.ts` registra `supabase.auth.onAuthStateChange(...)` que reage a:
- `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED` → re-resolve o perfil e atualiza `user: Inspector`.
- `SIGNED_OUT` → zera `user` e marca `authReady: true`.
- `PASSWORD_RECOVERY` → mantém `authReady: true` (o componente que chamou `verifyOtp` cuida da próxima etapa).
- `INITIAL_SESSION` → ignorado (já tratado por `hydrate()` no boot).

### Recalcular stats

Sempre que `equipments` ou `inspections` mudam, a action chama `recomputeStatsFromEquipments` que recalcula `stats: { total, emDia, pendentes, vencidos, conformidade }`.

---

## 8. Camada local: Dexie (`src/db/index.ts`)

Schema **v4** (use `db.version(4).stores(...)`):

```ts
db.version(4)
  .stores({
    equipamentos:   'id, tipo, status, setor, [setor+tipo], sincronizado',
    inspecoes:      'id, equipmentId, data, [equipmentId+data], sincronizado, userId',
    fotos:          'id, inspectionId',
    acoes_pendentes:'++id, tipo, createdAt',
    // tabela `users` removida (auth migrou para Supabase)
  })
  .upgrade(async (tx) => {
    await tx.table('users').clear().catch(() => undefined);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('firecheck-auth-session'); // sessão legada PBKDF2
    }
  });
```

> Tabelas mutáveis carregam `sincronizado: boolean`. Itens marcados `pendingDelete: true` são removidos do Dexie após DELETE no Supabase.

### Seed removida

O seed automático com dados mock foi removido. Na primeira carga o `hydrate()` verifica se existem equipamentos com IDs do seed antigo (`EXT-001`, `HID-042`, etc.) e, em caso positivo, limpa todo o banco local + nuvem para evitar dados obsoletos. O app começa vazio.

---

## 9. Sincronização Supabase (`src/services/sync.ts`)

Bidirecional, **fire-and-forget**. Nunca joga exceção para o caller.

### Fluxo

```
syncNow()
  ├── if !navigator.onLine          → return skip('offline')
  ├── if !isSupabaseConfigured      → return skip('supabase-not-configured')
  ├── if state.syncInProgress       → return skip('already-syncing')
  ├── state.syncInProgress = true
  ├── await pushPending()           // ↑ Dexie → Supabase (UPSERT/DELETE)
  ├── await pullFromCloud()         // ↓ Supabase → Dexie (preserva pending)
  └── state.syncInProgress = false
```

### Push

- Para cada tabela (`equipamentos`, `inspecoes`, `fotos`, `planos_acao`) busca linhas com `sincronizado === false` e faz `upsert(...).onConflict('id')`.
- Em sucesso, marca `sincronizado: true`.
- Se a linha tem `pendingDelete: true`, faz `DELETE` e remove do Dexie.

### Pull

- `fetchEquipments`, `fetchInspections`, `fetchActionPlans`.
- Para cada linha cloud, faz `db.upsert(mapped)` APENAS se a versão local tem `sincronizado: true` (ou não existe). Pendências locais **nunca são sobrescritas**.

### Botão manual

Sidebar (`AppLayout.tsx`) tem botão "Sincronizar agora" que chama `syncNow()`. Exibe toast com `SyncReport`.

### Status online/offline

`window.addEventListener('online'/'offline', ...)` no `App.tsx` atualiza `config.online` e dispara `syncNow()` quando volta online.

---

## 10. Roteamento (`src/App.tsx`)

```tsx
<Routes>
  {/* Públicas */}
  <Route path="/login" element={<Login />} />
  <Route path="/cadastro" element={<Cadastro />} />
  <Route path="/recuperar-senha" element={<RecuperarSenha />} />
  <Route path="/redefinir-senha" element={<RedefinirSenha />} />

  {/* Protegidas — guard em AppLayout */}
  <Route path="/" element={<AppLayout />}>
    <Route index element={<Dashboard />} />
    <Route path="equipamentos" element={<Equipamentos />} />
    <Route path="equipamentos/novo" element={<NovoEquipamento />} />
    <Route path="equipamentos/:id" element={<DetalhesEquipamento />} />
    <Route path="inspecionar/:id" element={<Inspecionar />} />
    <Route path="scan" element={<ScanQr />} />
    <Route path="qrcodes" element={<QrCodes />} />
    <Route path="relatorios" element={<Relatorios />} />
    <Route path="planodeacao" element={<PlanoDeAcao />} />
    <Route path="configuracoes" element={<Configuracoes />} />
    <Route path="admin/usuarios" element={<AdminUsuarios />} />  {/* admin only */}
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

`AppLayout` redireciona para `/login` se `!user` (após `authReady`). A página `/admin/usuarios` redireciona para `/` se `!isAdmin(user)`.

---

## 11. Design system (`src/index.css`)

### Tokens (CSS custom properties em `:root`)

```
--color-primary, --color-primary-hover, --color-primary-active
--color-danger, --color-success, --color-warning, --color-info
--color-bg, --color-bg-elevated, --color-text, --color-text-muted, --color-border
```

### Classes utilitárias reutilizáveis

| Classe | Função |
|---|---|
| `.card-subtle` | Card com sombra suave, borda e hover lift |
| `.btn-primary` | Botão primário (gradiente + sombra) |
| `.btn-ghost` | Botão secundário neutro |
| `.btn-danger` | Botão destrutivo |
| `.field-label` | Label uppercase tracking-wide |
| `.field-input` / `.field-textarea` | Inputs com focus ring |
| `.page-header` | Cabeçalho de página (título + ação) |
| `.pill` / `.pill-success` / `.pill-warning` / `.pill-danger` | Etiquetas coloridas |
| `.scrollbar-none` | `::-webkit-scrollbar { display: none }` |
| `.thin-scrollbar` | Scroll custom fina |
| `.no-print` | Esconde na impressão |
| `.toggle-switch.on / .off` | Switch premium (ver §Componentes) |
| `.toaster` | Container de toasts |
| `.qr-label*` | Estilos do QR de impressão (com `@media print`) |

### Cores semânticas (Tailwind 4)

Use sempre nomes semânticos, não valores literais:
- `text-text`, `text-text-muted`
- `bg-bg`, `bg-bg-elevated`
- `border-border`
- `text-primary`, `bg-primary`
- `text-success / warning / danger / info`

### ToggleSwitch (112×38 desktop / 104×36 ≤480px)

```css
.toggle-switch { width: 112px; height: 38px; ... }
.toggle-switch.on  { background: linear-gradient(180deg, #16a34a 0%, #008f4c 100%); }
.toggle-switch.off { background: linear-gradient(180deg, #f8f8f8 0%, #dedede 100%); }
.toggle-switch::before { /* knob 32×32 desktop / 30×30 ≤480px */ }
```

Markup:

```tsx
<ToggleSwitch
  checked={value}
  onChange={setValue}
  ariaLabel="Modo offline"
  onText="ON"
  offText="OFF"
/>
```

---

## 12. Componentes reutilizáveis

| Componente | Props principais | Onde usar |
|---|---|---|
| `<Toaster />` | (nenhuma) | Uma vez no `App.tsx` |
| `<ToggleSwitch />` | `checked, onChange, ariaLabel, onText?, offText?, className?` | Switches em Configurações |
| `<PasswordStrengthMeter />` | `score: 0|1|2|3|4` | Tela de cadastro |
| `<QrCodePrintCard />` | `id: string, name?: string, local?: string` | Após criar equipamento |

### Hooks customizados

```ts
const { showToast, dismissToast, clearToasts, toasts } = useToasts();
showToast({ kind: 'success' | 'error' | 'info' | 'warning', title, description?, duration? });

usePwaUpdate();   // detecta nova versão → toast "Atualizar" → reload
```

---

## 13. PWA (Progressive Web App)

### Visão geral

O FireCheck é uma PWA completa: instalável, offline-first, com detecção de conectividade, sincronização oportunística e fluxo de atualização automática. A experiência é pensada para uso em campo, sem depender de rede.

### Manifest (`public/manifest.json`)

```json
{
  "short_name": "FireCheck",
  "name": "FireCheck - Inspeção de Equipamentos",
  "description": "Sistema móvel para inspeção de equipamentos de combate a incêndio.",
  "lang": "pt-BR",
  "start_url": "/firecheck/",
  "scope": "/firecheck/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFFFFF",
  "theme_color": "#DC2626",
  "categories": ["utilities", "productivity"],
  "icons": [
    { "src": "favicon-16.png",  "sizes": "16x16",  "type": "image/png", "purpose": "any" },
    { "src": "favicon-32.png",  "sizes": "32x32",  "type": "image/png", "purpose": "any" },
    { "src": "favicon-48.png",  "sizes": "48x48",  "type": "image/png", "purpose": "any" },
    { "src": "apple-touch-icon.png", "sizes": "180x180", "type": "image/png", "purpose": "any" },
    { "src": "icon-192.png",   "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png",   "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "prefer_related_applications": false
}
```

### Service Worker (`public/sw.js`)

Estratégia **cache-first com atualização em background** (stale-while-revalidate):

1. `install`: pré-carrega assets estáticos no cache `firecheck-v2` e chama `skipWaiting()`.
2. `activate`: limpa caches antigos e chama `clients.claim()`.
3. `fetch`: serve do cache se disponível; inicia fetch em background para atualizar o cache. Se não está em cache, faz fetch da rede normalmente.
4. `message`: escuta `SKIP_WAITING` para forçar o worker à espera a assumir o controle.

```js
// Assets pré-cacheados no install
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/favicon.ico', '/favicon-16.png', '/favicon-32.png', '/favicon-48.png',
  '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png',
  '/src/main.tsx', '/src/App.tsx', '/src/index.css'
];
```

### Registro (`src/registerSW.ts`)

Registra o service worker **apenas em produção** (`import.meta.env.PROD`). Aceita um callback `onUpdateAvailable` que recebe uma função `reload` para disparar a atualização:

```ts
register((reload) => {
  showToast({
    kind: 'info',
    title: 'Nova versão disponível',
    description: 'Atualize agora para obter as últimas melhorias.',
    action: { label: 'Atualizar', onClick: reload },
    duration: 0,
  });
});
```

Fluxo de atualização:
1. `register()` detecta `reg.waiting` (worker já baixado) ou escuta `updatefound` + `statechange` → `installed`.
2. Invoca `onUpdateAvailable` com callback que posta `SKIP_WAITING`.
3. `controllerchange` escuta a ativação do novo worker e recarrega a página.
4. O toast usa `duration: 0` (não auto-dispensa) para garantir que o usuário veja.

Registro também acontece em `src/main.tsx` (chamada `serviceWorker.register()` no load), sem callback — isso garante que o SW seja registrado mesmo sem o hook, mas sem oferecer update notification se o componente `<App />` não montar o hook.

### Hook `usePwaUpdate` (`src/hooks/usePwaUpdate.ts`)

Usado em `App.tsx`. Faz duas coisas:

1. **Registra o SW com callback de atualização** — quando uma nova versão é detectada, exibe toast com ação "Atualizar".
2. **Escuta `appinstalled`** — quando o usuário instala o PWA, exibe toast de sucesso ("App instalado com sucesso").

```ts
export function usePwaUpdate(): void {
  useEffect(() => {
    register((reload) => {
      showToast({ kind: 'info', title: 'Nova versão disponível', action: { label: 'Atualizar', onClick: reload }, duration: 0 });
    });
  }, []);

  useEffect(() => {
    const onInstalled = () => {
      showToast({ kind: 'success', title: 'App instalado com sucesso', description: 'Abra o FireCheck direto da sua tela inicial.', duration: 6000 });
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);
}
```

### Hook `usePwaInstall` (`src/hooks/usePwaInstall.ts`)

Máquina de estados da instalação:

```
'unavailable' → 'available' → 'installed'
     ↑              |
     └──────────────┘ (se usuário dispensa)
```

- **`unavailable`**: navegador não tem superfície de instalação. Mostra fallback (instruções manuais no iOS).
- **`available`**: `beforeinstallprompt` foi disparado e está na fila. Botão "Instalar" visível no top bar.
- **`installed`**: app já está rodando como standalone (`display-mode: standalone` ou `navigator.standalone` no iOS).

Detecção iOS:
- Usa `userAgent` + `maxTouchPoints` para identificar iPads (iOS 13+).
- iOS nunca dispara `beforeinstallprompt`; exibe instruções "Share → Adicionar à tela inicial".
- Detecta `navigator.standalone` para saber se já está instalado no iOS.

API pública:

```ts
const install = usePwaInstall();
// install.state: 'unavailable' | 'available' | 'installed'
// install.isIos: boolean
// install.promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable' | 'error'>
```

### Botão de instalação na interface

`AppLayout.tsx` renderiza botão "Instalar" no top bar quando `install.state === 'available'`:

```tsx
{install.state === 'available' && (
  <button onClick={handleInstallClick} disabled={installing}
    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark">
    <Download className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">Instalar</span>
  </button>
)}
```

Se o usuário está no iOS e `state === 'unavailable'` (mas não está instalado), o AppLayout mostra um botão alternativo que abre um popup com instruções de instalação manual.

### Detecção de conectividade

`AppLayout.tsx` escuta eventos `online`/`offline` do navegador com deduplicação via ref. Exibe:

1. **OfflineBanner** — faixa âmbar fixa no topo (mobile/desktop) com contagem de pendências.
2. **SyncStatusBadge** — pill no top bar (desktop) com estado: `Sincronizado` (verde), `N pendentes` (âmbar), `Sincronizando...` (azul), `Offline` (vermelho).
3. **SyncNowButton** — botão na sidebar com mesma semântica de cores.
4. **Toasts** — "Conexão restabelecida" / "Você está offline" ao alternar.

### Indicadores de sincronização

| Componente | Onde | Função |
|---|---|---|
| `OfflineBanner` | Topo (mobile + desktop) | Faixa âmbar informando modo offline |
| `SyncStatusBadge` | Top bar (≥768px) | Pill compacto com estado do sync |
| `SyncNowButton` | Sidebar | Botão "Sincronizar agora" com contagem |
| Badge Supabase | Sidebar | Status da conexão com nuvem |

### Ícones e geração

- **SVG mestre**: `tools/icon-source.svg` — retângulo arredondado vermelho (`#DC2626`) com contorno de chama em branco (ícone Flame do Lucide).
- **Geração**: `node tools/generate-icons.mjs` (requer `sharp` e `to-ico`).
  - Gera PNGs: 16, 32, 48, 180, 192, 512, maskable-512.
  - Gera `favicon.ico` multi-tamanho (16+32+48).
- **Saída**: todos em `public/`.

### Modo offline

Tudo funciona localmente:
- IndexedDB (Dexie) é a fonte primária de dados.
- Escritas vão para Dexie com flag `sincronizado: false`.
- Sync bidirecional com Supabase quando online.
- Toasts e banners informam estado de conectividade.

### Fluxo de atualização completo

```
1. Nova build → sw.js muda (cache key firecheck-v2 → v3 etc.)
2. Browser baixa novo SW em background (updatefound)
3. Novo SW entra em estado 'waiting' (ainda não ativo)
4. usePwaUpdate detecta 'installed' com controller existente
5. Toast "Nova versão disponível" com botão "Atualizar"
6. Usuário clica → registerSW posta SKIP_WAITING
7. Novo SW ativa → controllerchange → window.location.reload()
8. Página recarrega com nova versão
```

### iOS (Safari)

- `beforeinstallprompt` **não existe**. Botão "Instalar" só aparece se o evento foi disparado (Chrome/Android).
- Detectamos iOS via UA + `maxTouchPoints` para iPads.
- Exibimos instruções manuais: "Compartilhar → Adicionar à Tela de Início".
- `navigator.standalone` detecta se já está instalado.
- Safe areas: `env(safe-area-inset-bottom)` no CSS do bottom nav e toaster.

---

## 14. Build e deploy

### CI (`.github/workflows/ci.yml`)

Em todo push/PR:
1. `npm ci`
2. `npx tsc -b --noEmit`
3. `npm run lint`
4. `npm run build`

### Deploy (`.github/workflows/deploy.yml`)

Em push na `main`:
1. Mesmos passos do CI.
2. `actions/deploy-pages@v4` com artefato `dist/`.

### Variáveis de ambiente

| Nome | Onde | Obrigatório |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (local) + GitHub Pages secrets | Não (fallback offline) |
| `VITE_SUPABASE_ANON_KEY` | `.env` (local) + GitHub Pages secrets | Não (fallback offline) |

> O cliente Supabase é construído em modo "disabled" se as variáveis estiverem ausentes ou forem placeholders (`isPlaceholder`). O app continua funcionando 100% local.

---

## 15. Configuração TypeScript

`tsconfig.app.json` tem regras estritas que **afetam o que você pode escrever**:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  }
}
```

### Consequências práticas

- ❌ **NÃO use** `class`, `enum`, `namespace`, `module Foo {}`.
- ✅ **USE** `interface`, `type`, `as const`, factory functions (`const authError = (...) => ({...})`).
- ✅ **Imports de tipos**: `import type { Equipment } from '...'` ou `import { type Foo } from '...'` (nunca misture com valores).
- ❌ **Não deixe** imports/vars sem usar — remova antes de commitar.

### Paths

- De `src/components/X.tsx` → `../types`, `../services/...`, `../hooks/...`
- De `src/pages/foo/Foo.tsx` → `../../types`, `../../components/...`
- De `src/pages/foo/sub/Foo.tsx` → `../../../components/...`

---

## 16. Convenções de código

| Aspecto | Convenção |
|---|---|
| **Estilo** | Funções puras + hooks; sem classes |
| **Nomes de arquivo** | PascalCase para componentes/páginas (`NovoEquipamento.tsx`), camelCase para utilitários (`useToasts.ts`) |
| **Componentes** | Função nomeada, export default por página; named export para componentes compartilhados |
| **Estado** | `useState` local para UI, Zustand para cross-page, Dexie para persistente |
| **Forms** | `react-hook-form` + `zod` (já configurado em `NovoEquipamento`) |
| **Toasts** | Sempre via `showToast({...})`. Nunca `alert()` ou `console.log()` para UX |
| **Datas** | ISO strings (`'2026-06-06'`) na store, `new Date()` só para exibição |
| **Strings PT-BR** | Sempre com acentos corretos ("Configurações", não "Configuracoes") |
| **Comentários** | Só quando explicam o "porquê", nunca o "o quê" (código deve ser autoexplicativo) |

### Proibições explícitas

- ❌ `any` (use `unknown` + narrowing).
- ❌ `console.log` em código de produção (mantenha `console.warn`/`console.error`).
- ❌ `localStorage` direto (use o store ou `authService`).
- ❌ `class` para modelar erros (use factory + type guard, vide `authError`).
- ❌ Novas dependências sem discussão prévia (projeto prioriza zero-deps para auth e zero-npm onde Web Crypto/IndexedDB bastam).

---

## 17. Convenções de commit

**Conventional Commits em PT-BR**, com escopo entre parênteses.

```bash
git commit -m "feat(equipamentos): adiciona filtro por criticidade"
git commit -m "fix(sync): resolve deadlock em pullFromCloud"
git commit -m "docs: atualiza PROJECT.md com fluxos de auth"
git commit -m "chore(deps): bump vite para 8.0.1"
git commit -m "refactor(store): separa slice de actionPlans"
```

Escopos comuns: `auth`, `ui`, `pwa`, `equipamentos`, `inspecoes`, `plano-acao`, `sync`, `store`, `db`, `docs`, `deps`, `ci`.

---

## 18. Fluxo de dados ponta-a-ponta

```
┌──────────────────────────────────────────────────────────────────────┐
│                         UI (React 19)                                │
│   pages/* + components/*                                             │
└──────────────────────────┬───────────────────────────────────────────┘
                           │ hooks / store
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Zustand store (src/store/index.ts)                  │
│   auth · RBAC · UI · sync · actionPlans · config · users             │
└──────────┬──────────────────────────────────────┬────────────────────┘
           │ leituras/escritas                     │ persist v2
           ▼                                       ▼
┌─────────────────────────┐               ┌────────────────────┐
│  Dexie (IndexedDB)      │               │ localStorage       │
│  v3: 5 tabelas          │               │ firecheck-storage  │
│  + seed mock            │               │ firecheck-auth-... │
└──────────┬──────────────┘               └────────────────────┘
           │ sync (oportunístico)
           ▼
┌─────────────────────────┐
│  Supabase (Postgres +   │
│  Storage + RLS)         │
│  public.* tables        │
└─────────────────────────┘
```

---

## 19. Receitas (como adicionar features)

### Adicionar uma nova página

1. Criar `src/pages/foo/Foo.tsx` (componente default export).
2. Adicionar rota em `src/App.tsx` dentro de `<Route element={<ProtectedShell />}>`.
3. Adicionar link na sidebar/bottom-nav em `src/components/layout/AppLayout.tsx`.
4. Se for restrita a admin, fazer guard `if (!isAdmin(user)) return <Navigate to="/" />`.

### Adicionar um novo campo em `Equipment`

1. Adicionar em `src/types/index.ts::Equipment`.
2. Adicionar input em `src/pages/equipamentos/NovoEquipamento.tsx` (RHF + zod).
3. Adicionar input em `src/pages/equipamentos/DetalhesEquipamento.tsx` (se editável inline).
4. Adicionar coluna em `supabase/migrations/000X_add_*.sql` (criar nova migration, nunca editar 0001).
5. Adicionar mapeamento em `src/services/mappers.ts::equipmentToDb / dbToEquipment`.
6. Limpar cache do browser antes de testar (Dexie v3 → v4 bump se a coluna é indexada).

### Adicionar um novo papel (ex.: "supervisor")

1. Adicionar `UserRole = 'admin' | 'inspector' | 'supervisor'` em `types/index.ts`.
2. Criar regra em `src/services/permissions.ts` (`canEdit*(user, x) = isAdmin(user) || isSupervisor(user) || (isInspector(user) && x.userId === user.id)`).
3. Adicionar opção no `<select>` de `AdminUsuarios.tsx`.
4. Adicionar badge em `AppLayout.tsx` + `Dashboard.tsx` se quiser destacar.
5. Atualizar migration 0001 ou criar nova — **não** edite migrations antigas.

### Adicionar uma nova configuração persistida

1. Adicionar em `AppConfig` (`types/index.ts`).
2. Adicionar action no store (ex.: `setMinhaConfig`).
3. Adicionar setter no `partialize` (se deve ser persistido).
4. Adicionar UI em `Configuracoes.tsx`.

---

## 20. Limitações conhecidas

- **Login exige rede.** Como a identidade está no Supabase, login/registro/recovery precisam de conexão. Os dados continuam offline-first — uma vez logado, a PWA funciona offline (sync oportunístico).
- **SMTP do Supabase precisa estar configurado** para o OTP de recuperação funcionar. Em projetos novos, o Supabase usa um SMTP de teste com rate limit baixo (2 e-mails/hora). Para produção, configurar SMTP próprio.
- **Sync não é tempo real**: dependemos de `navigator.onLine` + clique manual. Para tempo real, adicionar Supabase Realtime channels.
- **Sem multi-tenancy**: tudo é por projeto Supabase. Se dois clientes precisam de FireCheck isolados, criar projetos Supabase separados. Não existe `orgId` ainda.
- **Storage de fotos** fica no IndexedDB em base64 (offline-first). Upload só acontece em sync. Fotos grandes (>5 MB) podem estourar quota do browser.
- **PDF do relatório** usa html2canvas + jsPDF, pesado e gera o warning de chunk > 700kB. Considerar lazy-load da rota `/relatorios`.
- **PR #1 do Cloudflare Workers bot** existe na branch `cloudflare/workers-autoconfig` (base `8c0ccb8`). Não relacionada ao deploy real — pode ser fechada sem merge.
- **Dexie v4 → v5**: se adicionar campo indexado, lembrar de incrementar a versão e prover migração.

---

## 21. Verificação manual antes de PR

Para mudanças de auth/RBAC (Supabase Auth):
- [ ] Cadastrar primeira conta no projeto Supabase → vira `admin` (trigger 0003) → badge "Admin" + link "Usuários" no sidebar.
- [ ] Cadastrar segunda conta → segunda é `inspector`, sem badge.
- [ ] Tentar acessar `/admin/usuarios` como inspector → redireciona para `/`.
- [ ] Promover inspector a admin na tela → badge aparece no próximo load.
- [ ] Rebaixar admin para inspector → badge some, link "Usuários" some.
- [ ] Tentar rebaixar/excluir a si mesmo → bloqueado (UI + RPC `is_admin()` + policy).
- [ ] Excluir outro usuário → some da lista (deleção cascateia de `profiles` e `auth.users` via RPC).
- [ ] Logout → `signOut()` limpa sessão Supabase + redirect `/login`.
- [ ] Reload página logada → sessão restaurada via `supabase.auth.getSession()`.
- [ ] Token expirado → `autoRefreshToken` renova sem o usuário perceber.
- [ ] **Recovery OTP**: `/login` → "Esqueci minha senha" → digitar e-mail → recebe código de 6 dígitos → `/redefinir-senha` → digita OTP → digita nova senha → entra.
- [ ] **Recovery OTP inválido** (código errado) → erro `OTP_INVALID` sem avançar.
- [ ] **Recovery OTP expirado** (1h) → botão "Reenviar código" reenvia.

Para mudanças de sync:
- [ ] Com `.env` preenchido + rede → cadastrar equipamento → `sincronizado: true` no IndexedDB e linha aparece no Supabase.
- [ ] Sem rede → cadastrar equipamento → `sincronizado: false`, sync fica pendente.
- [ ] Voltar rede → botão "Sincronizar" puxa a fila.
- [ ] Sem `.env` → botão "Sincronizar" mostra toast "modo offline".

Para mudanças de UI:
- [ ] Testar em viewport 320px (mobile pequeno), 375px, 768px (tablet), 1280px (desktop).
- [ ] Testar com `prefers-reduced-motion: reduce`.
- [ ] Verificar `npm run build` (CSS purged, sem warnings novos).
- [ ] Verificar impressão (`@media print` em `.qr-label*` e `.no-print`).

---

## 22. Quando pedir clarificação

Em vez de inventar, **pergunte** se:

- Você precisa adicionar uma nova dependência npm.
- Você precisa tocar em `migrations/0001` (prefira criar uma nova).
- Você precisa mudar o esquema de auth (afeta TODOS os usuários do dispositivo).
- Você precisa mexer em `public/sw.js` (afeta cache offline).
- Você precisa de uma nova variável de ambiente (precisa configurar no GitHub Pages secrets).
- Você precisa de UI em inglês (projeto é PT-BR por convenção).

---

## 23. Resumo de uma linha

> **FireCheck** = React 19 + Dexie + Zustand PWA offline-first para inspeção de extintores/hidrantes/alarmes, com Supabase Auth (senha + recovery OTP por e-mail), RBAC admin/inspector (ownership-based), perfis em `public.profiles` com RLS, sync bidirecional opcional com Supabase, gerenciamento de QR Codes com impressão em lote, UI em PT-BR, design system próprio em `index.css`, e deploy em GitHub Pages.
