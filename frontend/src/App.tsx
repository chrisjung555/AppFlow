import { useCallback, useEffect, useState } from "react";
import "./App.css";

export type Job = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  url: string;
  platform: string;
  status: string;
  notes: string;
  date_added: string;
  date_updated: string;
};

export const JOB_STATUSES = [
  "Interested",
  "Applied",
  "Online Assessment",
  "Interview",
  "Offer",
  "Rejected",
] as const;

type Draft = {
  role: string;
  company: string;
  location: string;
  notes: string;
};

function draftFromJob(job: Job): Draft {
  return {
    role: job.role,
    company: job.company,
    location: job.location ?? "",
    notes: job.notes,
  };
}

function buildPatch(job: Job, draft: Draft): Record<string, unknown> | null {
  const body: Record<string, unknown> = {};
  if (draft.role.trim() !== job.role) body.role = draft.role.trim();
  if (draft.company.trim() !== job.company) body.company = draft.company.trim();
  const dLoc = draft.location.trim();
  const jLoc = (job.location ?? "").trim();
  if (dLoc !== jLoc) body.location = dLoc === "" ? null : dLoc;
  if (draft.notes.trim() !== (job.notes ?? "").trim()) {
    body.notes = draft.notes.trim();
  }
  return Object.keys(body).length ? body : null;
}

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

async function patchJob(
  id: string,
  body: Record<string, unknown>
): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Update failed (${res.status})`);
  }
  return res.json() as Promise<Job>;
}

async function deleteJobApi(id: string): Promise<void> {
  const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Delete failed (${res.status})`);
  }
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function EditIcon() {
  return (
    <svg
      className="icon-inline"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="icon-inline"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="icon-inline"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

type StatusSelectProps = {
  job: Job;
  disabled: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
};

function StatusSelect({ job, disabled, onPatch }: StatusSelectProps) {
  const isKnown = JOB_STATUSES.includes(
    job.status as (typeof JOB_STATUSES)[number]
  );
  const statuses = isKnown
    ? [...JOB_STATUSES]
    : Array.from(new Set([...JOB_STATUSES, job.status]));

  return (
    <div className="status-dropdown">
      <select
        className="status-select"
        value={job.status}
        disabled={disabled}
        aria-label="Application status"
        onChange={(e) => {
          const next = e.target.value;
          if (next !== job.status) void onPatch({ status: next });
        }}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

type JobRowProps = {
  job: Job;
  onUpdated: (job: Job) => void;
  onRemoved: (id: string) => void;
  onError: (message: string) => void;
};

function JobRow({ job, onUpdated, onRemoved, onError }: JobRowProps) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFromJob(job));

  useEffect(() => {
    if (!editing) {
      setDraft(draftFromJob(job));
    }
  }, [job, editing]);

  const runPatch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      onError("");
      try {
        const updated = await patchJob(job.id, body);
        onUpdated(updated);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [job.id, onError, onUpdated]
  );

  const startEdit = () => {
    setDraft(draftFromJob(job));
    setEditing(true);
    onError("");
  };

  const cancelEdit = () => {
    setDraft(draftFromJob(job));
    setEditing(false);
  };

  const saveEdit = () => {
    if (!draft.role.trim() || !draft.company.trim()) {
      onError("Role and company cannot be empty.");
      return;
    }
    const body = buildPatch(job, draft);
    if (!body) {
      setEditing(false);
      return;
    }
    void (async () => {
      setBusy(true);
      onError("");
      try {
        const updated = await patchJob(job.id, body);
        onUpdated(updated);
        setEditing(false);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleDelete = () => {
    if (!window.confirm("Remove this job permanently?")) return;
    void (async () => {
      setBusy(true);
      onError("");
      try {
        await deleteJobApi(job.id);
        onRemoved(job.id);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <tr className={busy ? "row-busy" : undefined}>
      <td className="td-edit">
        {editing ? (
          <div className="td-edit-inner">
            <button
              type="button"
              className="btn-save"
              disabled={busy}
              onClick={saveEdit}
            >
              Save
            </button>
            <button
              type="button"
              className="btn-cancel"
              disabled={busy}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-icon"
            disabled={busy}
            onClick={startEdit}
            aria-label="Edit job"
            title="Edit"
          >
            <EditIcon />
          </button>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="cell-input"
            type="text"
            value={draft.role}
            disabled={busy}
            onChange={(e) =>
              setDraft((d) => ({ ...d, role: e.target.value }))
            }
          />
        ) : (
          <span className="cell-text">{job.role}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="cell-input"
            type="text"
            value={draft.company}
            disabled={busy}
            onChange={(e) =>
              setDraft((d) => ({ ...d, company: e.target.value }))
            }
          />
        ) : (
          <span className="cell-text">{job.company}</span>
        )}
      </td>
      <td>
        {editing ? (
          <input
            className="cell-input"
            type="text"
            value={draft.location}
            disabled={busy}
            onChange={(e) =>
              setDraft((d) => ({ ...d, location: e.target.value }))
            }
            placeholder="—"
          />
        ) : (
          <span className="cell-text">{job.location || "—"}</span>
        )}
      </td>
      <td className="td-status">
        <StatusSelect job={job} disabled={busy} onPatch={runPatch} />
      </td>
      <td>
        {editing ? (
          <textarea
            className="cell-textarea"
            value={draft.notes}
            disabled={busy}
            rows={3}
            onChange={(e) =>
              setDraft((d) => ({ ...d, notes: e.target.value }))
            }
            placeholder="Notes"
          />
        ) : (
          <span className="cell-text cell-text--notes">
            {job.notes?.trim() ? job.notes : "—"}
          </span>
        )}
      </td>
      <td className="mono">{formatWhen(job.date_added)}</td>
      <td className="td-link">
        <a
          className="job-link-icon"
          href={job.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open job link"
          title={job.url}
        >
          <ExternalLinkIcon />
        </a>
      </td>
      <td className="td-delete">
        <button
          type="button"
          className="btn-delete"
          disabled={busy}
          onClick={handleDelete}
          aria-label="Remove job"
          title="Remove"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await fetchJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJobUpdated = useCallback((updated: Job) => {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }, []);

  const handleJobRemoved = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return (
    <div className="app">
      <h1>AppFlow</h1>
      <p className="sub">Your saved job applications (newest first)</p>

      <div className="toolbar">
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="banner error">
          Could not load jobs: {error}. Is the API running on{" "}
          <code>http://127.0.0.1:9000</code>?
        </div>
      ) : null}

      {rowError ? (
        <div className="banner error">
          {rowError}
          <button
            type="button"
            className="banner-dismiss"
            onClick={() => setRowError("")}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {!error && !loading && jobs.length === 0 ? (
        <p className="empty-state">No jobs applied</p>
      ) : null}

      {jobs.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="th-edit" aria-label="Edit" />
                <th>Role</th>
                <th>Company</th>
                <th>Location</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Added</th>
                <th className="th-link">Link</th>
                <th className="th-delete" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onUpdated={handleJobUpdated}
                  onRemoved={handleJobRemoved}
                  onError={setRowError}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {loading && jobs.length === 0 && !error ? (
        <div className="empty">Loading jobs…</div>
      ) : null}
    </div>
  );
}
