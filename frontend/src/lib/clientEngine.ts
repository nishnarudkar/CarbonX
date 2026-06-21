import type {
  CarbonInput,
  Entry,
  FootprintResult,
  InsightsResponse,
  Recommendation,
} from "./types";

// Constant carbon factors matching backend/app/carbon/factors.py
const DIET_ANNUAL_KG = {
  heavy_meat: 3300.0,
  medium_meat: 2500.0,
  low_meat: 1900.0,
  pescatarian: 1700.0,
  vegetarian: 1500.0,
  vegan: 1050.0,
};

const CAR_FACTORS_PER_KM = {
  petrol: 0.17,
  diesel: 0.171,
  hybrid: 0.12,
  electric: 0.047,
};

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

const PUBLIC_TRANSIT_PER_KM = 0.06;
const SHORT_HAUL_TRIP_KM = 1100.0;
const FLIGHT_SHORT_HAUL_PER_KM = 0.158;
const LONG_HAUL_TRIP_KM = 6500.0;
const FLIGHT_LONG_HAUL_PER_KM = 0.15;

const ELECTRICITY_PER_KWH = 0.45;
const NATURAL_GAS_PER_KWH = 0.183;
const GOODS_PER_USD_MONTHLY = 0.4;
const WASTE_PER_KG = 0.58;

const GLOBAL_AVG_ANNUAL_KG = 4800.0;
const SUSTAINABLE_TARGET_ANNUAL_KG = 2000.0;

const FLIGHT_REDUCTION_SHARE = 0.5;
const HOME_ENERGY_REDUCTION_SHARE = 0.33;
const CONSUMPTION_REDUCTION_SHARE = 0.25;
const GENERIC_TRANSPORT_REDUCTION_SHARE = 0.2;

const DIET_LADDER: (keyof typeof DIET_ANNUAL_KG)[] = [
  "heavy_meat",
  "medium_meat",
  "low_meat",
  "pescatarian",
  "vegetarian",
  "vegan",
];

function round(value: number, decimals: number): number {
  const p = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * p) / p;
}

/**
 * Computes the annual carbon footprint breakdown for a set of inputs locally.
 * Used as a fallback when the backend API is unreachable.
 *
 * @param data Lifestyle inputs
 * @returns Footprint calculation breakdown and totals
 */
export function localCalculate(data: CarbonInput): FootprintResult {
  // Transport
  const car =
    data.transport.car_km_per_week * WEEKS_PER_YEAR * CAR_FACTORS_PER_KM[data.transport.car_fuel];
  const transit =
    data.transport.public_transit_km_per_week * WEEKS_PER_YEAR * PUBLIC_TRANSIT_PER_KM;
  const flights =
    data.transport.short_haul_flights_per_year * SHORT_HAUL_TRIP_KM * FLIGHT_SHORT_HAUL_PER_KM +
    data.transport.long_haul_flights_per_year * LONG_HAUL_TRIP_KM * FLIGHT_LONG_HAUL_PER_KM;
  const transportTotal = car + transit + flights;

  // Home
  const electricity = data.home.electricity_kwh_per_month * MONTHS_PER_YEAR * ELECTRICITY_PER_KWH;
  const gas = data.home.natural_gas_kwh_per_month * MONTHS_PER_YEAR * NATURAL_GAS_PER_KWH;
  const homeTotal = (electricity + gas) / data.home.household_size;

  // Consumption
  const goods =
    data.consumption.goods_spend_usd_per_month * MONTHS_PER_YEAR * GOODS_PER_USD_MONTHLY;
  const waste = data.consumption.waste_kg_per_week * WEEKS_PER_YEAR * WASTE_PER_KG;
  const consumptionTotal = goods + waste;

  const breakdown = {
    transport: round(transportTotal, 2),
    home: round(homeTotal, 2),
    diet: round(DIET_ANNUAL_KG[data.diet], 2),
    consumption: round(consumptionTotal, 2),
  };

  const total = round(
    breakdown.transport + breakdown.home + breakdown.diet + breakdown.consumption,
    2,
  );

  return {
    breakdown_kg: breakdown,
    total_annual_kg: total,
    total_annual_tonnes: round(total / 1000, 3),
    comparison: {
      global_average_annual_kg: GLOBAL_AVG_ANNUAL_KG,
      sustainable_target_annual_kg: SUSTAINABLE_TARGET_ANNUAL_KG,
      ratio_to_global_average: round(total / GLOBAL_AVG_ANNUAL_KG, 3),
      ratio_to_sustainable_target: round(total / SUSTAINABLE_TARGET_ANNUAL_KG, 3),
    },
  };
}

/**
 * Produces ranked, quantified recommendations from the footprint breakdown locally.
 * Used as a fallback when the backend API is unreachable.
 *
 * @param data Lifestyle inputs
 * @param result Calculated footprint results
 * @returns Personalized recommendations and summary
 */
