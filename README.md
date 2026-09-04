# Certlyn

A real, working staging version of the Certlyn certification-job-management
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
2. Click **New project**. Pick any name (e.g. "certlyn"), set a database password (save it somewhere safe — a password manager, not a sticky note), pick the region closest to Sydney (e.g. `ap-southeast-2`), and click **Create new project**. Wait ~2 minutes while it's provisioned.

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

## Adding another certifier to your firm

Done inside Certlyn, not in Supabase. As a director, go to **Settings →
Certifiers → + Add certifier**, fill in their name, registration and the
email they will sign in with, and choose their role:

- **Director** — runs the firm. Every project, quotes, invoices, the
  audit log, every setting, and who is on the team.
- **Team member** — an employee or a contract certifier. They see only
  the projects they are the assigned certifier on, have been added to
  the team of (on the project's page, under the address), or are the
  inspector on. No quotes, no invoices, no firm settings; their own
  card and their own two-factor sign-in are all they can change.
A team member can prepare a CDC, CC, modified certificate or OC in
full, but **pressing Issue waits on a director** (database update
**0074**). They press *Request director approval* beside the Issue
button; every director is emailed and it appears on their dashboard;
the director approves or declines with a note, on the project itself.
An approval covers that one issue and is spent by it — regenerating,
or issuing a second OC, asks again. Directors are never asked; they
are the approval. The whole exchange is in the audit log.

- **Inspector** — a certifier who only carries out the inspections
  they are given (database update **0073**). On their projects they see
  two tabs: the approved documents, read-only, and the inspections.
  They record outcomes, issues, photos and notes, and sign the report —
  on the desktop or On site from a phone. They cannot change anything
  about the project, and reporting to the NSW Planning Portal is not
  offered to them: that stays with the firm, which owns the two-day
  reporting window.

Then press **Invite to sign in** on their card. They get an email with a
link to choose a password, and they are in. The database enforces the
role (update **0072**), not just the screens: a team member asking the
database directly for another project's rows gets nothing.

Every certifier who already had a login when 0072 was run is a
director, so nothing changes for anyone until a director changes it.
Your own role can only be changed by another director, so a firm is
never left without one.

## Charging other firms — the Firms page

You are the platform owner (migration 0068 marks your firm), so there is
no separate administrator login to create: sign in as yourself and a
**Firms** entry appears in the top bar that nobody else can see, at
`/platform`. It needs database update **0076**.

For each firm it shows, for whichever month you pick:

- how many **new projects** they created that month,
- how many were **brought across** from another system when they joined
  — never counted, so importing their back catalogue costs them nothing,
- how many they went **over** what their fee covers,
- and **what to invoice**, as lines you can copy onto an invoice.

**Export CSV** gives the whole month as a spreadsheet.

Each firm's terms are set on that same page, per firm, so a firm signed
up on different terms keeps them:

| Setting | Default |
| --- | --- |
| Introductory fee | $99 + GST per month |
| Introductory rate until | 30 June 2027 |
| Fee after that | $399 + GST per month |
| New projects included | 30 per month |
| Each project over that | $25 + GST |

The introductory rate ends on **one date for everybody**, not after six
months counted from each firm's own start: a firm joining in January
2027 holds it for six months, one joining in May holds it for two, and
both move to $399 on 1 July 2027.

**Billing runs by the calendar month.** A firm that starts on 9
September pays September in full, and their 30 included projects run
from the 1st to the end of that month like any other — there is no pro
rata and no part month. A project counts in the calendar month it was
created, in Sydney time, and keeps counting if it is deleted afterwards,
so a firm cannot unsell a project by deleting it. Amounts exclude GST.
Nothing here bills anyone automatically: Certlyn works out the number,
you raise the invoice.

The firm sees their own side of it under **Settings → Your plan**: this
month's count against what they are allowed, and what it comes to. That
is deliberate — a firm should never learn they went over from the
invoice.

Until you set terms for a firm, nothing is counted against a fee for
them and their page says so.

## The demonstration account

An account for showing Certlyn to other certifiers, with nothing to do
with Quality Private Certifiers: its own firm, its own certifier, its
own made-up clients and projects. Row security keeps it apart from your
real work exactly as it keeps any two firms apart — neither can see the
other's projects, even asking for them by id.

1. **Run database update 0075** (it adds the demonstration flag).
2. **Authentication → Users → Add user → Create new user.** Use an
   address you control, e.g. `demo@certlyn.com.au`, leave "Auto Confirm
   User" on, then click the new user and copy their **User UID**.
3. Open `supabase/demo_firm.sql`, paste that UID at the top, and Run.

You get *Certlyn Demonstration Certifiers* with a director and a team
member, three clients, and five projects — one collecting documents,
one ready to issue, one under construction with inspections done and
one booked, one finished with its Occupation Certificate, and one
PC/OC job under another certifier's approval — plus a quote, a paid
invoice and an overdue one, so the dashboard, the compliance clock and
every tab have something real-looking to show.

**No email can leave that account.** The firm is marked as a
demonstration, and Certlyn checks the firm before it sends anything: a
press of Send to client shows exactly what a real firm's client would
have received and then stops, saying so. Every made-up address is on
`example.com`, a domain reserved by the standards so it can never
belong to anyone. A yellow bar across every page says the account is a
demonstration, so nobody watching mistakes it for live work.

**Running the script again resets it** — the projects, clients, quotes
and invoices are wiped and laid out fresh. That is how you put the
account back after a demonstration where you issued a certificate or
ticked off a checklist. It refuses outright to run against a login that
belongs to a real firm.

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

Kept honest deliberately: this section is what gets read when deciding
whether something is worth asking for, and a stale list of "not built
yet" items that were built months ago is worse than no list.

**Working now.** The whole job, end to end: quotes, and an accepted quote
turned into a job carrying its client, address and fees; CDC, CC, Notice
of Commencement and Occupation Certificate checklists drawn from the
firm's own document library; amendments raised against individual
documents; certificates issued as PDF and Word on the firm's letterhead
with its signature and stamp, positioned where the firm wants it;
modifications; partial and whole OC; job completion.

Critical stage inspections: booked by the client from the portal under
the firm's lead-time and weekend rules, confirmed or rescheduled by the
certifier, carried out from a screen built for the van, with photos and
defects, and a report that is generated, signed and released. A calendar
feed each certifier can subscribe to from their phone.

The client portal: outstanding documents, upload, what has been approved
and what needs changes, inspection dates, released certificates and
reports, invoices, and paying by card.

Invoicing: raised from a job or a quote, emailed with the PDF attached,
paid by card through the firm's own Stripe, chased automatically when
overdue, exported to Xero.

Around all of that: an audit log, an issuance register over any date
range, a deadlines screen, storage usage, cloud backup to the firm's own
Dropbox or OneDrive, importing existing jobs from a spreadsheet, address
autofill from NSW Spatial Services, a combined stamped approval bundle,
recoverable deletion, rate limiting, and an error log that emails a fault
the first time it is seen.

**Multi-firm.** Every row carries a firm_id enforced by row-level
security, and a second firm brings its own sending address, its own
Resend account, its own Stripe, its own certificate layouts and its own
document library. Onboarding is `supabase/add_firm.sql` plus the firm
filling in its own Settings.

**Still ahead**, in the order they are worth doing:

- **NSW Planning Portal reporting.** The foundation is built against the
  PCC API specs; it needs the firm's own API subscription from ePlanning
  before it can be switched on. Until then, certificates and inspections
  are reported the way they always were.
- **Two-factor login.** For a login that issues statutory certificates,
  a stolen password should not be enough on its own.
- **Per-firm portal branding.** A second firm's clients see the Certlyn
  front door rather than that firm's, and its overnight reminders carry
  this deployment's address. One setting per firm — a portal address —
  fixes both. Only worth building when a second firm signs.
- **Copying the back catalogue to Dropbox.** Cloud backup copies
  everything issued from the moment it is connected; what was issued
  before it is not copied.
- **Offline inspection capture**, for a site with no signal.
- **Live editing of generated documents** through OneDrive or Word
  Online, instead of download, edit, re-upload.

**Decided against, so nobody re-proposes them:**

- **Virus scanning of uploads.** It would mean a paid service in front of
  every upload, delay before a document appears, and another thing to
  fail. Migration 0062 refuses the file types that are only ever an
  attack instead; the certifier's own antivirus does the rest. A
  malicious PDF is still a PDF — that is understood and accepted.
- **SMS notifications** — judged not worth the cost or the setup.
- **Linking the SEPP code to the CDC assessment.**
- **A complaints register and conflict-of-interest declarations.**

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

You register the app with the provider; Certlyn never sees your firm's
password, and the keys below are the deployment's, not any one firm's.

Until those keys are present the Settings page says so and offers no
Connect button — there is nothing to connect to, and a button that could
only fail would be worse than its absence.

**Dropbox** — create an app at https://www.dropbox.com/developers/apps
(Scoped access, then "Full Dropbox" or "App folder"), and on the app's
page:

- **Permissions** tab: tick `files.content.write`, `files.content.read`
  and `account_info.read`, then Submit. Do this *before* connecting —
  a permission added afterwards does not apply to a connection already
  made, and the firm has to disconnect and reconnect.
- **Settings** tab: add the redirect URI
  `https://www.certlyn.com.au/api/backup/dropbox/callback`, and copy the
  App key and App secret.

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

### Certificate layout and letter wording: three layers

What prints is resolved in this order, per firm and per document:

1. **What this firm saved** in Settings → Certificate layout / Approval
   wording. Theirs alone, and never overwritten from outside.
2. **What the platform owner published** — the same editors carry a
   second button, "Save as the standard for every firm", shown only to
   the owner's firm. It becomes what every firm that has saved nothing
   is drawn from, including firms that signed up before it was
   published.
3. **Certlyn's built-in**, when nobody has published anything.

So the owner improving the standard letter reaches every firm on the
standard; a firm that has written its own keeps it. Migration 0069
stores the published rows with no firm against them, readable by every
certifier and writable only by the owner — enforced in the database, not
only in the form.

The document library is different on purpose: a new firm gets a **copy**
of the owner's library at signup (`add_firm.sql`), and changes made
afterwards on either side stay where they are made. A checklist is a
working list a firm edits constantly; having it change underneath them
because the owner added an item would be worse than useless.

Only the platform owner's firm sees the Storage page at all — the plan
is the owner's, and a firm using Certlyn should see its own projects,
not the size of someone else's plan. Migration 0068 marks the first
firm as the owner and prints back which one it chose.

A deleted project is recoverable for thirty days from Projects →
Deleted, then the morning sweep removes it for good, documents
included, so deleted projects stop counting against storage on their
own.

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

## Still to set up

Things decided on and deliberately left for later. Nothing here is
broken; each is a step that makes Certlyn better without which it still
works.

### Certlyn's own web address — done 31 Aug 2026, one setting left

The site answers at `https://www.certlyn.com.au`; the bare
`certlyn.com.au` redirects to it. The A and CNAME records live in
VentraIP's DNS zone for the domain (a leftover parked-page A record had
to be deleted — two answers for one name kept Vercel's check failing).
The old `certflow-drab.vercel.app` address still works, so every link
already sent to a client keeps resolving.

Done in code, 4 Sept 2026: the overnight sweeps (document reminders,
the review digest) now link to `https://www.certlyn.com.au` whenever
they run on Vercel, so `NEXT_PUBLIC_SITE_URL` no longer needs setting.
Before this a client's morning digest carried Vercel's address for the
deployment itself. Setting the variable still overrides, if the address
ever changes.

### Certlyn's own sending domain — done 31 Aug 2026

`certlyn.com.au` is verified in Resend (DKIM, the two sending CNAMEs,
and DMARC all sit in VentraIP's DNS). Mail goes out as
`Quality Private Certifiers <notifications@certlyn.com.au>` with replies
directed to the firm's own inbox — `RESEND_FROM_EMAIL` and
`RESEND_REPLY_TO` in Vercel.

This is also what lets a future firm with no domain of its own send as
itself: Resend will only send from a domain verified in the account
whose key is used, so such a firm sets its sending address to
`Their Firm Pty Ltd <notifications@certlyn.com.au>` with its own inbox as
the reply-to. Their client sees their name; replies reach them.

### Planning data from the address — needs verifying against the live service

Pressing **Look up lot, council & planning** on the Details tab asks NSW
for the parcel and then for the planning layers over it: zone, lot area,
heritage and bushfire. Nothing is applied automatically — each finding
is shown with a "Use this" button, because these end up on a statutory
certificate and a zone taken on trust from a map service mid-republish
is a certificate issued on a premise nobody checked.

Two deliberate refusals in that panel:

- **A layer with nothing over the parcel reads "not identified", never
  "No".** Silence from a map service is not a clearance.
- **Flood and frontage are not offered at all.** Flood planning layers
  are council-held with patchy statewide coverage, so "No" would usually
  mean "nothing published". Frontage is not an attribute anywhere — it
  would have to be measured off the boundary, and for a corner lot or a
  battleaxe there is no single right answer.

**The endpoints are not yet proved.** This environment has no route to
the NSW services, so the layer names and services in `lib/nsw/planning`
are written from documentation, and the arithmetic and parsing are what
the tests cover. Confirm them against the live service with
`/api/address-details?address=…&debug=1`, which returns every request
made and every response, then correct the field patterns from what comes
back. An earlier attempt at zoning was abandoned because every endpoint
"came back empty" — from an environment that cannot reach NSW at all,
empty and blocked look identical.

### CDC conditions — the firm uploads them once

The conditions a CDC is issued subject to are the department's words,
not the firm's: nine to sixteen pages of the Regulation, different for a
greenfield dwelling, a demolition, an alteration. Certlyn does not hold
the text and never should — it holds the PDF and the name the firm knows
it by.

Set them up once under **Settings → CDC conditions** (migration 0070),
then tick which apply on each CDC project. More than one is normal — a
dwelling and the demolition preceding it are two sets. The chosen ones
are named on the certificate's Conditions row and attached to the
approved set behind it, ahead of the approved documents.

CDC only, deliberately: a Construction Certificate is issued against a
consent whose conditions are the council's, and an Occupation
Certificate imposes none of its own.

### The AI assistant — needs one key in Vercel, and database update 0071

Every project page now opens with **What's still needed**: the documents
not yet received, sent back for changes, or waiting on the certifier,
stage by stage (CDC/CC application, NOC, Occupation Certificate,
modifications). That list is read off the checklists and nothing else —
the AI is never allowed to decide what a project needs.

Underneath it, **Write with AI** drafts the note to the client: one or
two plain-English sentences per document saying what it is, who
prepares it and what it must show. The certifier reads it, changes what
they like, and only then presses Send. Until `ANTHROPIC_API_KEY` is set
under Vercel → Settings → Environment Variables (then Redeploy), the
same button writes the note from the document library's own
descriptions instead and says so.

What is sent to the AI: the project type, the description of the works,
and the titles and library descriptions of the outstanding documents.
No names, addresses, or files. Each note costs a few cents; the key is
created at console.anthropic.com and, like every other key, is pasted
into Vercel and never into a chat or an email.

**The dashboard note.** The dashboard opens with **Your assistant**: a
headline and a few points on what has happened and what is worth doing
— which client uploaded which document and when (in Sydney time),
documents waiting to be assessed and how long the oldest has waited,
bookings to confirm, inspections coming up or passed with no result
recorded, deadlines, money overdue. Each point links to its project.

The app gathers those facts; the AI only writes them up, and is told it
may not invent one. The note is kept in the `ai_briefings` table
(**run migration 0071**) with a fingerprint of the facts it came from,
so reopening the dashboard shows the same note for nothing and a new
one is written only when something has changed (and not more often
than every fifteen minutes, unless Refresh is pressed). Without the key
the same card lists the facts plainly, so nothing is lost — only the
prose. Site addresses do go to the AI for this note, because the note
is about them; client names still do not.

### AI reads uploaded documents — same key as above

On every uploaded document, **Read the details with AI** sends the
first four pages (or the photo) to the AI, which reads the title block
and suggests the Schedule 1 details: label, prepared by, reference
number, revision, date. Each comes back beside what the box holds now
with a **Use** button, and nothing is saved until one is pressed. It
also says whether the address printed on the document is this
project's, and flags anything worth knowing — unsigned, expired, marked
preliminary.

The document itself is what is sent, so this is the one AI feature
where a client's document leaves Certlyn. The button only appears when
`ANTHROPIC_API_KEY` is set, and reads nothing until pressed. A reading
costs a few cents; a long drawing set is cut to its first four pages
before it goes.

### On site, on a phone — built; install it to the home screen

`/site` is the inspection as one thumb-sized column: directions, call
the site, what was found, issues, photos straight from the camera (with
retry over one bar of signal), notes, sign, report to the Portal, email
the client. Reached from the **On site** tab on a phone, or **Open on
site** on any inspection card.

Certlyn now installs to a phone's home screen (Chrome: menu → Add to
Home screen; Safari: Share → Add to Home Screen), opening without the
browser around it.

### The public pages — one optional setting

The homepage, `/how-it-works`, `/why-certlyn`, `/pricing` and `/join`
are readable without a login. The product pictures on the homepage are
drawn from the app's own parts; drop real screenshots into
`public/screenshots/` (see the README there) and the page uses those
instead, taken on a demo project so no client's address is published. The price, the plan's contents and the
launch offer dates live in `lib/pricing.ts` and are quoted from there on
every page that mentions them. The form on `/join` emails
whoever runs Certlyn: `CONTACT_EMAIL` in Vercel if it is set, otherwise
the email on the owner's firm (Settings → Firm). It goes out through
the deployment's own sending address, so it needs `RESEND_API_KEY` like
every other email. Five messages a minute from the whole world is the
cap, and a hidden box catches the robots.

### Two-factor sign-in — check one switch in Supabase

Settings → Sign-in security lets each certifier scan a QR code into an
authenticator app; from then on every sign-in asks for the six-digit
code, and no certifier page or action opens without it. Supabase does
the cryptography (`auth.mfa`); Certlyn only carries the steps across.

Two things to know:

- **Supabase must allow it.** Authentication → Sign In / Providers →
  Multi-Factor Authentication → TOTP should be enabled. It usually is by
  default; if "Set up two-factor sign-in" answers with an error, that is
  where to look.
- **A lost phone locks the account.** There are no recovery codes. The
  fix is in Supabase: Authentication → Users → the certifier → remove
  the MFA factor. They can then sign in with their password and set up a
  new phone. Only the person with Supabase access can do this, which is
  what makes it safe.

Clients are not offered two-factor; their portal holds their own
project only.

### Privacy policy and terms — live, and due for a solicitor's eye

`/privacy` and `/terms` are linked from every public page and from the
interest form. Both are written to be true of the app as it is: every
processor named is one the code sends data to, and the terms say
plainly that every statutory decision is the certifier's. They should
still be read by a solicitor before another firm signs up.

The operating entity is `Certlyn` in `lib/legal.ts`; when Certlyn has
its own company and ABN, change it there and both pages follow. The
contact address on both pages is `CONTACT_EMAIL` once it is set in
Vercel, and the interest form until then.

### Charging other firms — run updates 0076 and 0077

Built 4 Sept 2026: see "Charging other firms — the Firms page" above.
Run **0076** then **0077** — the second makes the introductory rate end
on a date rather than after a number of months. Set each firm's terms on
that page as they sign up. Two decisions are
still yours:

- **The website now says what the Firms page charges** — $99 + GST a
  month until 30 June 2027, then $399 + GST, with $25 + GST a project
  past 30 and billing by calendar month. Both come from
  `lib/pricing.ts`, so a change of offer is one edit there.
  The old "join before 1 January 2027" condition is gone: the offer
  ending on a fixed date does that work by itself, since the later a
  firm joins the fewer months they get. Say the word if you want the
  cut-off back.
- **Nothing enforces the cap.** A firm that creates a 31st project in a
  month is not stopped or warned beyond the bar under Settings → Your
  plan; it simply appears on the invoice. Say the word if you want a
  warning at the point of creating one.

### The demonstration account — run update 0075

Built 4 Sept 2026 and ready to set up whenever you want it: see "The
demonstration account" above. Nothing else needs 0075, so a database
without it behaves exactly as before.

While building this, a fault in **0074** came to light and is fixed in
both files: its gate refused every write that was not a signed-in
certifier — a background sweep, or a SQL script run by you — rather
than letting them past. If you have already run 0074, running 0075
installs the corrected version.

### Roles and the director's sign-off — run updates 0072, 0073 and 0074

Built 4 Sept 2026. Until **0072** is run in Supabase, every certifier
login still has the run of the firm and the role and invite controls
under Settings → Certifiers stay hidden. **0073** adds the third role,
Inspector — inspections only, approval documents read-only, no Portal
reporting — and is enforced by the database, including a guard that
stops anyone but a director changing a role. **0074** adds the
director's sign-off before a team member issues: the database refuses
to create a certificate for a non-director without an approved,
unspent request, and spends it in the same statement, so one yes can
never issue two certificates. Once it is run, everyone who
already had a login is a director; add a team member, set their role,
and press **Invite to sign in** — see "Adding another certifier to your
firm" above. The invite needs email sending switched on (Settings →
Email sending).

