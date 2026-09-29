# Environment, secrets, and manual setup

Nothing in this list is a real secret. Put real values in Vercel → Project → Settings → Environment Variables, and in `.env.local` for local development. Do not commit them.

| Name | Where it is used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | Publishable or anon key. Row-level security still applies |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Action API and photo clean-up. Bypasses row-level security. Never expose it to the browser or the GPT |
| `ACTIONS_API_KEY` | Server, and the GPT Action auth screen | Bearer token. Long random string. The comparison is constant-time. It is not logged |
| `OWNER_EMAIL` | Server | Only this address can be sent a sign-in link |
| `NEXT_PUBLIC_SITE_URL` | Server | Public https origin. Email-link redirect and the OpenAPI `servers` URL. Also add it under Supabase Auth → URL configuration |
| `ACTIONS_RATE_LIMIT_PER_MINUTE` | Server | Optional. Default 60. The counter is per server instance, not global |
| `GOOGLE_CALENDAR_ID` | Server | Calendar id. Often `something@group.calendar.google.com` or the calendar’s email |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Server | The whole service-account JSON key, as one line. Not committed |
| `CRON_SECRET` | Server | Bearer token for `GET /api/cron/purge-photos` |

`VERCEL_URL` is set by Vercel. If `NEXT_PUBLIC_SITE_URL` is empty, the OpenAPI server URL falls back to it, then to `http://localhost:3000`.

## Database

Run `supabase/migrations/20260929120000_jobs.sql` in the Supabase SQL editor (or `supabase db push` if you use the CLI). It **drops** the earlier `customers`, `devices`, `tickets`, and `ticket_notes` tables. Do not run it if those tables hold anything you need.

Then insert the owner, with the same address as `OWNER_EMAIL`:

```sql
insert into private.owner_allowlist (email)
values (lower('owner@example.com'))
on conflict (email) do nothing;
```

The template is `supabase/manual/owner-allowlist.sql`. Until that row exists, a signed-in browser cannot read or write rows. The Action API uses the service role and is gated by `ACTIONS_API_KEY` instead.

Create the Auth user for that email before the first sign-in link. The app does not create users (`shouldCreateUser` is false).

Anon has no grants and no policies. Authenticated access requires `private.is_owner()`.

## Google Calendar

I could not see an existing calendar integration in this repo, so this is a server-side Google Calendar API client using a service account.

1. In Google Cloud, enable the Google Calendar API.
2. Create a service account and a JSON key.
3. Share Jordan’s calendar with the service account email, permission **Make changes to events**.
4. Set `GOOGLE_CALENDAR_ID` to that calendar’s id.
5. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the JSON key.

The entry is private, 30 minutes long, timezone `Europe/London`, with no guests and `sendUpdates=none`. Changing `collection_at` updates the stored event id. If Google says the event has gone, a new private event is created and the id is replaced.

If either variable is missing or the JSON has no `client_email` and `private_key`, `create_collection_event` returns `calendar_not_configured` and does not save a collection time. The other six actions keep working.

Collection booking stays on the GPT. The phone view has no calendar button. `src/lib/calendar/google.ts` is what a later phone button should call.

## Photos

Bucket `job-photos` is private. There is no public URL. Owner policies are on `storage.objects`. A helper creates a signed URL that lasts 5 minutes (`src/lib/photos/signed-url.ts`). The Action API does not call it. It returns a count and captions only.

Photos are deleted 12 months after the job closes (`collected` or `closed_no_repair`, measured from `closed_at`). Reopening a job clears `closed_at`, so the clock starts again when it closes.

`vercel.json` schedules `GET /api/cron/purge-photos` daily at 03:15 UTC. The route refuses to run until `CRON_SECRET` is set. Vercel Cron sends that value as a Bearer token when the project supports cron jobs. I could not verify the plan on this account. If cron is not available, call the route yourself with `Authorization: Bearer $CRON_SECRET`.

The route lists rows from `list_expired_job_photos()` and deletes the files with the Storage API, then deletes the rows.

`supabase/manual/schedule-photo-retention.sql` is the alternative: enable `pg_cron` and run that file. It calls `purge_expired_job_photos()`, which deletes `storage.objects` rows. I could not verify that this also removes the file bytes on your project. Check the bucket after the first run. Prefer the application route.

The phone view uploads from the job page. The browser redraws the photo to a JPEG (long edge about 1600 pixels, quality about 0.8) before upload, which drops location metadata. The file is stored in the private `job-photos` bucket and shown with a signed URL that lasts five minutes. No new environment variable is required. If `20260929120000_jobs.sql` has already been applied, the bucket, the `photos` table, and `jobs.phone` are already there. Confirm the bucket is private:

```sql
select id, public from storage.buckets where id = 'job-photos';
```

`public` must be false. If the row is missing, create it and the owner policies from that migration (the `job-photos` block). Do not make the bucket public.

## Decisions baked into this version

- Job refs look like `LL-4K7M`: four characters, without I, L, O, 0 or 1.
- `next_move` is required when a job is created, one line, at most 180 characters. A note summary is at most 120 characters (about 100). Note text is at most 4,000 characters. These are safety caps.
- `find_jobs` returns at most 50 jobs, newest activity first. Name and device search is a case-insensitive substring. Ref search is exact.
- A price with no basis is stored as an estimate. A quote with no agreement time gets `price_agreed_at` set to the server time. An estimate cannot carry an agreement time.
- Collection time is only written by `create_collection_event`, so the calendar entry and the job stay together. The private event is a 30-minute hold in `Europe/London`.
- Sending the same status to `set_status` is allowed, so a price or next step can be updated without pretending the status changed. Create, status, and calendar still need a spoken confirmation in the GPT instructions.
- Reopening a closed job clears `closed_at`. Moving between `collected` and `closed_no_repair` keeps the original close time.
- `add_note` may update `next_move`. It does not change status or the job price. A part amount on a note stays on the note.
- The Action API rate limit defaults to 60 requests a minute per server instance. It is not shared across instances.
- Signed photo URLs last 5 minutes. The Action API does not issue them. The phone view does, for the signed-in owner only.
- Idempotency stores a successful response only. A failed write releases the id so the same retry can proceed. Two identical in-flight writes: the second is told the first is still in progress.
