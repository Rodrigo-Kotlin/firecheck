# FireCheck — Contexto do Projeto para IAs

> Documento de referência. Leia antes de sugerir mudanças.
> Última atualização: 2026-06-06 · commit `51209ec`.

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
│   ├── manifest.webmanifest             # PWA manifest
│   └── icon-{192,512}.png
├── supabase/
│   ├── config.toml                      # project_id = "firecheck"
│   └── migrations/
│       ├── 0001_init_schema.sql         # tabelas + RLS permissivo + triggers
│       └── 0002_seed_data.sql           # inspetores seed
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
│   │   ├── authService.ts               # PBKDF2 + Web Crypto
│   │   ├── permissions.ts               # isAdmin, canEdit*, canManageUsers
│   │   ├── equipmentService.ts          # CRUD cloud equipamentos
│   │   ├── inspectionService.ts         # CRUD cloud inspeções
│   │   ├── actionPlanService.ts         # CRUD cloud planos de ação
│   │   ├── photoService.ts              # upload fotos
│   │   ├── inspectorService.ts          # CRUD cloud inspetores
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
│       ├── dashboard/Dashboard.tsx
│       ├── equipamentos/
│       │   ├── Equipamentos.tsx         # grid + busca + chips
│       │   ├── NovoEquipamento.tsx      # form + RHF + zod
│       │   └── DetalhesEquipamento.tsx
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
type EquipmentStatus = 'regular' | 'pendente' | 'vencido' | 'observacao';
type ActionPlanStatus = 'Aberta' | 'Em andamento' | 'Concluída' | 'Vencida';
type Criticidade = 'Crítico' | 'Alto' | 'Médio' | 'Baixo';
type UserRole = 'admin' | 'inspector';

interface Equipment {
  id: string;                  // ex.: "EXT-001"
  tipo: 'Extintor' | 'Hidrante' | 'Alarme' | 'Iluminação' | string;
  subtipo?: string;
  local: string;               // sala/corredor/etc
  setor: string;               // bloco/pavimento
  pavimento?: string;
  fabricante?: string;
  numSerie?: string;
  capacidade?: string;
  tipoCarga?: string;
  dataFabricacao?: string;     // ISO date
  dataUltimaManutencao?: string;
  dataProximaManutencao?: string;
  dataProximaInspecao?: string;
  status: EquipmentStatus;
  qrCode?: string;             // geralmente = id
  fotoUrl?: string;            // storage path
  observacoes?: string;
  createdBy?: string;          // <-- userId (RBAC)
}

interface Inspection {
  id: string;
  equipmentId: string;
  data: string;                // ISO date
  inspetor: string;            // nome
  status: EquipmentStatus;
  observacoes?: string;
  checklist?: Record<string, 'ok' | 'atencao' | 'falha' | 'na'>;
  sincronizado?: boolean;      // flag sync
  userId?: string;             // <-- userId (RBAC)
}

interface ActionPlan {
  id: string;
  equipmentId: string;
  local: string;
  descricao: string;
  criticidade: Criticidade;
  responsavel: string;
  prazo?: string;
  status: ActionPlanStatus;
  userId?: string;             // <-- userId (RBAC)
}

interface Inspector {
  id: string;
  nome: string;
  cargo: string;
  role?: UserRole;             // <-- RBAC
}

interface UserAccount {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  role: UserRole;              // 'admin' | 'inspector'
  passwordHash: string;        // base64
  salt: string;                // base64
  createdAt: number;           // Date.now()
}

// Tipo público (sem senha) usado na lista de usuários
type PublicUser = Omit<UserAccount, 'passwordHash' | 'salt'>;

