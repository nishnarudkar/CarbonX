"""Personalized insights via Google Gemini on Vertex AI.

Design principle: **graceful degradation**. The public entry point,
``generate_insights``, attempts a Gemini call when enabled and *always* falls
back to the deterministic rule-based engine on any error (disabled flag, missing
credentials, network/quota failure, malformed response). The platform therefore
never fails to give the user advice, and every code path is testable without GCP
by toggling settings or patching ``_call_gemini``.

Authentication uses Application Default Credentials (the Cloud Run service
account in production) — there is no API key in the codebase.
"""

from __future__ import annotations

import json
import logging

from app.config import Settings
from app.insights.rules import generate_rule_based_insights
from app.models import CarbonInput, FootprintResult, InsightsResponse, Recommendation

logger = logging.getLogger(__name__)

_SYSTEM_INSTRUCTION = (
    "You are a concise, encouraging sustainability coach. Given a person's annual "
    "carbon footprint breakdown (kg CO2e), produce a short summary and 2-4 specific, "
    "realistic actions that target their largest emission sources. Each action must "
    "include an estimated annual saving in kg CO2e. Be practical and non-judgmental."
)

# Schema for Gemini structured (JSON) output.
_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {"type": "string"},
                    "action": {"type": "string"},
                    "estimated_annual_savings_kg": {"type": "number"},
                },
                "required": ["category", "action", "estimated_annual_savings_kg"],
            },
        },
    },
    "required": ["summary", "recommendations"],
}


def _build_prompt(data: CarbonInput, result: FootprintResult) -> str:
    """Build the prompt for Gemini detailing the user's footprint breakdown and context."""
    return (
        "Carbon footprint breakdown (kg CO2e per year):\n"
        f"{json.dumps(result.breakdown_kg)}\n"
        f"Total: {result.total_annual_kg} kg/yr ({result.total_annual_tonnes} t/yr).\n"
        f"Sustainable target: {result.comparison.sustainable_target_annual_kg} kg/yr.\n"
        f"Diet: {data.diet.value}. Car fuel: {data.transport.car_fuel.value}.\n"
        "Give tailored advice to reduce the largest sources."
    )


def _call_gemini(
    data: CarbonInput, result: FootprintResult, settings: Settings
) -> InsightsResponse:
    """Invoke Gemini on Vertex AI and parse a structured response.

    Imported lazily so the SDK/credentials are only required when actually used —
    keeps unit tests and the rule-based path dependency-free.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(vertexai=True, project=settings.project_id, location=settings.region)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=_build_prompt(data, result),
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=_RESPONSE_SCHEMA,
            temperature=0.4,
            # Gemini 2.5 models "think" before answering, and thinking tokens
            # share this budget. Keep it generous so reasoning plus the final
            # structured JSON always fit and the response is never truncated.
            max_output_tokens=4096,
        ),
    )
    payload = json.loads(response.text)
    recommendations = [
        Recommendation(
            category=str(r["category"]),
            action=str(r["action"]),
            estimated_annual_savings_kg=round(float(r["estimated_annual_savings_kg"]), 2),
        )
        for r in payload.get("recommendations", [])
    ]
    if not recommendations:
        raise ValueError("Gemini returned no recommendations")
    return InsightsResponse(
        summary=str(payload["summary"]),
        recommendations=recommendations[:4],
        source="gemini",
    )


def generate_insights(
    data: CarbonInput, result: FootprintResult, settings: Settings
) -> InsightsResponse:
    """Return personalized insights, preferring Gemini and falling back to rules."""
    if not settings.use_gemini:
        return generate_rule_based_insights(data, result)
    try:
        return _call_gemini(data, result, settings)
    except Exception as exc:  # deliberately broad: any failure must degrade gracefully
        logger.warning("Gemini insight generation failed, using rule-based fallback: %s", exc)
        return generate_rule_based_insights(data, result)
