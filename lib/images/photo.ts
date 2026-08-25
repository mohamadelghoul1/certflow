import { fetchStampImage } from "@/lib/pdf/stamp";
import { downscalePhoto, type LoadedImage } from "@/lib/images/downscale";

// An inspection photo, fetched and cut down to what a page can show.
// Kept apart from the logo and signature loader on purpose: those are
// small, deliberately made artwork, often a PNG with transparency, and
// re-encoding them would be a loss for no gain.
export async function fetchPhotoImage(url: string | null): Promise<LoadedImage | null> {
  const image = await fetchStampImage(url);
  return image ? downscalePhoto(image) : null;
}
