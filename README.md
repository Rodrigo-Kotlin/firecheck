# FireCheck · PWA de Inspeção de Equipamentos de Incêndio

[![Build & Lint](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/ci.yml/badge.svg)](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/deploy.yml/badge.svg)](https://github.com/Rodrigo-Kotlin/firecheck/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

Sistema **offline-first** para inspeção de equipamentos de combate a incêndio
(extintores, hidrantes, iluminação de emergência, etc.) com sincronização
automática para a nuvem via Supabase.

🔗 **Demo online:** https://rodrigo-kotlin.github.io/firecheck/

---

## ✨ Features

- 📱 **PWA instalável** — funciona no celular como app nativo (Android/iOS).
- 📷 **Scanner de QR Code** com `html5-qrcode`.
- 📋 **Checklists dinâmicos** por tipo de equipamento.
- 📑 **Relatórios em PDF** com `jsPDF` + `html2canvas`.
- 🔄 **Sincronização bidirecional** Dexie ↔ Supabase.
- 📡 **Modo offline** completo — todas as escritas vão para IndexedDB
  instantaneamente; a sincronização acontece quando a conexão volta.
- 🚨 **Plano de ação** com criticidade inferida automaticamente.
- 🎨 **UI responsiva** (mobile / tablet / desktop) com sidebar e bottom nav.

## 🛠 Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript 5 |
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

Login: qualquer e-mail/senha (autenticação mock mantida para o demo).
Entre como "Ricardo Silva".

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
│   ├── manifest.json
│   ├── sw.js               # service worker
│   └── icon-{192,512}.png
└── src/
    ├── components/layout/  # AppLayout (sidebar + bottom nav)
    ├── data/mock.ts        # dados seed
    ├── db/index.ts         # Dexie schema
    ├── lib/supabase.ts     # client singleton
    ├── pages/              # 9 páginas (login, dashboard, etc.)
    ├── services/           # sync + mappers + CRUD Supabase
    ├── store/              # Zustand store
    └── types/              # tipos compartilhados
```

## 🧪 Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o Vite dev server com HMR |
| `npm run lint` | Roda o ESLint em todo o código |
| `npm run build` | Faz build de produção em `dist/` |
| `npm run preview` | Serve o build localmente para teste |

## 🗺 Roadmap

- [ ] Trocar mock login por Supabase Auth (`signInWithPassword`)
- [ ] RLS restritivo com `auth.uid()` por usuário
- [ ] Conflict resolution (last-write-wins com campo `version`)
- [ ] Sincronização periódica em background (Service Worker)
- [ ] Supabase CLI para versionar migrations (`supabase db push`)
- [ ] CI completo com preview deploy por PR
- [ ] Testes E2E com Playwright
- [ ] Multi-tenant com `organization_id`

## 📜 Licença

MIT © 2026 — ver [LICENSE](./LICENSE).
