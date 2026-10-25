/**
 * Station evidence: the federated "how did this station do the last time the
 * sky looked like this?" answer that the get_station_evidence tool returns.
 *
 * Two sources that live in different systems:
 *   - ops.handling_history  (Postgres): 90 days of handling times per station,
 *                            process and flight, tagged with the flight category
 *   - wx.metar_now          (REST, aviationweather.gov): what each station reports now
 * Zetaris joins them in ONE federated SQL query (ZETARIS_SQL below). The TAF
 * forecast is read from the same public API and reduced to the worst flight
 * category in the next 6 h.
 *
 * The offline mirror computes the same aggregates from the same CSV in-process
 * with Spark's percentile semantics, so (a) the app and the judge path work
 * without a Zetaris instance and (b) every recorded Zetaris answer can be
 * re-derived and checked byte for byte.
 */
import { HANDLING_HISTORY_CSV } from "./history.data";
import { ICAO, WX_ORDER, worse, type StationWeather, type Wx } from "./weather";

export type HistoryRow = {
  date: string;
  station: string;
  icao: string;
  process: string;
  flight: string;
  window_min: number;
  actual_min: number;
  within_window: boolean;
  wx_category: Wx;
};

export function parseHistory(csv: string = HANDLING_HISTORY_CSV): HistoryRow[] {
  const [head, ...lines] = csv.trim().split("\n");
  const cols = head.split(",");
  return lines.map((line) => {
    const v = line.split(",");
    const r = Object.fromEntries(cols.map((c, i) => [c, v[i]]));
    return {
      date: r.date,
      station: r.station,
      icao: r.icao,
      process: r.process,
      flight: r.flight,
      window_min: Number(r.window_min),
      actual_min: Number(r.actual_min),
      within_window: r.within_window === "true",
      wx_category: r.wx_category as Wx,
    };
  });
}

/** Which station processes a file's options depend on. Files not listed have no station evidence. */
export type Leg = { station: string; process: string; flight: string; role: string };
export const LEGS: Record<string, Leg[]> = {
  s615: [
    { station: "LEJ", process: "truck_to_flight", flight: "AYC 7841", role: "booked transfer at LEJ" },
    { station: "ZRH", process: "truck_to_flight", flight: "AYC 9864", role: "reroute via ZRH" },
    { station: "FRA", process: "truck_to_flight", flight: "AYC 552", role: "reroute via FRA" },
  ],
  s125: [{ station: "CDG", process: "flight_connection", flight: "AYC 045", role: "booked connection at CDG" }],
  s157: [{ station: "GVA", process: "acceptance_to_ready", flight: "AYC 090", role: "GVA acceptance for AYC 090" }],
  s131: [{ station: "GVA", process: "acceptance_to_ready", flight: "AYC 880", role: "GVA acceptance for AYC 880" }],
};

export function stationsFor(shipmentId: string): string[] {
  return [...new Set((LEGS[shipmentId] ?? []).map((l) => l.station))];
}

/** One aggregate row, exactly what the Zetaris query returns per (station, process, flight, category). */
export type AggRow = {
  station: string;
  process: string;
  flight: string;
  window_min: number;
  wx_category: Wx;
  n: number;
  within: number;
  p50_min: number;
  p90_min: number;
  max_min: number;
};

/** Spark percentile_approx on small groups: smallest value v with at least p of the values ≤ v. */
export function sparkPercentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(p * s.length) - 1)];
}

const flightsOf = (legs: Leg[]) => [...new Set(legs.map((l) => l.flight))].sort();

/** The federated query sent to Zetaris for a set of legs. */
export function zetarisSql(legs: Leg[]): string {
  const flights = flightsOf(legs)
    .map((f) => `'${f.replace(/'/g, "")}'`)
    .join(", ");
  return [
    "SELECT h.station, h.process, h.flight, h.window_min, h.wx_category,",
    "       COUNT(*) AS n,",
    "       SUM(CASE WHEN h.within_window THEN 1 ELSE 0 END) AS hits,",
    "       percentile_approx(h.actual_min, 0.5) AS p50_min,",
    "       percentile_approx(h.actual_min, 0.9) AS p90_min,",
    "       MAX(h.actual_min) AS max_min,",
    "       MAX(m.fltcat) AS metar_now, MAX(m.rawob) AS metar_raw",
    "FROM ops_pg.handling_history h",
    "LEFT JOIN cargo_wx.metar_now m ON m.icao = h.icao",
    `WHERE h.flight IN (${flights})`,
    "GROUP BY h.station, h.process, h.flight, h.window_min, h.wx_category",
    "ORDER BY h.station, h.flight, h.wx_category",
  ].join("\n");
}

/** Offline mirror of zetarisSql over the bundled CSV. */
export function mirrorAggregate(legs: Leg[], rows: HistoryRow[] = parseHistory()): AggRow[] {
  const flights = new Set(flightsOf(legs));
  const groups = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    if (!flights.has(r.flight)) continue;
    const k = [r.station, r.process, r.flight, r.window_min, r.wx_category].join("|");
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  return [...groups.values()]
    .map((g) => {
      const v = g.map((r) => r.actual_min);
      return {
        station: g[0].station,
        process: g[0].process,
        flight: g[0].flight,
        window_min: g[0].window_min,
        wx_category: g[0].wx_category,
        n: g.length,
        within: g.filter((r) => r.within_window).length,
        p50_min: sparkPercentile(v, 0.5),
        p90_min: sparkPercentile(v, 0.9),
        max_min: Math.max(...v),
      };
    })
    .sort((a, b) =>
      a.station !== b.station
        ? a.station.localeCompare(b.station)
        : a.flight !== b.flight
          ? a.flight.localeCompare(b.flight)
          : a.wx_category.localeCompare(b.wx_category),
    );
}

