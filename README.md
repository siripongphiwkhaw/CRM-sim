# Simulated CRM

A demo CRM built with **Next.js 16 (App Router)** — contacts, companies, a deals
kanban board, and tasks, with login, server actions, and Zod validation.

It runs on an **in-memory SQLite database** (SQLite compiled to WebAssembly via
[sql.js](https://sql.js.org) — no native modules), seeded with realistic demo
data on startup. That means it deploys to serverless hosts like Vercel with
**zero configuration**: no database to provision, no environment variables to set.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/siripongphiwkhaw/CRM-sim)

No setup required. After it deploys, open the URL and sign in with the demo
credentials below.

> **Note — this is a demo, not durable storage.** Because the database lives in
> memory, it is re-seeded with the same sample data whenever the serverless
> instance cold-starts. Your edits (new contacts, deal moves, completed tasks)
> work during a visit but are **not saved permanently** and are not shared
> between visitors.

## Demo credentials

| Email               | Password  |
| ------------------- | --------- |
| `admin@crm.local`   | `demo123` |
| `jordan@crm.local`  | `demo123` |

(Both are pre-filled on the login screen.)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database is created and
seeded in memory automatically on first request — nothing else to configure.

## Features

- **Dashboard** — pipeline value, won value, task counts, pipeline-by-stage, recent activity
- **Contacts** — searchable list, detail view with related deals & tasks, full CRUD
- **Companies** — list with contact/deal counts, detail view, full CRUD
- **Deals** — kanban board by stage with inline stage moves, full CRUD
- **Tasks** — filter by open/overdue/completed, inline complete toggle, full CRUD
- **Auth** — cookie sessions via [iron-session](https://github.com/vvo/iron-session); all routes gated by proxy (middleware)

## Tech stack

- Next.js 16 (App Router, Server Components, Server Actions)
- React 19 + Tailwind CSS v4
- sql.js (in-memory SQLite via WebAssembly)
- iron-session · bcryptjs · Zod · Faker
