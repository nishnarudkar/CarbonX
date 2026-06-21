"""Tests for the Gemini insights service and its graceful fallback."""

from __future__ import annotations

import json
from types import SimpleNamespace

from app.carbon.calculator import calculate_footprint
from app.config import Settings
from app.insights import gemini
from app.models import CarbonInput, InsightsResponse, Recommendation


def _ctx():
    data = CarbonInput()
    return data, calculate_footprint(data)


def _fake_genai_client(response_text: str):
    """A stand-in for ``genai.Client`` returning a canned model response."""

    class _FakeClient:
        def __init__(self, **_kwargs):
            self.models = SimpleNamespace(
                generate_content=lambda **_kw: SimpleNamespace(text=response_text)
            )

    return _FakeClient


def test_disabled_gemini_uses_rules():
    data, result = _ctx()
    resp = gemini.generate_insights(data, result, Settings(use_gemini=False))
    assert resp.source == "rules"


def test_gemini_failure_falls_back_to_rules(monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("vertex unavailable")

    monkeypatch.setattr(gemini, "_call_gemini", boom)
    data, result = _ctx()
    resp = gemini.generate_insights(data, result, Settings(use_gemini=True))
    assert resp.source == "rules"
    assert resp.recommendations  # fallback still produces advice


def test_build_prompt_mentions_totals_and_context():
    data, result = _ctx()
    prompt = gemini._build_prompt(data, result)
    assert str(result.total_annual_kg) in prompt
    assert data.diet.value in prompt
    assert "advice" in prompt


def test_call_gemini_parses_structured_response(monkeypatch):
    payload = {
        "summary": "You are close to the sustainable target.",
        "recommendations": [
            {"category": "diet", "action": "More plants", "estimated_annual_savings_kg": 400.123},
            {"category": "home", "action": "LED bulbs", "estimated_annual_savings_kg": 120.0},
        ],
    }
    monkeypatch.setattr("google.genai.Client", _fake_genai_client(json.dumps(payload)))
    data, result = _ctx()
    resp = gemini._call_gemini(data, result, Settings())
    assert resp.source == "gemini"
    assert resp.summary == payload["summary"]
    assert len(resp.recommendations) == 2
    # Savings are rounded to 2 decimal places for display.
    assert resp.recommendations[0].estimated_annual_savings_kg == 400.12


def test_empty_gemini_recommendations_fall_back_to_rules(monkeypatch):
    payload = {"summary": "ok", "recommendations": []}
    monkeypatch.setattr("google.genai.Client", _fake_genai_client(json.dumps(payload)))
    data, result = _ctx()
    resp = gemini.generate_insights(data, result, Settings(use_gemini=True))
    assert resp.source == "rules"


def test_malformed_gemini_json_falls_back_to_rules(monkeypatch):
    monkeypatch.setattr("google.genai.Client", _fake_genai_client("not valid json {"))
    data, result = _ctx()
    resp = gemini.generate_insights(data, result, Settings(use_gemini=True))
    assert resp.source == "rules"
    assert resp.recommendations


def test_gemini_success_path(monkeypatch):
    canned = InsightsResponse(
        summary="Great progress!",
        recommendations=[
            Recommendation(
                category="diet", action="Eat more plants", estimated_annual_savings_kg=200.0
            )
        ],
        source="gemini",
    )
    monkeypatch.setattr(gemini, "_call_gemini", lambda *_a, **_k: canned)
    data, result = _ctx()
    resp = gemini.generate_insights(data, result, Settings(use_gemini=True))
    assert resp.source == "gemini"
    assert resp.summary == "Great progress!"
