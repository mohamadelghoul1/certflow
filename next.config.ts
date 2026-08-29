import type { NextConfig } from "next";

// Headers every response carries.
//
// Worth having from the moment Certlyn is linked to from a public
// website: a page holding statutory certificates, client documents and
// invoices should not be silently embeddable by a site nobody here
// controls.
const securityHeaders = [
  // Only Certlyn may frame Certlyn. Without this, another site could
  // load a signed-in certifier's screen inside an invisible frame and
  // have them click things they cannot see — the reason a bank's
  // pages refuse to be framed. Both headers say the same thing; the
  // first is the modern one, the second is what older browsers read.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // A file is what its type says it is. Stops a browser deciding for
  // itself that an uploaded document is really a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A portal address can name a project. Following a link out should
  // not hand that address to whoever is on the other end.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
