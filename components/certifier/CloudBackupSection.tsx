"use client";

import { useActionState } from "react";
import { Cloud, CloudOff, CheckCircle2, AlertTriangle } from "lucide-react";
import { disconnectBackup, setBackupFolder, type BackupFolderState } from "@/lib/actions/backup";
import { formatISODate } from "@/lib/business";
import type { ConnectionStatus } from "@/lib/backup/connection";
import type { ProviderId } from "@/lib/backup/providers";
import type { ActionState } from "@/lib/actions/auth";

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
      <p className="text-sm text-muted">
        Cloud backup isn&rsquo;t set up on this deployment yet. It needs a Dropbox or Microsoft app to be registered and its keys added to the
        environment — see the README.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Keeps a copy of every document in your own cloud storage, in the same folders as the job archive download. Your files stay yours, readable
        without Certlyn.
      </p>
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
