import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { downscalePhoto, MAX_PHOTO_EDGE } from "@/lib/images/downscale";

// Photos are the only thing in a report that can make it enormous, and
// what goes wrong here is invisible until someone tries to email a
// twenty megabyte file. So these assert on real images, decoded back.

async function photo(width: number, height: number, options: { orientation?: number; noisy?: boolean } = {}) {
  if (options.noisy) {
    const raw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 256;
    return new Uint8Array(await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer());
  }
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 140, b: 90 } } });
  if (options.orientation) pipeline = pipeline.withMetadata({ orientation: options.orientation });
  return new Uint8Array(await pipeline.jpeg().toBuffer());
}

describe("cutting an inspection photo down to what the page can show", () => {
  test("a photo off a phone is brought within the cap", async () => {
    const bytes = await photo(4032, 3024, { noisy: true });
    const reduced = await downscalePhoto({ bytes, type: "jpeg" });
    const meta = await sharp(reduced.bytes).metadata();

    assert.equal(Math.max(meta.width || 0, meta.height || 0), MAX_PHOTO_EDGE);
    assert.ok(reduced.bytes.length < bytes.length / 4, `expected a real reduction, got ${reduced.bytes.length} from ${bytes.length}`);
  });

  test("the shape of the photo is kept, so nothing is cropped out of frame", async () => {
    const reduced = await downscalePhoto({ bytes: await photo(4000, 2000), type: "jpeg" });
    const meta = await sharp(reduced.bytes).metadata();
    assert.equal(meta.width! / meta.height!, 2);
  });

  // A photo taken sideways carries a tag saying so, and drawing the pixels
  // as they are stored puts the defect on its side in the report.
  test("a photo taken sideways is turned the right way up", async () => {
    const reduced = await downscalePhoto({ bytes: await photo(3000, 2000, { orientation: 6 }), type: "jpeg" });
    const meta = await sharp(reduced.bytes).metadata();
    assert.ok(meta.height! > meta.width!, `expected portrait, got ${meta.width}x${meta.height}`);
  });

  test("one already small enough is left exactly as it was", async () => {
    const image = { bytes: await photo(800, 600), type: "jpeg" as const };
    const reduced = await downscalePhoto(image);
    assert.equal(reduced.bytes, image.bytes, "no re-encode, so no loss of quality for nothing");
  });

  // A report carrying a heavier photo is a far better outcome than a
  // report that could not be produced at all.
  test("something that cannot be read at all comes straight back", async () => {
    const image = { bytes: new Uint8Array([1, 2, 3, 4, 5]), type: "jpeg" as const };
    assert.equal(await downscalePhoto(image), image);
  });
});
