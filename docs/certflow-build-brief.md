# Certlyn — Build Brief (v2)

A client project portal for a NSW building certification firm (Quality Private
Certifiers). This document describes the certifier-side prototype
(`certflow-client-portal.jsx`) as it stands today, so it can be turned into real,
deployed software with a database, login, and file storage — starting with the
client-facing portal, which was deliberately deferred from the prototype.

**This replaces the earlier v1 brief in full — a lot has changed since then.**

---

## 1. What this software does

Certifiers track building jobs from quote through to occupation. A quote, once
accepted, becomes a job. Each job moves through four stages: **CDC or CC → NOC →
Inspections → OC**. At each document stage, the certifier requests specific
documents from the client, reviews what's uploaded, either approves it or raises
amendment points, and — once everything is approved — issues the formal
certificate. Multiple registered certifiers at the firm can each issue documents,
inspections, and certificates independently.

---

## 2. Core data model

**Firm**
- Name, ABN, letterhead details (postal/office address, phone, email)
- **Certifiers** (plural, not a single hardcoded person): each with name,
  registration number, registration body. Any certifier can be selected as the
  issuer of any CDC/CC, modification, OC, or inspection — not just one default
  person. Managed under Settings.

**Quote**
- State, project type, pathway (CDC/CC), project dates, validity period
- Proposal address, Lot/Section/Plan, project title, certifier, building
  classification(s) (multi-select), development description
