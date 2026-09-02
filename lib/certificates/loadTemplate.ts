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
  const builtIn = { template: DEFAULT_TEMPLATES[key], custom: false, problems: [] as string[] };

  try {
    // The firm's own first, then the platform default the owner
    // published, then the built-in. Both come back in one query so the
    // fallback costs nothing: a firm on the standard layout is the
    // ordinary case, not the exception.
    const { data, error } = await supabase
      .from("certificate_templates")
      .select("firm_id, layout")
      .or(`firm_id.eq.${firmId},firm_id.is.null`)
      .eq("pathway", key);
    if (error || !data) return builtIn;

    const rows = data as { firm_id: string | null; layout?: unknown }[];
    const fallback = usable(rows.find((r) => r.firm_id === null), key) || builtIn;
    const own = rows.find((r) => r.firm_id === firmId);
    if (!own) return fallback;

    const layout = (own.layout || null) as { sections?: unknown } | null;
    if (!layout || !Array.isArray(layout.sections)) return fallback;

    const template = { pathway: key, sections: layout.sections } as CertificateTemplate;
    const problems = templateProblems(template);
    if (problems.length > 0) return { ...fallback, problems };
    return { template, custom: true, problems: [] };
  } catch {
    // No table yet — the firm is on the default like everyone else.
    return builtIn;
  }
}

// A stored layout only counts if it can actually be drawn. A platform
// default that has gone bad falls through to the built-in rather than
// taking every firm's certificate down with it.
function usable(row: { layout?: unknown } | undefined, pathway: CertificatePathway) {
  const layout = (row?.layout || null) as { sections?: unknown } | null;
  if (!layout || !Array.isArray(layout.sections)) return null;
  const template = { pathway, sections: layout.sections } as CertificateTemplate;
  return templateProblems(template).length > 0 ? null : { template, custom: false, problems: [] as string[] };
}
