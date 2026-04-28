# AppFlow

AppFlow is a personal job application tracking system:

- A **Chrome extension** detects job listings (starting with LinkedIn) and asks “Is this a role you’re applying for?”
- If you confirm, it saves the role to a **FastAPI backend**
- A **React dashboard** shows applications in a pipeline and lets you update status + notes

## MVP scope

- **Backend**: FastAPI + REST endpoints for jobs
- **Frontend**: React dashboard (table first; kanban later)
- **Extension**: Manifest V3, LinkedIn job page detection + extraction + confirmation prompt
- **Database**: start simple, but design to swap to PostgreSQL later (e.g., Render Postgres)

## Repo structure

```
/backend
/frontend
/extension
README.md
```

## Core user flow

1. User browses a job listing site (MVP: LinkedIn).
2. Extension detects a job listing page.
3. Extension extracts basic job data.
4. Extension shows a confirmation prompt: “Is this a role you’re applying for?”
5. On “Yes”, extension sends job data to backend.
6. Backend stores the job application (dedupe to avoid clutter).
7. Frontend dashboard displays the saved applications in a pipeline/table.

## Domain model: JobApplication

Canonical fields (used consistently across extension → API → frontend):

- **id**: string (server-generated)
- **company**: string (required)
- **role**: string (required)
- **location**: string (optional)
- **url**: string (required)
- **platform**: string enum (MVP: `linkedin`)
- **status**: string enum (default: `Interested`)
- **notes**: string (optional, default empty)
- **date_added**: ISO datetime string (server-generated)
- **date_updated**: ISO datetime string (server-generated)

### Status values

`Interested` | `Applied` | `Online Assessment` | `Interview` | `Offer` | `Rejected`

## Duplicate policy (MVP)

To avoid clutter and accidental repeats:

- **Primary dedupe key**: `(platform, normalized_url)`
- **POST /jobs is idempotent**:
  - Create new job → **201** with created JobApplication
  - Duplicate job → **200** with existing JobApplication (no new row)

## API contract (MVP)

Base URL (local dev): `http://localhost:8000`

### GET `/jobs`

- **200** → `JobApplication[]` (sorted newest-first)

### POST `/jobs`

Request body:

```json
{
  "company": "Acme",
  "role": "Software Engineer",
  "location": "Sydney, NSW",
  "url": "https://www.linkedin.com/jobs/view/123...",
  "platform": "linkedin"
}
```

- **201** created OR **200** existing → `JobApplication`

### PATCH `/jobs/{id}`

Partial update request body:

```json
{ "status": "Applied", "notes": "Referred by Sam" }
```

- **200** → updated `JobApplication`

### DELETE `/jobs/{id}`

- **204** no content

## Error shape (simple + consistent)

Non-2xx responses return:

```json
{ "error": "SOME_CODE", "message": "Human readable message" }
```

## Deployment target (later): Render

- Backend runs as a **Render Web Service**
- Database later can be **Render Postgres** via `DATABASE_URL`
- CORS should be configurable via environment variables (dashboard origin + extension use)
