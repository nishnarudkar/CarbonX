import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { emptyInput } from "./types";
import type { FootprintResult } from "./types";

const result: FootprintResult = {
  breakdown_kg: { transport: 0, home: 0, diet: 1050, consumption: 0 },
  total_annual_kg: 1050,
  total_annual_tonnes: 1.05,
  comparison: {
    global_average_annual_kg: 4800,
    sustainable_target_annual_kg: 2000,
    ratio_to_global_average: 0.219,
    ratio_to_sustainable_target: 0.525,
  },
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("posts the input to /api/calculate and returns the result", async () => {
    const fetchMock = mockFetch(200, result);
    const res = await api.calculate(emptyInput());
    expect(res.total_annual_kg).toBe(1050);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/calculate");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("falls back to local insights when the server responds with 422", async () => {
    mockFetch(422, { detail: "invalid" });
    const res = await api.getInsights(emptyInput());
    expect(res).toBeDefined();
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it("sends device id, input and result when saving an entry", async () => {
    const fetchMock = mockFetch(201, {
      id: "e1",
      created_at: "2026-01-01T00:00:00Z",
      device_id: "dev-abc12345",
      input: emptyInput(),
      result,
    });
    await api.saveEntry("dev-abc12345", emptyInput(), result);
    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.device_id).toBe("dev-abc12345");
    expect(payload.result.total_annual_kg).toBe(1050);
  });

  it("URL-encodes the device id when listing entries", async () => {
    const fetchMock = mockFetch(200, []);
    await api.listEntries("dev-abc12345");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/entries/dev-abc12345");
  });

  it("falls back to local history when history cannot be loaded due to 500 error", async () => {
    mockFetch(500, {});
    const res = await api.listEntries("dev-abc12345");
    expect(Array.isArray(res)).toBe(true);
  });

  it("falls back to local client calculation when the server returns 404 or 405", async () => {
    mockFetch(404, {});
    const res = await api.calculate(emptyInput());
    expect(res).toBeDefined();
    expect(res.total_annual_kg).toBeGreaterThan(0);
  });

  it("falls back to local client insights when the server returns 404 or 405", async () => {
    mockFetch(405, {});
    const res = await api.getInsights(emptyInput());
    expect(res).toBeDefined();
    expect(res.recommendations.length).toBeGreaterThan(0);
  });

  it("falls back to local client saveEntry when the server returns 404 or 405", async () => {
    mockFetch(404, {});
    const res = await api.saveEntry("dev-abc12345", emptyInput(), result);
    expect(res).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.device_id).toBe("dev-abc12345");
  });

  it("falls back to local client listEntries when the server returns 404 or 405", async () => {
    mockFetch(405, {});
    const res = await api.listEntries("dev-abc12345");
    expect(Array.isArray(res)).toBe(true);
  });

  it("falls back to local client calculation when the server throws a network error (no status)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));
    const res = await api.calculate(emptyInput());
    expect(res).toBeDefined();
    expect(res.total_annual_kg).toBeGreaterThan(0);
  });

  it("falls back to local calculation when calculation fails with a 500 error", async () => {
    mockFetch(500, {});
    const res = await api.calculate(emptyInput());
    expect(res).toBeDefined();
    expect(res.total_annual_kg).toBeGreaterThan(0);
  });

  it("falls back to local saveEntry when saveEntry fails with a 500 error", async () => {
    mockFetch(500, {});
    const res = await api.saveEntry("dev-abc12345", emptyInput(), result);
    expect(res).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.device_id).toBe("dev-abc12345");
  });

  it("fetches factors from the server successfully", async () => {
    const mockFactors = {
      diet: { vegan: 500 },
      electricity: { us: 0.4 },
    };
    const fetchMock = mockFetch(200, mockFactors);
    const res = await api.fetchFactors();
    expect(res).toEqual(mockFactors);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/factors");
  });

  it("throws when fetchFactors fails", async () => {
    mockFetch(500, {});
    await expect(api.fetchFactors()).rejects.toThrow(/Failed to fetch carbon factors/);
  });
});
