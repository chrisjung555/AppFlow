(function () {
  if (typeof globalThis.__appflowExtractLinkedInJob === "function") return;

  function normalizeText(s) {
    if (!s) return "";
    return String(s).replace(/\s+/g, " ").trim();
  }

  function querySafe(root, selector) {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  }

  function queryAllSafe(root, selector) {
    try {
      return [...root.querySelectorAll(selector)];
    } catch {
      return [];
    }
  }

  function pickFromSelectors(root, selectors) {
    for (const sel of selectors) {
      const el = querySafe(root, sel);
      const t = normalizeText(el?.textContent);
      if (t) return t;
    }
    return "";
  }

  /** Never use full `jobs-search__main-content` — it includes nav ("0 notifications"), lists, and wrong lockups. */
  const DETAIL_ROOT_SELECTORS = [
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".jobs-search__job-details",
    ".jobs-details__main-content",
    ".scaffold-layout__detail",
    "#job-details",
  ];

  function getDetailRoots() {
    const roots = [];
    for (const sel of DETAIL_ROOT_SELECTORS) {
      const el = querySafe(document, sel);
      if (el && !roots.includes(el)) roots.push(el);
    }
    if (roots.length) return roots;
    const top = querySafe(
      document,
      ".job-details-jobs-unified-top-card, .jobs-unified-top-card, .jobs-details-top-card"
    );
    if (top) return [top];
    return [document.documentElement];
  }

  const ROLE_SELECTORS = [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    ".jobs-details-top-card__title-text",
    ".top-card-layout__entity-info h1",
    "h1[class*='jobs-unified-top-card']",
    "h1[class*='job-details-jobs-unified']",
    ".job-details-jobs-unified-top-card h1",
    ".jobs-unified-top-card h1",
    '[data-test-id="job-details-job-title"]',
    '[data-test-id="job-card-title"]',
    "a[data-control-name*='job_card_title']",
    "a[class*='job-card-container__link']",
    ".artdeco-entity-lockup__title",
    'h1[class*="job-title"]',
    'h2[class*="job-title"]',
    "main h1",
    "h1",
    "h2",
  ];

  const COMPANY_SELECTORS = [
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name",
    ".jobs-details-top-card__company-name a",
    ".jobs-details-top-card__company-name",
    ".jobs-unified-top-card__subtitle-primary-grouping",
    'span[class*="company-name"]',
    ".top-card-layout__entity-info a[href*='/company/']",
    'a[data-tracking-control-name*="job_card_company_link"]',
    'a[data-tracking-control-name*="public_jobs_topcard-org-name"]',
    'a[data-tracking-control-name*="topcard_logo"]',
    '[data-test-id="job-details-company-name"]',
    ".artdeco-entity-lockup__subtitle a",
    ".artdeco-entity-lockup__subtitle",
    'a[href*="/company/"]',
  ];

  /** Strip nav + company-insight glue that leaks into textContent when the wrong node is read. */
  function sanitizeCompanyFromLinkedIn(raw) {
    let s = normalizeText(raw);
    if (!s) return "";
    s = s.replace(/^\d+\s+notifications\s*/i, "").trim();
    s = s.split(/\bI['']?m\s+interested\b/i)[0].trim();
    s = s.split(/\bActively\s+(?:reviewing|recruiting)\b/i)[0].trim();
    s = s.replace(/\s*·\s*Actively\s+(?:reviewing|recruiting).*$/i, "").trim();
    s = s.replace(/([A-Za-z)])(\d[\d,+]*\+?\s*employees?\b)/i, "$1 $2");
    const emp = s.match(/\b\d[\d,+]*\+?\s*employees?\b/i);
    if (emp && emp.index != null) {
      s = s.slice(0, emp.index).trim();
    }
    return normalizeText(s);
  }

  function sanitizeRoleFromLinkedIn(raw) {
    let s = normalizeText(raw);
    if (!s) return "";
    s = s.replace(/^\d+\s+notifications\s*/i, "").trim();
    return normalizeText(s);
  }

  /** Narrow bullets / test ids first; wide containers last (they concatenate insights). */
  const LOCATION_SELECTORS = [
    '[data-test-id="job-details-location"]',
    ".job-details-jobs-unified-top-card__bullet",
    "span[class*='job-details-jobs-unified-top-card__bullet']",
    ".jobs-unified-top-card__bullet",
    "span[class*='jobs-unified-top-card__bullet']",
    ".jobs-unified-top-card__workplace-type",
    ".job-details-jobs-unified-top-card__primary-description",
    ".job-details-jobs-unified-top-card__secondary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".job-details-jobs-unified-top-card__primary-description-container",
    "span[class*='topcard__flavor']",
    ".artdeco-entity-lockup__caption",
  ];

  /**
   * LinkedIn glues location with insights using " · " (e.g. time ago, applicants, Promoted).
   * Keep place-like text only; prefer "City, Country" when present.
   */
  function sanitizeLinkedInLocation(raw) {
    let s = normalizeText(raw);
    if (!s) return "";

    // Help split glued phrases like "... applicantsPromoted by ..."
    s = s.replace(/(\d+)\s*applicants?\s*/gi, "$1 applicants · ");
    s = s.replace(/\b(Promoted\s+by\s+)/gi, " · $1");
    s = s.replace(/\b(Actively\s+reviewing\s+)/gi, " · $1");

    const parts = s.split(/\s*·\s*/).map((p) => normalizeText(p)).filter(Boolean);
    if (parts.length === 0) return "";

    const noise =
      /\b(?:ago|applicants?|promoted|actively\s+reviewing|actively\s+recruiting|connections?)\b/i;
    const timeAgoOnly =
      /^\d+\s*(?:second|minute|hour|day|week|month|year)s?\s+ago$/i;
    const overApplicants = /^over\s+\d+/i;
    const workplaceOnly =
      /^(?:On-site|Hybrid|Remote)(?:\s*\([^)]+\))?$/i;

    const kept = [];
    for (const p of parts) {
      if (timeAgoOnly.test(p) || overApplicants.test(p)) break;
      if (noise.test(p) && !/,/.test(p)) break;
      if (workplaceOnly.test(p)) continue;
      kept.push(p);
    }

    let out = "";
    if (kept.length) {
      const withComma = kept.find((p) => /,/.test(p));
      out = withComma || kept[0];
    } else {
      out = parts[0];
    }

    out = out.replace(/\s*\([^)]*(?:On-site|Hybrid|Remote)[^)]*\)\s*$/i, "").trim();
    out = out.replace(/\s+(?:\d+\s*(?:day|week|month|year)s?\s+ago)\b.*$/i, "").trim();
    out = out.replace(/\bOver\s+\d+\s+applicants?\b.*$/i, "").trim();
    out = out.replace(/\bPromoted\b.*$/i, "").trim();
    out = out.replace(/\bActively\s+reviewing\b.*$/i, "").trim();

    return normalizeText(out);
  }

  /** Scan individual bullet nodes (often one clean line each) before falling back to big containers. */
  function locationFromTopCardBullets() {
    const bulletSelectors = [
      '[data-test-id="job-details-location"]',
      ".job-details-jobs-unified-top-card__bullet",
      "span[class*='job-details-jobs-unified-top-card__bullet']",
      ".jobs-unified-top-card__bullet",
      "span[class*='jobs-unified-top-card__bullet']",
    ];
    const roots = getDetailRoots();
    let fallback = "";
    for (const root of roots) {
      for (const sel of bulletSelectors) {
        for (const el of queryAllSafe(root, sel)) {
          const cleaned = sanitizeLinkedInLocation(normalizeText(el.textContent));
          if (!cleaned) continue;
          if (/,/.test(cleaned) && cleaned.length < 140) return cleaned;
          if (!fallback && cleaned.length < 140) fallback = cleaned;
        }
      }
    }
    return fallback;
  }

  function extractField(selectors) {
    const roots = getDetailRoots();
    for (const root of roots) {
      const v = pickFromSelectors(root, selectors);
      if (v) return v;
    }
    return pickFromSelectors(document, selectors);
  }

  function companyFromCompanyLinks() {
    const roots = new Set(getDetailRoots());
    const jobDetails = querySafe(document, ".jobs-search__job-details");
    if (jobDetails) roots.add(jobDetails);
    for (const sel of [
      ".job-details-jobs-unified-top-card",
      ".jobs-unified-top-card",
      ".jobs-details-top-card",
    ]) {
      const el = querySafe(document, sel);
      if (el) roots.add(el);
    }

    const tryLink = (a) => {
      let t = normalizeText(a?.textContent);
      if (!t || t.length > 180) return "";
      if (/^(see all|view all|show more)/i.test(t)) return "";
      t = sanitizeCompanyFromLinkedIn(t);
      return t;
    };

    for (const root of roots) {
      for (const a of queryAllSafe(root, 'a[href*="/company/"]')) {
        const t = tryLink(a);
        if (t) return t;
      }
    }
    return "";
  }

  function roleFromHeadings() {
    const skip = /^(jobs|job search|linkedin)$/i;
    const roots = getDetailRoots();
    for (const root of roots) {
      for (const h of queryAllSafe(root, "h1, h2")) {
        const t = normalizeText(h.textContent);
        if (!t || t.length > 220 || skip.test(t)) continue;
        if (/\bnotifications\b|i['']?m\s+interested|actively\s+recruiting/i.test(t)) {
          continue;
        }
        return t;
      }
    }
    return "";
  }

  function fromJsonLd() {
    let title = "";
    let hiringOrg = "";
    let jobLoc = "";
    for (const script of queryAllSafe(document, 'script[type="application/ld+json"]')) {
      let data;
      try {
        data = JSON.parse(script.textContent || "{}");
      } catch {
        continue;
      }
      const items = Array.isArray(data) ? data : data["@graph"] ? [].concat(data["@graph"]) : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = item["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.some((x) => String(x).toLowerCase() === "jobposting")) continue;
        if (item.title) title = title || normalizeText(item.title);
        const org = item.hiringOrganization;
        if (org && typeof org === "object" && org.name) {
          hiringOrg = hiringOrg || normalizeText(org.name);
        }
        const jl = item.jobLocation;
        if (!jobLoc && jl) {
          if (typeof jl === "string") jobLoc = normalizeText(jl);
          else if (typeof jl === "object") {
            const addr = jl.address || jl;
            if (addr && typeof addr === "object") {
              const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
              if (parts.length) jobLoc = normalizeText(parts.join(", "));
            }
          }
        }
      }
    }
    return { title, hiringOrg, jobLoc };
  }

  function __appflowExtractLinkedInJob() {
    let role = extractField(ROLE_SELECTORS);
    let company = extractField(COMPANY_SELECTORS);
    let location = locationFromTopCardBullets();
    if (!location) {
      location = sanitizeLinkedInLocation(extractField(LOCATION_SELECTORS));
    }

    const ld = fromJsonLd();
    if (!role && ld.title) role = ld.title;
    if (!company && ld.hiringOrg) company = ld.hiringOrg;
    if (!location && ld.jobLoc) {
      location = sanitizeLinkedInLocation(ld.jobLoc);
    }

    if (!company) company = companyFromCompanyLinks();
    if (!role) role = roleFromHeadings();

    company = sanitizeCompanyFromLinkedIn(company);
    role = sanitizeRoleFromLinkedIn(role);

    return {
      company,
      role,
      location: sanitizeLinkedInLocation(location),
      url: window.location.href,
      platform: "linkedin",
    };
  }

  globalThis.__appflowExtractLinkedInJob = __appflowExtractLinkedInJob;
})();
