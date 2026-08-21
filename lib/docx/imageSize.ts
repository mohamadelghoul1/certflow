// Minimal, safe image-dimension sniffer for the two formats a firm logo or
// certifier signature realistically get uploaded as (PNG, JPEG).
// Deliberately not using a general-purpose image-parsing library here: the
// obvious npm candidate (image-size) has an unpatched, actively exploitable
// infinite-loop DoS in its ICNS/JXL/HEIF parsers (GHSA-w3rx-r6r6-pgpr,
// GHSA-5p2g-fcmc-qvqq). This reads only the few fixed-position header bytes
// each format defines for width/height, with every loop bound taken
// directly from a value already re-checked against the buffer length, so it
// can't spin — anything that isn't PNG or JPEG (or is malformed) just falls
// through to a safe fixed default instead of being parsed at all.
export function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47 && buffer.toString("ascii", 12, 16) === "IHDR") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length && buffer[offset] === 0xff) {
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + segmentLength;
    }
  }

  return { width: 160, height: 60 };
}

// Only PNG/JPEG are actually sniffed for dimensions above, so those are the
// only two types this ever needs to report — anything else falls back to
// "png" (ImageRun requires a definite type; a wrong guess just means the
// browser/Word decodes the bytes as an unexpected format, which is no worse
// than the fallback dimensions already in play for that same unknown case).
export function detectImageType(buffer: Buffer): "png" | "jpg" {
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x89504e47) return "png";
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  return "png";
}

// Scales to a target height (matching the h-16 / h-14 on-screen sizing)
// while keeping the source aspect ratio, capped so an unusually wide/tall
// source image can't blow out the page — this is exactly the class of bug
// that made the firm logo render at full native resolution and overflow
// the page in the old HTML-export path.
export function scaleToHeight(dims: { width: number; height: number }, targetHeightPx: number, maxWidthPx: number) {
  if (dims.width <= 0 || dims.height <= 0) return { width: maxWidthPx, height: targetHeightPx };
  const width = Math.min(maxWidthPx, Math.round((dims.width / dims.height) * targetHeightPx));
  const height = Math.round((dims.height / dims.width) * width);
  return { width, height };
}

// Same idea, the other way round — for the inspection-photo grid, where
// every photo should share a common column width but can be any aspect
// ratio (unlike the logo/signature, which target a fixed height).
export function scaleToWidth(dims: { width: number; height: number }, targetWidthPx: number, maxHeightPx: number) {
  if (dims.width <= 0 || dims.height <= 0) return { width: targetWidthPx, height: maxHeightPx };
  const height = Math.min(maxHeightPx, Math.round((dims.height / dims.width) * targetWidthPx));
  const width = Math.round((dims.width / dims.height) * height);
  return { width, height };
}
