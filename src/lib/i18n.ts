export type Lang = "en" | "gu";

export const T = {
  appName: { en: "Sagar Sahayak", gu: "સાગર સહાયક" },
  tagline: { en: "Ocean Companion", gu: "દરિયાનો સાથી" },
  chooseLocation: { en: "Where are you sailing from?", gu: "તમે ક્યાંથી દરિયે જાવ છો?" },
  useMyLocation: { en: "Use my current location", gu: "મારું હાલનું સ્થાન વાપરો" },
  orPickHarbor: { en: "or pick a harbour", gu: "અથવા બંદર પસંદ કરો" },
  selectHarbor: { en: "Select harbour", gu: "બંદર પસંદ કરો" },
  continue: { en: "Continue", gu: "આગળ વધો" },
  changeLocation: { en: "Change location", gu: "સ્થાન બદલો" },
  lastUpdated: { en: "Last updated", gu: "છેલ્લે અપડેટ" },
  safe: { en: "SAFE TO GO", gu: "જવું સલામત છે" },
  caution: { en: "CAUTION", gu: "સાવધાન" },
  unsafe: { en: "DO NOT GO", gu: "દરિયે ન જાવ" },
  returnBy: { en: "Return by", gu: "પાછા ફરો" },
  listen: { en: "Listen", gu: "સાંભળો" },
  share: { en: "Share", gu: "શેર કરો" },
  why: { en: "Why this verdict?", gu: "આ નિર્ણય કેમ?" },
  thresholds: { en: "Thresholds used", gu: "વપરાયેલી મર્યાદા" },
  factor: { en: "Factor", gu: "પરિબળ" },
  safeRange: { en: "Safe", gu: "સલામત" },
  cautionRange: { en: "Caution", gu: "સાવધાન" },
  unsafeRange: { en: "Unsafe", gu: "અસુરક્ષિત" },
  outlook: { en: "3-day outlook", gu: "૩ દિવસની આગાહી" },
  conditions: { en: "Conditions now", gu: "અત્યારની સ્થિતિ" },
  wind: { en: "Wind", gu: "પવન" },
  wave: { en: "Wave height", gu: "મોજાંની ઊંચાઈ" },
  swell: { en: "Swell", gu: "સ્વેલ" },
  sst: { en: "Sea temp", gu: "દરિયાનું તાપમાન" },
  map: { en: "Coastal map", gu: "દરિયાકિનારાનો નકશો" },
  focal: { en: "Focal", gu: "મુખ્ય" },
  allHarbors: { en: "All harbours", gu: "બધા બંદરો" },
  zoneNote: {
    en: "Open-data advisory (SST-based) — not an official INCOIS feed.",
    gu: "ઓપન-ડેટા સલાહ (SST આધારિત) — સત્તાવાર INCOIS ડેટા નથી.",
  },
  ask: { en: "Ask Sagar Sahayak", gu: "સાગર સહાયકને પૂછો" },
  askPlaceholder: {
    en: "e.g. why is it caution today?",
    gu: "દા.ત. આજે સાવધાન કેમ છે?",
  },
  send: { en: "Ask", gu: "પૂછો" },
  log: { en: "Advisory log", gu: "સલાહ નોંધ" },
  emptyLog: { en: "No advisories recorded yet.", gu: "હજી કોઈ સલાહ નોંધાઈ નથી." },
  cached: {
    en: "showing cached data — could not reach the network",
    gu: "સાચવેલો ડેટા બતાવાય છે — નેટવર્ક મળ્યું નથી",
  },
  mockBadge: { en: "MOCK AI", gu: "મોક AI" },
  loading: { en: "Reading the sea…", gu: "દરિયો તપાસાય છે…" },
  likelihood: { en: "Fish likelihood", gu: "માછલીની શક્યતા" },
} as const;

export const t = (key: keyof typeof T, lang: Lang) => T[key][lang];

export const agoLabel = (iso: string, lang: Lang) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return lang === "en" ? "just now" : "હમણાં જ";
  if (mins < 60) return lang === "en" ? `${mins} min ago` : `${mins} મિનિટ પહેલાં`;
  const hrs = Math.round(mins / 60);
  return lang === "en" ? `${hrs} h ago` : `${hrs} કલાક પહેલાં`;
};
