import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dejavuSansBase64 } from "@/lib/portal/fonts/dejavuSans";
import { dejavuSansBoldBase64 } from "@/lib/portal/fonts/dejavuSansBold";

// The servers this runs on have no fonts installed at all — Vercel's
// logs showed "Fontconfig error: Cannot load default config file", and a
// render in that state draws every character as an empty box. So the
// fonts travel inside CertFlow itself: DejaVu Sans, written out to /tmp
// with a fontconfig configuration pointing at it.
//
// Timing is the whole trick: fontconfig honours these settings only if
// they are in place before the graphics engine first wakes up, which is
// why instrumentation.ts runs this at server start rather than at first
// render. The call here is idempotent, and the render path calls it
// again as a belt-and-braces.
export function ensureFonts(): void {
  const dir = "/tmp/certflow-fonts";
  if (!existsSync(`${dir}/fonts.conf`)) {
    mkdirSync(`${dir}/cache`, { recursive: true });
    writeFileSync(`${dir}/DejaVuSans.ttf`, Buffer.from(dejavuSansBase64, "base64"));
    writeFileSync(`${dir}/DejaVuSans-Bold.ttf`, Buffer.from(dejavuSansBoldBase64, "base64"));
    writeFileSync(
      `${dir}/fonts.conf`,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n  <dir>${dir}</dir>\n  <cachedir>${dir}/cache</cachedir>\n</fontconfig>\n`
    );
  }
  // Only step in when the server has no font setup of its own — a
  // machine with real fonts keeps them.
  if (!process.env.FONTCONFIG_FILE && !process.env.FONTCONFIG_PATH) {
    process.env.FONTCONFIG_FILE = `${dir}/fonts.conf`;
    process.env.FONTCONFIG_PATH = dir;
  }
}
