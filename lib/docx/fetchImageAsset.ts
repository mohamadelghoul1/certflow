import { getImageDimensions, detectImageType, scaleToHeight, scaleToWidth } from "@/lib/docx/imageSize";
import type { ImageAsset } from "@/lib/docx/shared";

// Fetches a firm logo or certifier signature (already a short-lived signed
// Supabase Storage URL) and prepares it for embedding directly in the
// generated .docx — the bytes end up inside the file itself, not linked,
// so unlike the old HTML export there's no dependency on the signed URL
// still being valid whenever the recipient later opens the document.
export async function fetchImageAsset(url: string | null, targetHeightPx: number, maxWidthPx: number): Promise<ImageAsset | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const dims = getImageDimensions(buffer);
    const type = detectImageType(buffer);
    const { width, height } = scaleToHeight(dims, targetHeightPx, maxWidthPx);
    return { buffer, type, width, height };
  } catch {
    return null;
  }
}

// Same as fetchImageAsset, but scales to a common column width instead of
// a common height — for the inspection-photo grid, where photos can have
// any aspect ratio but should still line up into tidy rows.
export async function fetchImageAssetByWidth(url: string | null, targetWidthPx: number, maxHeightPx: number): Promise<ImageAsset | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const dims = getImageDimensions(buffer);
    const type = detectImageType(buffer);
    const { width, height } = scaleToWidth(dims, targetWidthPx, maxHeightPx);
    return { buffer, type, width, height };
  } catch {
    return null;
  }
}
