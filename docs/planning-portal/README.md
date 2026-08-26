# NSW Planning Portal (ePlanning) integration

The official API specifications for the Online Post-Consent Certificate
Service, downloaded from the NSW Department of Planning and Environment's
Planning Portal by the firm and stored here so the integration is built
against the department's own words, not a paraphrase.

## What the service does for CertFlow

- **Inspections** (the headline): `InitiateInspection` → `PerformInspection`
  (or `MissedInspection`) → `CompleteInspection`. An inspection completed
  and signed in CertFlow can be reported to the Portal without a separate
  login. `NotifyCriticalStageInspection` serves the critical stage
  inspection notice.
- **Applications flow in**: the Portal *pushes* a lodged CC/OC/PCA/SC case
  and its documents to the certifier's system in real time
  (`CreatePCC`/`UpdatePCC` in the "ePlanning to Certifier" spec). This
  needs CertFlow to expose registered receiving endpoints — phase 2.
- **Assessment and determination**: `AcceptReturn`, `Assessment`,
  `ReqAddInfo`/`ProvideAddInfo`, `Determine`.
- **Certificate Registration** ties in at determination (see
  `Certificate-Registration-workflow.pdf`) for registering certificates
  with council and paying the fee via a Service NSW redirect.

## The shape of the API

- Base URLs: UAT `https://api-uat.apps1.nsw.gov.au/planning/PCCMgmt/Certifiers/v1`,
  production `https://api.apps1.nsw.gov.au/planning/PCCMgmt/Certifiers/v1`.
- Auth: an `api-key` header (issued by ePlanning at onboarding) plus an
  `organisationID` header naming the registered certifier organisation.
- Documents travel as **links, not uploads**: each document entry carries a
  `documentURL` the Portal downloads from. CertFlow's short-lived signed
  storage links suit this.
- The Portal accepts only fixed value lists for inspection types and
  results. They are extracted (with the request schemas) into
  `pcc-certifier-schemas.json` — generated from the YAML, not hand-written
  — and `lib/portal/inspections.ts` maps CertFlow's vocabulary onto them.
  `tests/portalInspections.test.ts` holds every outgoing payload against
  that file.

## Configuration (Vercel → Settings → Environment Variables)

| Variable | Meaning |
| --- | --- |
| `PLANNING_PORTAL_API_KEY` | Issued by ePlanning at onboarding. Secret. |
| `PLANNING_PORTAL_ORGANISATION_ID` | The registered certifier organisation name. |
| `PLANNING_PORTAL_BASE_URL` | Optional. **Defaults to the UAT (test) environment**; set to the production URL only when UAT testing is done. |

Until the first two are set, CertFlow treats the Portal as not connected
and attempts nothing.

## Status

Foundation only: specs stored, payload builders written and tested against
the schemas. Live calls wait on API onboarding with ePlanning (they issue
the key and register the organisation; their approval takes time — apply
early). The receiving endpoints for Portal-initiated cases are phase 2.