Three deliberate limits, all the owner's to revisit:

- A team member cannot create a project. The director creates it and
  assigns them; the same for importing.
- The sign-off is per issue and cannot be switched off for a trusted
  team member. If someone should issue freely, make them a director.
- The dashboard's AI note is the director's only, since it is written
  about the whole firm.
- Firm-level settings functions that store keys (Stripe, Resend) still
  answer any certifier login of the firm at the database level; the
  screens that call them are director-only. Tightening those two
  functions is a small follow-up if a firm has a team member it does
  not trust with that.

### A second firm — waiting on a firm being ready

The owner's decision, 2 Sept 2026: leave the second firm until one is
actually ready to join, rather than standing a test firm up now.
`supabase/add_firm.sql` is written and proved against a real database
(the unfilled placeholder, a UID with no login behind it, a real login
creating the firm, and a second run refusing to duplicate).

Two migrations go with it and are only worth running then:

- **0068** marks the owner's firm, which is what hides the Storage page
  from everybody else. With one firm there is nobody to hide it from.
- **0069** adds the published standard layout and wording. Until it is
  run, "Save as the standard for every firm" answers that it could not
  save — the button shows because a database without 0068 has no owner
  flag to check, and one firm is treated as the owner.

**0067** is different and is worth running now: without it a partial
Occupation Certificate cannot record what it excludes.

