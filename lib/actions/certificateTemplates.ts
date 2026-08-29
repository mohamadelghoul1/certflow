"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATES, templateProblems, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";
import type { CertificatePathway } from "@/lib/certificates/templateFields";
import type { ActionState } from "@/lib/actions/auth";

// A firm's own certificate layout.
//
// Saving one is a change to what a statutory certificate says, so it is
// checked before it is stored rather than after it has been issued, and
// it lands in the audit log like any other decision of that weight.

function pathwayOf(value: FormDataEntryValue | null): CertificatePathway {
  const asked = String(value);
  return asked === "CC" || asked === "OC" ? asked : "CDC";
}

export async function saveCertificateTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const pathway = pathwayOf(formData.get("pathway"));

  let template: CertificateTemplate;
  try {
    const sections = JSON.parse(String(formData.get("layout") || "null"));
    if (!Array.isArray(sections)) return { error: "That layout could not be read. Please try again." };
    template = { pathway, sections };
  } catch {
    return { error: "That layout could not be read. Please try again." };
  }

  // Refused rather than stored: a template that cannot be drawn is a
  // certificate that cannot be issued, and finding that out at issue time
  // is finding out too late.
  const problems = templateProblems(template);
  if (problems.length > 0) return { error: problems[0] };

  const supabase = await createClient();
  const { error } = await supabase.from("certificate_templates").upsert(
    {
      firm_id: profile.firm_id,
      pathway,
      layout: { sections: template.sections },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id,pathway" },
  );
  if (error) return { error: "That layout could not be saved. Please try again." };

  await recordAuditEvent(createAdminClient(), {
    firmId: profile.firm_id,
    action: "certificate.template_changed",
    summary: `Changed the ${pathway} certificate layout`,
    detail: { pathway, sections: template.sections.length },
    severity: "warning",
  });

  revalidatePath("/settings");
  return undefined;
}

// Back to CertFlow's layout. The firm's own is deleted rather than
// overwritten with a copy of the default, so "have they customised this?"
// stays a question with one answer.
export async function resetCertificateTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { profile } = await requireProfile("certifier");
  const pathway = pathwayOf(formData.get("pathway"));

  const supabase = await createClient();
  const { error } = await supabase.from("certificate_templates").delete().eq("firm_id", profile.firm_id).eq("pathway", pathway);
  if (error) return { error: "That could not be undone. Please try again." };

  await recordAuditEvent(createAdminClient(), {
    firmId: profile.firm_id,
    action: "certificate.template_changed",
    summary: `Returned the ${pathway} certificate to the standard layout`,
    detail: { pathway, reverted: true },
    severity: "warning",
  });

  revalidatePath("/settings");
  return undefined;
}

// What Settings shows: the firm's own layout where they have one, and the
// default to start from where they have not.
export async function certificateTemplatesForFirm(firmId: string) {
  const supabase = await createClient();
  try {
    const { data } = await supabase.from("certificate_templates").select("pathway, layout").eq("firm_id", firmId);
    const saved = new Map((data || []).map((r) => [String(r.pathway), (r.layout as { sections?: unknown })?.sections]));
    return (["CDC", "CC", "OC"] as CertificatePathway[]).map((pathway) => {
      const sections = saved.get(pathway);
      return {
        pathway,
        custom: Array.isArray(sections),
        template: Array.isArray(sections) ? ({ pathway, sections } as CertificateTemplate) : DEFAULT_TEMPLATES[pathway],
      };
    });
  } catch {
    // No table yet — every firm is on the standard layout.
    return (["CDC", "CC", "OC"] as CertificatePathway[]).map((pathway) => ({ pathway, custom: false, template: DEFAULT_TEMPLATES[pathway] }));
  }
}
