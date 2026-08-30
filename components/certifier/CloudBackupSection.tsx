"use client";

import { useActionState } from "react";
import { Cloud, CloudOff, CheckCircle2, AlertTriangle, DatabaseBackup } from "lucide-react";
import { disconnectBackup, setBackupFolder, type BackupFolderState } from "@/lib/actions/backup";
import { formatISODate } from "@/lib/business";
import type { ConnectionStatus } from "@/lib/backup/connection";
import type { ProviderId } from "@/lib/backup/providers";
import type { ActionState } from "@/lib/actions/auth";


// The record itself, as opposed to the documents.
//
// The two are different things and the difference only becomes obvious
// on the day it matters: the documents are the certificates, and this is
// the register of which ones were issued, against which jobs, on what
// dates, with which inspection outcomes. Without it a firm has a folder
// of PDFs and no way to say what it certified.
//
// Sent to the firm's cloud storage nightly as well, for the firms that
// would rather not remember. This is for the day somebody wants a copy
// in their own hands.
function RecordBackup() {
  return (
    <div className="border border-line rounded-md p-4 space-y-2 bg-surface">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <DatabaseBackup size={15} /> Your records
      </div>
      <p className="text-[11px] text-muted">
        Every project, certificate, inspection outcome and invoice as one file — the register behind the documents. Copied to your cloud storage
        each night once one is connected, and downloadable here whenever you want a copy in your own hands.
      </p>
      <a href="/api/backup/database" className="inline-block text-xs font-semibold text-secondary hover:underline">
        Download a copy now
      </a>
      <p className="text-[11px] text-placeholder">
        Your Stripe and Resend keys are deliberately left out of it — paste those back in from Stripe and Resend if you ever restore.
      </p>
    </div>
  );
}

const LABELS: Record<ProviderId, string> = { dropbox: "Dropbox", onedrive: "OneDrive" };

// A firm's own copy of its documents, in its own cloud storage.
//
// A certifier holds job records for years — longer than any subscription
// — so the point of this is that the files are theirs, in a folder they
// can open without Certlyn, laid out exactly as the downloadable archive
// is.
export function CloudBackupSection({ configured, connections }: { configured: ProviderId[]; connections: ConnectionStatus[] }) {
  const connected = new Map(connections.map((c) => [c.provider, c]));

  if (configured.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Cloud backup isn&rsquo;t set up on this deployment yet. It needs a Dropbox or Microsoft app to be registered and its keys added to the
          environment — see the README.
        </p>
        <RecordBackup />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Keeps a copy of every document in your own cloud storage, in the same folders as the job archive download. Your files stay yours, readable
        without Certlyn.
      </p>
      <RecordBackup />
      {configured.map((provider) => {
        const connection = connected.get(provider);
        return connection ? (
          <ConnectedRow key={provider} connection={connection} />
        ) : (
          <div key={provider} className="flex items-center justify-between border border-line rounded-md px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <CloudOff size={15} /> {LABELS[provider]} — not connected
            </div>
            <a href={`/api/backup/${provider}/connect`} className="text-xs font-semibold text-secondary hover:underline">
              Connect {LABELS[provider]}
            </a>
          </div>
        );
      })}
    </div>
  );
}

function ConnectedRow({ connection }: { connection: ConnectionStatus }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(async (_p, fd) => {
    await disconnectBackup(fd);
    return undefined;
  }, undefined);

  return (
    <div className="border border-accent/30 bg-success-bg rounded-md px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <Cloud size={15} /> {LABELS[connection.provider]} — {connection.account_label || "connected"}
        </div>
        <form action={formAction}>
          <input type="hidden" name="connection_id" value={connection.id} />
          <button disabled={pending} className="text-xs text-error hover:underline disabled:opacity-60">
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        </form>
      </div>
      <BackupFolderField connection={connection} />
      <div className="text-[11px] text-muted mt-1">
        {connection.last_sync_at ? `Last copied ${formatISODate(connection.last_sync_at.slice(0, 10))}.` : "Nothing copied yet."}
      </div>
      {connection.last_sync_error ? (
        <div className="flex items-start gap-1.5 text-[11px] text-warning-text mt-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {connection.last_sync_error}
        </div>
      ) : (
        connection.last_sync_at && (
          <div className="flex items-center gap-1.5 text-[11px] text-accent mt-1.5">
            <CheckCircle2 size={12} /> Everything copied across.
          </div>
        )
      )}
    </div>
  );
}

// The folder the copies land in, typed rather than fixed: a firm that
// already keeps its projects somewhere in particular wants ours in that
// same list, not in a folder of our own beside it.
function BackupFolderField({ connection }: { connection: ConnectionStatus }) {
  const [state, formAction, pending] = useActionState<BackupFolderState, FormData>(setBackupFolder, undefined);

  return (
    <form action={formAction} className="mt-2">
      <label className="block text-[11px] font-semibold text-muted mb-1">Back up into this folder</label>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="connection_id" value={connection.id} />
        <input
          name="root_folder"
          defaultValue={connection.root_folder}
          placeholder="/Certlyn"
          className="flex-1 min-w-[12rem] border border-line rounded-md px-2.5 py-1.5 text-sm bg-white"
        />
        <button disabled={pending} className="text-xs font-semibold text-secondary hover:underline disabled:opacity-60">
          {pending ? "Saving…" : "Save folder"}
        </button>
      </div>
      <div className="text-[11px] text-muted mt-1">
        Each project gets its own folder inside it, named the way you already file them — <span className="font-medium">CDC-26280 - 28 Eucalyptus Street, Constitution Hill</span>.
      </div>
      {state?.error && <div className="text-[11px] text-error mt-1">{state.error}</div>}
      {state?.saved && <div className="text-[11px] text-accent mt-1">{state.saved}</div>}
    </form>
  );
}
