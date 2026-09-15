# ll-tickets

LaunchLayer solo-shop **ticket tracking** for Wickford repair (Jordan Duggins). Phone-first workbench: flick jobs by **where I’m at · findings · next**. British English.

## What it is

- Single LaunchLayer org via Supabase Auth. No shop picker, no multi-tenant UI.
- Ticket lists: **Open / Waiting / Done**. Each row: who · device · quiet state · latest finding · next only if a jot earned it (`next:` / `todo:`).
- New ticket: who + what’s wrong. Here now. Opens the sheet immediately.
- Ticket sheet: quiet Open / Waiting / Done, newest-first findings, optional next under the meta, sticky jot composer (`autoFocus`) with Send in the thumb zone.
- More: history and help only

## What it is not

Billing, FreeAgent, SumUp, multi-shop/SaaS, Focus/Duolingo chrome, cyan TODAY heroes, Suggestions rails, QA/stress protocols, VisionFlow, Twilio, PC builder, marketing site, chat UI, parts/intake chip trees.

## Stack

Next.js App Router, Supabase (Auth + Postgres + RLS), Tailwind. Vercel-ready.

## Run locally

1. Create a Supabase project.
2. In the SQL editor, run `supabase/schema.sql`.
3. Authentication → Users → Add user (email/password). Sign-up is not in the UI; this is a staff bench.
4. Copy env and fill keys:

```bash
cp .env.example .env.local
```

5. Install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, create a ticket. You should land on the sheet with the composer focused.

```bash
npm test
npm run lint
npm run build
```

## Deploy (Vercel)

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the project environment. Deploy the repo. Same schema SQL against that Supabase project.

## Schema

Minimal kernels only:

- `customers` — name, phone, email
- `devices` — label, serial
- `tickets` — symptom, status, waiting, here-now vs appointment, `due_at`
- `ticket_notes` — one jot stream (note / finding / check outcome / status)

RLS: authenticated users can use the whole bench (one shop). Anon has no access.

## Lists

| List | Meaning |
| --- | --- |
| Open | Not done, not waiting, not a future booking |
| Waiting | Parked, or a future appointment |
| Done | Done |

Rows are for flicking: tell jobs apart from the latest finding without opening each. A quiet **next** line appears only when a jot includes `next:` or `todo:`.

## Findings

Open a ticket and **jot what is happening**. The composer focuses on open and sits in the thumb zone with Send in one tap. Findings are newest first. Open / Waiting / Done is a quiet where-at picker — never a Do-next hero.
