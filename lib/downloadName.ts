// Filenames for generated downloads.
//
// A certificate reference carries a slash — CDC-26001/01 — which is a path
// separator, so every browser silently rewrites it before saving: a set
// downloaded as "CDC-26001/01-Approved-Set.pdf" lands in the downloads
// folder as "CDC-26001_01-Approved-Set.pdf". Verified in Chromium rather
// than assumed. Handling it here means the name that arrives is the name
// that was chosen, instead of one the browser edited.
//
// Everything else a certifier might type into a custom reference is left
// alone — spaces, commas and the rest all survive a quoted
// Content-Disposition intact, also verified rather than assumed.
export function safeFileName(value: string) {
  return value
    .replace(/\//g, "-")
    .replace(/[\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The Content-Disposition value for an attachment.
//
// Sent twice: a plain ASCII `filename` that every client understands, and
// an RFC 5987 `filename*` carrying the real characters. Browsers prefer
// filename* when they see it, so an address with an en dash or an accent
// arrives intact rather than being flattened by clients that only read the
// ASCII form.
export function attachmentHeader(fileName: string) {
  const safe = safeFileName(fileName);
  return `attachment; filename="${asciiFileName(safe)}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

// The name flattened to plain ASCII.
//
// Needed in two places. In a Content-Disposition header it is the fallback
// for clients that can't read filename*. On an <a download> attribute it
// is the only form that works at all: Chromium silently rejects a download
// filename containing any non-ASCII character and saves the file as
// "download" — no name and no extension. Verified in Chromium rather than
// assumed. An accented address keeps its letters ("Céline" saves as
// "Celine"); only a character with no ASCII letter underneath it — an en
// dash, a curly quote — becomes a hyphen.
export function asciiFileName(fileName: string) {
  return (
    safeFileName(fileName)
      // Accents come off their letters first, so "Céline" flattens to
      // "Celine" rather than "C-line". Only what has no letter underneath
      // it — an en dash, a curly quote — becomes a hyphen.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^ -~]/g, "-")
      .replace(/"/g, "")
  );
}

// Loose comparison for "does this reference already say the address?" —
// case, punctuation and spacing all ignored, so "21 Coquet Way, Green
// Valley" matches "21 COQUET WAY GREEN VALLEY".
function squash(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The name a job's generated documents are filed under: the certificate
// reference, then the site address, then what the document is. The address
// is what makes a downloads folder full of these readable at a glance — a
// reference alone means looking each one up.
//
// A certifier who has renamed the reference to include the address already
// gets it once; repeating it would be the app arguing with the name they
// chose.
export function jobDocumentName(reference: string, address: string, label: string, extension: string) {
  const ref = (reference || "").trim();
  const site = (address || "").trim();
  const alreadyNamed = site.length > 0 && squash(ref).includes(squash(site));
  const parts = [ref, alreadyNamed ? "" : site, (label || "").trim()].filter(Boolean);
  return `${safeFileName(parts.join(" - "))}.${extension}`;
}

// The filename out of a Content-Disposition header, for a download the
// browser isn't navigating to — fetched in the background instead, so the
// page can show it working. Prefers the RFC 5987 `filename*` for the same
// reason browsers do: it carries the real characters. Returns "" when the
// header is missing or unreadable, and the caller falls back to a name of
// its own rather than saving something called "download".
export function fileNameFromDisposition(header: string | null) {
  if (!header) return "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // A malformed percent-escape shouldn't lose the download; fall
      // through to the ASCII name below.
    }
  }
  const plain = /filename="([^"]*)"/i.exec(header);
  return plain ? plain[1].trim() : "";
}
