"use client";

import { FileUpload } from "@/components/certifier/FileUpload";

// Generic bridge: uploads a file to Storage, then calls whichever server
// action was passed in with the resulting path plus any fixed fields
// (job_id, item_id, etc.) merged in.
export function ActionUpload({
  action,
  fields,
  pathPrefix,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  pathPrefix: string;
  label?: string;
}) {
  async function handle(path: string) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    fd.set("file_path", path);
    await action(fd);
  }
  return <FileUpload pathPrefix={pathPrefix} onUploaded={handle} label={label} />;
}
