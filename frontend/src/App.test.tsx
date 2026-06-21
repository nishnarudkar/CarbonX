import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import App from "./App";
import { useFootprint } from "./hooks/useFootprint";
import type { FootprintResult, InsightsResponse } from "./lib/types";

// Mock the API layer so the integration test runs without a backend.
vi.mock("./lib/api", () => ({
  calculate: vi.fn(),
  getInsights: vi.fn(),
  saveEntry: vi.fn(),
  listEntries: vi.fn(),
}));

import * as api from "./lib/api";

const result: FootprintResult = {
  breakdown_kg: { transport: 2000, home: 1000, diet: 1500, consumption: 500 },
  total_annual_kg: 5000,
  total_annual_tonnes: 5.0,
  comparison: {
    global_average_annual_kg: 4800,
    sustainable_target_annual_kg: 2000,
    ratio_to_global_average: 1.04,
    ratio_to_sustainable_target: 2.5,
  },
};

const insights: InsightsResponse = {
  summary: "Your footprint is above the sustainable target.",
  recommendations: [
    { category: "transport", action: "Drive less", estimated_annual_savings_kg: 400 },
  ],
  source: "rules",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listEntries).mockResolvedValue([]);
  vi.mocked(api.calculate).mockResolvedValue(result);
  vi.mocked(api.getInsights).mockResolvedValue(insights);
  vi.mocked(api.saveEntry).mockResolvedValue({
    id: "e1",
    created_at: new Date().toISOString(),
    device_id: "dev-123",
    input: {} as never,
    result,
  });
});

/** Render the app and wait for the initial history load to settle. */
async function renderApp() {
  const view = render(<App />);
  await waitFor(() => expect(api.listEntries).toHaveBeenCalled());
  return view;
}

describe("App", () => {
  it("renders with no accessibility violations", async () => {
    const { container } = await renderApp();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("calculates and shows results plus personalized insights", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /calculate my footprint/i }));

    await waitFor(() => expect(screen.getByText(/your estimated footprint/i)).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /personalized insights/i })).toBeInTheDocument();
    expect(screen.getByText(/drive less/i)).toBeInTheDocument();
    expect(api.calculate).toHaveBeenCalledTimes(1);
  });

  it("announces readiness to screen readers via the status live region", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /calculate my footprint/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/results .* are ready below/i),
    );
  });

  it("saves an entry and reloads history", async () => {
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /calculate my footprint/i }));
    await waitFor(() => screen.getByRole("button", { name: /save this entry/i }));
    await userEvent.click(screen.getByRole("button", { name: /save this entry/i }));

    await waitFor(() => expect(api.saveEntry).toHaveBeenCalledTimes(1));
    // listEntries: once on mount, once after save.
    expect(api.listEntries).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/entry saved/i));
  });

  it("shows an error message when calculation fails", async () => {
    vi.mocked(api.calculate).mockRejectedValueOnce(new Error("boom"));
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /calculate my footprint/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i),
    );
  });

  it("shows an error message when saving fails", async () => {
    vi.mocked(api.saveEntry).mockRejectedValueOnce(new Error("boom"));
    await renderApp();
    await userEvent.click(screen.getByRole("button", { name: /calculate my footprint/i }));
    await waitFor(() => screen.getByRole("button", { name: /save this entry/i }));
    await userEvent.click(screen.getByRole("button", { name: /save this entry/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not save/i));
  });

  it("handles history load failure gracefully", async () => {
    vi.mocked(api.listEntries).mockRejectedValueOnce(new Error("load failed"));
    await renderApp();
    expect(screen.getByText(/no saved entries yet/i)).toBeInTheDocument();
  });

  it("does not save when there is no calculation result", async () => {
    let hookRef: ReturnType<typeof useFootprint>;
    function TestComponent() {
      hookRef = useFootprint();
      return null;
    }
    await act(async () => {
      render(<TestComponent />);
    });
    await act(async () => {
      await hookRef.save();
    });
    expect(api.saveEntry).not.toHaveBeenCalled();
  });

  it("toggles theme between light and dark", async () => {
    await renderApp();
    const toggle = screen.getByRole("button", { name: /switch to light theme/i });
    expect(toggle).toBeInTheDocument();

    // Toggle to light theme
    await userEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeInTheDocument();

    // Toggle back to dark theme
    const toggleToDark = screen.getByRole("button", { name: /switch to dark theme/i });
    await userEvent.click(toggleToDark);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });
});
