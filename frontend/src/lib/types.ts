// Shared types mirroring the backend Pydantic schema (app/models.py).

export type CarFuel = "petrol" | "diesel" | "hybrid" | "electric";

export type GridRegion = "global" | "us" | "uk" | "eu" | "in" | "fr";

export type DietType =
  | "heavy_meat"
  | "medium_meat"
  | "low_meat"
  | "pescatarian"
  | "vegetarian"
  | "vegan";

export interface CarbonInput {
  transport: {
    car_km_per_week: number;
    car_fuel: CarFuel;
    public_transit_km_per_week: number;
    short_haul_flights_per_year: number;
    long_haul_flights_per_year: number;
  };
  home: {
    electricity_kwh_per_month: number;
    natural_gas_kwh_per_month: number;
    household_size: number;
    region: GridRegion;
  };
  diet: DietType;
  consumption: {
    goods_spend_usd_per_month: number;
    waste_kg_per_week: number;
  };
}

export interface Comparison {
  global_average_annual_kg: number;
  sustainable_target_annual_kg: number;
  ratio_to_global_average: number;
  ratio_to_sustainable_target: number;
}

export interface FootprintResult {
  breakdown_kg: Record<string, number>;
  total_annual_kg: number;
  total_annual_tonnes: number;
  comparison: Comparison;
}

export interface Recommendation {
  category: string;
  action: string;
  estimated_annual_savings_kg: number;
}

export interface InsightsResponse {
  summary: string;
  recommendations: Recommendation[];
  source: "gemini" | "rules";
}

export interface Entry {
  id: string;
  created_at: string;
  device_id: string;
  input: CarbonInput;
  result: FootprintResult;
}

/** A fresh, all-zero input with sensible defaults (average diet, petrol car). */
export const emptyInput = (): CarbonInput => ({
  transport: {
    car_km_per_week: 0,
    car_fuel: "petrol",
    public_transit_km_per_week: 0,
    short_haul_flights_per_year: 0,
    long_haul_flights_per_year: 0,
  },
  home: {
    electricity_kwh_per_month: 0,
    natural_gas_kwh_per_month: 0,
    household_size: 1,
    region: "global",
  },
  diet: "medium_meat",
  consumption: {
    goods_spend_usd_per_month: 0,
    waste_kg_per_week: 0,
  },
});

export interface CarbonFactors {
  diet_annual_kg?: Record<string, number>;
  car_factors_per_km?: Record<string, number>;
  weeks_per_year?: number;
  months_per_year?: number;
  public_transit_per_km?: number;
  short_haul_trip_km?: number;
  flight_short_haul_per_km?: number;
  long_haul_trip_km?: number;
  flight_long_haul_per_km?: number;
  electricity_per_kwh_regional?: Record<string, number>;
  natural_gas_per_kwh?: number;
  goods_per_usd_monthly?: number;
  waste_per_kg?: number;
  global_avg_annual_kg?: number;
  sustainable_target_annual_kg?: number;
}
