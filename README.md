# CertFlow

A real, working staging version of the CertFlow certification-job-management
software described in `certflow-build-brief.md` — built with a real database,
real logins for both certifiers and clients, and real file uploads, replacing
the click-through prototype (`certflow-client-portal.jsx`).

This README assumes no coding or IT background. Every step below is exactly
what to click. It should take about 10–15 minutes.

---

## What you're setting up

Three free accounts/services work together:

- **Supabase** — your database, your login system, and your file storage,
  all in one. This is where every job, quote, document, and photo actually
  lives.
- **GitHub** — already holding this code (you're looking at it).
- **Vercel** — turns this code into a real website with a real address,
  and automatically updates it every time new code is pushed here.

You'll create free accounts on Supabase and Vercel. Nothing here costs money
at this stage (small free tiers on both).

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and click **Start your project**, sign up (GitHub sign-in is easiest).
2. Click **New project**. Pick any name (e.g. "certflow"), set a database password (save it somewhere safe — a password manager, not a sticky note), pick the region closest to Sydney (e.g. `ap-southeast-2`), and click **Create new project**. Wait ~2 minutes while it's provisioned.

## Step 2 — Create the database structure

1. In your new Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/migrations/0001_init.sql` in this repository, copy its entire contents, paste into the SQL editor, and click **Run**. This creates every table, security rule, and the file storage area.
4. Repeat for **every other file** in `supabase/migrations/`, in number order — `0002_client_invite.sql`, then `0003…`, and so on to the highest number. Each one is a new query: open the file, copy all of it, paste, Run.

> **Already set up, and just need the latest changes?** You only need the
> files with a number higher than the last one you ran. The most recent are
> `0012_custom_cert_ref.sql` (rename a certificate reference),
> `0013_inspection_report_text.sql` (edit an inspection report's wording
> in the app), and `0014_firm_stamp.sql` (upload your own approval stamp).
> Running one twice is harmless — every one of these is safe to re-run.

> **If a migration stops with "column ... already exists":** you've run
> that file before. Note that Supabase runs the whole editor tab as a
> single unit, so when one line fails the lines *after* it don't run
> either. Re-run the file as-is — every `add column` is now written as
> `add column if not exists`, so it adds whatever is missing and skips
> whatever isn't.

You should see "Success. No rows returned" both times. If you see a red
error instead, stop and get help before continuing — don't re-run a
partially-failed script.

## Step 3 — Create your own certifier login

1. In Supabase, click **Authentication** in the sidebar, then **Users**, then **Add user** → **Create new user**.
2. Enter your own email and a password. Leave "Auto Confirm User" turned on. Click **Create user**.
3. Click on the user you just created and copy their **User UID** (a long code like `a1b2c3d4-...`) — you'll need it in a moment.

## Step 4 — Link your login to a firm

1. Open `supabase/seed_firm_template.sql` in this repository. It's a short script with three parts and some `<PLACEHOLDER>` values.
2. Go back to Supabase's **SQL Editor**, new query.
3. Copy in **part 1** only (the `insert into firms...` block) and run it. It will print back an `id` — copy that.
4. Copy in **part 2**, replace `<FIRM_ID>` with the id you just copied, edit the name/registration details to your own, and run it. It prints another `id` — copy that too.
5. Copy in **part 3**, replace `<AUTH_USER_ID>` with the User UID from Step 3, `<FIRM_ID>` and `<CERTIFIER_ID>` with the two ids above, and your real name/email. Run it.

You now have one working certifier login tied to your firm.

## Adding another firm later

`supabase/add_firm.sql` sets up a second firm in one run — the firm, its
first certifier, the login, and a document library copied from the firm
that has the fullest one.

1. **Authentication → Users → Add user → Create new user.** Their email
   and a password, "Auto Confirm User" left on. Click the new user and
   copy their **User UID**.
2. Open `supabase/add_firm.sql`, paste that UID and fill in the seven
   values at the top.
3. Paste the whole file into the SQL editor and Run. It prints how many
   library items the new firm got.

They can sign in immediately. Row security keeps the two firms apart:
neither can see the other's projects, documents or clients, even asking
for them by id.

Do not set a firm up by hand instead. The standard document library is
seeded by a migration, which only ran for the firms that existed when it
was run — a firm created any other way has none, and every CDC, NOC and
OC checklist on their projects comes out empty with nothing to say why.

## Step 5 — Get your API keys

1. In Supabase, click the gear icon (**Project Settings**) → **API**.
2. You'll need three values from this page for the next step:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click "Reveal" — keep this one private, never share it)

## Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (GitHub sign-in is easiest — use the same GitHub account this repository is under).
2. Click **Add New** → **Project**, and import this GitHub repository (`certflow`).
3. Before clicking Deploy, open **Environment Variables** and add these four (values from Step 5, plus your Vercel URL once you know it — you can add/edit the last one after the first deploy):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from Step 5 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key from Step 5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from Step 5 |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-project-name.vercel.app` (Vercel shows you this after the first deploy — come back and set it, then redeploy) |

4. Click **Deploy**. After a couple of minutes you'll get a live URL.
5. Once deployed, go back to **Settings → Environment Variables**, fill in the real `NEXT_PUBLIC_SITE_URL` with the URL Vercel gave you, then go to the **Deployments** tab and click **Redeploy** on the latest one (so it picks up that last value).

From now on, every time new code is pushed to this repository's branch,
Vercel automatically rebuilds and updates your live site — nothing further
to click.

## Step 7 — Try it out

1. Visit your Vercel URL, click **Certifier sign in**, and log in with the email/password from Step 3.
2. Go to **Settings** and check your firm details and certifier entry look right.
3. Add a **Client** under Settings (name + email), then click **Invite to portal** — Supabase will email them a sign-in link (Supabase's built-in email sender works out of the box for light testing; see the note below if invite emails don't arrive).
4. Create a **New Job**, assign that client to it under the job's Details tab, and try requesting a document, approving it, issuing the CDC/CC, etc.
5. Ask the invited client to check their email, click the link, set a password, and see their job in the portal at `/portal`.

> **If invite emails don't arrive:** Supabase's default email sender is
> rate-limited and meant for testing, not real client communication. For
> anything beyond a quick test, connect a proper email provider under
> Supabase **Authentication → Providers → SMTP Settings** (e.g. using
> [Resend](https://resend.com), which is also what Section 10 of the build
> brief recommends for the real notification emails later).

---

## What's real vs. what's still ahead

**Real and working now:** certifier login, client login, the full job
workflow (quotes → jobs → CDC/CC/NOC/OC checklists → amendments →
inspections → certificates → modifications → Partial/Whole OC → job
completion), real file uploads and downloads via Supabase Storage, and the
brand-new client portal (view job status, see amendment notes, upload
documents, book inspections under the exact lead-time/weekend rules in the
brief, view issued certificates and inspection reports once released). The
database is multi-tenant-ready (every row carries a `firm_id`, enforced by
Postgres Row Level Security) per the brief's Section 12 guidance, even
though only one firm uses it today.

**Automatic Lot/Section/Plan and council from the address** — working.
Typing a development address (on New Job or the Details tab) suggests
matching NSW addresses, and picking one fills in the Lot/Section/Plan and
the council. A property across several parcels lists them all as
tickboxes so you can choose which the job covers. It reads NSW Spatial
Services, a free public government service that needs no account or key,
and every field stays an ordinary box you can type into.

Land zoning is **not** filled in automatically. It isn't part of the
parcel data, and no public endpoint serving it could be found, so it
stays a field you fill in — the "Find a property on the NSW Planning
Portal" link beside the address opens the official search, which shows
the zoning for an address.

**Deliberately not built yet** — these all need a paid third-party account
with an API key only you can obtain, exactly as the build brief describes:

- **Real email sending** for status-change notifications (brief §10) — currently only the client-invite email exists, via Supabase's basic default sender.
- **Real payment collection via Stripe** (§16) — the "Mark as paid" button is real and manual; actual card charging isn't wired up.
- **NSW Planning Portal reporting** (§9) — this is a **legal requirement** for the firm to report certificates/inspections within 2 business days; it needs the firm's own API subscription key from the NSW Planning Portal team before it can be built.
- **Combined stamped PDF bundle** (§11) — merging approved documents into one stamped PDF (the per-document "requires stamping" toggle is already in place, ready for this).
- **Multi-certifier-firm billing/signup** (§13) — this is intentionally a later phase, once the certifier side is proven on this firm's real jobs.
- **Offline inspection capture** (§14) — a mobile-specific, offline-first rebuild.
- **Live-editing generated documents via OneDrive/Word Online** — instead of downloading a plain Word file, register CertFlow with Microsoft, let each firm connect their Microsoft 365/OneDrive account, and create the letters/certificate there directly. Editing in desktop Word (or Word Online embedded right in the page) would then autosave back to that same file with no download/re-upload step, which is what a proper "edit and it's just saved" experience actually requires. Needs a Microsoft developer/Azure app registration and an OAuth connect flow per firm before it can be built — today's Export as Word → edit → "Upload edited/signed copy" is the interim workflow.
- Reports and Audit screens from the prototype haven't been ported yet (all the underlying data is there — this is a next-iteration UI task, not a data-model gap).

Tell me when you're ready for any of these and I'll wire it up — most of
them just need you to paste in an API key once you've signed up for that
service.

---

## For future reference (technical)

- Framework: Next.js (App Router) + TypeScript + Tailwind CSS.
- Database/auth/storage: Supabase (Postgres + Row Level Security).
- `supabase/migrations/` — run these in order on a fresh project.
- `lib/business.ts` / `lib/constants.ts` — business rules and reference data ported directly from the original prototype.
- Local development: copy `.env.example` to `.env.local`, fill in the same Supabase values, then `npm install && npm run dev`.

## Running the tests

```bash
npm test     # the test suite
npm run check  # types, lint and tests together — run this before pushing
```

The suite covers the parts where mistakes reach a council rather than a
screen: the generated documents (it builds a real approval PDF and Word
file from a fixture and reads them back), the certificate reference and
download filenames, the dashboard's counting rules, and the checklist
ordering. Tests live in `tests/` and are excluded from the production
build.

## Cloud backup (Dropbox / OneDrive) — optional

Lets a firm keep its own copy of every document in its own cloud storage,
in the same folders as the job archive download. Off unless configured:
the Settings page only offers a provider whose keys are present.

You register the app with the provider; CertFlow never sees your firm's
password, and the keys below are the deployment's, not any one firm's.

**Dropbox** — create an app at https://www.dropbox.com/developers/apps
(scoped access, "Full Dropbox" or "App folder"), give it the
`files.content.write` and `account_info.read` permissions, and add the
redirect URI `https://YOUR-DOMAIN/api/backup/dropbox/callback`.

**OneDrive** — register an application in the Microsoft Entra admin
centre, add a Web redirect URI of
`https://YOUR-DOMAIN/api/backup/onedrive/callback`, and grant the
delegated permissions `Files.ReadWrite`, `User.Read` and `offline_access`.

Then add to Vercel → Settings → Environment Variables:

```
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=
```

### Each firm's own sending address

`RESEND_FROM_EMAIL` and `RESEND_REPLY_TO` are the deployment's default.
With more than one firm on a deployment, each sets its own under
**Settings → Firm details → Emails come from / Replies go to**, and its
clients see that firm rather than the first one.

The address must belong to a domain verified with Resend
(**Resend → Domains**). Add each firm's domain there before they fill
the field in — an unverified sender is refused at send time.

Left blank, a firm uses the deployment default, which is what a
single-firm deployment has always done.

### Where client replies go

Emails go out as `RESEND_FROM_EMAIL`. A firm that sends from an address
nobody reads can have answers arrive somewhere else:

```
RESEND_REPLY_TO=info@qpcertifiers.com.au
```

Leave it out and a reply goes to the sending address, as it always did.
Settings → System check names both, so what an email carries can be
checked without sending one.

### How much storage is left

The Storage page in Settings shows what every project is holding. To
have it also show how much room is left, tell it how much the plan
allows:

```
STORAGE_LIMIT_GB=1
```

The number is gigabytes, and it is your Supabase project's storage
allowance — find it under **Supabase → Settings → Usage**, which also
shows what you are currently billed for. Leave it out and the page
shows what is used but says plainly that no limit has been recorded,
rather than inventing one and reporting headroom that may not exist.

Either pair can be left out — a provider with no keys simply isn't
offered. Each firm then connects its own account under Settings → Cloud
backup, and the tokens are stored per firm in a table with row level
security and no policies, so only the server can read them.

### Where fault alerts go (optional)

Anything that breaks is recorded and shown on **Audit → Faults**, and the
first time each distinct fault happens, one email goes out. By default
that email goes to the firm's own address (Settings → Firm). To send it
somewhere else — the person who maintains the software, rather than the
office inbox — add:

```
ERROR_ALERT_EMAIL=
```

Worth setting: a failure that happens before anyone has signed in belongs
to no firm, so this address is the only one it can reach.