### Also worth doing

- Register `certlin.com.au` and point it at the same place. It catches
  the misspelling everyone will make on the phone, forever.
- Put Certlyn through IP Australia's trade mark search. A domain being
  free does not mean the name is.

### Security review — three passes, the listed work finished

Run before letting a second firm in, because from that point one firm's
mistake or malice reaches another's clients. First pass, two findings,
both fixed:
an unauthenticated endpoint that emailed any certifier with
caller-supplied content, and two actions that handed browser-supplied
ids to the service role, which row security does not constrain.

**Already covered, and clean:** the four client-portal document routes
(they gate on the caller's own session before the service role does the
assembly); firm isolation on jobs, clients, invoices, quotes and
checklist items, proved against Postgres in both directions; the Stripe
and Resend credential tables, which no login can read at all; and every
server action that writes a row named by the browser — all but the two
found go through the caller's own session, where row security applies.

**Second pass** covered the token links and the upload path, and found
two more, both fixed: a link scheme that failed open without its secret,
and an upload folder the database was not checking. Migration 0061 goes
with the second. The calendar feed's firm scoping moved from JavaScript
into the query while it was open — it was right, but it was one careless
edit from handing over every firm's diary.

**Third pass** went through everything on that list. Three findings,
all fixed:

1. **Spreadsheet formula injection in the CSV exports.** The issuance
   register and the Xero invoice export quoted their fields correctly
   but did not neutralise them. A value beginning `=`, `+`, `-`, `@` or
   a tab is run as a formula by Excel, Google Sheets and LibreOffice —
   and some of those fields are typed by clients through the portal. A
   client could have written a live formula into a register a certifier
   later opens. Both exports now go through `lib/csv`, which prefixes
   such a value so it is stored as text. Plain numbers are exempt: a
   credit line arriving as the text "'-50.00" is an import Xero rejects.
