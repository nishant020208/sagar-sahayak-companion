import { levelFor, THRESHOLDS, worst, type Level } from "./harbors";

export type DaySummary = {
  date: string;
  windSpeed: number;
  waveHeight: number;
  swellHeight: number;
  sst: number;
  level: Level;
};

export type WeatherData = {
  lat: number;
  lon: number;
  fetchedAt: string;
  current: {
    windSpeed: number;
    windDirection: number;
    waveHeight: number;
    windWaveHeight: number;
    swellHeight: number;
    sst: number;
  };
  days: DaySummary[];
};

const num = (v: unknown): number => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

function chunkStats(values: unknown[], from: number, to: number) {
  const slice = values.slice(from, to).map(num);
  if (slice.length === 0) return { max: 0, avg: 0 };
  return {
    max: Math.max(...slice),
    avg: slice.reduce((a, b) => a + b, 0) / slice.length,
  };
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { "User-Agent": "SagarSahayak/1.0" } });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${new URL(url).pathname}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchWeather(lat: number, lon: number, days: number): Promise<WeatherData> {
  const d = Math.min(Math.max(Math.round(days) || 1, 1), 3);
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
    `&hourly=wave_height,wind_wave_height,swell_wave_height,sea_surface_temperature` +
    `&forecast_days=${d}&timezone=auto`;
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=wind_speed_10m,wind_direction_10m&forecast_days=${d}&timezone=auto`;

  const [marine, forecast] = await Promise.all([getJson(marineUrl), getJson(forecastUrl)]);

  const mh = (marine["hourly"] ?? {}) as Record<string, unknown[]>;
  const fh = (forecast["hourly"] ?? {}) as Record<string, unknown[]>;
  const times = (mh["time"] ?? fh["time"] ?? []) as string[];

  const wave = mh["wave_height"] ?? [];
  const windWave = mh["wind_wave_height"] ?? [];
  const swell = mh["swell_wave_height"] ?? [];
  const sst = mh["sea_surface_temperature"] ?? [];
  const wind = fh["wind_speed_10m"] ?? [];
  const windDir = fh["wind_direction_10m"] ?? [];

  const nowIdx = Math.min(new Date().getHours(), Math.max(times.length - 1, 0));

  const dayList: DaySummary[] = [];
  for (let i = 0; i < d; i++) {
    const from = i * 24;
    const to = from + 24;
    if (from >= times.length) break;
    const w = chunkStats(wind, from, to).max;
    const wv = chunkStats(wave, from, to).max;
    const sw = chunkStats(swell, from, to).max;
    const t = chunkStats(sst, from, to).avg;
    const level = worst([
      levelFor(w, THRESHOLDS.wind),
      levelFor(wv, THRESHOLDS.wave),
      levelFor(sw, THRESHOLDS.swell),
    ]);
    dayList.push({
      date: (times[from] ?? "").slice(0, 10),
      windSpeed: round(w),
      waveHeight: round(wv),
      swellHeight: round(sw),
      sst: round(t),
      level,
    });
  }

  return {
    lat,
    lon,
    fetchedAt: new Date().toISOString(),
    current: {
      windSpeed: round(num(wind[nowIdx])),
      windDirection: round(num(windDir[nowIdx])),
      waveHeight: round(num(wave[nowIdx])),
      windWaveHeight: round(num(windWave[nowIdx])),
      swellHeight: round(num(swell[nowIdx])),
      sst: round(num(sst[nowIdx])),
    },
    days: dayList,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const data = await getJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=12`,
    );
    const addr = (data["address"] ?? {}) as Record<string, string>;
    const name =
      addr["village"] ||
      addr["town"] ||
      addr["city"] ||
      addr["suburb"] ||
      addr["county"] ||
      addr["state_district"] ||
      (data["display_name"] as string | undefined)?.split(",")[0];
    return name ?? null;
  } catch {
    return null;
  }
}

/* ---------------- watsonx.ai (IBM Granite) ---------------- */

async function watsonxToken(apiKey: string): Promise<string> {
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });
  if (!res.ok) throw new Error(`IAM token failed (${res.status})`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function callLovableAI(prompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("no AI credentials configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI gateway failed (${res.status})`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("AI gateway returned no text");
  return text;
}

export async function callGranite(prompt: string): Promise<string> {
  const apiKey = process.env["WATSONX_API_KEY"];
  const projectId = process.env["WATSONX_PROJECT_ID"];
  const baseUrl = process.env["WATSONX_URL"];
  // watsonx Granite when configured; otherwise the hosted AI gateway keeps
  // every advisory on real model output instead of canned text.
  if (!apiKey || !projectId || !baseUrl) return callLovableAI(prompt);


  const token = await watsonxToken(apiKey);
  const res = await fetch(
    `${baseUrl.replace(/\/$/, "")}/ml/v1/text/generation?version=2023-05-29`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model_id: "ibm/granite-3-8b-instruct",
        project_id: projectId,
        input: prompt,
        parameters: { decoding_method: "greedy", max_new_tokens: 400, repetition_penalty: 1.05 },
      }),
    },
  );
  if (!res.ok) throw new Error(`watsonx failed (${res.status})`);
  const json = (await res.json()) as { results?: { generated_text?: string }[] };
  const text = json.results?.[0]?.generated_text?.trim();
  if (!text) throw new Error("watsonx returned no text");
  return text;
}

export function extractJson<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function logAdvisory(row: {
  location_name: string;
  lat: number;
  lon: number;
  verdict: string;
  message: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("advisory_log").insert(row);
  } catch (e) {
    console.error("advisory_log insert failed", e);
  }
}
