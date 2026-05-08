# AppFlow

AppFlow is a personal job application tracker:

- A **Chrome extension** (Manifest V3) detects LinkedIn job views, scrapes role/company/location from the page, and asks whether to track the listing.
- On confirm, it **POSTs** to a **FastAPI** backend, which stores rows in **SQLite** (deduped by normalized URL).
- A **React + Vite** dashboard lists jobs, lets you **edit** fields (not the listing URL), change **status** via a dropdown, and **delete** rows.

## Tech stack

| Area        | Choice |
|------------|--------|
| Backend    | Python 3, **FastAPI**, **SQLModel** (SQLite by default) |
| Database   | **SQLite** file (`appflow.sqlite3` under `backend/` when you run the API from that directory). Override with `DATABASE_URL`. |
| Frontend   | **React 18**, **TypeScript**, **Vite** (`npm run dev`). Dev server proxies `/api/*` → `http://127.0.0.1:9000`. |
| Extension  | MV3 **content script** + **popup**; shared extraction in `extension/linkedinExtract.js`. |

## MVP scope

- **Backend**: REST CRUD for jobs (`GET`, `POST`, `PATCH`, `DELETE`), idempotent `POST /jobs`, CORS for local dashboard + `chrome-extension://`.
- **Frontend**: Table view with edit mode, status select, external-link icon, delete (not kanban yet).
- **Extension**: LinkedIn URLs with `/jobs/` and `currentJobId`; banner + popup save paths.
- **Later**: hosted deploy (e.g. Render), **PostgreSQL** via `DATABASE_URL`, richer UI.

## Repo structure

```
backend/
  app/           # FastAPI app, models, SQLite session
  run-dev.sh     # optional: run API on 127.0.0.1:9000 with venv if present
  requirements.txt
extension/
  manifest.json
  contentScript.js
  linkedinExtract.js
  popup.js / popup.html
frontend/
  src/App.tsx    # dashboard
  vite.config.ts # dev proxy to backend
README.md
```

## Quick start (local)

### 1. Backend API

From `backend/` (use a venv and install deps once):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
./run-dev.sh
# same as: uvicorn app.main:app --reload --host 127.0.0.1 --port 9000
```

- Health: `http://127.0.0.1:9000/health`
- OpenAPI: `http://127.0.0.1:9000/docs`
- **SQLite file** (default): `backend/appflow.sqlite3` (created on first request).

The **extension** is configured for **`http://127.0.0.1:9000`**; keep that port unless you change both extension JS and this command.

### 2. Frontend dashboard

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The dev server proxies API calls such as `/api/jobs` to the backend on port **9000**.

### 3. Chrome extension

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → choose the `extension/` folder.
3. Browse LinkedIn job pages with the extension + API running to save jobs.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLAlchemy URL (default `sqlite:///./appflow.sqlite3` relative to process cwd). |
| `CORS_ALLOW_ORIGINS` | Comma-separated origins; defaults include `http://localhost:5173`, `http://127.0.0.1:5173`, and LinkedIn. |

## Domain model (Job)

Fields line up across extension → API → UI:

- **id** (UUID, server-generated)
- **company**, **role** (required)
- **location** (optional)
- **url** (required; normalized for dedupe; not editable in the dashboard MVP)
- **platform** (default `linkedin`)
- **status** enum: `Interested` | `Applied` | `Online Assessment` | `Interview` | `Offer` | `Rejected`
- **notes** (optional)
- **date_added**, **date_updated** (UTC, server-managed)

## Duplicate policy

- Dedupe key: **`(platform, normalized_url)`**
- **`POST /jobs`** is idempotent: new row → **201**; existing → **200** with the same row.

## API (local)

Base URL for the extension and direct tools: **`http://127.0.0.1:9000`**

| Method | Path | Notes |
|--------|------|--------|
| GET | `/jobs` | Newest first |
| POST | `/jobs` | Body: `company`, `role`, `location?`, `url`, `platform` |
| PATCH | `/jobs/{id}` | Partial JSON (e.g. `status`, `notes`, `company`, …) |
| DELETE | `/jobs/{id}` | **204** on success |
| GET | `/health` | Liveness |

Example `POST /jobs` body:

```json
{
  "company": "Acme",
  "role": "Software Engineer",
  "location": "Sydney, NSW",
  "url": "https://www.linkedin.com/jobs/view/123...",
  "platform": "linkedin"
}
```

Errors use FastAPI’s usual JSON shape (e.g. **`detail`** on validation failures; some routes use **`detail: { "error", "message" }`** for 404s).

## Deployment (later)

- Run the API as a managed web service; set **`DATABASE_URL`** to Postgres (or another server DB) when you outgrow single-machine SQLite.
- Point the built frontend at the real API base URL (today’s Vite proxy is dev-only).
- Publish the extension with updated host permissions / API URL as needed.
