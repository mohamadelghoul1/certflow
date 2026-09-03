"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "@/lib/email";
import { withinLimit, type Limit } from "@/lib/rateLimit";
import { readInterest, validateInterest, interestEmailHtml, interestSubject } from "@/lib/interest";

export type InterestState = { error?: string; success?: string } | undefined;

// Five a minute from the whole world is plenty for a form a person
// fills in once; a flood past that is a script.
const INTEREST_LIMIT: Limit = { windowSeconds: 60, max: 5 };

// Where the form goes: CONTACT_EMAIL if it is set in Vercel, otherwise
// the email of the firm that runs Certlyn. select("*") so a database
// without the platform_owner column still answers with the oldest firm.
async function contactAddress(): Promise<string | null> {
  if (process.env.CONTACT_EMAIL) return process.env.CONTACT_EMAIL;
  const admin = createAdminClient();
  const { data } = await admin.from("firms").select("*").order("created_at").limit(20);
  const firms = (data || []) as { email?: string | null; platform_owner?: boolean }[];
  const owner = firms.find((f) => f.platform_owner) || firms[0];
  return owner?.email || null;
}

export async function registerInterest(_prev: InterestState, formData: FormData): Promise<InterestState> {
  const fields = readInterest(formData);
  const problem = validateInterest(fields);
  // A robot is thanked and ignored; a person is told what to fix.
  if (problem) return fields.website ? { success: problem } : { error: problem };

  const supabase = await createClient();
  if (!(await withinLimit(supabase, "interest:all", INTEREST_LIMIT))) return { error: "Too many messages just now — please try again in a minute." };

  const to = await contactAddress();
  if (!to || !emailConfigured()) {
    return { error: "The form isn't connected yet — email us directly instead." };
  }

  const result = await sendEmail(to, interestSubject(fields), interestEmailHtml(fields));
  if (result.error || result.skipped) return { error: "Your message couldn't be sent just now — please try again shortly." };
  return { success: "Thanks — we've got your details and will be in touch shortly." };
}
