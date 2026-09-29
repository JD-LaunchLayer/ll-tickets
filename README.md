# ll-tickets

LaunchLayer workshop jobs for Jordan Duggins’ Wickford repair bench. He talks to a custom GPT, and the same records are on his phone. The GPT files a thin job and a stream of notes. The phone view is for the bench: find the job, file a note, set the next move, add a photo.

British English.

## What it is

- A job is a ref, a customer name, a device, the reported fault, a status, one next step, an optional price (estimate or quote), backup position, whether access was given, and an optional collection time.
- Everything else is a note. Edits keep the previous wording.
- The GPT sees the customer name and the device. It never sees the phone number and never sees photo files.
- The phone view, after the owner email link, lists active jobs, opens a job, files a note, changes status and the next move, creates a job (with an optional phone number), and adds a photo. Photos are private and removed 12 months after the job closes.
- The Action API is seven operations, protected by a bearer API key. See `docs/gpt-actions.openapi.json` and `GET /openapi.json`.

## What it is not

Billing, FreeAgent, time logging, a customer portal, messaging the customer, and multi-user. Those are out. The earlier ticket bench (Open / Waiting / Done, customers, devices, ticket notes, password sign-in) has been removed because it did not match this record. Collection booking stays on the GPT; there is no calendar button on the phone.

## Stack

Next.js App Router, Supabase (Auth, Postgres, row-level security, private Storage), Vitest. Vercel-ready.

## Run locally

1. Create a Supabase project.
2. Run `supabase/migrations/20260929120000_jobs.sql` in the SQL editor. It drops the old ticket tables if they are there.
3. Run `supabase/manual/owner-allowlist.sql` with your email.
4. Authentication → Users → Add user for that email. Sign-up from the app is off.
5. Copy env and fill placeholders only with your own values:

```bash
cp .env.example .env.local
```

6. Install and start:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and request a sign-in link. After sign-in you get the job list. Jobs can also be filed through the GPT.

```bash
npm test
npm run lint
npm run build
```

## Docs

- [GPT setup](docs/gpt-setup.md)
- [GPT instructions](docs/gpt-instructions.md)
- [Environment and secrets](docs/environment.md)
- [Privacy note to approve](docs/privacy-note.md)
- [OpenAPI file](docs/gpt-actions.openapi.json)

## Deploy

Set the variables in `.env.example` on the host. At minimum the Action API needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ACTIONS_API_KEY`. Sign-in also needs the publishable key, `OWNER_EMAIL`, and `NEXT_PUBLIC_SITE_URL`. Calendar and photo clean-up are optional and documented in `docs/environment.md`.

Do not apply the migration to a production database that still has ticket-bench data you need.
