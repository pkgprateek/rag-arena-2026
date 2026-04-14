"""Configuration routes exposed to the frontend."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models import TierProfile
from app.tier_profiles import get_public_tier_profiles

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/tiers", response_model=list[TierProfile])
async def get_tier_profiles() -> list[TierProfile]:
    """Return the canonical public tier profiles in display order."""
    return get_public_tier_profiles()


@router.get("/calcom")
async def get_calcom_link() -> dict:
    """Return the Cal.com link for CTA buttons."""
    return {"calcom_link": settings.calcom_link}
