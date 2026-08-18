import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  graniteAnswer,
  graniteBreakdown,
  graniteVerdict,
  mockAnswer,
  mockBreakdown,
  mockVerdict,
} from "./advisory.server";
import { fetchWeather, logAdvisory, reverseGeocode } from "./marine.server";

const coords = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    coords.extend({ days: z.number().int().min(1).max(3).default(1) }).parse(data),
  )
  .handler(async ({ data }) => fetchWeather(data.lat, data.lon, data.days));

export const getPlaceName = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => coords.parse(data))
  .handler(async ({ data }) => ({ name: await reverseGeocode(data.lat, data.lon) }));

const weatherSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  fetchedAt: z.string(),
  current: z.object({
    windSpeed: z.number(),
    windDirection: z.number(),
    waveHeight: z.number(),
    windWaveHeight: z.number(),
    swellHeight: z.number(),
    sst: z.number(),
  }),
  days: z.array(
    z.object({
      date: z.string(),
      windSpeed: z.number(),
      waveHeight: z.number(),
      swellHeight: z.number(),
      sst: z.number(),
      level: z.enum(["safe", "caution", "unsafe"]),
    }),
  ),
});

export const getAdvisory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        mode: z.enum(["verdict", "breakdown", "ask"]),
        place: z.string().min(1).max(120),
        question: z.string().max(500).optional(),
        weather: weatherSchema,
        log: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { mode, place, weather } = data;

    if (mode === "breakdown") {
      try {
        return { mode, ...(await graniteBreakdown(weather, place)) };
      } catch {
        return { mode, ...mockBreakdown(weather) };
      }
    }

    if (mode === "ask") {
      const question = (data.question ?? "").trim() || "How is the sea today?";
      try {
        return { mode, ...(await graniteAnswer(weather, place, question)) };
      } catch {
        return { mode, ...mockAnswer(weather, place, question) };
      }
    }

    let result;
    try {
      result = await graniteVerdict(weather, place);
    } catch {
      result = mockVerdict(weather, place);
    }

    if (data.log) {
      await logAdvisory({
        location_name: place,
        lat: weather.lat,
        lon: weather.lon,
        verdict: result.verdict.toUpperCase(),
        message: result.alert ?? result.explanation,
      });
    }

    return { mode: "verdict" as const, ...result };
  });
