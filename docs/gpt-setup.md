# GPT setup

Do these in order. Jobs are filed by talking to the custom GPT, or on the phone. Ask the record on the phone helps him diagnose a fault. It reads the same records and does not file them. The custom GPT stays supported. The Action API is unchanged.

1. Deploy this app (Vercel is the intended host) and set the environment variables in [environment.md](environment.md). The Action API will not start until `ACTIONS_API_KEY` and the Supabase service role are set.
2. In the Supabase SQL editor, run `supabase/migrations/20260929120000_jobs.sql`. Then run `supabase/migrations/20260929190000_assistant_daily_usage.sql` if you want Ask the record. Then run `supabase/manual/owner-allowlist.sql` with your email. Details are in [environment.md](environment.md).
3. Create the owner user in Supabase: Authentication → Users → Add user, with the same email as `OWNER_EMAIL`. Sign-in is an email link, so the password is unused. Turn off public sign-ups if the dashboard lets you.
4. Add `NEXT_PUBLIC_SITE_URL` (for example `https://your-deployment.vercel.app`) to Supabase Auth → URL configuration → Redirect URLs, including `/auth/callback`.
5. Open [ChatGPT](https://chatgpt.com) → your custom GPT → Configure. If you are creating it, start a new GPT.
6. Under Actions, import the schema from `https://YOUR-DEPLOYMENT/openapi.json` (the live URL, not the file in Git). Authentication: API key, sent as a Bearer token. Paste `ACTIONS_API_KEY`.
7. Paste the instructions from [gpt-instructions.md](gpt-instructions.md) into the GPT instructions box.
8. Turn on web browsing so the GPT can read the live price list at [https://launchlayer.uk/services/](https://launchlayer.uk/services/).
9. In ChatGPT settings → Data controls, turn off model improvement (do not allow chats to train the model).
10. Test with a dummy job. Say you want a new job for a made-up customer, confirm when asked, then ask it to read the job back. Check the ref, the customer, the device, the fault, and the next step. Ask it to file a note, then correct one word, and confirm the old wording is still in `note_revisions` if you look in Supabase. Delete or close the dummy job with `closed_no_repair` when you are finished.

The GPT must not be given a way to text or email customers. There is no such action.

## Descriptions the importer would not accept

ChatGPT Actions rejects an operation description longer than 300 characters. `find_jobs` and `set_status` are shortened in `docs/gpt-actions.openapi.json`, which is what `GET /openapi.json` serves. The calls are unchanged. The longer wording is below.

**find_jobs.** Use it to decide which job Jordan means, or to list work in progress. Filter by `customer_name`, `device`, `ref`, or `status`. If `status` is omitted, only active jobs are returned (everything except `collected` and `closed_no_repair`). Read each `summary_line` before choosing a job. The phone number is never returned.

**set_status.** Confirm before a status change in the GPT instructions; the spec does not repeat that. Allowed statuses: `new`, `diagnosing`, `waiting_on_parts`, `waiting_on_customer`, `ready`, `collected`, `closed_no_repair`. `price_basis` `estimate` is not binding. `quote` is only for an agreed fixed price, and the server sets `price_agreed_at` when you do not send one. Sending the current status is allowed when you only need to update `price`, `next_move`, `access_given`, `backup_position`, or `follow_up_at`.

Suggested privacy wording for customers, for you to approve before anyone sees it, is in [privacy-note.md](privacy-note.md).
