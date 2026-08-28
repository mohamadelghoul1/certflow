"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, RotateCw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addPhoto, removePhoto } from "@/lib/actions/inspections";
import { downscaleForUpload } from "@/lib/images/browserDownscale";
import { MAX_INSPECTION_PHOTOS, photoSlotsRemaining } from "@/lib/constants";

type Pending = { key: string; file: File; failed: boolean };

// Kept out of the component: a unique name is a side effect, and one
// generated while rendering would change on every re-render.
function uploadPath(prefix: string, fileName: string): string {
  return `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

function newKey(): string {
  return `${Date.now()}-${Math.random()}`;
}

// Photographs, straight from the camera.
//
// Two things matter here and nothing else does. The button opens the
// camera rather than a file browser, because that is what a person on a
// slab is trying to do. And a photo that fails to upload is kept, named,
// and offered again — six megabytes over one bar of signal fails often
// enough that "it didn't work, take it again" is not an acceptable
// answer.
export function SitePhotos({
  inspectionId,
  jobId,
  pathPrefix,
  photos,
}: {
  inspectionId: string;
  jobId: string;
  pathPrefix: string;
  photos: { id: string; url: string | null }[];
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startRefresh] = useTransition();
  const router = useRouter();
  const remaining = photoSlotsRemaining(photos.length + pending.filter((p) => !p.failed).length);

  async function upload(file: File, key: string) {
    setBusy(true);
    try {
      // Shrunk here, on the phone, before it goes anywhere near the
      // network.
      const prepared = await downscaleForUpload(file);
      const supabase = createClient();
      const path = uploadPath(pathPrefix, prepared.name);
      const { error } = await supabase.storage.from("certflow-files").upload(path, prepared);
      if (error) throw error;

      const fd = new FormData();
      fd.set("inspection_id", inspectionId);
      fd.set("job_id", jobId);
      fd.set("file_path", path);
      await addPhoto(fd);

      setPending((current) => current.filter((p) => p.key !== key));
      startRefresh(() => router.refresh());
    } catch {
      setPending((current) => current.map((p) => (p.key === key ? { ...p, failed: true } : p)));
    } finally {
      setBusy(false);
    }
  }

  function choose(files: FileList | null) {
    const chosen = Array.from(files || []).slice(0, remaining);
    if (chosen.length === 0) return;
    const queued = chosen.map((file) => ({ key: newKey(), file, failed: false }));
    setPending((current) => [...current, ...queued]);
    for (const item of queued) void upload(item.file, item.key);
  }

  function retry(item: Pending) {
    setPending((current) => current.map((p) => (p.key === item.key ? { ...p, failed: false } : p)));
    void upload(item.file, item.key);
  }

  function discard(key: string) {
    setPending((current) => current.filter((p) => p.key !== key));
  }

  return (
    <div>
      {(photos.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-hover border border-line">
              {photo.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
              )}
              <form action={removePhoto} className="absolute top-1 right-1">
                <input type="hidden" name="photo_id" value={photo.id} />
                <input type="hidden" name="job_id" value={jobId} />
                <button aria-label="Remove photo" className="w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center">
                  <X size={15} />
                </button>
              </form>
            </div>
          ))}

          {pending.map((item) => (
            <div key={item.key} className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center text-center px-1 ${item.failed ? "border-error bg-error-bg" : "border-line bg-hover"}`}>
              {item.failed ? (
                <>
                  <span className="text-[10px] font-semibold text-error leading-tight px-1">Didn&rsquo;t send</span>
                  <button type="button" onClick={() => retry(item)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-error">
                    <RotateCw size={11} /> Retry
                  </button>
                  <button type="button" onClick={() => discard(item.key)} className="mt-0.5 text-[10px] text-placeholder underline">
                    discard
                  </button>
                </>
              ) : (
                <span className="text-[11px] font-medium text-placeholder">Sending…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {remaining > 0 ? (
        <label className="w-full inline-flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-white py-4 font-semibold text-primary active:bg-hover cursor-pointer">
          <Camera size={20} />
          {busy ? "Sending…" : "Take a photo"}
          {/* capture opens the camera straight away on a phone; on a
              desktop it is an ordinary file picker. */}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
        </label>
      ) : (
        <div className="text-xs text-muted text-center py-2">All {MAX_INSPECTION_PHOTOS} photos added.</div>
      )}
    </div>
  );
}
