/**
 * Live station weather from the public aviationweather.gov Data API (no key).
 * METAR = what the station reports now; TAF = what it forecasts.
 *
 * We reduce both to the ICAO/FAA flight category (VFR / MVFR / IFR / LIFR),
 * because that is the column the handling history is keyed on: it is the
 * join key between "what the sky is doing" and "how this station performed
 * the last time the sky did that".
 */

export type Wx = "VFR" | "MVFR" | "IFR" | "LIFR";
export const WX_ORDER: Wx[] = ["VFR", "MVFR", "IFR", "LIFR"];

export const ICAO: Record<string, string> = {
  GVA: "LSGG",
  LEJ: "EDDP",
  ZRH: "LSZH",
  FRA: "EDDF",
  CDG: "LFPG",
};

export type StationWeather = {
  station: string;
  icao: string;
  observed_at: string | null;
  metar: string | null;
  metar_category: Wx | null;
  taf: string | null;
  /** Worst category forecast in the next `horizonH` hours, TEMPO/PROB groups included. */
  taf_worst_category: Wx | null;
  taf_worst_reason: string | null;
};

type Cloud = { cover?: string | null; base?: number | null };

/** Visibility in statute miles from the API's string/number ("6+", "1/2", 3). */
export function visibilitySm(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace("+", "");
  if (/^\d+\s+\d+\/\d+$/.test(s)) {
    const [whole, frac] = s.split(/\s+/);
    const [a, b] = frac.split("/").map(Number);
    return Number(whole) + a / b;
  }
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split("/").map(Number);
    return a / b;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Lowest broken/overcast layer (or vertical visibility) in feet. */
export function ceilingFt(clouds: Cloud[] | undefined, vertVis?: number | null): number | null {
  let ceil: number | null = vertVis ?? null;
  for (const c of clouds ?? []) {
    if ((c.cover === "BKN" || c.cover === "OVC" || c.cover === "OVX") && typeof c.base === "number") {
      ceil = ceil === null ? c.base : Math.min(ceil, c.base);
    }
  }
  return ceil;
}

/** FAA flight category from ceiling (ft) and visibility (SM). */
export function flightCategory(ceil: number | null, visSm: number | null): Wx {
  const c = ceil ?? Infinity;
  const v = visSm ?? Infinity;
  if (c < 500 || v < 1) return "LIFR";
  if (c < 1000 || v < 3) return "IFR";
  if (c <= 3000 || v <= 5) return "MVFR";
  return "VFR";
}

export function worse(a: Wx | null, b: Wx | null): Wx | null {
  if (!a) return b;
  if (!b) return a;
  return WX_ORDER.indexOf(a) >= WX_ORDER.indexOf(b) ? a : b;
}

type MetarJson = { icaoId: string; rawOb?: string; reportTime?: string; fltCat?: string; visib?: unknown; clouds?: Cloud[] };
type TafJson = {
  icaoId: string;
  rawTAF?: string;
  fcsts?: { timeFrom: number; timeTo: number; fcstChange?: string | null; probability?: number | null; visib?: unknown; vertVis?: number | null; clouds?: Cloud[]; wxString?: string | null }[];
};

export function summarize(
  station: string,
  metar: MetarJson | undefined,
  taf: TafJson | undefined,
  nowSec: number,
  horizonH = 6,
): StationWeather {
  const icao = ICAO[station] ?? station;
  let metarCat: Wx | null = null;
  if (metar) {
    const api = metar.fltCat as Wx | undefined;
    metarCat = api && WX_ORDER.includes(api) ? api : flightCategory(ceilingFt(metar.clouds), visibilitySm(metar.visib));
  }
  let worst: Wx | null = null;
  let reason: string | null = null;
  const end = nowSec + horizonH * 3600;
  for (const f of taf?.fcsts ?? []) {
    if (f.timeTo <= nowSec || f.timeFrom >= end) continue;
    const vis = visibilitySm(f.visib);
    // A change group that omits visibility or cloud inherits the base; treat missing as "no worse".
    const cat = flightCategory(ceilingFt(f.clouds, f.vertVis), vis);
    if (worst === null || WX_ORDER.indexOf(cat) > WX_ORDER.indexOf(worst)) {
      worst = cat;
      const from = new Date(f.timeFrom * 1000).toISOString().slice(11, 16);
      const to = new Date(f.timeTo * 1000).toISOString().slice(11, 16);
      const tag = f.fcstChange === "PROB" && f.probability ? `PROB${f.probability}` : f.probability ? `PROB${f.probability} ${f.fcstChange ?? ""}`.trim() : (f.fcstChange ?? "BASE");
      reason = `${tag} ${from}–${to} UTC${f.wxString ? ` ${f.wxString}` : ""}`;
    }
  }
  return {
    station,
    icao,
    observed_at: metar?.reportTime ?? null,
    metar: metar?.rawOb ?? null,
    metar_category: metarCat,
    taf: taf?.rawTAF ?? null,
    taf_worst_category: worst,
    taf_worst_reason: reason,
  };
}

const API = "https://aviationweather.gov/api/data";

export async function fetchStationWeather(
  stations: string[],
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: number } = {},
): Promise<StationWeather[]> {
  const f = opts.fetchImpl ?? fetch;
  const ids = stations.map((s) => ICAO[s] ?? s).join(",");
  const get = async <T,>(kind: "metar" | "taf"): Promise<T[]> => {
    const res = await f(`${API}/${kind}?ids=${ids}&format=json`, {
      headers: { "user-agent": "cargopilot (github.com/Makabeez/cargopilot)" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 6000),
    });
    if (!res.ok) throw new Error(`aviationweather ${kind} ${res.status}`);
    return (await res.json()) as T[];
  };
  const [metars, tafs] = await Promise.all([get<MetarJson>("metar"), get<TafJson>("taf")]);
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  return stations.map((s) => {
    const icao = ICAO[s] ?? s;
    return summarize(
      s,
      metars.find((m) => m.icaoId === icao),
      tafs.find((t) => t.icaoId === icao),
      nowSec,
    );
  });
}
