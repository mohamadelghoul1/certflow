// The card surcharge: what a client pays extra when they choose card, so
// the firm still receives the invoice's face value.
//
// Australian law allows passing on no more than the actual cost of
// acceptance — and bans card surcharges entirely from 1 October 2026
// (RBA retail payments review, conclusions March 2026). Both rules are
// enforced here rather than remembered: the amount is derived from
// Stripe's standard domestic rate and rounded DOWN to the cent so it can
// never exceed the true cost, and from the ban date the surcharge is
// simply never applied again, whatever the Settings switch says.

// Stripe's standard Australian domestic card pricing. A firm on a
// negotiated (cheaper) rate should not enable the surcharge, since
// charging above actual cost is unlawful — Settings says so.
export const STRIPE_RATE = 0.017;
export const STRIPE_FIXED = 0.3;
export const SURCHARGE_BAN_DATE = "2026-10-01";

export function surchargeAllowed(todayIso: string): boolean {
  return todayIso < SURCHARGE_BAN_DATE;
}

// Grossed up so the firm nets the invoice total after Stripe's cut:
// gross = (total + fixed) / (1 - rate). The surcharge is then exactly
// Stripe's fee on that gross amount — the cost of acceptance, no more.
// Floored to the cent: a fraction under cost is lawful, a fraction over
// is not.
export function cardSurchargeFor(totalIncGst: number, todayIso: string): { surcharge: number; grossTotal: number } | null {
  if (!surchargeAllowed(todayIso)) return null;
  if (totalIncGst <= 0) return null;
  const gross = (totalIncGst + STRIPE_FIXED) / (1 - STRIPE_RATE);
  const surcharge = Math.floor((gross - totalIncGst) * 100) / 100;
  return { surcharge, grossTotal: Math.round((totalIncGst + surcharge) * 100) / 100 };
}
