# ll-tickets

LaunchLayer solo-shop **ticket tracking** for Wickford repair (Jordan Duggins). Phone-first: jot what is happening on a job. British English.

## What it is

- Single LaunchLayer org via Supabase Auth. No shop picker, no multi-tenant UI.
- Ticket lists: **Open / Waiting / Done**
- New ticket: who + what’s wrong. Here now. Opens the sheet immediately.
- Ticket detail: sticky jot composer in the thumb zone, one note stream (newest first), quiet Open / Waiting / Done picker
- More: history and help only

## What it is not

Billing, FreeAgent, SumUp, multi-shop/SaaS, Focus/Duolingo chrome, cyan TODAY heroes, Suggestions rails, QA/stress protocols, VisionFlow, Twilio, PC builder, marketing site.

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

Open [http://localhost:3000](http://localhost:3000), sign in, create a ticket. You should land on the sheet and be able to type a note.

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
- `ticket_notes` — note / finding / check outcome / status

RLS: authenticated users can use the whole bench (one shop). Anon has no access.

## Lists

| List | Meaning |
| --- | --- |
| Open | Not done, not waiting, not a future booking |
| Waiting | Parked, or a future appointment |
| Done | Done |

## Notes first

Open a ticket and **jot what is happening**. The composer sits in the thumb zone. Open / Waiting / Done is a quiet picker — never in the way of logging.
