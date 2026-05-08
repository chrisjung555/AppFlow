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

async function fetchJobs(): Promise<Job[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
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

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="app">
      <h1>AppFlow</h1>
      <p className="sub">Saved job applications (newest first).</p>

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

      {!error && !loading && jobs.length === 0 ? (
        <div className="banner hint">
          No jobs yet. Save one from the LinkedIn extension while the backend is
          running, then refresh.
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Company</th>
                <th>Location</th>
                <th>Status</th>
                <th>Added</th>
                <th>Listing</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.role}</td>
                  <td>{job.company}</td>
                  <td>{job.location || "—"}</td>
                  <td>{job.status}</td>
                  <td className="mono">{formatWhen(job.date_added)}</td>
                  <td>
                    <a
                      className="job-link"
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </td>
                </tr>
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
