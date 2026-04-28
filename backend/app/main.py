from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, col, select

from .config import get_settings
from .db import get_session, init_db
from .models import Job, JobCreate, JobUpdate
from .utils import normalize_url


app = FastAPI(title="AppFlow API", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/jobs", response_model=list[Job])
def list_jobs(session: Session = Depends(get_session)) -> list[Job]:
    statement = select(Job).order_by(col(Job.date_added).desc())
    return list(session.exec(statement).all())


@app.post("/jobs", response_model=Job, status_code=201)
def create_job(payload: JobCreate, response: Response, session: Session = Depends(get_session)) -> Any:
    normalized_url = normalize_url(payload.url)

    existing = session.exec(
        select(Job).where((Job.platform == payload.platform) & (Job.url == normalized_url))
    ).first()
    if existing is not None:
        # Idempotent create: return existing without creating a new row.
        response.status_code = 200
        return existing

    now = datetime.now(timezone.utc)
    job = Job(
        company=payload.company,
        role=payload.role,
        location=payload.location,
        url=normalized_url,
        platform=payload.platform,
        date_added=now,
        date_updated=now,
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@app.patch("/jobs/{job_id}", response_model=Job)
def update_job(job_id: UUID, payload: JobUpdate, session: Session = Depends(get_session)) -> Job:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Job not found"})

    data = payload.model_dump(exclude_unset=True)
    if "url" in data and data["url"] is not None:
        data["url"] = normalize_url(data["url"])

    for key, value in data.items():
        setattr(job, key, value)

    job.date_updated = datetime.now(timezone.utc)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


@app.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: UUID, session: Session = Depends(get_session)) -> Response:
    job = session.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Job not found"})

    session.delete(job)
    session.commit()
    return Response(status_code=204)