/** Canonical form for comparing a Zetaris answer with the mirror. */
export function aggKey(rows: AggRow[]): string {
  return JSON.stringify(
    [...rows]
      .map((r) => [r.station, r.process, r.flight, r.window_min, r.wx_category, r.n, r.within, r.p50_min, r.p90_min, r.max_min])
      .sort((a, b) => String(a).localeCompare(String(b))),
  );
}

// ---------------------------------------------------------------------------
// The snapshot a run uses, and the tool output derived from it
// ---------------------------------------------------------------------------

export type EvidenceSnapshot = {
  backend: "zetaris" | "mirror";
  /** Why the mirror answered, when it did. */
  backend_note?: string;
  sql: string;
  fetched_at: string;
  rows: AggRow[];
  weather: StationWeather[];
  weather_source: "aviationweather.gov" | "unavailable";
};

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

function stat(rows: AggRow[]) {
  const n = rows.reduce((s, r) => s + r.n, 0);
  const within = rows.reduce((s, r) => s + r.within, 0);
  return { n, within };
}

/**
 * The get_station_evidence tool output. Pure function of (shipment, what-if
 * overrides, snapshot): the same snapshot always gives the same output, which
 * is what lets a recorded run be re-verified offline.
 */
export function stationEvidence(shipmentId: string, snap: EvidenceSnapshot | undefined, whatIf: Partial<Record<string, Wx>> = {}) {
  const legs = LEGS[shipmentId] ?? [];
  if (!legs.length) {
    return { applicable: false, note: "No station handling evidence applies to this file (no transfer or acceptance process at risk)." };
  }
  if (!snap) {
    return { applicable: false, note: "Station evidence unavailable for this run." };
  }
  return {
    applicable: true,
    source: snap.backend === "zetaris" ? "Zetaris federated query (Postgres handling history JOIN live METAR REST table)" : "Offline mirror of the Zetaris query (same CSV, same aggregates)",
    weather_source: snap.weather_source,
    fetched_at: snap.fetched_at,
    stations: legs.map((leg) => {
      const wx = snap.weather.find((w) => w.station === leg.station);
      const forced = whatIf[leg.station];
      const live = worse(wx?.metar_category ?? null, wx?.taf_worst_category ?? null);
      const category: Wx | null = forced ?? live;
      const mine = snap.rows.filter((r) => r.flight === leg.flight && r.station === leg.station);
      const all = stat(mine);
      const inCat = category ? mine.filter((r) => r.wx_category === category) : [];
      const c = stat(inCat);
      const catRow = inCat[0];
      return {
        station: leg.station,
        icao: ICAO[leg.station] ?? leg.station,
        role: leg.role,
        process: leg.process,
        flight: leg.flight,
        window_min: mine[0]?.window_min ?? null,
        weather: forced
          ? { basis: "what-if set by the duty officer", flight_category: forced }
          : {
              basis: "worst of METAR now and TAF next 6 h",
              flight_category: category,
              metar: wx?.metar ?? null,
              metar_category: wx?.metar_category ?? null,
              taf_worst_category: wx?.taf_worst_category ?? null,
              taf_worst_period: wx?.taf_worst_reason ?? null,
            },
        history_90_days: {
          all_weather: `within window ${all.within} of ${all.n} (${pct(all.within, all.n)}%)`,
          ...(category
            ? {
                [`in_${category}`]: c.n
                  ? `within window ${c.within} of ${c.n} (${pct(c.within, c.n)}%), median ${catRow.p50_min} min, p90 ${catRow.p90_min} min`
                  : `no ${category} movements recorded`,
              }
            : {}),
          sample_note: c.n && c.n < 15 ? `small sample: ${c.n} movements in ${category}` : undefined,
        },
      };
    }),
  };
}

export const WX_LIST = WX_ORDER;

/** Flight category each station is judged on: the what-if if set, else worst of METAR now and TAF next 6 h. */
export function stationCategories(
  shipmentId: string,
  snap: EvidenceSnapshot | undefined,
  whatIf: Partial<Record<string, Wx>> = {},
): { station: string; category: Wx | null; whatIf: boolean }[] {
  return stationsFor(shipmentId).map((station) => {
    if (whatIf[station]) return { station, category: whatIf[station]!, whatIf: true };
    const wx = snap?.weather.find((w) => w.station === station);
    return { station, category: worse(wx?.metar_category ?? null, wx?.taf_worst_category ?? null), whatIf: false };
  });
}

/**
 * Desk policy v5, "keep first unless the station says otherwise": the booked
 * plan loses its keep-first priority when, in tonight's flight category, the
 * booked station process held its window in fewer than KEEP_MIN_RATE of at
 * least KEEP_MIN_N past movements. Both numbers are a policy choice (the
 * desk's risk appetite), not a measured constant; the README shows how many
 * files each setting flips.
 */
export const KEEP_MIN_N = 8;
export const KEEP_MIN_RATE = 2 / 3;

export function bookedLegVerdict(shipmentId: string, snap: EvidenceSnapshot | undefined, whatIf: Partial<Record<string, Wx>> = {}) {
  const leg = (LEGS[shipmentId] ?? []).find((l) => l.role.startsWith("booked"));
  if (!leg || !snap) return null;
  const cat = stationCategories(shipmentId, snap, whatIf).find((c) => c.station === leg.station)?.category ?? null;
  if (!cat) return null;
  const rows = snap.rows.filter((r) => r.flight === leg.flight && r.station === leg.station && r.wx_category === cat);
  const { n, within } = stat(rows);
  return { station: leg.station, flight: leg.flight, category: cat, n, within, rate: n ? within / n : null, overridesKeep: n >= KEEP_MIN_N && within / n < KEEP_MIN_RATE };
}
