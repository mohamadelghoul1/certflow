// The one price, and the launch offer, in one place — quoted on the
// homepage, the pricing page and the contact page, and changed here
// when they change.

export const PLAN_NAME = "Certlyn Professional";
export const PRICE_MONTHLY_EX_GST = 399;
export const PRICE_LABEL = "$399 + GST";

// What the subscription covers: every certifier at the firm, and this
// many new projects a month.
export const JOBS_PER_MONTH = 30;
export const COVERAGE_LINE = `Unlimited certifiers. Up to ${JOBS_PER_MONTH} new projects a month.`;

// The introductory rate. Not a number of months from joining — a fixed
// end date, so every firm on it moves to the standard price on the same
// day and the earlier a firm joins the longer they hold it.
export const INTRO_PRICE_MONTHLY_EX_GST = 99;
export const INTRO_PRICE_LABEL = "$99 + GST";
export const INTRO_UNTIL = "30 June 2027";
export const STANDARD_FROM = "1 July 2027";

// Billing runs by the calendar month, whatever day of it a firm starts
// on. Said out loud on the pricing page rather than left for the first
// invoice to explain.
export const BILLING_LINE = "Billed by calendar month. A firm joining part-way through a month pays that month in full.";

export const EXTRA_PROJECT_FEE = 25;
export const EXTRA_PROJECT_LINE = `Projects past the ${JOBS_PER_MONTH} included are $${EXTRA_PROJECT_FEE} + GST each.`;

export const PLAN_INCLUDES = [
  "Unlimited certifiers",
  `Up to ${JOBS_PER_MONTH} new projects a month`,
  "Client portal",
  "Project management",
  "Inspection management",
  "Documents and certificates",
  "Client notifications",
  "Invoicing",
  "NSW Planning Portal integration",
  "Core Certlyn workflow",
];
