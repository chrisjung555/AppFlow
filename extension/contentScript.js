(() => {
  const BANNER_ID = "appflow-banner";
  const API_BASE_URL = "http://127.0.0.1:9000";
  const DISMISSED_JOB_ID_KEY = "appflow:dismissedJobId";

  function isLinkedInJobPage() {
    // MVP rule: only treat as valid job page if URL includes:
    // - linkedin.com
    // - /jobs/
    // - currentJobId=...
    const host = window.location.hostname || "";
    if (!host.endsWith("linkedin.com")) return false;

    const path = window.location.pathname || "";
    if (!path.includes("/jobs/")) return false;

    const params = new URLSearchParams(window.location.search || "");
    return params.has("currentJobId");
  }

  function getCurrentJobId() {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("currentJobId");
  }

  function getDismissedJobId() {
    try {
      return sessionStorage.getItem(DISMISSED_JOB_ID_KEY);
    } catch {
      return null;
    }
  }

  function setDismissedJobId(jobId) {
    try {
      sessionStorage.setItem(DISMISSED_JOB_ID_KEY, jobId);
    } catch {
      // ignore
    }
  }

  function extractLinkedInJob() {
    const fn = globalThis.__appflowExtractLinkedInJob;
    if (typeof fn === "function") return fn();
    return {
      company: "",
      role: "",
      location: "",
      url: window.location.href,
      platform: "linkedin",
    };
  }

  function ensureBanner() {
    const existing = document.getElementById(BANNER_ID);

    if (!isLinkedInJobPage()) {
      if (existing) existing.remove();
      return;
    }
    const currentJobId = getCurrentJobId();
    if (currentJobId && getDismissedJobId() === currentJobId) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.className = "appflow-banner";

    banner.innerHTML = `
      <div class="appflow-banner__title">Is this a role you’re applying for?</div>
      <div class="appflow-banner__actions">
        <button class="appflow-banner__btn appflow-banner__btn--primary" data-appflow-action="yes">Yes, track this</button>
        <button class="appflow-banner__btn" data-appflow-action="no">No</button>
      </div>
      <div class="appflow-banner__status" data-appflow-status>Waiting…</div>
    `;

    const statusEl = banner.querySelector("[data-appflow-status]");
    const setStatus = (text) => {
      if (statusEl) statusEl.textContent = text;
    };

    banner.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button[data-appflow-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-appflow-action");
      if (action === "no") {
        const jobId = getCurrentJobId();
        if (jobId) setDismissedJobId(jobId);
        setStatus("Dismissed.");
        banner.remove();
        return;
      }

      if (action === "yes") {
        (async () => {
          const job = extractLinkedInJob();
          if (!job.role || !job.company) {
            setStatus(
              "Couldn’t read title/company from the page yet. Wait for the job panel to load, then try again."
            );
            return;
          }

          setStatus("Saving…");
          try {
            const res = await fetch(`${API_BASE_URL}/jobs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(job),
            });

            if (!res.ok) {
              const text = await res.text();
              setStatus(`Save failed (${res.status}): ${text.slice(0, 120)}`);
              return;
            }

            const saved = await res.json();
            setStatus(res.status === 200 ? "Already tracked." : "Saved.");
            console.debug("[AppFlow] saved job", saved);
          } catch (err) {
            setStatus(`Save failed: ${err?.message || String(err)}`);
          }
        })();
      }
    });

    document.documentElement.appendChild(banner);
    setStatus("Detected LinkedIn job page.");
  }

  function safeEnsureBanner() {
    try {
      ensureBanner();
    } catch (err) {
      // Avoid console spam from repeated failures
      console.debug("[AppFlow] ensureBanner failed", err);
    }
  }

  function onUrlChange() {
    safeEnsureBanner();
  }

  function hookHistory() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const ret = originalPushState.apply(this, args);
      onUrlChange();
      return ret;
    };

    history.replaceState = function (...args) {
      const ret = originalReplaceState.apply(this, args);
      onUrlChange();
      return ret;
    };

    window.addEventListener("popstate", onUrlChange);
  }

  hookHistory();
  safeEnsureBanner();
})();

