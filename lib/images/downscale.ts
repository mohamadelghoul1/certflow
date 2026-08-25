import sharp from "sharp";

// Photos taken on a phone go into a report at the size they came off the
// camera — four thousand pixels across, several megabytes each — and are
// then drawn into a box about two hundred and fifty points wide. A
// pdf-lib embedJpg stores the file as it was given, so all of that extra
// detail ends up in the PDF, where nobody can ever see it. Four photos
// could easily make a report twenty megabytes, which is slow to build,
// slow to download, and too big for some mailboxes to accept.
//
// So a photo is resized to what the page can actually show before it is
// embedded. Nothing is cropped and nothing is rotated by hand — the
// camera's own orientation tag is applied, which is what stops a photo
// taken sideways appearing on its side.

// The long edge, in pixels. The widest a photo is ever drawn is a little
// over half the content width of an A4 page, so 1400 is still around
// three times the detail a 300 dpi print of that box would use. Chosen
// generously on purpose: this is evidence, and someone may want to zoom
// into it.
export const MAX_PHOTO_EDGE = 1400;

export type LoadedImage = { bytes: Uint8Array; type: "png" | "jpeg" };

// Returns the photo unchanged if anything goes wrong. A report with a
// heavier photo in it is a far better outcome than a report that could
// not be produced.
export async function downscalePhoto(image: LoadedImage, maxEdge = MAX_PHOTO_EDGE): Promise<LoadedImage> {
  try {
    const meta = await sharp(image.bytes, { failOn: "none" }).metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);

    // Already small enough, and a re-encode would only lose quality.
    if (longest > 0 && longest <= maxEdge) return image;

    const bytes = await sharp(image.bytes, { failOn: "none" })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    // Guards against the odd case where re-encoding makes a file bigger
    // than it started — a small PNG screenshot, for instance.
    if (bytes.length >= image.bytes.length) return image;
    return { bytes: new Uint8Array(bytes), type: "jpeg" };
  } catch {
    return image;
  }
}

export async function downscalePhotos(images: (LoadedImage | null)[], maxEdge = MAX_PHOTO_EDGE): Promise<(LoadedImage | null)[]> {
  return Promise.all(images.map((image) => (image ? downscalePhoto(image, maxEdge) : null)));
}
