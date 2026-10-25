/**
 * Zetaris REST client (server only). Zetaris ships no npm package; the REST
 * SQL endpoint is the documented way in (github.com/zetaris/getting-started,
 * docs/connections/client-setup.md):
 *
 *   POST {ZETARIS_REST_URL}/sql-editor/sqls/run
 *   Authorization: Bearer <API token>   X-Org-ID: <org id>   X-Request-ID: <uuid>
 *   body {queryId, sql, source: "SqlEditor", limit}  →  {data: rows}
 *
 * Rows come back positionally with string values; we map them by the SELECT
 * column order of zetarisSql().
 */
import { aggKey, mirrorAggregate, zetarisSql, type AggRow, type EvidenceSnapshot, type Leg, LEGS, stationsFor } from "./evidence";
import { fetchStationWeather, type StationWeather, type Wx } from "./weather";

export type ZetarisConfig = {
  restUrl: string;
  apiKey: string;
  orgId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function zetarisConfigFromEnv(env: Record<string, string | undefined> = process.env): ZetarisConfig | null {
  const restUrl = env.ZETARIS_REST_URL?.trim();
  const apiKey = env.ZETARIS_API_KEY?.trim();
  if (!restUrl || !apiKey) return null;
  return { restUrl: restUrl.replace(/\/$/, ""), apiKey, orgId: env.ZETARIS_ORG_ID?.trim() || "1" };
}

const COLS = ["station", "process", "flight", "window_min", "wx_category", "n", "hits", "p50_min", "p90_min", "max_min", "metar_now", "metar_raw"] as const;

export async function runZetarisSql(cfg: ZetarisConfig, sql: string, limit = 500, requireData = true): Promise<unknown[]> {
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.restUrl}/sql-editor/sqls/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      "x-org-id": cfg.orgId,
      "x-request-id": crypto.randomUUID(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ queryId: crypto.randomUUID(), sql, source: "SqlEditor", limit }),
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zetaris HTTP ${res.status}: ${text.slice(0, 200)}`);
  const out = (text ? JSON.parse(text) : null) as { data?: unknown[]; error?: unknown; message?: unknown } | null;
  if (out && (out.error || (typeof out.message === "string" && /error|fail|exception/i.test(out.message)))) {
    throw new Error(`Zetaris: ${String(out.error ?? out.message).slice(0, 300)}`);
  }
  if (!out || !Array.isArray(out.data)) {
    if (requireData) throw new Error("Zetaris response had no data array");
    return [];
  }
  return out.data;
}

/** Positional (or keyed) Zetaris rows → typed aggregates. */
export function parseZetarisRows(data: unknown[]): { rows: AggRow[]; metar: Record<string, { cat: string | null; raw: string | null }> } {
  const rows: AggRow[] = [];
  const metar: Record<string, { cat: string | null; raw: string | null }> = {};
  for (const r of data) {
    const get = (i: number): unknown => (Array.isArray(r) ? r[i] : (r as Record<string, unknown>)[COLS[i]]);
    const s = (i: number) => (get(i) === null || get(i) === undefined ? null : String(get(i)));
    const n = (i: number) => Number(get(i));
    const station = s(0)!;
    rows.push({
      station,
      process: s(1)!,
      flight: s(2)!,
      window_min: n(3),
      wx_category: s(4) as Wx,
      n: n(5),
      within: n(6),
      p50_min: n(7),
      p90_min: n(8),
      max_min: n(9),
    });
    metar[station] = { cat: s(10), raw: s(11) };
  }
  return { rows, metar };
}

/**
 * Federated answers are cached briefly per SQL text: every file opening on the
 * desk sends the same query for its legs, and the history does not change
 * within a minute. One retry absorbs a transient Spark/REST error (seen during
 * recording when the METAR REST table was fetched by several queries at once).
 */
const zCache = new Map<string, { at: number; data: unknown[] }>();
const Z_CACHE_MS = 60_000;

/** Tests and the setup script reset the cache between scenarios. */
export function clearZetarisCache(): void {
  zCache.clear();
}

async function federated(cfg: ZetarisConfig, sql: string): Promise<unknown[]> {
  const key = `${cfg.restUrl}\n${sql}`;
  const hit = zCache.get(key);
  if (hit && Date.now() - hit.at < Z_CACHE_MS) return hit.data;
  let data: unknown[];
  try {
    data = await runZetarisSql(cfg, sql);
  } catch (e) {
    if (!/SparkException|HiveSQLException|HTTP 5\d\d|timeout|aborted/i.test(e instanceof Error ? e.message : String(e))) throw e;
    await new Promise((r) => setTimeout(r, 1500));
    data = await runZetarisSql(cfg, sql);
  }
  zCache.set(key, { at: Date.now(), data });
  return data;
}

/**
 * Builds the evidence snapshot for a file. Zetaris answers when it is configured
 * and reachable; otherwise the offline mirror answers and the snapshot says so.
 * Weather is fetched directly in both cases for the TAF (the Zetaris REST table
 * carries the METAR), and the snapshot records which source answered.
 */
export async function loadEvidence(
  shipmentId: string,
  opts: { zetaris?: ZetarisConfig | null; fetchImpl?: typeof fetch; now?: number; offline?: boolean } = {},
): Promise<EvidenceSnapshot | undefined> {
  const legs: Leg[] = LEGS[shipmentId] ?? [];
  if (!legs.length) return undefined;
  const sql = zetarisSql(legs);
  const fetchedAt = new Date(opts.now ?? Date.now()).toISOString();

  let weather: StationWeather[] = [];
  let weatherSource: EvidenceSnapshot["weather_source"] = "unavailable";
  if (!opts.offline) {
    try {
      weather = await fetchStationWeather(stationsFor(shipmentId), { fetchImpl: opts.fetchImpl, now: opts.now });
      weatherSource = "aviationweather.gov";
    } catch {
      weather = [];
    }
  }

  const mirror = mirrorAggregate(legs);
  if (opts.zetaris && !opts.offline) {
    try {
      const { rows, metar } = parseZetarisRows(await federated(opts.zetaris, sql));
      // The METAR seen through Zetaris replaces the direct one, so the flight
      // category used for the join is the federated one.
      for (const w of weather) {
        const z = metar[w.station];
        if (z?.cat) {
          w.metar_category = z.cat as Wx;
          w.metar = z.raw ?? w.metar;
        }
      }
      return {
        backend: "zetaris",
        backend_note: aggKey(rows) === aggKey(mirror) ? "reconciled with the offline mirror: identical aggregates" : "DIFFERS from the offline mirror",
        sql,
        fetched_at: fetchedAt,
        rows,
        weather,
        weather_source: weatherSource,
      };
    } catch (e) {
      return {
        backend: "mirror",
        backend_note: `Zetaris unavailable (${e instanceof Error ? e.message.slice(0, 300) : "error"}); offline mirror answered`,
        sql,
        fetched_at: fetchedAt,
        rows: mirror,
        weather,
        weather_source: weatherSource,
      };
    }
  }
  return {
    backend: "mirror",
    backend_note: opts.zetaris ? "offline run" : "ZETARIS_REST_URL not set; offline mirror answered",
    sql,
    fetched_at: fetchedAt,
    rows: mirror,
    weather,
    weather_source: weatherSource,
  };
}
