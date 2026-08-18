import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  HARBORS,
  THRESHOLDS,
  nearestHarbor,
  zoneLikelihood,
  type Level,
} from "@/lib/harbors";
import { T, agoLabel, t, type Lang } from "@/lib/i18n";
import { getAdvisory, getPlaceName, getWeather } from "@/lib/sagar.functions";

const CoastMap = lazy(() => import("@/components/CoastMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sagar Sahayak — Sea Safety Advisor for Gujarat Fishermen" },
      {
        name: "description",
        content:
          "Live wind, wave and swell readings turned into one plain-language answer: is it safe to go out, where to go, and when to be back. English and Gujarati.",
      },
      { property: "og:title", content: "Sagar Sahayak — Ocean Companion" },
      {
        property: "og:description",
        content:
          "AI sea-safety verdicts for small-boat fishermen on the Gujarat coast, in English and Gujarati.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SagarSahayak,
});

/* ---------------- types & storage ---------------- */

type Weather = Awaited<ReturnType<typeof getWeather>>;
type AdvisoryResponse = Awaited<ReturnType<typeof getAdvisory>>;
type Verdict = Extract<AdvisoryResponse, { mode: "verdict" }>;
type Breakdown = Extract<AdvisoryResponse, { mode: "breakdown" }>;

type Loc = { lat: number; lon: number; name: string };
type Cache = { loc: Loc; weather: Weather; verdict: Verdict; at: string };

type LogRow = {
  id: string;
  created_at: string;
  location_name: string;
  verdict: string;
  message: string;
};

const LS_LOC = "sagar.location";
const LS_LANG = "sagar.lang";
const LS_CACHE = "sagar.cache";

const read = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

/* ---------------- page ---------------- */

