// Text going into an email body. Four modules had grown their own copy
// of this, two of them without the quote case — which is the one that
// matters when a value lands inside an attribute rather than between
// tags. One version, escaping all four.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
