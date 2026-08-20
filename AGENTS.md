# Agent Guidelines — Sagar Sahayak

This project is a TanStack Start (React 19 + Vite + Nitro) application.

## Key conventions
- Server functions live in `src/lib/sagar.functions.ts` using `createServerFn`
- AI calls go through `callGranite` in `src/lib/marine.server.ts` (watsonx → Gemini fallback)
- All text strings are in `src/lib/i18n.ts` (English + Gujarati)
- Harbour data and safety thresholds are in `src/lib/harbors.ts`
- Database writes (advisory log) use the Supabase service-role client in `src/integrations/supabase/client.server.ts`

## Environment variables
See `.env.example` for the full list. Never commit `.env`.

## Running
```bash
npm run dev   # starts on http://localhost:3000
npm run build # production build (Nitro/Cloudflare Workers target)
```
