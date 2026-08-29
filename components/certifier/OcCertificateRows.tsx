import { Fragment } from "react";
import { resolveTemplate } from "@/lib/certificates/certificateTemplate";
import { ocFieldValues } from "@/lib/certificates/certificateValues";
import type { OcCertificateData } from "@/lib/certificates/ocData";

// The body of the Occupation Certificate, drawn from the firm's own
// layout where they have saved one and Certlyn's otherwise.
//
// The same layout the PDF and the Word export walk. It used to be
// written out row by row on the screen, so a firm that added, renamed or
// dropped a row saw the change in both files it hands over but not on
// the screen it checks them from — the one place a mistake would have
// been caught.
//
// Its own component so it can be rendered in a test. A page cannot be.

function CertRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <tr className="align-top">
      <td className="py-1.5 pr-4 text-sm font-semibold text-heading whitespace-nowrap w-1/3">{label}</td>
      <td className="py-1.5 text-sm text-muted">{value || "—"}</td>
    </tr>
  );
}

function TableSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} className="pb-1 pt-4 text-sm font-bold uppercase text-doc-heading border-b border-line">
        {children}
      </td>
    </tr>
  );
}

export function OcCertificateRows({ data }: { data: OcCertificateData }) {
  return (
    <table className="w-full mb-8">
      <tbody>
        {resolveTemplate(data.template, ocFieldValues(data), data.typeLabel, data.consentLabel).map((section) => (
          <Fragment key={section.heading}>
            {section.heading && <TableSectionHeading>{section.heading}</TableSectionHeading>}
            {section.rows.map((row, i) => (
              <CertRow key={`${row.key}-${i}`} label={row.label} value={row.value} />
            ))}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