export function localGetInsights(data: CarbonInput, result: FootprintResult): InsightsResponse {
  const recommendations: Recommendation[] = [];

  // Sort categories by value desc
  const ranked = Object.entries(result.breakdown_kg).sort((a, b) => b[1] - a[1]);

  for (const [category, amount] of ranked) {
    if (category === "transport") {
      const t = data.transport;
      const flightsKm =
        t.short_haul_flights_per_year * SHORT_HAUL_TRIP_KM +
        t.long_haul_flights_per_year * LONG_HAUL_TRIP_KM;
      const carKmYear = t.car_km_per_week * WEEKS_PER_YEAR;
      const carEmissions = carKmYear * CAR_FACTORS_PER_KM[t.car_fuel];
      const flying = t.short_haul_flights_per_year + t.long_haul_flights_per_year > 0;

      if (flying && flightsKm * FLIGHT_LONG_HAUL_PER_KM > carEmissions) {
        recommendations.push({
          category: "transport",
          action:
            "Replace one or more flights per year with rail or video calls, and combine trips to halve your aviation emissions.",
          estimated_annual_savings_kg: round(FLIGHT_REDUCTION_SHARE * amount, 2),
        });
      } else if (t.car_km_per_week > 0 && t.car_fuel !== "electric") {
        const current = carKmYear * CAR_FACTORS_PER_KM[t.car_fuel];
        const electric = carKmYear * CAR_FACTORS_PER_KM.electric;
        const saving = round(current - electric, 2);
        if (saving > 0) {
          recommendations.push({
            category: "transport",
            action:
              "Shift short car trips to walking, cycling or public transit, and consider an electric vehicle for the rest.",
            estimated_annual_savings_kg: saving,
          });
        }
      } else if (amount > 0) {
        recommendations.push({
          category: "transport",
          action: "Carpool or use public transit for routine journeys to cut transport emissions.",
          estimated_annual_savings_kg: round(GENERIC_TRANSPORT_REDUCTION_SHARE * amount, 2),
        });
      }
    } else if (category === "home" && amount > 0) {
      recommendations.push({
        category: "home",
        action:
          "Switch to a renewable electricity tariff and improve insulation/thermostat settings to cut roughly a third of home energy emissions.",
        estimated_annual_savings_kg: round(HOME_ENERGY_REDUCTION_SHARE * amount, 2),
      });
    } else if (category === "diet") {
      const current = data.diet;
      const idx = DIET_LADDER.indexOf(current);
      if (idx < DIET_LADDER.length - 1) {
        const target = DIET_LADDER[idx + 1];
        const saving = round(DIET_ANNUAL_KG[current] - DIET_ANNUAL_KG[target], 2);
        if (saving > 0) {
          recommendations.push({
            category: "diet",
            action: `Shift toward a ${target.replace("_", " ")} diet — even a few plant-based days each week meaningfully lowers food emissions.`,
            estimated_annual_savings_kg: saving,
          });
        }
      }
    } else if (category === "consumption" && amount > 0) {
      recommendations.push({
        category: "consumption",
        action:
          "Buy less and choose durable, second-hand or repairable goods, and reduce landfill waste by recycling and composting.",
        estimated_annual_savings_kg: round(CONSUMPTION_REDUCTION_SHARE * amount, 2),
      });
    }
  }

  const total = result.total_annual_kg;
  const target = SUSTAINABLE_TARGET_ANNUAL_KG;
  let summary = "";
  if (total <= target) {
    summary = `Your estimated footprint is ${result.total_annual_tonnes} t CO2e/yr — at or below the sustainable target of ${(target / 1000).toFixed(1)} t. Keep it up, and lock in these habits.`;
  } else {
    const over = round((total - target) / 1000, 2);
    summary = `Your estimated footprint is ${result.total_annual_tonnes} t CO2e/yr, about ${over} t above the sustainable target of ${(target / 1000).toFixed(1)} t. The actions below target your biggest sources first for the fastest reductions.`;
  }

  return {
    summary,
    recommendations: recommendations.slice(0, 4),
    source: "rules",
  };
}

const LOCAL_HISTORY_KEY = "carbon_local_history_entries";

/**
 * Persists a footprint entry for the device to localStorage.
 * Used as a fallback when the backend API is unreachable.
 *
 * @param deviceId Persistent anonymous device ID
 * @param input Lifestyle inputs used for calculation
 * @param result Calculated footprint results
 * @returns Stored history entry
 */
export function localSaveEntry(
  deviceId: string,
  input: CarbonInput,
  result: FootprintResult,
): Entry {
  const entries = localListEntries(deviceId);
  const newEntry: Entry = {
    id: `local-${Math.random().toString(36).substring(2, 9)}`,
    created_at: new Date().toISOString(),
    device_id: deviceId,
    input,
    result,
  };
  entries.unshift(newEntry);
  window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries));
  return newEntry;
}

/**
 * Retrieves the device's saved history entries from localStorage.
 * Used as a fallback when the backend API is unreachable.
 *
 * @param deviceId Persistent anonymous device ID
 * @returns List of history entries, newest first
 */
export function localListEntries(deviceId: string): Entry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Entry[];
    return all.filter((e) => e.device_id === deviceId);
  } catch {
    return [];
  }
}
