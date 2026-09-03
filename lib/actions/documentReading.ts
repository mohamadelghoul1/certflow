"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchStoredFile } from "@/lib/storage";
import { aiConfigured, describeAiError } from "@/lib/ai/outstandingSummary";
import { readDocument, type DocumentReading } from "@/lib/ai/documentReading";
import type { JobDetails } from "@/types/db";

// One press: the document goes to the AI, its details come back as
// suggestions. Nothing is saved here — the certifier applies what they
// agree with from the form.

export type ReadingState = { error?: string; reading?: DocumentReading; pagesRead?: number; totalPages?: number } | undefined;

type FileRow = {
  file_path: string | null;
  checklist_items: { title: string; checklists: { job_id: string } | { job_id: string }[] | null } | { title: string; checklists: { job_id: string } | { job_id: string }[] | null }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function readDocumentWithAi(_prev: ReadingState, formData: FormData): Promise<ReadingState> {
  const { profile } = await requireProfile("certifier");
  if (!aiConfigured()) return { error: "Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables to read documents with AI." };

  const supabase = await createClient();
  const fileId = String(formData.get("file_id"));
  const jobId = String(formData.get("job_id"));

  const { data: job } = await supabase.from("jobs").select("id, address, details").eq("id", jobId).eq("firm_id", profile.firm_id).single();
  if (!job) return { error: "Project not found." };

  // The file is checked back to the project it was asked about: a file
  // id from a browser is not trusted to belong where the form says.
  const { data: fileRow } = await supabase.from("checklist_item_files").select("file_path, checklist_items(title, checklists(job_id))").eq("id", fileId).single();
  const file = (fileRow as unknown as FileRow | null) || null;
  const item = one(file?.checklist_items);
  const checklist = one(item?.checklists);
  if (!file?.file_path || !item || checklist?.job_id !== jobId) return { error: "That document could not be found on this project." };

  const stored = await fetchStoredFile(file.file_path, supabase);
  if (!stored) return { error: "The document could not be downloaded from storage." };

  const fileName = file.file_path.split("/").pop() || "document";
  const details = (job.details as JobDetails | null) || {};
  try {
    const result = await readDocument({
      file: { bytes: stored.bytes, contentType: stored.contentType, fileName },
      jobAddress: job.address || "",
      lotSectionDp: details.certificateDetails?.lotSectionDp || null,
      itemTitle: item.title,
    });
    return { reading: result.reading, pagesRead: result.pagesRead, totalPages: result.totalPages };
  } catch (error) {
    return { error: describeAiError(error) };
  }
}
