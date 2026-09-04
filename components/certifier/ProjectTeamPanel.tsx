"use client";

import { useActionState, useState } from "react";
import { Users } from "lucide-react";
import { setJobTeam } from "@/lib/actions/team";
import type { ActionState } from "@/lib/actions/auth";

// Who works on this project. The assigned certifier (set on the Details
// tab) signs its certificates; anyone else the director adds here can
// open the project too, as can the inspector on any of its inspections.
// A team member sees the list; only a director changes it.
export function ProjectTeamPanel({
  jobId,
  certifiers,
  assignedCertifierId,
  memberIds,
  manage,
  ready,
}: {
  jobId: string;
  certifiers: { id: string; name: string; firm_role?: string }[];
  assignedCertifierId: string | null;
  memberIds: string[];
  manage: boolean;
  // Migration 0072 has run, so there is a team list to keep.
  ready: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await setJobTeam(prev, fd);
    if (!result?.error) setEditing(false);
    return result;
  }, undefined);

  const assigned = certifiers.find((c) => c.id === assignedCertifierId);
  const members = certifiers.filter((c) => memberIds.includes(c.id) && c.id !== assignedCertifierId);
  const others = certifiers.filter((c) => c.id !== assignedCertifierId);

  if (!ready) {
    // Nothing to show a team member; a director is told once what would
    // make this work, in the place it would appear.
    if (!manage) return null;
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-placeholder">
        <Users size={13} /> Run database update 0072 to give team members their own logins and assign them to projects.
      </div>
    );
  }

  return (
    <div className="mt-3 text-sm">
      {editing ? (
        <form action={action} className="rounded-md border border-line bg-white p-4 space-y-3 max-w-xl">
          <input type="hidden" name="job_id" value={jobId} />
          <div className="text-xs font-semibold text-placeholder">Who can open this project</div>
          {assigned && (
            <div className="text-sm text-muted">
              <span className="font-semibold text-primary">{assigned.name}</span> — assigned certifier, always on it. Change that on the Details tab.
            </div>
          )}
          {others.length === 0 ? (
            <div className="text-xs text-placeholder">Nobody else on the firm&rsquo;s certifier list yet — add them under Settings → Certifiers.</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {others.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="certifier_id" value={c.id} defaultChecked={memberIds.includes(c.id)} className="accent-primary" />
                  {c.name}
                  {c.firm_role === "director" && <span className="text-[10px] text-placeholder">director — sees every project anyway</span>}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted">
            The inspector named on an inspection can open the project too, without being listed here.
          </p>
          {state?.error && <div className="text-xs text-error">{state.error}</div>}
          <div className="flex gap-2">
            <button disabled={pending} className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60">
              {pending ? "Saving…" : "Save team"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-md text-xs text-muted hover:bg-hover">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
          <Users size={13} className="text-icon" />
          <span className="font-semibold text-placeholder">Team:</span>
          {assigned ? (
            <span>
              <span className="text-primary font-medium">{assigned.name}</span> (assigned certifier)
            </span>
          ) : (
            <span className="text-placeholder">no assigned certifier</span>
          )}
          {members.map((m) => (
            <span key={m.id}>
              · <span className="text-primary font-medium">{m.name}</span>
            </span>
          ))}
          {manage && (
            <button type="button" onClick={() => setEditing(true)} className="text-secondary hover:underline font-medium">
              {members.length > 0 ? "Change" : "Add team members"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
