# FireCheck · PWA de Inspeção de Equipamentos de Incêndio

[![Build & Lint](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/ci.yml/badge.svg)](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/deploy.yml/badge.svg)](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

Sistema **offline-first** para inspeção de equipamentos de combate a incêndio
(extintores, hidrantes, iluminação de emergência, etc.) com sincronização
automática para a nuvem via Supabase.

🔗 **Demo online:** https://rodrigo-kotlin.github.io/firecheck/

---

## ✨ Features

- 📱 **PWA instalável** — funciona no celular como app nativo (Android/iOS).
- 🔐 **Autenticação local-first** com PBKDF2-SHA-256 (Web Crypto, zero deps);
  o primeiro usuário do dispositivo vira admin automaticamente.
- 👥 **RBAC** (admin/inspector) com permissões baseadas em ownership:
  inspetores só editam os próprios cadastros; admin edita tudo.
- 📷 **Scanner de QR Code** com `html5-qrcode`.
- 📋 **Checklists dinâmicos** por tipo de equipamento.
- 📑 **Relatórios em PDF** com `jsPDF` + `html2canvas`.
- 🔄 **Sincronização bidirecional** Dexie ↔ Supabase (oportunística).
- 📡 **Modo offline** completo — todas as escritas vão para IndexedDB
  instantaneamente; a sincronização acontece quando a conexão volta.
- 🚨 **Plano de ação** com criticidade inferida automaticamente.
- 🎨 **UI responsiva** (mobile / tablet / desktop) com sidebar e bottom nav.
  Barra de filtros com scroll horizontal natural, campo de busca com
  área de toque confortável (≥ 40px) e foco destacado em vermelho.

## 🛠 Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Estado | Zustand (com `persist` no localStorage) |
| Banco local | Dexie 4 (IndexedDB) |
| Backend | Supabase (Postgres + Storage) |
| Estilo | TailwindCSS 4 |
| QR | html5-qrcode |
| PDF | jsPDF + html2canvas |
| PWA | Service Worker manual (`public/sw.js`) |

## 🚀 Quick start

```bash
# 1. Instalar dependências
npm install

# 2. Configurar Supabase (opcional em dev — app cai em modo local)
cp .env.example .env
# edite o .env com sua URL e anon key do Supabase

# 3. Subir o dev server
npm run dev
# → http://localhost:5173

# 4. Build de produção
npm run build
```

**Login (local):** cadastre-se com nome, e-mail, cargo e senha (≥ 8 caracteres,
1 maiúscula, 1 dígito). A **primeira conta** do dispositivo vira **admin**
automaticamente; contas subsequentes são **inspector** e podem ser promovidas
na tela `Configurações → Gerenciar Usuários`. A senha é protegida com
**PBKDF2-SHA-256** (100k iterações, salt 16 bytes) e nunca sai do dispositivo.

## ☁️ Setup do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode em ordem:
   - `supabase/migrations/0001_init_schema.sql` (tabelas + RLS + bucket)
   - `supabase/migrations/0002_seed_data.sql` (dados de exemplo)
3. Preencha o `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Reinicie o dev server. A telemetria no sidebar deve mostrar
   **"Em dia"** após o primeiro `hydrate()`.

> ⚠️ As policies de RLS atuais são permissivas (`using (true)`) — adequado
> para o demo, mas **não para produção**. Veja "Roadmap" abaixo.

## 📁 Estrutura

```
firecheck/
├── .github/
│   ├── CODEOWNERS
│   └── workflows/
│       ├── ci.yml          # lint + build em PRs
│       └── deploy.yml      # build + deploy para GitHub Pages
├── supabase/
│   ├── config.toml         # gerado por `supabase init`
│   └── migrations/
│       ├── 0001_init_schema.sql
│       └── 0002_seed_data.sql
├── public/
│   ├── manifest.json       # PWA manifest (theme_color #E11D48)
│   ├── sw.js               # service worker (cache firecheck-v2)
│   ├── favicon.ico         # multi-size (16+32+48)
│   ├── favicon-{16,32,48}.png
│   ├── apple-touch-icon.png
│   └── icon-{192,512,maskable-512}.png
└── src/
    ├── App.tsx             # rotas + Toaster + usePwaUpdate
    ├── main.tsx            # entrypoint
    ├── registerSW.ts       # PWA service worker
    ├── index.css           # design system (classes utilitárias + tokens)
    ├── components/         # Toaster, ToggleSwitch, QrCodePrintCard, etc.
    │   └── layout/         # AppLayout (sidebar + bottom nav)
    ├── data/mock.ts        # seed inicial
    ├── db/index.ts         # Dexie schema v3
    ├── hooks/              # useToasts, usePwaUpdate
    ├── lib/supabase.ts     # client singleton
    ├── pages/              # login, dashboard, equipamentos, etc.
    ├── services/           # auth, permissions, sync, mappers, CRUD
    ├── store/              # Zustand store (persist v2)
    └── types/              # tipos de domínio
```

## 🧪 Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o Vite dev server com HMR |
| `npm run lint` | Roda o ESLint em todo o código |
| `npm run build` | Faz build de produção em `dist/` |
| `npm run preview` | Serve o build localmente para teste |

## 🗺 Roadmap

- [x] Autenticação local-first com PBKDF2 (Web Crypto)
- [x] RBAC admin/inspector com permissões por ownership
- [ ] RLS restritivo no Supabase (atualmente permissivo para o demo)
- [ ] Conflict resolution (last-write-wins com campo `version`)
- [ ] Sincronização periódica em background (Service Worker)
- [ ] Supabase CLI para versionar migrations (`supabase db push`)
- [ ] CI completo com preview deploy por PR
- [ ] Testes E2E com Playwright
- [ ] Multi-tenant com `organization_id`

## 🤖 Documentação para IAs

Se você é um assistente de IA começando a trabalhar neste projeto, leia
[`PROJECT.md`](./PROJECT.md) — ele contém o modelo de domínio, o fluxo
de auth, a matriz de RBAC, o esquema do Dexie, o orquestrador de sync, as
convenções de código e receitas para adicionar features.

## 📜 Licença

MIT © 2026 — ver [LICENSE](./LICENSE).
