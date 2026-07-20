# Jenonutz Cloud

A demo CRM and loyalty platform, plus **Only-One** — a customer-facing LINE LIFF
mini-app for cross-brand loyalty. Built with Next.js 16 (App Router), React 19,
TypeScript, Tailwind v4, and Neon Postgres.

> Fictional demo. All brand and company names are placeholders.

## Modules

**Staff CRM** (`/dashboard` and friends, behind sign-in):

- **Members** — customer master data, Customer 360, per-purpose PDPA consent
- **Loyalty** — append-only points ledger, tiers, rewards catalog, redemption
- **Cases** — service workflow (open → in progress → resolved → closed)
- **AI Insights** — rule-based signals across loyalty, channel, and consent
- **Products** — catalog with reorder points and photos
- **Sales & Channel** — dealers, self-ordering, stock, sell-in/sell-out, receipt OCR
- **Data Cloud** — linked source systems
- **SQL Console** and **Setup** — admin only

**Only-One LIFF app** (`/liff`, customer-facing, mobile-first):

- One points balance spanning every brand, with a per-brand earning breakdown
- Tier and progress to the next tier
- Points history and a rewards catalog with self-service redemption
- PDPA consent toggles

Access to CRM modules is scoped per department; see Setup.

## Architecture

- **One shared loyalty balance per member.** Balance and lifetime are always
  computed from the append-only `loyalty_ledger`; `customers.points`/`tier` are a
  cache whose single writer is `recomputeCustomerCache`.
- **Earn rate** is keyed on the member type (B2C 1pt/฿20, B2B 1pt/฿100) with a
  tier multiplier — never on the sales channel.
- **`transactions.brand`** records where a purchase happened, which drives the
  cross-brand breakdown in Only-One.
- **Schema** lives as a single idempotent SQL string in `db/schema.ts`, applied
  on cold start by `ensureDatabase()` in `db/client.ts`. Additive changes are
  written both in the `CREATE TABLE` body and as `ALTER TABLE … ADD COLUMN IF
  NOT EXISTS` at the bottom, so an already-provisioned database migrates too.

## Setup

Requires Node 20+ and a Neon Postgres database.

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL at minimum
npm run dev
```

The schema is created automatically on first request. Demo logins (password
`demo123`): `admin@crm.local` (admin), plus the department users seeded in
`db/seed.ts`.

### Optional demo data

The app starts empty. To populate members, purchases across brands, and a
rewards catalog for clicking through Only-One:

```bash
npx tsx --env-file=.env.local scripts/seed-demo.ts
npx tsx --env-file=.env.local scripts/seed-demo.ts --clear   # remove it again
```

## Environment

See `.env.example`. `DATABASE_URL` is required; everything else is optional.
Secrets live only in `.env.local` (gitignored) — never commit them.

## Only-One LINE setup

`/liff` runs against a demo member picker locally with `LIFF_DEV_FALLBACK=1` (no
LINE account needed). To connect real LINE:

1. In the [LINE Developers console](https://developers.line.biz/), create a
   **LINE Login** channel.
2. Add a **LIFF app**: endpoint URL `https://<your-domain>/liff`, size **Full**.
3. Enable **both** the `profile` and `openid` scopes. Without `openid`,
   `liff.getIDToken()` returns `null` and sign-in cannot work.
4. Set `NEXT_PUBLIC_LIFF_ID` (the LIFF ID) and `LINE_CHANNEL_ID` (the channel
   ID) in your environment. The dev fallback disables itself automatically once
   these are set.
5. Open `https://liff.line.me/<LIFF_ID>` inside the LINE app. A verified user
   with no linked membership sees a linking-request screen; staff link the LINE
   user id to a member from the Members edit form.

## Scripts

- `npm run dev` · `npm run build` · `npm run lint`
- `npx tsx --env-file=.env.local scripts/seed-demo.ts` — optional demo data
