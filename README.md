# Sagar Sahayak — સાગર સહાયક

**AI-powered sea-safety advisor for small-boat fishermen on the Gujarat coast**

Sagar Sahayak fetches live ocean data and turns it into a single, plain-language answer in **English and Gujarati**: is it safe to go out today, where to sail, and when to return. No meteorological training required.

---

## Features

- 🌊 **Live ocean conditions** — wind speed, wave height, swell, and sea surface temperature from [Open-Meteo](https://open-meteo.com) (free, no API key)
- 🤖 **AI-generated verdicts** — powered by IBM Granite (watsonx.ai) with Google Gemini as fallback
- 🗺️ **Coastal map** — Leaflet map with colour-coded safety status for all Gujarat harbours
- 🔊 **Text-to-speech** — reads the verdict aloud in English or Gujarati
- 📤 **WhatsApp share** — share the safety verdict with your crew in one tap
- 📋 **Advisory log** — real-time Supabase feed of past advisories
- 🌐 **Bilingual** — full English + Gujarati (ગુજરાતી) interface
- 📱 **Mobile-first** — works on any phone browser, offline-friendly with localStorage cache

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + Vite) |
| Routing | TanStack Router (file-based) |
| Styling | Vanilla CSS + Tailwind CSS v4 |
| Map | Leaflet + OpenStreetMap |
| Database | [Supabase](https://supabase.com) (Postgres + Realtime) |
| AI | IBM Granite via watsonx.ai · Google Gemini (fallback) |
| Weather | Open-Meteo Marine & Forecast APIs |
| Geocoding | Nominatim (OpenStreetMap) |
| Runtime | Nitro (Cloudflare Workers target) |

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (or Node.js ≥ 20 + npm)
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key (free) **or** IBM watsonx.ai credentials

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/nishant020208/sagar-sahayak-companion.git
cd sagar-sahayak-companion
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-side log writes) |
| `GEMINI_API_KEY` | ✅* | Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com)) |
| `WATSONX_API_KEY` | ⬜ | IBM watsonx API key (optional, takes priority over Gemini) |
| `WATSONX_PROJECT_ID` | ⬜ | IBM watsonx project ID |
| `WATSONX_URL` | ⬜ | watsonx regional endpoint (e.g. `https://us-south.ml.cloud.ibm.com`) |

> \* Required if not using watsonx. Without any AI key the app falls back to rule-based mock advisories.

### 4. Set up the Supabase database

Run the migrations in `supabase/migrations/` against your project, or push them with the Supabase CLI:

```bash
supabase db push
```

### 5. Run locally

```bash
bun run dev
```

App will start at **http://localhost:3000**.

---

## Project Structure

```
src/
├── components/
│   ├── CoastMap.tsx        # Leaflet map with harbour markers
│   └── ui/                 # shadcn/ui base components
├── hooks/
│   └── use-mobile.tsx
├── integrations/
│   └── supabase/           # Supabase client, auth middleware, types
├── lib/
│   ├── advisory.server.ts  # AI verdict, breakdown & answer logic
│   ├── error-capture.ts    # Server-side error capture utility
│   ├── error-page.ts       # Fallback HTML error page
│   ├── error-reporting.ts  # Client-side error reporting
│   ├── harbors.ts          # Gujarat harbour data + safety thresholds
│   ├── i18n.ts             # English / Gujarati translation strings
│   ├── marine.server.ts    # Open-Meteo fetch + Gemini/watsonx calls
│   └── sagar.functions.ts  # TanStack Start server functions
├── routes/
│   ├── __root.tsx          # Root layout, fonts, error boundary
│   └── index.tsx           # Main page (all UI components)
├── server.ts               # Nitro server entry + SSR error normaliser
├── start.ts                # TanStack Start instance + middleware
└── styles.css              # Global CSS design system
supabase/
└── migrations/             # SQL schema (advisory_log table)
```

---

## Safety Thresholds

The rule-based guardrail uses these thresholds (AI verdict cannot contradict them):

| Factor | Safe | Caution | Unsafe |
|---|---|---|---|
| Wind speed | ≤ 20 km/h | ≤ 35 km/h | > 35 km/h |
| Wave height | ≤ 1.2 m | ≤ 2.0 m | > 2.0 m |
| Swell height | ≤ 1.0 m | ≤ 1.8 m | > 1.8 m |

---

## Covered Harbours

Porbandar · Veraval · Okha · Dwarka · Mangrol · Jafrabad · Diu

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Build production bundle |
| `bun run preview` | Preview production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format code with Prettier |

---

## Disclaimer

This app provides open-data advisories based on publicly available weather data. It is **not** an official INCOIS (Indian National Centre for Ocean Information Services) product. Always cross-check with official forecasts and your local knowledge before going to sea.

---

## License

MIT
