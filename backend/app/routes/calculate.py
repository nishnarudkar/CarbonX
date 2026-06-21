"""Footprint calculation and insights endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.carbon.calculator import calculate_footprint
from app.config import Settings, get_settings
from app.insights.gemini import generate_insights
from app.models import CarbonInput, FootprintResult, InsightsResponse

router = APIRouter(prefix="/api", tags=["footprint"])


@router.post("/calculate", response_model=FootprintResult)
def calculate(payload: CarbonInput) -> FootprintResult:
    """Compute the annual carbon footprint breakdown for the supplied inputs."""
    return calculate_footprint(payload)


@router.post("/insights", response_model=InsightsResponse)
def insights(payload: CarbonInput, settings: Settings = Depends(get_settings)) -> InsightsResponse:
    """Return personalized reduction advice (Gemini, with rule-based fallback)."""
    result = calculate_footprint(payload)
    return generate_insights(payload, result, settings)
