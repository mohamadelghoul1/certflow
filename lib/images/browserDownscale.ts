"use client";

// Shrinking a photo before it leaves the phone.
//
// A photo straight off a modern camera is three to six megabytes. On a
// site with one bar of signal that is the difference between a photo
// that uploads and one that times out — and the report draws them at
// about a thousand pixels wide anyway, so the other five megabytes
// travel a long way to be thrown away.
//
// Falls back to the original file whenever anything is unavailable or
// goes wrong: a photo that uploads slowly is better than no photo.

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function downscaleForUpload(file: File): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;

    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE) {
      bitmap.close?.();
      return file;
    }

    const scale = MAX_EDGE / longest;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}