- Contact details (applicant, owner — with "owner is applicant" toggle), council LGA
- **Fee schedule**: line items (description + amount), auto-totaled
- Status: `draft → sent → accepted / declined`
- "Issue quote to client" generates the actual priced quote document (letterhead +
  fee table), viewable, printable, and exportable to Word; "Email to client" opens
  a pre-filled email draft (see Section 8 on why it can't attach automatically yet)
- Once **accepted**, "Generate job from quote" creates a real job with address,
  description, pathway, applicant/owner contact, council, and classifications
  carried over automatically

**Job**
- Address, scope of works, **job types** (multi-select from a preset list, or type
  a custom one — not a single fixed category), pathway (`CDC` or `CC`)
- **Assigned certifier** (default issuer for this job's certificates, set at
  creation, overridable per certificate)
- **Status**: `active` or `complete` (see Section 4, job completion)
- `details`: project number, zoning, BCA/NCC version, applicant contact, applicant
  address, owner details (or "same as applicant"), council/LGA + contact, proposal
  details (classifications, construction type, dwellings, cost, storeys, effective
  height, floor area), site area, building description, certificate details
  (Lot/Section/DP, NSW Planning Portal ref, relevant EPI, relevant part of code,
  determination date, lapse date — see Section 4 for the lapse rule)
- `conditions`: Conditions of Consent, entered manually, appear on the CDC/CC
- `checklists`: **CDC/CC, NOC, and OC checklists are all open and usable from job
  creation** — none of them are gated behind certificate issuance (see Section 4).
  Each modification also gets its own checklist (see below).
- `inspections`: list of requested inspections, each independently assignable to
  any certifier
- `certificateRecords`:
  - `pathway`: the original CDC/CC — `generated`, `generatedDate`, `issuedBy`,
    `version` (bumped on regeneration), `approvalUploaded`, plus a `modifications`
    array (see below)
  - `oc`: **not a single record** — a `records` array, each one a Partial or Whole
    OC (see Section 4 — "Final OC" is retired terminology)

**Checklist item** (belongs to a checklist — original CDC/CC, NOC, OC, or a
modification)
- Title, description
- `status`: requested → submitted → approved
- `amendments`: independently-resolvable amendment points (not one blanket note)
- `version`: increments on client resubmission — **current file overwrites the
  previous one**, no version history kept (firm's explicit choice)
- **`revision`, `documentDate`, `preparedBy`**: the actual document's own revision
  letter, the date it was prepared, and who prepared it (e.g. the architect) —
  separate from Certlyn's internal submission/approval dates. Shown on the
  generated certificate's document schedule.

**Modification** (a Modified CDC/CC)
- `id`, `reason`, `generated`, `generatedDate`, `issuedBy`
- Has **its own checklist**, auto-populated from the same document library as the
  original CDC/CC, at `project.checklists[modification.id]`. Request updated
  documents, review, approve — same workflow as any other checklist. Only once
  that checklist is fully approved can the modification actually be issued.

**Occupation Certificate record** (one of possibly several, in `oc.records`)
- `id`, `type`: `"partial"` or `"whole"`, `description` (scope, for partials),
  `generatedDate`, `issuedBy`, `approvalUploaded`, `approvalDate`
- A job can have several Partial OCs before an eventual Whole OC. There is no
  single "the OC" anymore — see Section 4.

**Inspection**
- Title, description, date (real date picker, not a placeholder string)
- `outcome`: `pending → passed / failed / passed_subject_to`
- `defects`: independently-resolvable points (used for both Fail and Pass-subject-to)
- `inspectorName` / `inspectorLicense`: assignable per inspection from the
  certifier registry — different inspections on the same job can have different
  certifiers
- `reportSent` / `reportSentDate`

**Condition of Consent** — free text, entered manually by the certifier, appears
on the generated CDC/CC certificate.

---

## 3. Key workflows

### Quote → Job
1. Certifier builds a quote with a fee schedule
2. "Issue quote to client" generates the priced document and marks it Sent
3. Client accepts (marked manually by certifier for now) → certifier clicks
   "Generate job from quote" → real job created with details prefilled

### Job creation
New jobs auto-populate the CDC/CC, NOC, and OC checklists from a standard document
library for the chosen pathway — the certifier adds/removes items manually from
there. A default certifier is assigned at creation.

### Document review (identical across original CDC/CC, NOC, OC, and modifications)
1. Client uploads → status becomes `submitted`
2. Certifier approves, or adds one or more amendment points (each independently
   resolved, not a single blanket note)
3. Client re-uploads → **overwrites** the previous file; version counter
   increments; amendment points stay until manually resolved
4. Once every item in a checklist is `approved`, that stage is complete

### Inspections
1. Certifier marks Passed / Failed / **Passed subject to** (a third outcome — for
   inspections that pass but leave outstanding items to close out, distinct from
   an outright fail)
2. Fail or Pass-subject-to both require recording at least one defect/condition,
   each independently resolvable
3. Each inspection has its own assignable certifier and its own generated report
   (letterhead, owner details, site address, result, defects/conditions, inspector
   name and license), printable/Word-exportable, with a "send to client" action

### Issuing the original CDC/CC
Available once that checklist is fully approved. Certifier picks the issuing
certifier from the registry and generates it — a formatted certificate with a
document schedule (including each document's revision, document date, and
preparer), Conditions of Consent, and an "APPROVED" stamp. **Can be regenerated**
(e.g. to correct a mistake) — this bumps the version number and clears any
uploaded signed approval, since a new document needs a fresh sign-off.

### Modified CDC/CC
Once the original is issued, "Start a modified {pathway}" creates a **new
checklist** for that modification (same document library as the original) with a
recorded reason. The certifier requests/reviews/approves documents on it same as
any checklist; only once that checklist is complete does "Issue modification"
become available, with its own certifier picker. Multiple modifications can exist
on one job, each independently.

### Occupation Certificates — Partial and Whole, no more "Final OC"
"Final Occupation Certificate" is retired NSW terminology and has been fully
removed from this software. Once the OC checklist is complete and the original
CDC/CC has been issued, the certifier can issue as many **Partial OCs** as needed
(each with a description of scope, e.g. "Units 1–4") followed eventually by a
**Whole OC**. Each is a separate, independently viewable/exportable certificate
with its own certifier and its own signed-approval upload state.

### Job completion
Once a **Whole OC** has been issued, a "Mark job complete" button appears on the
job. Completed jobs get a badge; a "Reopen job" link is available if needed.

### CDC lapse date
Auto-calculated: always **5 years** from the date of issuance, **unless** work
has commenced (NOC checklist fully approved) and at least one inspection has
passed/failed/passed-subject-to — in which case it shows "N/A — construction
commenced" rather than a fixed date, on the reasoning that the certificate has
already been acted upon. **This interpretation should be double-checked against
actual NSW practice before relying on it in production** — it was built from a
verbal description, not the legislation itself.

---

## 4. Important structural decisions worth knowing before building the real version

- **NOC and OC checklists are NOT gated behind CDC/CC issuance.** They can be
  built and worked on from day one. What *is* still gated behind CDC/CC issuance:
  the Inspections tab (construction can't logically start before approval), and
  actually *issuing* an OC certificate (can't occupy a building before its
  development approval exists). This distinction was deliberately corrected after
  an earlier, overly broad lock was found to be blocking legitimate early
  checklist prep.
- **Partial/Whole OC, not "Final OC".** Any reference to "Final Occupation
  Certificate" anywhere in older documentation, mockups, or reference systems
  should be disregarded — this software's model is authoritative going forward.
- **Multiple certifiers, not one hardcoded person.** Every certificate,
  modification, and inspection independently records who issued/inspected it.
  Don't assume a single "the certifier" anywhere in the real build.

---

## 5. Roles (for the real build)

- **Certifier / firm staff** — full access to their firm's jobs; which specific
  actions (e.g. issuing certificates) should be restricted by registration status
  is a real-world business rule to confirm with the firm, not something the
  prototype enforces
- **Client** — **not yet designed.** This is the next thing to build for real
  (see Section 7) — access to only their own job(s); upload documents; view
  checklist status, amendment notes, inspection outcomes; view/download issued
  certificates once the signed approval is uploaded

---

## 6. What's simulated in the prototype vs. needs to be real

| Prototype (fake) | Needs to become |
|---|---|
| "Simulate client upload" button | Real file upload to storage, from a real client login |
| In-memory React state | Real database, persists across sessions |
| No login | Real authentication for certifier + client accounts |
| "Send inspection report" is just a flag | Actually emails/notifies the client |
| "Email to client" opens a pre-filled mailto draft, no attachment | Real email API sending the actual document as an attachment |
| NSW Planning Portal is a link-out only | Real automated Lot/DP/Section/Zone lookup |
| Certificate schedule lists approved documents | Real merged, stamped PDF bundle of the actual files |
| Nothing reports to the NSW Planning Portal | **Legally required** data reporting via the Common API — see Section 9 |
| Everything lost on refresh or code update | Real backups |

---

## 7. THE NEXT THING TO BUILD: the client-facing portal

This was deliberately never prototyped — a fake login with fake data wouldn't
have validated anything real about the client experience, so it's better built
once, for real, than thrown away as a demo. The certifier-side data model was
already built with this in mind:

- Amendment points are visible, structured data — ready to surface to a client
- Certificates carry an `approvalUploaded` flag, intended as the "now visible to
  client" moment
- Inspection reports have a `reportSent` flag for the same purpose
- Checklist item statuses (requested/submitted/approved/amendment) map directly
  onto what a client needs to see and act on

**Suggested scope for a first client portal:**
1. Client login (scoped to their own job only)
2. View job status: checklist progress per stage, with amendment notes clearly
   shown per document
3. Upload documents directly (replacing "Simulate client upload")
4. View/download issued certificates once `approvalUploaded` is true
5. View inspection outcomes and reports once `reportSent` is true

---

## 8. NSW Planning Portal integration (site zoning/lot lookup)

**Goal:** auto-populate Lot/Section/DP and Land Zone from the typed site address.

**Why it's just a link-out in the prototype:** the Spatial Viewer has no public
third-party API, and a Claude Artifact has no outbound internet access at all.

**How to build it for real:** geocode the address, then query NSW Spatial
Services' cadastre and Land Zoning Map services (public map services, not a
polished API) at that coordinate — server-side, to avoid CORS and to cache
results. Populate the fields but keep them manually editable.

**Address-autocomplete specifically:** the certifier asked for a typeahead
field — type the address, select from live suggestions, with Lot/DP
pre-filled automatically on selection. This can't be faked with a static
list the way councils/suburbs were (35 councils is a workable static set;
NSW's millions of individual addresses are not). Use an address-autocomplete
API (Google Places, or the NSW address locator) for the typeahead itself,
then resolve the selected address to its cadastral Lot/DP via the same
NSW Spatial Services lookup described above — both pieces come from the
same underlying property record, so one selection can populate both fields
at once. Keep a manual-entry fallback for addresses the API doesn't
recognise (new subdivisions, etc.).

---

## 9. NSW Planning Portal data reporting — LEGAL REQUIREMENT, not optional

**This is a compliance obligation, not just a nice-to-have integration.** Under
the Building and Development Certifiers Regulation 2020, registered certifiers
must report CDC/CC/OC issuance and critical stage inspections to the NSW
Planning Portal **within 2 business days of each event**.

**The real API to use:** the NSW Planning Portal **Common API** includes
`CSIPerformed` and `CSIMissed` endpoints specifically for reporting critical
stage inspections, plus equivalent reporting hooks for certificate issuance.
Access requires a subscription key — request it by emailing the NSW Planning
Portal team with the firm's organisation details (the firm has already been
told to expect this contact). Full API specs are published at
planningportal.nsw.gov.au/API.

**Why it's not in the prototype:** no outbound internet access from a Claude
Artifact, same reason as the zoning lookup and email sending.

**How to build it for real:**
1. Store the Planning Portal API subscription key securely on the backend once
   obtained (never in client-side code).
2. When an inspection outcome is recorded (`passed`/`failed`), call
   `CSIPerformed` or `CSIMissed` with the relevant job/inspection data.
3. When a CDC/CC or OC is generated, call the equivalent certificate-reporting
   endpoint.
4. Track the 2-business-day deadline per event and surface anything approaching
   or past it as a task — this fits naturally alongside the existing dashboard
   task list (lapsing CDCs, open amendments, etc.), since it's the same kind of
   "don't let this slip" item a certifier needs to see without hunting for it.
5. Log each report attempt (success/failure) — if the Portal API is briefly
   down, the firm needs to know a report didn't go through, not just fail silently.

---

## 10. Real email sending, and status-change notifications

**Why the prototype can't do it:** a browser can open a pre-filled `mailto:`
draft but cannot attach a file to it — that's a browser security restriction, not
something workaroundable client-side. Beyond that, the prototype has **no
notification system of any kind** — approving an item, requesting an amendment,
issuing a certificate, or sending an inspection report are all just in-memory
state changes; nothing goes out to anyone. Even the client-facing view is a
same-session preview, not a real separate client actually being notified.

**How to build it for real:** send from the backend via a transactional email API
(Resend, Postmark, SendGrid, etc.), triggered server-side on the events that
matter to a client, with the relevant document/PDF attached directly where
applicable:
- Document approved
- Amendment requested (include the note itself in the email body)
- Client's resubmission acknowledged
- Certificate issued and now visible in their portal
- Inspection report sent

This also covers quotes and reports being emailed out, and is a natural place to
log a "sent" timestamp against each record for traceability.

**Certifier-facing notification — a different case from the ones above:** every
event listed above is outbound *to the client*, triggered by the certifier's own
click. Client-initiated events need the same treatment in the other direction —
specifically, a client booking an inspection (see Section 15, inspection
booking rules) should immediately email the certifier and/or push an in-app
notification. This can't be simulated at all in the prototype, since there's no
certifier action to hang a `mailto:` draft off — it has to be a real server-side
trigger firing the moment the client's booking is saved, independent of anyone
clicking anything. The prototype does show this as an in-app dashboard task and
an on-page confirmation banner once the certifier is looking at it — the real
build should add the actual push/email trigger on top of that, not replace it.

---

## 11. Combined PDF bundle + real document stamping

**Requested:** once a checklist is fully approved, combine the actual uploaded
files into one PDF, and apply a visible "APPROVED" stamp onto the real document
pages (not just the summary certificate, which already has this).

**Why it's not real yet:** there are no real uploaded files — checklist items are
simulated metadata, not actual binary documents.

**How to build it for real (once file storage exists):** server-side PDF library
(e.g. `pdf-lib`) to merge every approved document's stored PDF in checklist
order, and to stamp each page with "APPROVED", the certifier's name/registration
number, and date. Keep the merged file as a convenience bundle alongside the
originals — don't discard the source documents.

**Selective stamping, not blanket stamping.** Each checklist item now has a
`requiresStamping` boolean, toggled by the certifier via a "Stamp" button next
to each document — it is not automatically true for every approved document.
The document schedule already shows a "Stamped" column reflecting this
selection. When building the real PDF-stamping step above, only apply the
physical stamp to documents where `requiresStamping` is true, not to every
approved document in the checklist.

---

## 12. Architecture guidance

Build **multi-tenant from day one**, even though there's only one firm today —
every job/quote/certifier should belong to a `firm_id`. Cheap to do now, avoids a
rebuild if the firm later sells this to other certification companies (the
long-term intent).

**Suggested stack:** Next.js + Supabase (Postgres, auth, and file storage in one
service — good fit for a solo/small build, free tier to start). Deploy on Vercel.

---

## 13. Selling this to other certification firms — SaaS/multi-tenant plan

This is a real, viable second phase — build it once the certifier-side product
is proven with the firm's own real jobs, not at the same time as getting the
firm itself running. Section 12's "multi-tenant from day one" advice is what
makes this affordable to add later instead of requiring a rebuild.

**What needs to be added, on top of everything else in this brief:**

1. **True data isolation between firms.** Every job, quote, certifier, and
   client record needs a `firm_id`, and the database itself — not just the
   application code — must enforce that one firm can never read another firm's
   data, even by a bug. Supabase's **Row Level Security (RLS)** is built
   exactly for this: policies attached to each table that filter every query
   by the logged-in user's firm automatically. Don't rely on the frontend
   remembering to filter by firm — enforce it at the database layer.

2. **Configurable firm identity.** Firm name, ABN, logo, letterhead
   address/phone/email, and the certifier registry are currently hardcoded
   constants (`FIRM`, `defaultCertifiers()`). These need to become per-firm
   settings, editable from within the app, so every generated certificate,
   letter, and client portal shows the correct firm's own branding — not
   Quality Private Certifiers' details for every tenant.

3. **Signup and onboarding.** A new firm needs to create an account (company
   name, ABN, first certifier) and land in a clean, empty version of the
   software — no existing jobs, no other firm's data visible, sensible
   defaults (e.g. the standard DOC_LIBRARY and INSPECTION_LIBRARY) pre-loaded
   so they're not starting from a blank checklist library.

4. **Real billing.** Use **Stripe** for recurring subscriptions — it handles
   monthly charging, failed payments, upgrades/downgrades, and cancellations,
   so none of that needs to be built from scratch. Decide on a pricing model
   early since it affects the data model (e.g. per-certifier-seat pricing
   needs the certifier registry to be countable per firm; flat-rate pricing
   doesn't).

5. **Real user accounts and roles within each firm.** The prototype has no
   login at all — "the certifier" is just an implicit concept. A real firm
   will likely want multiple people logging in (senior certifier, junior
   certifier, office admin) with different permissions, which also solves the
   "who is actually approving this document" attribution gap noted in the
   Audit section elsewhere in this brief.

**Sequencing recommendation:** get the certifier-side product solid and
genuinely used on the firm's own real jobs first. That's what validates the
product itself. The tenant-isolation, billing, and onboarding layer is a
distinct, addable-later phase — cheaper to build once, properly, after the
core product direction is proven, than to build both simultaneously.

---

## 14. Explicitly deferred (don't build yet, beyond the client portal)

- Billing / subscriptions for other firms
- Document version history (currently overwrite-only, by firm's choice — worth a
  final gut-check before real file storage locks this in)
- Job deletion, and voiding a certificate outright (only regenerate/reissue exists)
- Firm-level business reporting (turnaround time, revenue, workload per
  certifier) — Reports currently just counts CDC/CC/NOC/OC issuance
- Certifier workload view (who currently has how many active jobs) — cheap to
  add now that the audit data model exists, useful for deciding who to assign
  a new job to
- **Offline inspection capture** — genuinely can't be built in this prototype
  at all, unlike everything else on this list. This needs a service worker
  and real persistent device storage, and Claude Artifacts are explicitly
  restricted from using any browser storage API — the same category of hard
  limitation as real file storage or real email, not a "haven't gotten to it
  yet" item.

  **How to build it for real:** architect the mobile app as offline-first
  from the start, not retrofitted later — that's a materially bigger job.
  - Register a **service worker** so the app shell loads even with no
    connection.
  - Store in-progress inspection data (outcome, defects, photo files) in
    **IndexedDB** on the device the moment the certifier records it, before
    attempting any network call.
  - Use the **Background Sync API** (or a manual "sync now" retry loop as a
    fallback for browsers without it) to push queued inspections to the
    server automatically once connectivity returns — the certifier shouldn't
    have to remember to re-send anything.
  - **Conflict handling:** if the same inspection was somehow also updated
    from another device while offline (e.g. two certifiers, or the certifier
    switched devices), decide a clear resolution rule — most recent
    timestamp wins is the simplest, but flag it for certifier review rather
    than silently overwriting if the two versions genuinely disagree on
    outcome (passed vs failed).
  - Give the certifier a visible **"queued — will sync when online"**
    indicator on any inspection recorded offline, so it's never ambiguous
    whether something has actually reached the server yet.

**Already built, not deferred** — worth noting here since these were recent
additions: NCC/BCA clause reference per checklist document, and certifier PI
insurance/registration expiry tracking with dashboard task warnings. Both are
fully real and working in the prototype already.

---

## 15. Inspection booking rules

The client portal's "Book an Inspection" feature enforces specific lead-time
and weekend rules — replicate these exactly server-side, since they're real
firm policy, not arbitrary defaults:

- **Lead time:** if the booking request is made before 2pm, the earliest
  bookable day is tomorrow. If made at or after 2pm, the earliest bookable
  day is 2 days out.
- **No weekend inspections, ever.** A target date that lands on Saturday or
  Sunday is invalid — always corrected to the following **Tuesday**, not
  Monday.
- **Booking made during the weekend itself** also resolves to Tuesday
  regardless of time of day — Monday is never offered as an option in this
  case either.
- These rules were verified with explicit date-math test cases (a booking
  made Saturday morning, Saturday afternoon, Sunday morning, Sunday evening,
  and a few weekday edge cases that roll over a weekend) — worth replicating
  those same test cases against the real implementation before trusting it.
- On the certifier side, the date field remains freely editable (for
  back-recording actual historical inspections) but shows a warning — not a
  hard block — if a weekend date is entered.
- When a client books an inspection, the certifier currently sees an in-app
  dashboard task and a confirmation banner on the job — see Section 10 for
  what real-time notification (email/push) should be added on top of this.

---

## 16. Real payment collection on quotes — Stripe

**What's real in the prototype, and what isn't:** every quote now has a
`paymentStatus` ("unpaid"/"paid") and `paymentReceivedDate`, with a "Mark as
paid" button on the quote form. This is genuinely useful as-is for tracking
payments received by other means (bank transfer, in person) — but it's a
manual toggle, not real payment collection. There is no actual charge, no
card details, nothing processed.

**Why real collection can't be built in the prototype:** taking a real
payment requires a server-side API call to a payment processor with a secret
key — something a static, backend-less prototype cannot do securely or at
all.

**How to build it for real:** use **Stripe** — same recommendation as
Section 13's subscription billing, and the two can share the same Stripe
account/integration.
- **Simplest approach: Stripe Payment Links or Stripe Checkout.** When a
  quote is issued, generate a Checkout session for the quote total and
  include the payment link in the email sent to the client (see Section 10).
  The client pays directly on Stripe's hosted page — no card handling inside
  this app at all.
- **Mark as paid automatically, not manually,** once real payment exists:
  listen for Stripe's `checkout.session.completed` webhook and update the
  quote's `paymentStatus` and `paymentReceivedDate` server-side when it
  fires. The manual "Mark as paid" button built in the prototype is still
  worth keeping as a fallback for payments received outside Stripe (bank
  transfer, cheque), but it should no longer be the primary path once real
  collection exists.
- **Reporting:** once real payments flow through Stripe, this is also the
  natural foundation for real revenue reporting, flagged as a gap in
  Section 14's "Explicitly deferred" list.

---

## 17. Reference file

The working prototype implementing all of the above is `certflow-client-portal.jsx`
— a single-file React component using Tailwind and lucide-react icons, currently
running as a Claude Artifact with in-memory state only. Use it as the UI/UX and
business-logic reference when building the real version — the interaction
patterns (chip-based multi-select, amendment points, per-item status, the
generate → view → upload-approval certificate flow) should carry over largely
unchanged; only the persistence layer underneath needs to become real.
