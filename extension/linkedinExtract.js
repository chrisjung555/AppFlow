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

  /** Most specific job-detail containers first so queries stay in-context. */
  const DETAIL_ROOT_SELECTORS = [
    ".jobs-search__job-details",
    ".jobs-details__main-content",
    ".scaffold-layout__detail",
    ".jobs-search__main-content",
    ".job-details-jobs-unified-top-card",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    "#job-details",
  ];

  function getDetailRoots() {
    const roots = [];
    for (const sel of DETAIL_ROOT_SELECTORS) {
      const el = querySafe(document, sel);
      if (el && !roots.includes(el)) roots.push(el);
    }
    return roots.length ? roots : [document.documentElement];
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
    ".top-card-layout__entity-info a[href*='/company/']",
    'a[data-tracking-control-name*="job_card_company_link"]',
    'a[data-tracking-control-name*="public_jobs_topcard-org-name"]',
    'a[data-tracking-control-name*="topcard_logo"]',
    '[data-test-id="job-details-company-name"]',
    ".artdeco-entity-lockup__subtitle a",
    ".artdeco-entity-lockup__subtitle",
    ".jobs-unified-top-card__subtitle-primary-grouping",
    'a[href*="/company/"]',
    'span[class*="company-name"]',
  ];

  const LOCATION_SELECTORS = [
    ".job-details-jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__primary-description",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__secondary-description-container",
    ".job-details-jobs-unified-top-card__tertiary-description-container",
    ".jobs-unified-top-card__bullet",
    "span[class*='job-details-jobs-unified-top-card__bullet']",
    "span[class*='jobs-unified-top-card__bullet']",
    '[data-test-id="job-details-location"]',
    ".jobs-unified-top-card__workplace-type",
    "span[class*='topcard__flavor']",
    ".artdeco-entity-lockup__caption",
  ];

  function extractField(selectors) {
    const roots = getDetailRoots();
    for (const root of roots) {
      const v = pickFromSelectors(root, selectors);
      if (v) return v;
    }
    return pickFromSelectors(document, selectors);
  }

  function companyFromCompanyLinks() {
    const roots = getDetailRoots();
    const tryLink = (a) => {
      const t = normalizeText(a?.textContent);
      if (!t || t.length > 180) return "";
      if (/^(see all|view all|show more)/i.test(t)) return "";
      return t;
    };

    for (const root of roots) {
      for (const a of queryAllSafe(root, 'a[href*="/company/"]')) {
        const t = tryLink(a);
        if (t) return t;
      }
    }
    for (const a of queryAllSafe(document, 'a[href*="/company/"]')) {
      const t = tryLink(a);
      if (t) return t;
    }
    return "";
  }

  function roleFromHeadings() {
    const skip = /^(jobs|job search|linkedin)$/i;
    const roots = getDetailRoots();
    for (const root of roots) {
      for (const h of queryAllSafe(root, "h1, h2")) {
        const t = normalizeText(h.textContent);
        if (t && t.length < 220 && !skip.test(t)) return t;
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
    let location = extractField(LOCATION_SELECTORS);

    const ld = fromJsonLd();
    if (!role && ld.title) role = ld.title;
    if (!company && ld.hiringOrg) company = ld.hiringOrg;
    if (!location && ld.jobLoc) location = ld.jobLoc;

    if (!company) company = companyFromCompanyLinks();
    if (!role) role = roleFromHeadings();

    return {
      company,
      role,
      location,
      url: window.location.href,
      platform: "linkedin",
    };
  }

  globalThis.__appflowExtractLinkedInJob = __appflowExtractLinkedInJob;
})();