interface AppConfig {
  empresa: { nome: string; cnpj?: string; endereco?: string };
  preferencias: { modoOffline: boolean; notificacoes: boolean };
  online: boolean;
}
```

---

## 5. Autenticação local-first (`src/services/authService.ts`)

**Decisão arquitetural**: optamos por NÃO usar Supabase Auth. A PWA precisa funcionar 100% offline e queremos zero dependências externas para identidade. Tudo vive no IndexedDB (Dexie) com **PBKDF2-SHA-256 (100.000 iterações, salt 16 bytes)** calculado via Web Crypto API.

### Regras

1. **Primeiro usuário do dispositivo vira admin automaticamente** (`db.users.count() === 0`).
2. **Demais usuários são `inspector`** e precisam ser promovidos por um admin.
3. **E-mail é case-insensitive** e único por dispositivo.
4. **Sessão** fica em `localStorage['firecheck-auth-session']` = `{ userId, loginAt }`. Não persiste senha.
5. **Senha é digitada em clear-text** apenas no momento do login/register. Depois só `passwordHash` e `salt` ficam no IndexedDB.
6. **`persist` do Zustand** guarda APENAS `actionPlans`, `config`, `users: PublicUser[]` (sem `passwordHash`/`salt`). Migration v2 remove o antigo campo `user` da store persistida.

### Política de senha

| Regra | Implementação |
|---|---|
| ≥ 8 caracteres | `checkPasswordPolicy` |
| Pelo menos 1 maiúscula | regex |
| Pelo menos 1 dígito | regex |
| Score 0–4 | `getPasswordStrength` (entropia simples) |
| Barra visual | `<PasswordStrengthMeter score={...} />` |

### API pública

```ts
registerUser({ nome, email, cargo, password }): Promise<PublicUser>
loginUser({ email, password }): Promise<PublicUser>
logoutUser(): void                                       // limpa sessão
resolveSession(): Promise<PublicUser | null>             // chamado no boot
listUsers(): Promise<PublicUser[]>
getPublicUser(id: string): Promise<PublicUser | null>
setUserRole(id: string, role: UserRole): Promise<void>
deleteUser(id: string): Promise<void>
isFirstUserAdmin(): Promise<boolean>
getPasswordStrength(pwd: string): 0|1|2|3|4
isValidEmail / isValidNome / isValidCargo(email: string): boolean
checkPasswordPolicy(pwd: string): { ok: boolean; reasons: string[] }
```

Erros: `authError(code, message)` é uma factory (porque `erasableSyntaxOnly: true` proíbe `class`). Use o type guard `isAuthError(x)` antes de narrowing.

---

## 6. RBAC (`src/services/permissions.ts`)

```ts
isAdmin(user: PublicUser | null): boolean
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
| Ver qualquer página | ✅ | ✅ | ✅ (read-only nos não-próprios) | ❌ → `/login` |

