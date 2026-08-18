export type Harbor = {
  id: string;
  name: string;
  nameGu: string;
  lat: number;
  lon: number;
};

export const HARBORS: Harbor[] = [
  { id: "porbandar", name: "Porbandar", nameGu: "પોરબંદર", lat: 21.6417, lon: 69.6293 },
  { id: "veraval", name: "Veraval", nameGu: "વેરાવળ", lat: 20.9159, lon: 70.3629 },
  { id: "okha", name: "Okha", nameGu: "ઓખા", lat: 22.4707, lon: 69.0708 },
  { id: "dwarka", name: "Dwarka", nameGu: "દ્વારકા", lat: 22.2394, lon: 68.9678 },
  { id: "mangrol", name: "Mangrol", nameGu: "માંગરોળ", lat: 21.1206, lon: 70.1163 },
  { id: "jafrabad", name: "Jafrabad", nameGu: "જાફરાબાદ", lat: 20.8667, lon: 71.3667 },
  { id: "diu", name: "Diu", nameGu: "દીવ", lat: 20.7144, lon: 70.9874 },
];

export function nearestHarbor(lat: number, lon: number): Harbor {
  let best = HARBORS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const h of HARBORS) {
    const d = (h.lat - lat) ** 2 + (h.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** Safety thresholds used for the deterministic guardrail + the "Why" table. */
export const THRESHOLDS = {
  wind: { safe: 20, caution: 35 }, // km/h
  wave: { safe: 1.2, caution: 2.0 }, // m
  swell: { safe: 1.0, caution: 1.8 }, // m
};

export type Level = "safe" | "caution" | "unsafe";

export function levelFor(value: number, t: { safe: number; caution: number }): Level {
  if (value <= t.safe) return "safe";
  if (value <= t.caution) return "caution";
  return "unsafe";
}

export const worst = (levels: Level[]): Level =>
  levels.includes("unsafe") ? "unsafe" : levels.includes("caution") ? "caution" : "safe";

/** Simplified open-data fishing-zone proxy based on sea surface temperature. */
export function zoneLikelihood(sst: number | null): "Low" | "Moderate" | "Good" {
  if (sst == null || Number.isNaN(sst)) return "Low";
  if (sst >= 26 && sst <= 29) return "Good";
  if (sst >= 24 && sst < 31) return "Moderate";
  return "Low";
}
