"""Repository abstraction for tracking entries.

A small interface (Protocol) decouples the API from the storage backend. The
Firestore implementation is used in production; an in-memory implementation backs
local development and tests. This is what makes the persistence layer testable
without a database and swappable without touching route code.
"""

from __future__ import annotations

from typing import Protocol

from app.models import CarbonInput, Entry, FootprintResult


class EntryRepository(Protocol):
    """Stores and retrieves footprint entries scoped to an anonymous device id."""

    def add(self, device_id: str, data: CarbonInput, result: FootprintResult) -> Entry:
        """Persist a new entry and return it (with id and timestamp)."""
        ...

    def list_for_device(self, device_id: str, limit: int = 50) -> list[Entry]:
        """Return a device's entries, newest first."""
        ...
