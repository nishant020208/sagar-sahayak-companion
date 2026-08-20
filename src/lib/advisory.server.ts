import { levelFor, THRESHOLDS, worst, zoneLikelihood, type Level } from "./harbors";
import { callGranite, extractJson, type WeatherData } from "./marine.server";

export type VerdictResult = {
  verdict: Level;
  explanation: string;
  explanationGu: string;
  returnBy: string;
  alert: string | null;
  alertGu: string | null;
  mock: boolean;
};

export type Factor = {
  factor: "wind" | "wave" | "swell" | "sst";
  value: string;
  level: Level;
  reason: string;
  reasonGu: string;
};

export type BreakdownResult = { factors: Factor[]; mock: boolean };

export function deterministicLevel(w: WeatherData): Level {
  return worst([
    levelFor(w.current.windSpeed, THRESHOLDS.wind),
    levelFor(w.current.waveHeight, THRESHOLDS.wave),
    levelFor(w.current.swellHeight, THRESHOLDS.swell),
  ]);
}

function returnTimeFor(level: Level): string {
  if (level === "safe") return "17:00";
  if (level === "caution") return "13:00";
  return "Do not sail today";
}

export function mockVerdict(w: WeatherData, place: string): VerdictResult {
  const level = deterministicLevel(w);
  const c = w.current;
  const en =
    level === "safe"
      ? `Calm conditions off ${place}: wind ${c.windSpeed} km/h and waves ${c.waveHeight} m are within safe limits for small boats.`
      : level === "caution"
        ? `Choppy conditions off ${place}: wind ${c.windSpeed} km/h and waves ${c.waveHeight} m are rising — stay close to shore.`
        : `Dangerous sea off ${place}: wind ${c.windSpeed} km/h and waves ${c.waveHeight} m are beyond safe limits for small boats.`;
  const gu =
    level === "safe"
      ? `${place} પાસે દરિયો શાંત છે: પવન ${c.windSpeed} કિમી/કલાક અને મોજાં ${c.waveHeight} મીટર — નાની હોડી માટે સલામત.`
      : level === "caution"
        ? `${place} પાસે દરિયો થોડો તોફાની છે: પવન ${c.windSpeed} કિમી/કલાક, મોજાં ${c.waveHeight} મીટર — કિનારાની નજીક રહો.`
        : `${place} પાસે દરિયો ખતરનાક છે: પવન ${c.windSpeed} કિમી/કલાક, મોજાં ${c.waveHeight} મીટર — આજે દરિયે ન જાવ.`;
  const alert =
    level === "safe"
      ? null
      : level === "caution"
        ? `Rough seas building later today — plan to return by ${returnTimeFor(level)}.`
        : `Unsafe sea state — small boats should remain in harbour today.`;
  const alertGu =
    level === "safe"
      ? null
      : level === "caution"
        ? `આજે પછીથી દરિયો તોફાની થશે — ${returnTimeFor(level)} સુધીમાં પાછા ફરો.`
        : `દરિયો અસુરક્ષિત છે — આજે નાની હોડીઓ બંદરમાં જ રહે.`;
  return {
    verdict: level,
    explanation: en,
    explanationGu: gu,
    returnBy: returnTimeFor(level),
    alert,
    alertGu,
    mock: true,
  };
}

export function mockBreakdown(w: WeatherData): BreakdownResult {
  const c = w.current;
  const windL = levelFor(c.windSpeed, THRESHOLDS.wind);
  const waveL = levelFor(c.waveHeight, THRESHOLDS.wave);
  const swellL = levelFor(c.swellHeight, THRESHOLDS.swell);
  const zone = zoneLikelihood(c.sst);
  return {
    mock: true,
    factors: [
      {
        factor: "wind",
        value: `${c.windSpeed} km/h`,
        level: windL,
        reason: `Wind: ${c.windSpeed} km/h — ${windL === "safe" ? `within safe range (under ${THRESHOLDS.wind.safe} km/h)` : windL === "caution" ? `elevated (above ${THRESHOLDS.wind.safe} km/h)` : `dangerous (above ${THRESHOLDS.wind.caution} km/h)`}.`,
        reasonGu: `પવન: ${c.windSpeed} કિમી/કલાક — ${windL === "safe" ? "સલામત મર્યાદામાં" : windL === "caution" ? "વધારે છે, સાવધાન" : "ખતરનાક"}.`,
      },
      {
        factor: "wave",
        value: `${c.waveHeight} m`,
        level: waveL,
        reason: `Wave height: ${c.waveHeight} m — ${waveL === "safe" ? `comfortable for small boats (under ${THRESHOLDS.wave.safe} m)` : waveL === "caution" ? `choppy (above ${THRESHOLDS.wave.safe} m)` : `dangerous (above ${THRESHOLDS.wave.caution} m)`}.`,
        reasonGu: `મોજાં: ${c.waveHeight} મીટર — ${waveL === "safe" ? "નાની હોડી માટે ઠીક" : waveL === "caution" ? "ઊંચા થઈ રહ્યા છે" : "ખતરનાક"}.`,
      },
      {
        factor: "swell",
        value: `${c.swellHeight} m`,
        level: swellL,
        reason: `Swell: ${c.swellHeight} m — ${swellL === "safe" ? `long low swell, easy to handle (under ${THRESHOLDS.swell.safe} m)` : swellL === "caution" ? `noticeable roll (above ${THRESHOLDS.swell.safe} m)` : `heavy swell (above ${THRESHOLDS.swell.caution} m)`}.`,
        reasonGu: `સ્વેલ: ${c.swellHeight} મીટર — ${swellL === "safe" ? "સામાન્ય" : swellL === "caution" ? "ધ્યાન રાખો" : "ભારે"}.`,
      },
      {
        factor: "sst",
        value: `${c.sst} °C`,
        level: "safe",
        reason: `Sea surface temperature: ${c.sst} °C — open-data fishing likelihood proxy reads ${zone}. Not a safety factor on its own.`,
        reasonGu: `દરિયાનું તાપમાન: ${c.sst} °C — માછલી મળવાની શક્યતા: ${zone}. આ સલામતીનું પરિબળ નથી.`,
      },
    ],
  };
}

