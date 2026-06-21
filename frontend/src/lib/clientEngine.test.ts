import { describe, expect, it, beforeEach } from "vitest";
import { localCalculate, localGetInsights, localSaveEntry, localListEntries } from "./clientEngine";
import { emptyInput } from "./types";
import type { CarbonInput, FootprintResult } from "./types";

describe("clientEngine", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("localCalculate", () => {
    it("handles zero/empty input correctly", () => {
      const input = emptyInput();
      const res = localCalculate(input);
      expect(res.breakdown_kg.diet).toBe(2500);
      expect(res.breakdown_kg.transport).toBe(0);
      expect(res.breakdown_kg.home).toBe(0);
      expect(res.breakdown_kg.consumption).toBe(0);
    });

    it("calculates car transport emissions for various fuels", () => {
      const fuels: ("petrol" | "diesel" | "hybrid" | "electric")[] = [
        "petrol",
        "diesel",
        "hybrid",
        "electric",
      ];
      for (const fuel of fuels) {
        const input: CarbonInput = {
          ...emptyInput(),
          transport: {
            car_km_per_week: 100,
            car_fuel: fuel,
            public_transit_km_per_week: 0,
            short_haul_flights_per_year: 0,
            long_haul_flights_per_year: 0,
          },
        };
        const res = localCalculate(input);
        expect(res.breakdown_kg.transport).toBeGreaterThan(0);
      }
    });

    it("calculates public transit and flight emissions", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        transport: {
          car_km_per_week: 0,
          car_fuel: "petrol",
          public_transit_km_per_week: 200,
          short_haul_flights_per_year: 2,
          long_haul_flights_per_year: 1,
        },
      };
      const res = localCalculate(input);
      expect(res.breakdown_kg.transport).toBeCloseTo(1946.6, 1);
    });

    it("calculates home energy emissions", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        home: {
          electricity_kwh_per_month: 300,
          natural_gas_kwh_per_month: 150,
          household_size: 2,
          region: "global",
        },
      };
      const res = localCalculate(input);
      // Electricity: 300 * 12 * 0.45 = 1620
      // Gas: 150 * 12 * 0.183 = 329.4
      // Total: (1620 + 329.4) / 2 = 974.7
      expect(res.breakdown_kg.home).toBeCloseTo(974.7, 1);
    });

    it("calculates consumption emissions", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        consumption: {
          goods_spend_usd_per_month: 500,
          waste_kg_per_week: 10,
        },
      };
      const res = localCalculate(input);
      // Goods: 500 * 12 * 0.40 = 2400
      // Waste: 10 * 52 * 0.58 = 301.6
      // Total: 2701.6
      expect(res.breakdown_kg.consumption).toBeCloseTo(2701.6, 1);
    });
  });

  describe("localGetInsights", () => {
    it("generates a sustainable summary when emissions are under target", () => {
      const input = emptyInput();
      input.diet = "vegan"; // vegan is 1050 kg, which is <= 2000 kg target
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      expect(insights.summary).toContain("at or below the sustainable target");
    });

    it("generates a warning summary when emissions are over target", () => {
      const input = emptyInput();
      input.diet = "heavy_meat"; // heavy meat is 3300 kg, which is > 2000 kg target
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      expect(insights.summary).toContain("above the sustainable target");
    });

    it("generates aviation reduction recommendation when flights are high", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        transport: {
          car_km_per_week: 0,
          car_fuel: "petrol",
          public_transit_km_per_week: 0,
          short_haul_flights_per_year: 0,
          long_haul_flights_per_year: 2,
        },
      };
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "transport");
      expect(rec?.action).toContain("aviation emissions");
    });

    it("generates EV shift recommendation for non-electric cars", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        transport: {
          car_km_per_week: 200,
          car_fuel: "petrol",
          public_transit_km_per_week: 0,
          short_haul_flights_per_year: 0,
          long_haul_flights_per_year: 0,
        },
      };
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "transport");
      expect(rec?.action).toContain("electric vehicle");
    });

    it("generates generic transport recommendation for electric cars or transit only", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        transport: {
          car_km_per_week: 0,
          car_fuel: "electric",
          public_transit_km_per_week: 300,
          short_haul_flights_per_year: 0,
          long_haul_flights_per_year: 0,
        },
      };
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "transport");
      expect(rec?.action).toContain("Carpool or use public transit");
    });

    it("generates home energy recommendation when home emissions are present", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        home: {
          electricity_kwh_per_month: 100,
          natural_gas_kwh_per_month: 0,
          household_size: 1,
          region: "global",
        },
      };
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "home");
      expect(rec?.action).toContain("renewable electricity tariff");
    });

    it("generates diet recommendation for meat eaters", () => {
      const input = emptyInput();
      input.diet = "heavy_meat";
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "diet");
      expect(rec?.action).toContain("Shift toward a medium meat diet");
    });

    it("generates consumption recommendation when consumption emissions are present", () => {
      const input: CarbonInput = {
        ...emptyInput(),
        consumption: {
          goods_spend_usd_per_month: 100,
          waste_kg_per_week: 0,
        },
      };
      const result = localCalculate(input);
      const insights = localGetInsights(input, result);
      const rec = insights.recommendations.find((r) => r.category === "consumption");
      expect(rec?.action).toContain("Buy less and choose durable");
    });
  });

  describe("local database entries", () => {
    const mockInput = emptyInput();
    const mockResult: FootprintResult = {
      breakdown_kg: { transport: 0, home: 0, diet: 1000, consumption: 0 },
      total_annual_kg: 1000,
      total_annual_tonnes: 1.0,
      comparison: {
        global_average_annual_kg: 4800,
        sustainable_target_annual_kg: 2000,
        ratio_to_global_average: 0.208,
        ratio_to_sustainable_target: 0.5,
      },
    };

    it("saves and retrieves history entries matching device id", () => {
      const devId = "dev-test-123";
      const saved = localSaveEntry(devId, mockInput, mockResult);
      expect(saved.device_id).toBe(devId);
      expect(saved.id).toBeDefined();

      const entries = localListEntries(devId);
      expect(entries.length).toBe(1);
      expect(entries[0].id).toBe(saved.id);

      // different device id should return empty
      const otherEntries = localListEntries("dev-other");
      expect(otherEntries.length).toBe(0);
    });

    it("returns empty array if localStorage parse throws an error", () => {
      window.localStorage.setItem("carbon_local_history_entries", "invalid-json{");
      const entries = localListEntries("dev-test-123");
      expect(entries).toEqual([]);
    });
  });

  describe("updateFactors", () => {
    it("updates all factor constants when provided", async () => {
      const clientEngine = await import("./clientEngine");
      clientEngine.updateFactors({
        diet_annual_kg: { heavy_meat: 9999 },
        car_factors_per_km: { petrol: 9.9 },
        weeks_per_year: 99,
        months_per_year: 99,
        public_transit_per_km: 9.9,
        short_haul_trip_km: 999,
        flight_short_haul_per_km: 9.9,
        long_haul_trip_km: 9999,
        flight_long_haul_per_km: 9.9,
        electricity_per_kwh_regional: { us: 9.9 },
        natural_gas_per_kwh: 9.9,
        goods_per_usd_monthly: 9.9,
        waste_per_kg: 9.9,
        global_avg_annual_kg: 9999,
        sustainable_target_annual_kg: 9999,
      });

      expect(clientEngine.DIET_ANNUAL_KG.heavy_meat).toBe(9999);
      expect(clientEngine.CAR_FACTORS_PER_KM.petrol).toBe(9.9);

      // Verify empty update does not throw
      clientEngine.updateFactors({});
    });
  });
});
