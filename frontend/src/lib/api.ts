// Typed client for the backend API. Same-origin in production; proxied in dev.

import type { CarbonInput, Entry, FootprintResult, InsightsResponse } from "./types";

/** Error with an HTTP status code attached, thrown by postJson on non-2xx. */
interface ApiError extends Error {
  status: number;
}

/** Type guard: checks whether an unknown value is an ApiError. */
function isApiError(err: unknown): err is ApiError {
  return err instanceof Error && typeof (err as ApiError).status === "number";
}

/** POST a JSON body and parse the JSON response, throwing on non-2xx status. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: ApiError = Object.assign(new Error(`Request to ${path} failed (${res.status})`), {
      status: res.status,
    });
    throw err;
  }
  return (await res.json()) as T;
}

/** Determine if an error is a real backend failure that should be thrown instead of falling back. */
function shouldThrow(err: unknown): boolean {
  if (isApiError(err)) {
    // If the status is 404 (Not Found) or 405 (Method Not Allowed), we fall back
    // because static hosts like GitHub Pages return these for API calls.
    if (err.status === 404 || err.status === 405) {
      return false;
    }
    return true;
  }
  return false;
}

import { localCalculate, localGetInsights, localSaveEntry, localListEntries } from "./clientEngine";

/** Compute the annual footprint breakdown for the given lifestyle inputs. */
export async function calculate(input: CarbonInput): Promise<FootprintResult> {
  try {
    return await postJson<FootprintResult>("/api/calculate", input);
  } catch (err: unknown) {
    if (shouldThrow(err)) throw err;
    return localCalculate(input);
  }
}

/** Fetch personalized reduction advice (Gemini with rule-based fallback). */
export async function getInsights(input: CarbonInput): Promise<InsightsResponse> {
  try {
    return await postJson<InsightsResponse>("/api/insights", input);
  } catch (err: unknown) {
    if (shouldThrow(err)) throw err;
    const res = localCalculate(input);
    return localGetInsights(input, res);
  }
}

/** Save a footprint snapshot to the device's anonymous history. */
export async function saveEntry(
  deviceId: string,
  input: CarbonInput,
  result: FootprintResult,
): Promise<Entry> {
  try {
    return await postJson<Entry>("/api/entries", {
      device_id: deviceId,
      input,
      result,
    });
  } catch (err: unknown) {
    if (shouldThrow(err)) throw err;
    return localSaveEntry(deviceId, input, result);
  }
}

/** List the device's saved entries, newest first. */
export async function listEntries(deviceId: string): Promise<Entry[]> {
  try {
    const res = await fetch(`/api/entries/${encodeURIComponent(deviceId)}`);
    if (!res.ok) {
      const err: ApiError = Object.assign(new Error(`Failed to load history (${res.status})`), {
        status: res.status,
      });
      throw err;
    }
    return (await res.json()) as Entry[];
  } catch (err: unknown) {
    if (shouldThrow(err)) throw err;
    return localListEntries(deviceId);
  }
}