2. **The client-facing PDF routes had no rate limit** while the
   certifier's equivalents did. Each builds a certificate or an invoice
   from scratch on every request, so a signed-in client — or a stolen
   session — could loop them. All three now sit behind the same ceiling.
3. **A served file's content type came from the filename in the URL**
   rather than from the sealed token that decides what is served. Now
   taken from the storage path.

**Checked and clean:** every job document route (archive, stamp,
approval bundle, neighbour letter, inspection report PDF and Word, the
OC set) scopes the job to the caller's firm before building anything;
`/api/forms/[itemId]` reads the item through the caller's own session
and only then resolves the file behind it; `/api/search` is firm-scoped
on all four tables and strips PostgREST's own operators out of the
search text; the report exports are firm-scoped; `/api/uploads/recent`
checks the role and joins on the firm; the ePlanning endpoint fails
closed without its credentials and compares them in constant time; the
cron endpoint refuses without `CRON_SECRET`; the backup OAuth callback
checks the state cookie *and* that it belongs to the caller's firm; the
portal file token names one file and expires; password reset is rate
limited per address, says the same thing whether or not the address is
known, and signs the browser out before verifying; `/auth/confirm`
cannot be turned into an open redirect; `client_book_inspection` — the
one function a client's browser calls directly — enforces role, job
visibility, outcome, double-booking, the NOC gate, weekends and the
notice period in the database itself; no `dangerouslySetInnerHTML`
anywhere in the app; and every digest email escapes what people typed.

