# ll-tickets

LaunchLayer workshop jobs for Jordan Duggins’ Wickford repair bench. He talks to a custom GPT. The GPT files a thin job and a stream of notes. A later phone view will sit on the same records. This version is the record and the Action API.

British English.

## What it is

- A job is a ref, a customer name, a device, the reported fault, a status, one next step, an optional price (estimate or quote), backup position, whether access was given, and an optional collection time.
- Everything else is a note. Edits keep the previous wording.
- The GPT sees the customer name and the device. It never sees the phone number and never sees photo files.
- The Action API is seven operations, protected by a bearer API key. See `docs/gpt-actions.openapi.json` and `GET /openapi.json`.

## What it is not

Billing, FreeAgent, time logging, a customer portal, messaging the customer, multi-user, and the phone view. Those are out of this version. The earlier ticket bench (Open / Waiting / Done, customers, devices, ticket notes, password sign-in) has been removed because it did not match this record.

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

Open [http://localhost:3000](http://localhost:3000) and request a sign-in link. The page after sign-in is only a confirmation. Jobs are filed through the GPT.

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