> **Dados legados sem ownership** (mocks antigos sem `createdBy`/`userId`) são editáveis APENAS por admin.

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
  users: PublicUser[]    // <-- cache para acesso síncrono
}
```

> **A identidade do usuário atual NÃO é persistida pela store.** Ela vive em `firecheck-auth-session` (localStorage) e é re-resolvida via `db.users.get(userId)` no boot (`resolveSession()`).

### Ações relevantes

| Ação | Comportamento |
|---|---|
| `init()` | Carrega users do Dexie → store. Resolve sessão. |
| `login(email, pwd)` | Async. Chama `authService.loginUser`. |
| `register({...})` | Async. Primeiro user vira admin. |
| `logout()` | Limpa sessão. Não limpa dados. |
| `loadUsers()` | Recarrega `users: PublicUser[]` do Dexie. |
| `setUserRole(id, role)` | Persiste + reload. Impede self-demote. |
| `deleteUserAccount(id)` | Impede self-delete. Recarrega lista. |
| `addEquipment(eq)` | Estampa `createdBy: get().user.id`. |
| `addInspection(ins)` | Estampa `userId`. |
| `addActionPlan(p)` | Estampa `userId`. |
| `syncNow()` | `void syncAll()` (fire-and-forget, nunca joga erro). |
| `setModoOffline / setNotificacoes` | Atualiza `config.preferencias` + `online`. |
| `saveEmpresaConfig / setConfig` | Persistência de empresa. |
| `showToast / dismissToast / clearToasts` | Wrappers do hook. |

### Recalcular stats

Sempre que `equipments` ou `inspections` mudam, a action chama `recomputeStatsFromEquipments` que recalcula `stats: { total, emDia, pendentes, vencidos, conformidade }`.

---

## 8. Camada local: Dexie (`src/db/index.ts`)

Schema **v3** (use `db.version(3).stores(...)`):

```ts
db.version(3).stores({
  equipamentos:   '&id, tipo, status, setor, [setor+tipo], sincronizado',
  inspecoes:      '&id, equipmentId, data, [equipmentId+data], sincronizado, userId',
  fotos:          '&id, inspectionId',
  acoes_pendentes:'++id, tipo, createdAt',
  users:          '&id, &email, createdAt',
});
```

> O `&` em `&id`/`&email` indica chave única. Tabelas mutáveis carregam `sincronizado: boolean`. Itens marcados `pendingDelete: true` são removidos do Dexie após DELETE no Supabase.

### Seed

`db.ts:118` faz `if (equipamentos.count() === 0) seedFromMock(...)` com:
- 5 equipamentos: `EXT-001`, `HID-042`, `EXT-109`, `ALM-005`, `ILU-018`
- 3 inspetores: `inspector` (Ana Souza, Bruno Lima, Carla Mendes)
- Stats: 150 total, 132 em dia, 12 pendentes, 6 vencidos, 88% conformidade

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
  <Route element={<ProtectedShell />}>          {/* exige login */}
    <Route path="/" element={<Dashboard />} />
    <Route path="/equipamentos" element={<Equipamentos />} />
    <Route path="/equipamentos/novo" element={<NovoEquipamento />} />
    <Route path="/equipamentos/:id" element={<DetalhesEquipamento />} />
    <Route path="/inspecionar/:id" element={<Inspecionar />} />
    <Route path="/scan" element={<ScanQr />} />
    <Route path="/relatorios" element={<Relatorios />} />
    <Route path="/plano-acao" element={<PlanoDeAcao />} />
    <Route path="/configuracoes" element={<Configuracoes />} />
    <Route path="/admin/usuarios" element={<AdminUsuarios />} />  {/* admin only */}
  </Route>
  <Route path="/login" element={<Login />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

`ProtectedShell` redireciona para `/login` se `!user`. A página `/admin/usuarios` redireciona para `/` se `!isAdmin(user)`.

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

## 13. PWA

- **Manifest**: `public/manifest.webmanifest` (icons 192/512).
- **Service Worker**: `public/sw.js` (estratégia simples de cache, chave `firecheck-v2`).
- **Update flow**: `registerSW.ts` → `usePwaUpdate` → toast "Nova versão disponível" → `SKIP_WAITING` → reload automático.
- **Install**: botão "Adicionar à tela inicial" no Chrome (manifest válido + SW registrado).
- **Modo offline**: tudo funciona localmente. Toasts mostram estado online/offline no `AppLayout` (badge superior direito).

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
6. Atualizar mock em `src/data/mock.ts` (se aplicável).
7. Limpar cache do browser antes de testar (Dexie v3 → v4 bump se a coluna é indexada).

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

- **Mock login + RLS permissivo** no Supabase. Em produção, trocar para Supabase Auth real e apertar RLS (`auth.role() = 'authenticated'` + policies por org).
- **Sync não é tempo real**: dependemos de `navigator.onLine` + clique manual. Para tempo real, adicionar Supabase Realtime channels.
- **Sem multi-tenancy**: tudo é por dispositivo. Se dois técnicos compartilham login no mesmo tablet, não há segregação por `orgId` (não existe `orgId` ainda).
- **Storage de fotos** fica no IndexedDB em base64 (offline-first). Upload só acontece em sync. Fotos grandes (>5 MB) podem estourar quota do browser.
- **PDF do relatório** usa html2canvas + jsPDF, pesado e gera o warning de chunk > 700kB. Considerar lazy-load da rota `/relatorios`.
- **PR #1 do Cloudflare Workers bot** existe na branch `cloudflare/workers-autoconfig` (base `8c0ccb8`). Não relacionada ao deploy real — pode ser fechada sem merge.
- **Dexie v3 → v4**: se adicionar campo indexado, lembrar de incrementar a versão e prover migração.

---

## 21. Verificação manual antes de PR

Para mudanças de auth/RBAC:
- [ ] Cadastrar primeira conta → confere badge "Admin" + link "Usuários" no sidebar.
- [ ] Cadastrar segunda conta → segunda é `inspector`, sem badge.
- [ ] Tentar acessar `/admin/usuarios` como inspector → redireciona.
- [ ] Promover inspector a admin na tela → badge aparece.
- [ ] Rebaixar admin para inspector → badge some, link "Usuários" some.
- [ ] Tentar rebaixar/excluir a si mesmo → bloqueado.
- [ ] Excluir outro usuário → some da lista, ações dele continuam (não cascateia).
- [ ] Logout → sessão limpa, redirect `/login`.
- [ ] Reload página logada → sessão restaurada.
- [ ] Sessão inválida (userId apagado do Dexie) → cai pra `/login` sem loop.

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

> **FireCheck** = React 19 + Dexie + Zustand PWA offline-first para inspeção de extintores/hidrantes/alarmes, com PBKDF2 auth local, RBAC admin/inspector (ownership-based), sync bidirecional opcional com Supabase, UI em PT-BR, design system próprio em `index.css`, e deploy em GitHub Pages.
