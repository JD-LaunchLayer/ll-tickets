# ll-tickets

LaunchLayer workshop jobs for Jordan Duggins’ Wickford repair bench. He talks to a custom GPT, which files the job, or he uses the phone. Ask the record on the phone is a diagnosing buddy: it does not file notes. The phone view is the branded bench app: jobs, a new job, and Ask the record, with the logo in a dark header. He finds the job, files a note, sets the next move, adds a photo, and reasons through the fault. The custom GPT stays supported.

British English.

## What it is

- A job is a ref, a customer name, a device, the reported fault, a status, one next step, an optional price (estimate or quote), backup position, whether access was given, and an optional collection time.
- Everything else is a note. Edits keep the previous wording.
- The GPT sees the customer name and the device. It never sees the phone number and never sees photo files.
- The phone view, after the owner email link, lists active jobs, opens a job, files a note, changes status and the next move, creates a job (with an optional phone number), and adds a photo. Photos are private and removed 12 months after the job closes. Ask the record reads the job and can search past jobs. On a job page the chat applies to that job. A reply is saved only if he taps Save to notes and confirms. The chat thread stays in the browser. The assistant never sees the phone number.
- The Action API is seven operations, protected by a bearer API key. See `docs/gpt-actions.openapi.json` and `GET /openapi.json`. Ask the record does not replace it.

## What it is not

Billing, FreeAgent, time logging, a customer portal, messaging the customer, and multi-user. Those are out. The earlier ticket bench (Open / Waiting / Done, customers, devices, ticket notes, password sign-in) has been removed because it did not match this record. Collection booking stays on the GPT; there is no calendar button on the phone.

## Stack

Next.js App Router, Supabase (Auth, Postgres, row-level security, private Storage), Vitest. Vercel-ready.

## Run locally

1. Create a Supabase project.
2. Run `supabase/migrations/20260929120000_jobs.sql` in the SQL editor. It drops the old ticket tables if they are there. Then run `supabase/migrations/20260929190000_assistant_daily_usage.sql` so Ask the record can count the day's messages.
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

Open [http://localhost:3000](http://localhost:3000) and request a sign-in link. After sign-in you get the job list. Jobs are filed on the phone, or through the GPT. Without `OPENAI_API_KEY`, Ask the record shows “Assistant is not set up yet.” The GPT keeps working either way.

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

Set the variables in `.env.example` on the host. At minimum the Action API needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ACTIONS_API_KEY`. Sign-in also needs the publishable key, `OWNER_EMAIL`, and `NEXT_PUBLIC_SITE_URL`. Ask the record also needs `OPENAI_API_KEY`. `ASSISTANT_MODEL` and `ASSISTANT_DAILY_MESSAGE_LIMIT` are optional. Calendar and photo clean-up are optional and documented in `docs/environment.md`.

Do not apply the migration to a production database that still has ticket-bench data you need.
