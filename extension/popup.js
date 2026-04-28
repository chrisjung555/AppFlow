const API_BASE_URL = "http://127.0.0.1:9000";

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function isLinkedInJobUrlWithCurrentJobId(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith("linkedin.com")) return false;
    if (!u.pathname.includes("/jobs/")) return false;
    return u.searchParams.has("currentJobId");
  } catch {
    return false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFromPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const pickText = (selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          const txt = el?.textContent?.trim();
          if (txt) return txt;
        }
        return "";
      };

      const role = pickText(["h1"]);
      const company = pickText(['a[href*="/company/"]', 'a[data-tracking-control-name*="public_jobs_topcard-org-name"]']);
      const location = pickText([".jobs-unified-top-card__bullet", "span[class*='topcard__flavor']"]);

      return {
        company,
        role,
        location,
        url: window.location.href,
        platform: "linkedin",
      };
    },
  });

  return result;
}

async function saveJob(job) {
  const res = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job),
  });

  const bodyText = await res.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = bodyText;
  }

  return { status: res.status, ok: res.ok, body };
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("addBtn");
  if (!btn) return;

  (async () => {
    const tab = await getActiveTab();
    const url = tab?.url || "";
    const ok = isLinkedInJobUrlWithCurrentJobId(url);
    btn.disabled = !ok;
    setStatus(
      ok
        ? "Ready."
        : "Open a valid LinkedIn job posting"
    );
  })();

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    setStatus("Reading page…");

    try {
      const tab = await getActiveTab();
      const url = tab?.url || "";
      if (!isLinkedInJobUrlWithCurrentJobId(url)) {
        setStatus("Not on a supported LinkedIn job URL (missing currentJobId).");
        return;
      }

      const job = await extractFromPage(tab.id);
      if (!job?.company || !job?.role) {
        setStatus("Couldn’t detect role/company on this page.");
        return;
      }

      setStatus("Saving…");
      const result = await saveJob(job);
      if (!result.ok) {
        setStatus(`Save failed (${result.status}).`);
        console.debug("[AppFlow] save failed", result);
        return;
      }

      setStatus(result.status === 200 ? "Already tracked." : "Saved.");
    } catch (err) {
      setStatus(`Error: ${err?.message || String(err)}`);
      console.debug("[AppFlow] error", err);
    } finally {
      btn.disabled = false;
    }
  });
});

