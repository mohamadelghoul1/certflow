import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TEMPLATES, templateProblems, type CertificateTemplate } from "@/lib/certificates/certificateTemplate";
import type { CertificatePathway } from "@/lib/certificates/templateFields";

// Which layout a certificate is drawn from.
//
// The default unless the firm has saved one of its own, and the default
// again if what they saved cannot be used — a certificate that fails to
// print is worse than one printed the standard way, and the editor tells
// them the moment a template goes wrong rather than leaving it to a
// certificate nobody can issue.
//
// A database without migration 0055 has no table at all, which is the
// same answer: the default.
export async function loadCertificateTemplate(
  supabase: SupabaseClient,
  firmId: string,
  pathway: string,
): Promise<{ template: CertificateTemplate; custom: boolean; problems: string[] }> {
  const key: CertificatePathway = pathway === "CC" || pathway === "OC" ? pathway : "CDC";
  const fallback = { template: DEFAULT_TEMPLATES[key], custom: false, problems: [] as string[] };

  try {
    const { data, error } = await supabase
      .from("certificate_templates")
      .select("layout")
      .eq("firm_id", firmId)
      .eq("pathway", key)
      .maybeSingle();
    if (error || !data) return fallback;

    const layout = (data as { layout?: unknown }).layout as { sections?: unknown } | null;
    if (!layout || !Array.isArray(layout.sections)) return fallback;

    const template = { pathway: key, sections: layout.sections } as CertificateTemplate;
    const problems = templateProblems(template);
    if (problems.length > 0) return { ...fallback, problems };
    return { template, custom: true, problems: [] };
  } catch {
    // No table yet — the firm is on the default like everyone else.
    return fallback;
  }
}
