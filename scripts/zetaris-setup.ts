/**
 * Zetaris setup + check over the REST SQL API (one statement per call).
 *
 *   npm run zetaris:setup   registers the Postgres datasource, the METAR REST
 *                           table and the SchemaStore view from
 *                           zetaris/02_zetaris_setup.sql (idempotent: "already
 *                           exists" counts as done)
 *   npm run zetaris:check   runs the federated query CargoPilot sends for every
 *                           file with station evidence and compares the answer
 *                           with the offline mirror, aggregate by aggregate
 *
 * Reads .env (ZETARIS_REST_URL, ZETARIS_API_KEY, ZETARIS_ORG_ID) and .env.ops
 * (OPS_PG_PASSWORD; OPS_PG_JDBC_URL and OPS_PG_USER optional). Never prints a
 * credential: the datasource statement is echoed with the password masked.
 */
import { readFileSync } from "node:fs";
import { LEGS, aggKey, mirrorAggregate, zetarisSql } from "../src/lib/ops/evidence";
import { parseZetarisRows, runZetarisSql, zetarisConfigFromEnv } from "../src/lib/ops/zetaris";

for (const f of [".env", ".env.ops"]) {
  try {
    process.loadEnvFile(f);
  } catch {
    /* optional */
  }
}

const cfg = zetarisConfigFromEnv();
if (!cfg) {
  console.error("Set ZETARIS_REST_URL and ZETARIS_API_KEY in .env (see .env.example).");
  process.exit(2);
}

function statements(): string[] {
  const text = readFileSync("zetaris/02_zetaris_setup.sql", "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  return text
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fill(sql: string): string {
  const pw = process.env.OPS_PG_PASSWORD?.trim();
  if (sql.includes("<password>") && !pw) throw new Error("OPS_PG_PASSWORD missing (.env.ops)");
  return sql
    .replace('"jdbc:postgresql://<neon-host>/<database>?sslmode=require"', `"${process.env.OPS_PG_JDBC_URL?.trim() || "jdbc:postgresql://cargopilot-ops:5432/cargopilot_ops"}"`)
    .replace('"<read-only user>"', `"${process.env.OPS_PG_USER?.trim() || "ops"}"`)
    .replace('"<password>"', `"${pw ?? ""}"`);
}

const mask = (s: string) => s.replace(/password\s+"[^"]*"/i, 'password "****"');
const head = (s: string) => mask(s).replace(/\s+/g, " ").slice(0, 110);

async function setup() {
  // Setup statements only: the SELECTs at the end of the file are for `check`.
  const todo = statements().filter((s) => !/^SELECT/i.test(s));
  let failed = 0;
  for (const raw of todo) {
    const sql = fill(raw);
    try {
      await runZetarisSql(cfg!, sql, 10, false);
      console.log(`  OK    ${head(sql)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exist/i.test(msg)) console.log(`  OK    ${head(sql)}  (already exists)`);
      else {
        failed++;
        console.log(`  FAIL  ${head(sql)}\n        ${mask(msg).slice(0, 400)}`);
      }
    }
  }
  console.log(failed ? `\n${failed} statement(s) failed.` : "\nZetaris setup complete. Next: npm run zetaris:check");
  process.exit(failed ? 1 : 0);
}

async function check() {
  let bad = 0;
  const metarRows = await runZetarisSql(cfg!, "SELECT icao, fltcat, rawob FROM cargo_wx.metar_now", 20);
  console.log(`cargo_wx.metar_now (live REST table): ${metarRows.length} stations`);
  for (const r of metarRows) console.log(`  ${JSON.stringify(r).slice(0, 140)}`);
  for (const [id, legs] of Object.entries(LEGS)) {
    const t0 = Date.now();
    const { rows } = parseZetarisRows(await runZetarisSql(cfg!, zetarisSql(legs), 500));
    const same = aggKey(rows) === aggKey(mirrorAggregate(legs));
    if (!same) bad++;
    console.log(`  ${same ? "MATCH" : "DIFF "}  ${id}  ${rows.length} aggregate rows  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!same) {
      console.log("    zetaris:", aggKey(rows).slice(0, 300));
      console.log("    mirror: ", aggKey(mirrorAggregate(legs)).slice(0, 300));
    }
  }
  console.log(bad ? `\n${bad} file(s) differ from the mirror.` : "\nZetaris answers equal the offline mirror for every file.");
  process.exit(bad ? 1 : 0);
}

/** Runs each source on its own and the join, printing full errors: tells a REST failure from a Postgres one. */
async function diagnose() {
  const probes: [string, string][] = [
    ["engine", "SELECT 1 AS one"],
    ["postgres (ops_pg)", "SELECT count(*) AS n FROM ops_pg.handling_history"],
    ["REST raw (cargowx_rest.metar_geojson)", "SELECT type FROM cargowx_rest.metar_geojson"],
    ["REST view (cargo_wx.metar_now)", "SELECT icao, fltcat FROM cargo_wx.metar_now"],
    ["federated join (s615)", zetarisSql(LEGS.s615)],
  ];
  for (const [name, sql] of probes) {
    const t0 = Date.now();
    try {
      const rows = await runZetarisSql(cfg!, sql, 50);
      console.log(`  OK    ${name}  ${rows.length} rows  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    } catch (e) {
      const msg = mask(e instanceof Error ? e.message : String(e));
      // The root cause sits after "Caused by" / "most recent failure"; print it whole.
      console.log(`  FAIL  ${name}  ${((Date.now() - t0) / 1000).toFixed(1)} s\n${msg.replace(/\\n/g, "\n").slice(0, 1800)}\n`);
    }
  }
}

/** Drops the weather view and REST table (schema is inferred at CREATE), then runs setup again. */
async function rewire() {
  for (const sql of ["DROP SCHEMASTORE VIEW metar_now FROM cargo_wx", "DROP LIGHTNING DATABASE TABLE cargowx_rest.metar_geojson"]) {
    try {
      await runZetarisSql(cfg!, sql, 10, false);
      console.log(`  OK    ${sql}`);
    } catch (e) {
      console.log(`  SKIP  ${sql}  (${(e instanceof Error ? e.message : String(e)).slice(0, 160)})`);
    }
  }
  await setup();
}

const mode = process.argv[2];
(mode === "check" ? check : mode === "diagnose" ? diagnose : mode === "rewire" ? rewire : setup)().catch((e) => {
  console.error(mask(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
