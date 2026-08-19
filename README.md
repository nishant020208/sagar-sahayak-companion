# Sagar Sahayak (સાગર સહાયક) — Ocean Companion

Sea-safety advisor for small-boat fishermen on the Gujarat coast. It turns live marine
data into one plain-language answer: **GO OUT / BE CAREFUL / DO NOT GO**, in English and
Gujarati.

## Features

- **Location entry** — GPS (browser geolocation + Nominatim reverse geocoding) or a
  harbour picker (Porbandar, Veraval, Okha, Dwarka, Mangrol, Jafrabad, Diu). Saved locally.
- **Hero verdict** — maritime signal-flag colour block with explanation, proactive alert
  and a recommended return time.
- **Voice readout** — Web Speech API reads the verdict aloud (Gujarati voice when in ગુ).
- **WhatsApp share** — one tap forwards the advisory to a boat group.
- **Why this verdict?** — per-factor breakdown (wind, wave, swell, SST) plus the exact
  thresholds used.
- **3-day outlook** — daily maxima with their own verdicts.
- **Coastal map** — Leaflet + OpenStreetMap, focal view or all harbours colour-coded.
- **Fish likelihood** — open-data SST proxy (explicitly not an official INCOIS feed).
- **Ask Sagar Sahayak** — grounded Q&A over the current live readings.
- **Advisory log** — every verdict written to the database and streamed back in realtime.

## Data sources

| Source | Use |
| --- | --- |
| Open-Meteo Marine API | wave, wind-wave, swell, sea surface temperature |
| Open-Meteo Forecast API | wind speed and direction |
| Nominatim (OpenStreetMap) | reverse geocoding for GPS positions |
| OpenStreetMap tiles + Leaflet | coastal map |
| IBM watsonx.ai (Granite) | verdict text, breakdown, chat answers |

## Safety thresholds

| Factor | Safe | Caution | Unsafe |
| --- | --- | --- | --- |
| Wind | ≤ 20 km/h | ≤ 35 km/h | > 35 km/h |
| Wave height | ≤ 1.2 m | ≤ 2 m | > 2 m |
| Swell | ≤ 1 m | ≤ 1.8 m | > 1.8 m |

The rule engine decides the verdict; the model only writes the wording and never
contradicts it.

## AI configuration

Server code calls IBM Granite on watsonx.ai when these secrets are set:

```
WATSONX_API_KEY
WATSONX_PROJECT_ID
WATSONX_URL      # e.g. https://us-south.ml.cloud.ibm.com
```

Without them (or if watsonx errors), the app falls back to the hosted AI gateway so
verdicts, breakdowns and chat answers stay real model output. If no AI is reachable at
all, deterministic threshold-based text is used and the response is flagged as mock.

## Architecture

- **TanStack Start** (React 19, Vite 7) with file routes in `src/routes`.
- **Server functions** in `src/lib/sagar.functions.ts` (`getWeather`, `getPlaceName`,
  `getAdvisory`) — every upstream API call and secret stays server-side.
- **Server-only helpers**: `src/lib/marine.server.ts` (fetching, geocoding, Granite),
  `src/lib/advisory.server.ts` (verdict logic, prompts, fallbacks).
- **Shared logic**: `src/lib/harbors.ts` (harbours, thresholds, SST proxy),
  `src/lib/i18n.ts` (English/Gujarati strings).
- **Database**: `advisory_log` table, public read, service-role insert, realtime enabled.
- **Map**: `src/components/CoastMap.tsx` is lazily loaded client-side only, with an
  explicit container height and `invalidateSize()` on mount/resize so tiles render fully.

## Development

```sh
npm i
npm run dev
```