**Still open, and deliberately:** the local Postgres harness had row
security switched off on `storage.objects`, which made the first storage
test pass when it should have failed. Supabase enables it on the
platform, so this was the harness lying rather than the app — but any
future storage test must enable it first, or it proves nothing.

### The promotional page — written, held back deliberately

https://claude.ai/code/artifact/d1143407-eb10-40e5-984b-652373e92561

A one-page pitch to NSW certifiers, structured around the certification
pathway itself. Private until shared. The owner's decision is to hold it
until the software has been proven on real jobs, which is the right way
round — advertising early wins a first customer and a first complaint in
the same week.

To change it, publish to that URL rather than creating a new one, or the
link goes stale. Two placeholders are waiting on a decision:

- `hello@certlyn.com.au` appears in three links and is invented.
- There is no pricing on it, because none has been set. Leaving price
  off is a legitimate choice — it starts a conversation rather than
  ending one — but it should be a choice.

Every claim on it was checked against the code before it was written,
which is what turned up that the feature list above had gone stale. Do
the same before changing it: the page is only worth anything while
everything on it is true.

### An open question, for the owner's accountant

Whether the domain and the software belong in QP Certifiers Pty Ltd or a
separate entity. Selling software to other certifiers is a different
business from certifying, and separating it is much easier before firms
are using it than after.

### Two things noticed while testing, for the firm to decide

- **The firm's name reads two ways.** Email goes out as "QP Certifiers"
  and signs off "Quality Private Certifiers" — the sign-off is
  Settings -> Firm details -> Name, which is also what prints on
  certificates. Deliberate, or worth making consistent.
- **A test client carries a real address.** The invoice test went to a
  client record whose email is the owner's own. Worth tidying before real
  invoices go out, or a client's invoice lands in the wrong inbox.