function SagarSahayak() {
  const weatherFn = useServerFn(getWeather);
  const advisoryFn = useServerFn(getAdvisory);
  const placeFn = useServerFn(getPlaceName);

  const [hydrated, setHydrated] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [loc, setLoc] = useState<Loc | null>(null);

  const [weather, setWeather] = useState<Weather | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const storedLang = read<Lang>(LS_LANG);
    if (storedLang === "en" || storedLang === "gu") setLang(storedLang);
    const storedLoc = read<Loc>(LS_LOC);
    if (storedLoc) setLoc(storedLoc);
    const cache = read<Cache>(LS_CACHE);
    if (cache && storedLoc) {
      setWeather(cache.weather);
      setVerdict(cache.verdict);
      setUpdatedAt(cache.at);
    }
  }, []);

  useEffect(() => {
    if (hydrated) write(LS_LANG, lang);
  }, [lang, hydrated]);

  const label = useCallback((key: keyof typeof T) => t(key, lang), [lang]);

  const refresh = useCallback(
    async (target: Loc) => {
      setLoading(true);
      try {
        const w = (await weatherFn({ data: { lat: target.lat, lon: target.lon, days: 3 } })) as Weather;
        const v = (await advisoryFn({
          data: { mode: "verdict", place: target.name, weather: w, log: true },
        })) as Verdict;
        const at = new Date().toISOString();
        setWeather(w);
        setVerdict(v);
        setUpdatedAt(at);
        setStale(false);
        setBreakdown(null);
        write(LS_CACHE, { loc: target, weather: w, verdict: v, at } satisfies Cache);
      } catch (err) {
        console.error("refresh failed", err);
        const cache = read<Cache>(LS_CACHE);
        if (cache) {
          setWeather(cache.weather);
          setVerdict(cache.verdict);
          setUpdatedAt(cache.at);
        }
        setStale(true);
      } finally {
        setLoading(false);
      }
    },
    [advisoryFn, weatherFn],
  );

  // Initial + 15-minute polling
  useEffect(() => {
    if (!loc) return;
    void refresh(loc);
    const id = window.setInterval(() => void refresh(loc), 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loc, refresh]);

  const chooseLocation = useCallback((next: Loc) => {
    setLoc(next);
    write(LS_LOC, next);
  }, []);

  if (!hydrated) return <div className="sagar-app center-card muted">…</div>;

  if (!loc) {
    return (
      <LocationEntry
        lang={lang}
        setLang={setLang}
        onChoose={chooseLocation}
        resolveName={async (lat, lon) => {
          try {
            const res = await placeFn({ data: { lat, lon } });
            return res.name ?? nearestHarbor(lat, lon).name;
          } catch {
            return nearestHarbor(lat, lon).name;
          }
        }}
      />
    );
  }

  const level: Level = verdict?.verdict ?? "caution";
  const likelihood = zoneLikelihood(weather?.current.sst ?? null);

  return (
    <div className="sagar-app" style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <span className="display" style={{ fontSize: 18 }}>
          {label("appName")}
        </span>
        <button
          className="btn btn-sm"
          onClick={() => {
            setLoc(null);
            setVerdict(null);
            setWeather(null);
            window.localStorage.removeItem(LS_LOC);
          }}
          title={label("changeLocation")}
        >
          📍 {loc.name}
        </button>
        <span className="grow" />
        {updatedAt && (
          <span className="mono muted" style={{ fontSize: 12 }}>
            <span className="livedot" style={{ marginRight: 6 }} />
            {label("lastUpdated")} {agoLabel(updatedAt, lang)}
          </span>
        )}
        <div role="group" aria-label="Language">
          <button className="btn btn-sm" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
          <button
            className="btn btn-sm"
            aria-pressed={lang === "gu"}
            onClick={() => setLang("gu")}
            style={{ marginLeft: 6 }}
          >
            ગુ
          </button>
        </div>
      </header>

      <main className="wrap">
        {stale && updatedAt && (
          <p className="notice" style={{ marginTop: 16 }}>
            {label("cached")} — {agoLabel(updatedAt, lang)}
          </p>
        )}

        <VerdictHero
          lang={lang}
          level={level}
          verdict={verdict}
          loading={loading && !verdict}
          locName={loc.name}
        />

        <WhyPanel
          lang={lang}
          breakdown={breakdown}
          onOpen={async () => {
            if (breakdown || !weather) return;
            try {
              const b = (await advisoryFn({
                data: { mode: "breakdown", place: loc.name, weather, log: false },
              })) as Breakdown;
              setBreakdown(b);
            } catch (err) {
              console.error("breakdown failed", err);
            }
          }}
        />

        <section className="panel" style={{ marginTop: 16 }}>
          <h2 className="display" style={{ fontSize: 16, margin: "0 0 12px" }}>
            {label("outlook")}
          </h2>
          <div className="chips">
            {(weather?.days ?? []).map((d) => (
              <div key={d.date} className={`chip ${d.level}`}>
                <div className="mono" style={{ fontSize: 12 }}>
                  {d.date}
                </div>
                <div className="display" style={{ fontSize: 15, marginTop: 4 }}>
                  {t(d.level, lang)}
                </div>
                <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                  {d.windSpeed} km/h · {d.waveHeight} m
                </div>
              </div>
            ))}
            {!weather && <p className="muted">{label("loading")}</p>}
          </div>
        </section>

        <div className="grid2" style={{ marginTop: 16 }}>
          <section className="panel">
            <h2 className="display" style={{ fontSize: 16, margin: "0 0 12px" }}>
              {label("conditions")}
            </h2>
            <div className="tiles">
              <Tile label={label("wind")} value={weather ? `${weather.current.windSpeed}` : "—"} unit="km/h" />
              <Tile label={label("wave")} value={weather ? `${weather.current.waveHeight}` : "—"} unit="m" />
              <Tile label={label("swell")} value={weather ? `${weather.current.swellHeight}` : "—"} unit="m" />
              <Tile label={label("sst")} value={weather ? `${weather.current.sst}` : "—"} unit="°C" />
            </div>
            <p className="mono muted" style={{ fontSize: 12, marginTop: 12 }}>
              {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
            </p>
          </section>

          <MapPanel
            lang={lang}
            loc={loc}
            level={level}
            likelihood={likelihood}
            weatherFn={weatherFn}
            advisoryFn={advisoryFn}
          />
        </div>

        <AskBox lang={lang} weather={weather} place={loc.name} advisoryFn={advisoryFn} />

        <AdvisoryLog lang={lang} />
      </main>
    </div>
  );
}

/* ---------------- location entry ---------------- */

function LocationEntry({
  lang,
  setLang,
  onChoose,
  resolveName,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  onChoose: (loc: Loc) => void;
  resolveName: (lat: number, lon: number) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [harborId, setHarborId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const useGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not available on this device.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const name = await resolveName(latitude, longitude);
        setBusy(false);
        onChoose({ lat: latitude, lon: longitude, name });
      },
      () => {
        setBusy(false);
        setError("Could not get your location — pick a harbour below.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="sagar-app center-card">
      <div className="panel" style={{ maxWidth: 460, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 className="display" style={{ fontSize: 24, margin: 0 }}>
            {t("appName", lang)}
          </h1>
          <span className="grow" style={{ flex: 1 }} />
          <button className="btn btn-sm" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            EN
          </button>
          <button className="btn btn-sm" aria-pressed={lang === "gu"} onClick={() => setLang("gu")}>
            ગુ
          </button>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          {t("tagline", lang)}
        </p>

        <h2 style={{ fontSize: 16, marginTop: 20 }}>{t("chooseLocation", lang)}</h2>

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={useGps} disabled={busy}>
          {busy ? "…" : `📍 ${t("useMyLocation", lang)}`}
        </button>

        <p className="muted" style={{ textAlign: "center", margin: "14px 0 8px", fontSize: 13 }}>
          {t("orPickHarbor", lang)}
        </p>

        <label htmlFor="harbor" className="muted" style={{ fontSize: 13 }}>
          {t("selectHarbor", lang)}
        </label>
        <select
          id="harbor"
          className="select"
          style={{ marginTop: 6 }}
          value={harborId}
          onChange={(e) => setHarborId(e.target.value)}
        >
          <option value="">—</option>
          {HARBORS.map((h) => (
            <option key={h.id} value={h.id}>
              {lang === "gu" ? h.nameGu : h.name}
            </option>
          ))}
        </select>

        <button
          className="btn"
          style={{ width: "100%", marginTop: 12 }}
          disabled={!harborId}
          onClick={() => {
            const h = HARBORS.find((x) => x.id === harborId);
            if (h) onChoose({ lat: h.lat, lon: h.lon, name: lang === "gu" ? h.nameGu : h.name });
          }}
        >
          {t("continue", lang)}
        </button>

        {error && (
          <p className="notice" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- hero ---------------- */

function VerdictHero({
  lang,
  level,
  verdict,
  loading,
  locName,
}: {
  lang: Lang;
  level: Level;
  verdict: Verdict | null;
  loading: boolean;
  locName: string;
}) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef<Level | null>(null);

  useEffect(() => {
    if (prev.current && prev.current !== level) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 900);
      return () => window.clearTimeout(id);
    }
    prev.current = level;
    return undefined;
  }, [level]);

  const explanation = verdict
    ? lang === "gu"
      ? verdict.explanationGu
      : verdict.explanation
    : t("loading", lang);
  const alert = verdict ? (lang === "gu" ? verdict.alertGu : verdict.alert) : null;

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${t(level, lang)}. ${explanation}`);
    u.lang = lang === "gu" ? "gu-IN" : "en-IN";
    window.speechSynthesis.speak(u);
  };

  const shareText = `${t("appName", lang)} — ${locName}: ${t(level, lang)}. ${explanation} ${
    verdict ? `${t("returnBy", lang)} ${verdict.returnBy}.` : ""
  }`;

  return (
    <section className={`hero ${level}${pulse ? " pulse" : ""}`} aria-live="polite">
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="badge mono">{locName}</span>
        {verdict?.mock && <span className="badge mono">{t("mockBadge", lang)}</span>}
      </div>
      <h1 style={{ marginTop: 12 }}>{loading ? t("loading", lang) : t(level, lang)}</h1>
      <p>{explanation}</p>
      {alert && <p style={{ fontWeight: 600 }}>⚠ {alert}</p>}
      <div className="row">
        {verdict && (
          <span className="mono" style={{ fontWeight: 600 }}>
            {t("returnBy", lang)}: {verdict.returnBy}
          </span>
        )}
        <button className="btn" onClick={speak}>
          🔊 {t("listen", lang)}
        </button>
        <a
          className="btn"
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none" }}
        >
          ↗ {t("share", lang)}
        </a>
      </div>
    </section>
  );
}

/* ---------------- why panel ---------------- */

function WhyPanel({
  lang,
  breakdown,
  onOpen,
}: {
  lang: Lang;
  breakdown: Breakdown | null;
  onOpen: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel">
      <button
        className="btn"
        aria-expanded={open}
        style={{ width: "100%", textAlign: "left" }}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void onOpen();
        }}
      >
        {open ? "▾" : "▸"} {t("why", lang)}
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {!breakdown && <p className="muted">{t("loading", lang)}</p>}
          {breakdown?.factors.map((f) => (
            <p key={f.factor} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span className={`dot ${f.level}`} aria-hidden />
              <span>{lang === "gu" ? f.reasonGu : f.reason}</span>
            </p>
          ))}

          <h3 className="display" style={{ fontSize: 14, margin: "18px 0 8px" }}>
            {t("thresholds", lang)}
          </h3>
          <table className="thr">
            <thead>
              <tr>
                <th>{t("factor", lang)}</th>
                <th className="num">{t("safeRange", lang)}</th>
                <th className="num">{t("cautionRange", lang)}</th>
                <th className="num">{t("unsafeRange", lang)}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("wind", lang)}</td>
                <td className="num">≤ {THRESHOLDS.wind.safe} km/h</td>
                <td className="num">≤ {THRESHOLDS.wind.caution} km/h</td>
                <td className="num">&gt; {THRESHOLDS.wind.caution} km/h</td>
              </tr>
              <tr>
                <td>{t("wave", lang)}</td>
                <td className="num">≤ {THRESHOLDS.wave.safe} m</td>
                <td className="num">≤ {THRESHOLDS.wave.caution} m</td>
                <td className="num">&gt; {THRESHOLDS.wave.caution} m</td>
              </tr>
              <tr>
                <td>{t("swell", lang)}</td>
                <td className="num">≤ {THRESHOLDS.swell.safe} m</td>
                <td className="num">≤ {THRESHOLDS.swell.caution} m</td>
                <td className="num">&gt; {THRESHOLDS.swell.caution} m</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------- tiles & map ---------------- */

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="tile">
      <div className="muted" style={{ fontSize: 13 }}>
        {label}
      </div>
      <div className="v">
        {value} <span style={{ fontSize: 14 }}>{unit}</span>
      </div>
    </div>
  );
}

function MapPanel({
  lang,
  loc,
  level,
  likelihood,
  weatherFn,
  advisoryFn,
}: {
  lang: Lang;
  loc: Loc;
  level: Level;
  likelihood: string;
  weatherFn: (opts: { data: { lat: number; lon: number; days: number } }) => Promise<Weather>;
  advisoryFn: (opts: {
    data: {
      mode: "verdict" | "breakdown" | "ask";
      place: string;
      weather: Weather;
      log: boolean;
      question?: string;
    };
  }) => Promise<AdvisoryResponse>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [harborStatus, setHarborStatus] = useState<Record<string, Level>>({});
  const [loadingAll, setLoadingAll] = useState(false);

  const loadAll = useCallback(async () => {
    if (Object.keys(harborStatus).length === HARBORS.length) return;
    setLoadingAll(true);
    try {
      const entries = await Promise.all(
        HARBORS.map(async (h) => {
          const w = await weatherFn({ data: { lat: h.lat, lon: h.lon, days: 1 } });
          const v = (await advisoryFn({
            data: { mode: "verdict", place: h.name, weather: w, log: false },
          })) as Verdict;
          return [h.id, v.verdict] as const;
        }),
      );
      setHarborStatus(Object.fromEntries(entries));
    } catch (err) {
      console.error("multi-harbor load failed", err);
    } finally {
      setLoadingAll(false);
    }
  }, [advisoryFn, harborStatus, weatherFn]);

  return (
    <section className="panel">
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <h2 className="display" style={{ fontSize: 16, margin: 0, flex: 1 }}>
          {t("map", lang)}
        </h2>
        <button className="btn btn-sm" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
          {t("focal", lang)}
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={showAll}
          onClick={() => {
            setShowAll(true);
            void loadAll();
          }}
        >
          {loadingAll ? "…" : t("allHarbors", lang)}
        </button>
      </div>

      <ClientOnly fallback={<div className="map-shell" />}>
        <Suspense fallback={<div className="map-shell" />}>
          <CoastMap
            lat={loc.lat}
            lon={loc.lon}
            placeName={loc.name}
            level={level}
            likelihood={likelihood}
            showAll={showAll}
            harborStatus={harborStatus}
          />
        </Suspense>
      </ClientOnly>

      <p style={{ marginTop: 10, fontSize: 14 }}>
        {t("likelihood", lang)}: <strong className="mono">{likelihood}</strong>
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        {t("zoneNote", lang)}
      </p>
    </section>
  );
}

/* ---------------- ask ---------------- */

function AskBox({
  lang,
  weather,
  place,
  advisoryFn,
}: {
  lang: Lang;
  weather: Weather | null;
  place: string;
  advisoryFn: (opts: {
    data: {
      mode: "verdict" | "breakdown" | "ask";
      place: string;
      weather: Weather;
      log: boolean;
      question?: string;
    };
  }) => Promise<AdvisoryResponse>;
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || !weather || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const res = (await advisoryFn({
        data: { mode: "ask", place, weather, question: q, log: false },
      })) as Extract<AdvisoryResponse, { mode: "ask" }>;
      setMessages((m) => [...m, { q, a: res.answer }]);
    } catch (err) {
      console.error("ask failed", err);
      setMessages((m) => [
        ...m,
        { q, a: lang === "gu" ? "જવાબ મળ્યો નથી — ફરી પ્રયાસ કરો." : "Could not answer right now — please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h2 className="display" style={{ fontSize: 16, margin: "0 0 12px" }}>
        {t("ask", lang)}
      </h2>
      {messages.map((m, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {m.q}
          </p>
          <p style={{ margin: "4px 0 0" }}>{m.a}</p>
        </div>
      ))}
      <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("askPlaceholder", lang)}
          aria-label={t("ask", lang)}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !weather}>
          {busy ? "…" : t("send", lang)}
        </button>
      </form>
    </section>
  );
}

/* ---------------- advisory log ---------------- */

function AdvisoryLog({ lang }: { lang: Lang }) {
  const [rows, setRows] = useState<LogRow[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("advisory_log")
      .select("id, created_at, location_name, verdict, message")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("advisory_log read failed", error.message);
      return;
    }
    setRows((data ?? []) as LogRow[]);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("advisory_log_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "advisory_log" },
        () => void load(),
      )
      .subscribe();
    const poll = window.setInterval(() => void load(), 60000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [load]);

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === "gu" ? "gu-IN" : "en-IN", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [lang],
  );

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h2 className="display" style={{ fontSize: 16, margin: "0 0 8px" }}>
        {t("log", lang)}
      </h2>
      {rows.length === 0 && <p className="muted">{t("emptyLog", lang)}</p>}
      <div className="logscroll">
        {rows.map((r) => (
          <div key={r.id} className="logrow">
            <span className="mono muted" style={{ fontSize: 12, minWidth: 130 }}>
              {fmt.format(new Date(r.created_at))}
            </span>
            <span className={`dot ${r.verdict.toLowerCase()}`} aria-hidden />
            <span className="mono" style={{ fontSize: 12, minWidth: 72 }}>
              {r.verdict}
            </span>
            <span style={{ flex: 1 }}>
              <strong>{r.location_name}</strong> — {r.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
