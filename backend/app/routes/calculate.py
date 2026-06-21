from typing import Any

from fastapi import APIRouter, Depends

from app.carbon import factors
from app.carbon.calculator import calculate_footprint
from app.config import Settings, get_settings
from app.insights.gemini import generate_insights
from app.models import CarbonInput, FootprintResult, InsightsResponse

router = APIRouter(prefix="/api", tags=["footprint"])


@router.get("/factors")
def get_factors() -> dict[str, Any]:
    """Expose the active carbon conversion factors and regional constants."""
    return {
        "diet_annual_kg": factors.DIET_ANNUAL_KG,
        "car_factors_per_km": factors.CAR_FACTORS_PER_KM,
        "weeks_per_year": factors.WEEKS_PER_YEAR,
        "months_per_year": factors.MONTHS_PER_YEAR,
        "public_transit_per_km": factors.PUBLIC_TRANSIT_PER_KM,
        "short_haul_trip_km": factors.SHORT_HAUL_TRIP_KM,
        "flight_short_haul_per_km": factors.FLIGHT_SHORT_HAUL_PER_KM,
        "long_haul_trip_km": factors.LONG_HAUL_TRIP_KM,
        "flight_long_haul_per_km": factors.FLIGHT_LONG_HAUL_PER_KM,
        "electricity_per_kwh_regional": factors.ELECTRICITY_PER_KWH_REGIONAL,
        "natural_gas_per_kwh": factors.NATURAL_GAS_PER_KWH,
        "goods_per_usd_monthly": factors.GOODS_PER_USD_MONTHLY,
        "waste_per_kg": factors.WASTE_PER_KG,
        "global_avg_annual_kg": factors.GLOBAL_AVG_ANNUAL_KG,
        "sustainable_target_annual_kg": factors.SUSTAINABLE_TARGET_ANNUAL_KG,
    }


@router.post("/calculate", response_model=FootprintResult)
def calculate(payload: CarbonInput) -> FootprintResult:
    """Compute the annual carbon footprint breakdown for the supplied inputs."""
    return calculate_footprint(payload)


@router.post("/insights", response_model=InsightsResponse)
def insights(payload: CarbonInput, settings: Settings = Depends(get_settings)) -> InsightsResponse:
    """Return personalized reduction advice (Gemini, with rule-based fallback)."""
    result = calculate_footprint(payload)
    return generate_insights(payload, result, settings)
