// Weather adapter for the Zetaris REST table: live METAR from aviationweather.gov,
// reduced to the four fields CargoPilot joins on, every value a string.
//
// Why it exists: a Zetaris Lightning REST table infers its JSON schema once, at
// CREATE time. aviationweather.gov's `wdir` is a number most of the time but
// the string "VRB" in light winds (and `ceil`, `wgst` flip between null and a
// number). The table was created while Geneva reported VRB, so the column was
// typed string; an hour later every station reported a number and every query
// failed with "The value (170) of the type (java.lang.Long) cannot be converted
// to the string type". Pinning the shape here keeps the federated query stable.
//
// Same live data, same GeoJSON layout the SchemaStore view reads. Zero deps:
//   docker run -d --name cargopilot-wx --restart unless-stopped --network zetaris_default \
//     -v "$PWD/scripts/wx-adapter.mjs:/app/wx-adapter.mjs:ro" node:22-alpine node /app/wx-adapter.mjs
// Zetaris then reads http://cargopilot-wx:8787/metar
import { createServer } from "node:http";

const STATIONS = (process.env.WX_STATIONS ?? "LSGG,EDDP,LSZH,EDDF,LFPG").split(",");
const PORT = Number(process.env.PORT ?? 8787);
const TTL_MS = 60_000; // be polite to aviationweather.gov: at most one fetch a minute
let cache = { at: 0, body: "" };

const str = (v) => (v === null || v === undefined ? "" : String(v));

async function metar() {
  if (cache.body && Date.now() - cache.at < TTL_MS) return cache.body;
  const url = `https://aviationweather.gov/api/data/metar?ids=${STATIONS.join(",")}&format=geojson`;
  const res = await fetch(url, {
    headers: { "user-agent": "cargopilot-wx-adapter (github.com/Makabeez/cargopilot)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`aviationweather ${res.status}`);
  const src = await res.json();
  const features = (src.features ?? []).map((f) => ({
    type: "Feature",
    properties: {
      id: str(f.properties?.id),
      fltcat: str(f.properties?.fltcat),
      obsTime: str(f.properties?.obsTime),
      rawOb: str(f.properties?.rawOb),
    },
  }));
  cache = { at: Date.now(), body: JSON.stringify({ type: "FeatureCollection", features }) };
  return cache.body;
}

createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/metar")) {
      const body = await metar();
      res.writeHead(200, { "content-type": "application/json" }).end(body);
    } else if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    } else {
      res.writeHead(404).end();
    }
  } catch (e) {
    // Serve the last good answer rather than nothing; Zetaris then still has a typed table.
    if (cache.body) res.writeHead(200, { "content-type": "application/json", "x-stale": "1" }).end(cache.body);
    else res.writeHead(502, { "content-type": "text/plain" }).end(String(e?.message ?? e));
  }
}).listen(PORT, "0.0.0.0", () => console.log(`wx-adapter on :${PORT} for ${STATIONS.join(",")}`));
