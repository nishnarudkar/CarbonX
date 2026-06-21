import { useCallback, useEffect, useState } from "react";
import * as api from "../lib/api";
import { getDeviceId } from "../lib/deviceId";
import type { CarbonInput, Entry, FootprintResult, InsightsResponse } from "../lib/types";

/**
 * Owns all asynchronous application state: footprint calculation, insights,
 * saving entries, and history loading. Components stay presentational; this
 * hook is the single place that talks to the API.
 *
 * `status` carries polite screen-reader announcements (rendered in a
 * `role="status"` live region) so async outcomes are audible, not just visible.
 */
export function useFootprint() {
  const [deviceId] = useState(getDeviceId);
  const [result, setResult] = useState<FootprintResult | null>(null);
  const [lastInput, setLastInput] = useState<CarbonInput | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const syncOfflineEntries = useCallback(async () => {
    try {
      const raw = window.localStorage.getItem("carbon_local_history_entries");
      if (!raw) return;
      const all = JSON.parse(raw) as Entry[];
      const localEntries = all.filter((e) => e.device_id === deviceId && e.id.startsWith("local-"));
      if (localEntries.length === 0) return;

      const syncedIds: string[] = [];
      for (const entry of localEntries) {
        const saved = await api.saveEntry(deviceId, entry.input, entry.result);
        if (!saved.id.startsWith("local-")) {
          syncedIds.push(entry.id);
        } else {
          break; // server is still down or failed
        }
      }

      if (syncedIds.length > 0) {
        const rawNow = window.localStorage.getItem("carbon_local_history_entries");
        if (rawNow) {
          const currentAll = JSON.parse(rawNow) as Entry[];
          const filtered = currentAll.filter((e) => !syncedIds.includes(e.id));
          window.localStorage.setItem("carbon_local_history_entries", JSON.stringify(filtered));
        }
      }
    } catch {
      // fail silently
    }
  }, [deviceId]);

  const loadHistory = useCallback(async () => {
    try {
      await syncOfflineEntries();
      setEntries(await api.listEntries(deviceId));
    } catch {
      // History is non-critical; fail silently rather than blocking the app.
    }
  }, [deviceId, syncOfflineEntries]);

  useEffect(() => {
    async function init() {
      try {
        const fetched = await api.fetchFactors();
        const { updateFactors } = await import("../lib/clientEngine");
        updateFactors(fetched);
      } catch {
        // Silently use local defaults if API is unreachable
      }
    }
    void init();
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /** Calculate the footprint and fetch personalized insights for the input. */
  const calculate = async (input: CarbonInput) => {
    setLoading(true);
    setError(null);
    setStatus("");
    try {
      const [calc, ins] = await Promise.all([api.calculate(input), api.getInsights(input)]);
      setResult(calc);
      setInsights(ins);
      setLastInput(input);
      setStatus("Your footprint results and personalized insights are ready below.");
    } catch {
      setError("Something went wrong calculating your footprint. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /** Persist the latest result to the device's history and refresh it. */
  const save = async () => {
    if (!result || !lastInput) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveEntry(deviceId, lastInput, result);
      await loadHistory();
      setStatus("Entry saved to your history.");
    } catch {
      setError("Could not save this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return { result, insights, entries, loading, saving, error, status, calculate, save };
}