function contextBlock(w: WeatherData, place: string) {
  return `Location: ${place} (${w.lat.toFixed(3)}, ${w.lon.toFixed(3)})
Now: wind ${w.current.windSpeed} km/h from ${w.current.windDirection}deg, wave ${w.current.waveHeight} m, wind-wave ${w.current.windWaveHeight} m, swell ${w.current.swellHeight} m, sea surface temperature ${w.current.sst} C.
Next days (daily maxima): ${w.days.map((d) => `${d.date}: wind ${d.windSpeed} km/h, wave ${d.waveHeight} m, swell ${d.swellHeight} m, SST ${d.sst} C`).join(" | ")}
Safety thresholds: wind safe <=${THRESHOLDS.wind.safe} km/h, caution <=${THRESHOLDS.wind.caution}; wave safe <=${THRESHOLDS.wave.safe} m, caution <=${THRESHOLDS.wave.caution}; swell safe <=${THRESHOLDS.swell.safe} m, caution <=${THRESHOLDS.swell.caution}.
Rule-based verdict from those thresholds: ${deterministicLevel(w).toUpperCase()}.`;
}

export async function graniteVerdict(w: WeatherData, place: string): Promise<VerdictResult> {
  const prompt = `You are Sagar Sahayak, a marine safety advisor for small-boat fishermen on the Gujarat coast of India.
${contextBlock(w, place)}

Return ONLY JSON with keys: verdict ("safe"|"caution"|"unsafe"), explanation (one plain English sentence), explanationGu (the same sentence in Gujarati script), returnBy (recommended return time, 24h "HH:MM", or a short phrase if unsafe), alert (one short proactive advisory line in English, or null if safe), alertGu (Gujarati version or null).
Do not contradict the rule-based verdict. JSON:`;
  const text = await callGranite(prompt);
  const parsed = extractJson<Partial<VerdictResult>>(text);
  const fallback = mockVerdict(w, place);
  if (!parsed?.verdict) return { ...fallback, mock: false };
  return {
    verdict: (["safe", "caution", "unsafe"] as const).includes(parsed.verdict as Level)
      ? (parsed.verdict as Level)
      : fallback.verdict,
    explanation: parsed.explanation ?? fallback.explanation,
    explanationGu: parsed.explanationGu ?? fallback.explanationGu,
    returnBy: parsed.returnBy ?? fallback.returnBy,
    alert: parsed.alert ?? fallback.alert,
    alertGu: parsed.alertGu ?? fallback.alertGu,
    mock: false,
  };
}

export async function graniteBreakdown(w: WeatherData, place: string): Promise<BreakdownResult> {
  const prompt = `You are Sagar Sahayak, a marine safety advisor for small-boat fishermen on the Gujarat coast.
${contextBlock(w, place)}

Return ONLY JSON: {"factors":[{"factor":"wind"|"wave"|"swell"|"sst","value":"<number with unit>","level":"safe"|"caution"|"unsafe","reason":"<one short English line citing the threshold>","reasonGu":"<same line in Gujarati script>"}]} with exactly one entry per factor in that order. JSON:`;
  const text = await callGranite(prompt);
  const parsed = extractJson<BreakdownResult>(text);
  if (!parsed?.factors?.length) return { ...mockBreakdown(w), mock: false };
  return { factors: parsed.factors, mock: false };
}

export async function graniteAnswer(
  w: WeatherData,
  place: string,
  question: string,
): Promise<{ answer: string; mock: boolean }> {
  const prompt = `You are Sagar Sahayak, answering a Gujarat small-boat fisherman's question. Use ONLY the data below; if the data cannot answer it, say so plainly. Answer in 2-3 short sentences, plain language, no markdown.
${contextBlock(w, place)}

Question: ${question}
Answer:`;
  const answer = await callGranite(prompt);
  return { answer, mock: false };
}

export function mockAnswer(w: WeatherData, place: string, question: string) {
  const level = deterministicLevel(w);
  const c = w.current;
  const tomorrow = w.days[1];
  const trend = tomorrow
    ? ` Tomorrow (${tomorrow.date}) looks ${tomorrow.level.toUpperCase()} with wind up to ${tomorrow.windSpeed} km/h and waves up to ${tomorrow.waveHeight} m.`
    : "";
  return {
    answer:
      `[Mock answer — AI credentials not configured] Based on live data for ${place}: today reads ${level.toUpperCase()} ` +
      `(wind ${c.windSpeed} km/h, waves ${c.waveHeight} m, swell ${c.swellHeight} m, SST ${c.sst} °C).${trend} ` +
      `Your question was: "${question}".`,
    mock: true,
  };
}
