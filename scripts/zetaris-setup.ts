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

(process.argv[2] === "check" ? check : setup)().catch((e) => {
  console.error(mask(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
