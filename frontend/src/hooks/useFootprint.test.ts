import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFootprint } from "./useFootprint";
import * as api from "../lib/api";
import { emptyInput, type InsightsResponse } from "../lib/types";

vi.mock("../lib/api", () => ({
  calculate: vi.fn(),
  getInsights: vi.fn(),
  saveEntry: vi.fn(),
  listEntries: vi.fn(),
  fetchFactors: vi.fn(),
}));

const mockResult = {
  breakdown_kg: { transport: 100, home: 200, diet: 300, consumption: 400 },
  total_annual_kg: 1000,
  total_annual_tonnes: 1.0,
  comparison: {
    global_average_annual_kg: 4800,
    sustainable_target_annual_kg: 2000,
    ratio_to_global_average: 0.2,
    ratio_to_sustainable_target: 0.5,
  },
};

const mockInsights: InsightsResponse = {
  summary: "Good job",
  recommendations: [],
  source: "rules",
};

describe("useFootprint hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(api.fetchFactors).mockResolvedValue({
      electricity: { us: 0.35 },
    });
    vi.mocked(api.listEntries).mockResolvedValue([]);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("loads carbon factors on mount and handles failure silently", async () => {
    vi.mocked(api.fetchFactors).mockRejectedValueOnce(new Error("Network Error"));
    renderHook(() => useFootprint());

    await waitFor(() => {
      expect(api.listEntries).toHaveBeenCalled();
    });
  });

  it("calculates and saves footprint, updating status and history", async () => {
    vi.mocked(api.calculate).mockResolvedValueOnce(mockResult);
    vi.mocked(api.getInsights).mockResolvedValueOnce(mockInsights);
    vi.mocked(api.saveEntry).mockResolvedValueOnce({
      id: "entry-123",
      created_at: new Date().toISOString(),
      device_id: "dev-123",
      input: emptyInput(),
      result: mockResult,
    });

    const { result } = renderHook(() => useFootprint());

    await act(async () => {
      await result.current.calculate(emptyInput());
    });

    expect(result.current.result).toEqual(mockResult);
    expect(result.current.insights).toEqual(mockInsights);
    expect(result.current.status).toContain("ready");

    await act(async () => {
      await result.current.save();
    });

    expect(api.saveEntry).toHaveBeenCalled();
    expect(result.current.status).toContain("Entry saved");
  });

  it("syncs local storage offline entries to the server when online", async () => {
    renderHook(() => useFootprint());
    await waitFor(() => {
      expect(api.listEntries).toHaveBeenCalled();
    });

    const generatedDeviceId = vi.mocked(api.listEntries).mock.calls[0][0];

    const localEntry = {
      id: "local-123",
      device_id: generatedDeviceId,
      input: emptyInput(),
      result: mockResult,
      created_at: new Date().toISOString(),
    };

    window.localStorage.setItem("carbon_local_history_entries", JSON.stringify([localEntry]));

    vi.mocked(api.saveEntry).mockResolvedValueOnce({
      id: "server-123",
      created_at: new Date().toISOString(),
      device_id: generatedDeviceId,
      input: emptyInput(),
      result: mockResult,
    });

    renderHook(() => useFootprint());

    await waitFor(() => {
      expect(api.saveEntry).toHaveBeenCalledWith(
        generatedDeviceId,
        localEntry.input,
        localEntry.result,
      );
    });

    const stored = window.localStorage.getItem("carbon_local_history_entries");
    expect(stored).toBe("[]");
  });

  it("stops syncing offline entries if the server save request fails or returns a local- prefixed ID", async () => {
    renderHook(() => useFootprint());
    await waitFor(() => expect(api.listEntries).toHaveBeenCalled());
    const generatedDeviceId = vi.mocked(api.listEntries).mock.calls[0][0];

    const localEntry = {
      id: "local-123",
      device_id: generatedDeviceId,
      input: emptyInput(),
      result: mockResult,
      created_at: new Date().toISOString(),
    };

    window.localStorage.setItem("carbon_local_history_entries", JSON.stringify([localEntry]));

    vi.mocked(api.saveEntry).mockResolvedValueOnce({
      id: "local-failed-again",
      created_at: new Date().toISOString(),
      device_id: generatedDeviceId,
      input: emptyInput(),
      result: mockResult,
    });

    renderHook(() => useFootprint());

    await waitFor(() => {
      expect(api.saveEntry).toHaveBeenCalled();
    });

    const stored = JSON.parse(window.localStorage.getItem("carbon_local_history_entries") || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe("local-123");
  });

  it("handles invalid localStorage JSON silently", async () => {
    window.localStorage.setItem("carbon_local_history_entries", "{invalid json");
    renderHook(() => useFootprint());
    await waitFor(() => {
      expect(api.listEntries).toHaveBeenCalled();
    });
  });

  it("handles history listEntries load failure silently", async () => {
    vi.mocked(api.listEntries).mockRejectedValueOnce(new Error("load history failed"));
    renderHook(() => useFootprint());
    await waitFor(() => {
      expect(api.listEntries).toHaveBeenCalled();
    });
  });

  it("does not sync offline entries if there are no local entries in localStorage", async () => {
    renderHook(() => useFootprint());
    await waitFor(() => {
      expect(api.listEntries).toHaveBeenCalled();
    });

    const generatedDeviceId = vi.mocked(api.listEntries).mock.calls[0][0];

    const nonLocalEntry = {
      id: "server-456",
      device_id: generatedDeviceId,
      input: emptyInput(),
      result: mockResult,
      created_at: new Date().toISOString(),
    };

    window.localStorage.setItem("carbon_local_history_entries", JSON.stringify([nonLocalEntry]));

    renderHook(() => useFootprint());

    // saveEntry should not be called since there are no local entries to sync
    expect(api.saveEntry).not.toHaveBeenCalled();
  });
});
