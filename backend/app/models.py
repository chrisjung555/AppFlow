from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class JobStatus(str, Enum):
    interested = "Interested"
    applied = "Applied"
    online_assessment = "Online Assessment"
    interview = "Interview"
    offer = "Offer"
    rejected = "Rejected"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobBase(SQLModel):
    company: str
    role: str
    location: Optional[str] = None
    url: str
    platform: str = "linkedin"
    status: JobStatus = JobStatus.interested
    notes: str = ""


class Job(JobBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    date_added: datetime = Field(default_factory=_utc_now, nullable=False)
    date_updated: datetime = Field(default_factory=_utc_now, nullable=False)


class JobCreate(SQLModel):
    company: str
    role: str
    location: Optional[str] = None
    url: str
    platform: str = "linkedin"


class JobUpdate(SQLModel):
    company: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    platform: Optional[str] = None
    status: Optional[JobStatus] = None
    notes: Optional[str] = None

