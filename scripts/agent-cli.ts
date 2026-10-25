/**
 * CargoPilot agent CLI.
 *
 *   npm run judge-demo     no key, no network, ~5 s. Validates AWBs, runs the
 *                          rules agent on every UI-reachable scenario through
 *                          the verifier, re-verifies every recorded Nemotron
 *                          trace against freshly computed tool outputs, prints
 *                          the eval headline.
 *   npm run agent:models   lists the Nemotron model ids your key can call.
 *   npm run agent:record   runs Nemotron live on the eval matrix, saves every
 *                          run to data/traces/, then writes the eval report.
 *   npm run agent:eval     rebuilds data/eval/report.{json,md} from data/traces/.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, renameSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { SHIPMENTS } from "../src/lib/cargo/engine";
import { isValidAwb } from "../src/lib/agent/awb";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, blockedRun, groundingFor, runLiveAgent, runRulesAgent } from "../src/lib/agent/agent";
import { evalMatrix, evalMatrixV5, fullRulesMatrix } from "../src/lib/agent/matrix";
import { adverseConditions, gatherContext, screenNotes } from "../src/lib/agent/context";
import { LEGS, aggKey, mirrorAggregate, stationCategories } from "../src/lib/ops/evidence";
import { zetarisConfigFromEnv } from "../src/lib/ops/zetaris";
import { recallFor, seedMemory, HANDOVER_NOTES, RECALL_THRESHOLD } from "../src/lib/memory/desk-memory";
import { Scout } from "../src/lib/guard/scout";
import { createHash } from "node:crypto";
import { buildContext, executeTool } from "../src/lib/agent/tools";
import { verifyDecision } from "../src/lib/agent/verifier";
import type { AgentRun, ToolStep } from "../src/lib/agent/types";

try {
  process.loadEnvFile(".env");
} catch {
  /* optional */
}

const TRACES = "data/traces";
const EVAL = "data/eval";
const HISTORY = "data/eval/history";
const cfg = {
  apiKey: process.env.NEBIUS_API_KEY?.trim() ?? "",
  baseUrl: process.env.NEBIUS_BASE_URL?.trim() || DEFAULT_BASE_URL,
  model: process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL,
  temperature: process.env.AGENT_TEMPERATURE ? Number(process.env.AGENT_TEMPERATURE) : undefined,
  extraBody: process.env.NEBIUS_EXTRA_BODY ? (JSON.parse(process.env.NEBIUS_EXTRA_BODY) as Record<string, unknown>) : undefined,
};
// Listed price for Nemotron 3 Super on Nebius (USD per 1M tokens). Override if your invoice differs.
const PRICE_IN = Number(process.env.PRICE_IN_PER_M ?? 0.3);
const PRICE_OUT = Number(process.env.PRICE_OUT_PER_M ?? 0.9);

const ok = (b: boolean) => (b ? "PASS" : "FAIL");
const fileFor = (key: string) => join(TRACES, key.replace(/[^a-z0-9+-]+/gi, "_") + ".json");

function loadTraces(dir = TRACES): AgentRun[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as AgentRun);
}

function historyDirs(): string[] {
  if (!existsSync(HISTORY)) return [];
  return readdirSync(HISTORY)
    .map((d) => join(HISTORY, d))
    .filter((d) => existsSync(join(d, "traces")))
    .sort();
}

/** Move the current recording (traces + report) into data/eval/history/<label>/ before overwriting. */
function archiveCurrent(): string | null {
  const runs = loadTraces();
  if (!runs.length) return null;
  const pv = runs[0].promptVersion ?? "v1";
  const stamp = runs.map((r) => r.startedAt).sort()[0].slice(0, 16).replace(/[:T]/g, "-");
  const dest = join(HISTORY, `${stamp}-prompt-${pv}`);
  mkdirSync(join(dest, "traces"), { recursive: true });
  for (const f of readdirSync(TRACES).filter((f) => f.endsWith(".json"))) renameSync(join(TRACES, f), join(dest, "traces", f));
  for (const f of ["report.md", "report.json"]) if (existsSync(join(EVAL, f))) copyFileSync(join(EVAL, f), join(dest, f));
  return dest;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/**
 * Checks every recording must still pass. Archived runs are re-verified with the
 * checks that existed when they were recorded (newer checks such as "language"
 * apply from prompt v4 on), so history stays reproducible as the verifier grows.
 */
const promptNum = (r: AgentRun) => Number((r.promptVersion ?? "v1").replace(/\D/g, "")) || 1;
const CORE_CHECKS = new Set(["tools", "option", "allowed", "ranking", "risk", "figures", "refs", "reply", "customer"]);

/** Re-check a recorded decision against tool outputs recomputed from scratch. */
function reverify(run: AgentRun, coreOnly = false) {
  const ctx = buildContext(run.scenario, run.external);
  const toolSteps = run.steps.filter((s): s is ToolStep => s.kind === "tool" && !s.error);
  const called = toolSteps.map((s) => s.name);
  const fresh = toolSteps.map((s) => JSON.stringify(executeTool(s.name, s.args, ctx)));
  const recorded = toolSteps.map((s) => JSON.stringify(s.output));
  const outputsMatch = fresh.every((f, i) => f === recorded[i]);
  const all = verifyDecision(run.decision, ctx, called, groundingFor(run.scenario, fresh));
  const checks = coreOnly ? all.filter((c) => CORE_CHECKS.has(c.id)) : all;
  return { outputsMatch, checks, pass: checks.every((c) => c.pass) };
}

/**
 * v5 integrity: what a recorded run says Zetaris and H-MEM returned must be
 * re-derivable offline. Zetaris aggregates must equal the mirror over the
 * pinned CSV; the H-MEM recall must equal a fresh recall from the seed notes,
 * the recorded operator notes and the recorded weather.
 */
async function reverifyExternal(run: AgentRun): Promise<string[]> {
  const ext = run.external;
  const problems: string[] = [];
  if (!ext) return problems;
  if (ext.evidence) {
    const legs = LEGS[run.scenario.shipmentId] ?? [];
    if (aggKey(ext.evidence.rows) !== aggKey(mirrorAggregate(legs))) problems.push(`${ext.evidence.backend} aggregates differ from the mirror`);
  }
  if (ext.memory) {
    const conditions = adverseConditions(stationCategories(run.scenario.shipmentId, ext.evidence, run.scenario.wx ?? {}));
    const fresh = await recallFor(run.scenario.shipmentId, screenNotes(run.scenario.memoryNotes).accepted, conditions);
    if (JSON.stringify(fresh.recalled) !== JSON.stringify(ext.memory.recalled)) problems.push("H-MEM recall differs from a fresh recall");
  }
  return problems;
}

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
/** Pinned: the CSV every Zetaris answer is checked against. Regenerate with scripts/gen-ops-history.ts. */
const HISTORY_CSV_SHA256 = "57034758e754ed6fd9255fda273c59e94bdeb2cde1bb63f42b07011014907ea2";

/** Hand-labelled: which seed notes are relevant to which file (for recall precision/recall). */
const MEMORY_TRUTH: Record<string, string[]> = {
  s615: ["mem-1", "mem-3", "mem-4"],
  s172: ["mem-5"],
  s074: ["mem-6"],
  s125: ["mem-7"],
  s131: ["mem-8"],
  s157: ["mem-9"],
  s080: ["mem-10"],
  s176: ["mem-11"],
  s020: [],
  s235: [],
};

async function scoutScore(path: string) {
  const scout = new Scout();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const line of readFileSync(path, "utf8").trim().split("\n")) {
    const ex = JSON.parse(line) as { prompt: string; expected: { injection?: boolean } };
    if (ex.expected.injection === undefined) continue;
    const blocked = (await scout.decide({ prompt: ex.prompt })).risk.level === "block";
    if (ex.expected.injection) {
      if (blocked) tp++;
      else fn++;
    } else if (blocked) fp++;
    else tn++;
  }
  return { tp, fp, fn, tn, precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1 };
}

function pct(n: number, d: number) {
  return d ? `${((100 * n) / d).toFixed(0)}%` : "—";
}

function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function buildReport(runs: AgentRun[]) {
  const live = runs.filter((r) => r.mode === "live");
  const firstTry = live.filter((r) => r.verdict.accepted && r.verdict.attempts === 1).length;
  const accepted = live.filter((r) => r.verdict.accepted).length;
  const agree = live.filter((r) => r.verdict.accepted && r.baseline.agrees).length;
  const lat = live.map((r) => r.latencyMs);
  const tin = live.reduce((a, r) => a + r.promptTokens, 0);
  const tout = live.reduce((a, r) => a + r.completionTokens, 0);
  const toolCalls = live.map((r) => r.steps.filter((s) => s.kind === "tool").length);
  const failedChecks = new Map<string, number>();
  for (const r of live)
    for (const s of r.steps)
      if (s.kind === "verify" && !s.accepted) for (const c of s.checks) if (!c.pass) failedChecks.set(c.id, (failedChecks.get(c.id) ?? 0) + 1);
  const models = [...new Set(live.map((r) => r.model))];
  const promptVersions = [...new Set(live.map((r) => r.promptVersion ?? "v1"))];
  const rejections = live.flatMap((r) =>
    r.steps
      .filter((s) => s.kind === "verify" && !s.accepted)
      .map((s) => ({
        key: r.scenarioKey,
        operatorMessage: r.scenario.operatorMessage ?? null,
        attempt: s.kind === "verify" ? s.attempt : 0,
        failures: s.kind === "verify" ? s.checks.filter((c) => !c.pass).map((c) => `${c.id}: ${c.detail ?? "failed"}`) : [],
      })),
  );
  return {
    generatedAt: new Date().toISOString(),
    models,
    promptVersions,
    scenarios: live.length,
    acceptedFirstTry: firstTry,
    acceptedAfterRetries: accepted,
    fellBackToRules: live.length - accepted,
    agreesWithRules: agree,
    latencyMs: { p50: quantile(lat, 0.5), p95: quantile(lat, 0.95) },
    toolCallsPerRun: { min: Math.min(...toolCalls), max: Math.max(...toolCalls), mean: toolCalls.reduce((a, b) => a + b, 0) / (toolCalls.length || 1) },
    tokens: { prompt: tin, completion: tout, usdAtListPrice: (tin * PRICE_IN + tout * PRICE_OUT) / 1e6 },
    rejectionsByCheck: Object.fromEntries(failedChecks),
    rejections,
    rows: live.map((r) => ({
      key: r.scenarioKey,
      awb: SHIPMENTS.find((s) => s.id === r.scenario.shipmentId)?.awb,
      operatorMessage: r.scenario.operatorMessage ?? null,
      attempts: r.verdict.attempts,
      accepted: r.verdict.accepted,
      fellBack: r.verdict.fellBack,
      pick: r.decision.recommended_option_id,
      rulesPick: r.baseline.recommended_option_id,
      agrees: r.baseline.agrees,
      latencyMs: r.latencyMs,
      toolCalls: r.steps.filter((s) => s.kind === "tool").length,
    })),
  };
}

function reportMarkdown(rep: ReturnType<typeof buildReport>) {
  const n = rep.scenarios;
  const lines = [
    "# CargoPilot agent eval",
    "",
    `Generated ${rep.generatedAt} from ${n} recorded live runs of ${rep.models.join(", ") || "—"} on Nebius Token Factory (prompt ${rep.promptVersions.join(", ")}).`,
    "Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Decision accepted by the verifier on first submission | ${rep.acceptedFirstTry}/${n} (${pct(rep.acceptedFirstTry, n)}) |`,
    `| Accepted after verifier feedback (≤3 submissions) | ${rep.acceptedAfterRetries}/${n} (${pct(rep.acceptedAfterRetries, n)}) |`,
    `| Fell back to rules engine | ${rep.fellBackToRules}/${n} |`,
    `| Verified pick = rules-engine pick | ${rep.agreesWithRules}/${rep.acceptedAfterRetries} (${pct(rep.agreesWithRules, rep.acceptedAfterRetries)}) |`,
    `| Latency p50 / p95 | ${(rep.latencyMs.p50 / 1000).toFixed(1)} s / ${(rep.latencyMs.p95 / 1000).toFixed(1)} s |`,
    `| Tool calls per run (min / mean / max) | ${rep.toolCallsPerRun.min} / ${rep.toolCallsPerRun.mean.toFixed(1)} / ${rep.toolCallsPerRun.max} |`,
    `| Tokens (prompt → completion) | ${rep.tokens.prompt.toLocaleString("en")} → ${rep.tokens.completion.toLocaleString("en")} |`,
    `| Cost at list price ($${PRICE_IN}/$${PRICE_OUT} per 1M) | $${rep.tokens.usdAtListPrice.toFixed(4)} |`,
    "",
    "## What the verifier sent back",
    "",
    Object.keys(rep.rejectionsByCheck).length
      ? Object.entries(rep.rejectionsByCheck)
          .map(([k, v]) => `- \`${k}\`: ${v} rejection(s)`)
          .join("\n")
      : "- Nothing: every submission passed on the first try.",
    "",
    ...(rep.rejections.length
      ? [
          "Each rejection, exactly as the verifier returned it to the model:",
          "",
          "| Scenario | Attempt | Failures |",
          "| --- | --- | --- |",
          ...rep.rejections.map(
            (x) =>
              `| \`${x.key}\`${x.operatorMessage ? ` “${x.operatorMessage}”` : ""} | ${x.attempt} | ${x.failures.join("<br>").replace(/\|/g, "\\|")} |`,
          ),
          "",
        ]
      : []),
    "## Where Nemotron and the rules engine disagree",
    "",
    "A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (protected cargo first, then risk → delay → cost) differs from the engine's fixed order.",
    "",
    "| Scenario | Nemotron | Rules |",
    "| --- | --- | --- |",
    ...rep.rows.filter((r) => r.accepted && !r.agrees).map((r) => `| \`${r.key}\` | ${r.pick} | ${r.rulesPick} |`),
    "",
    "## Every run",
    "",
    "| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rep.rows.map(
      (r) =>
        `| \`${r.key}\`${r.operatorMessage ? ` “${r.operatorMessage}”` : ""} | ${r.awb} | ${r.attempts} | ${r.fellBack ? "fallback" : "accepted"} | ${r.pick} | ${r.rulesPick} | ${r.toolCalls} | ${(r.latencyMs / 1000).toFixed(1)} s |`,
    ),
    "",
  ];
  return lines.join("\n");
}

function writeReport(runs: AgentRun[]) {
  const rep = buildReport(runs);
  mkdirSync(EVAL, { recursive: true });
  writeFileSync(join(EVAL, "report.json"), JSON.stringify(rep, null, 2));
  writeFileSync(join(EVAL, "report.md"), reportMarkdown(rep));
  return rep;
}

async function judge() {
  const t0 = Date.now();
  let failures = 0;
  console.log("CargoPilot judge demo — no API key, no network\n");

  const badAwb = SHIPMENTS.filter((s) => !isValidAwb(s.awb));
  console.log(`[1] AWB check digits (IATA mod 7) ............ ${ok(!badAwb.length)}  ${SHIPMENTS.length} AWBs`);
  failures += badAwb.length;

  const matrix = fullRulesMatrix();
  let rulesFail = 0;
  const leak = SHIPMENTS.some((s) => {
    const ctx = buildContext({ shipmentId: s.id, delayMin: s.baseDelay, flags: {}, locale: "en" });
    return JSON.stringify(executeTool("find_alternatives", { awb: s.awb }, ctx)).includes("recommended");
  });
  for (const sc of matrix) {
    const run = await runRulesAgent(sc);
    if (!run.verdict.accepted) {
      rulesFail++;
      console.log("    FAIL", run.scenarioKey, run.verdict.checks.filter((c) => !c.pass));
    }
  }
  console.log(`[2] Tools hide the engine's recommendation .... ${ok(!leak)}`);
  console.log(`[3] Rules agent through verifier .............. ${ok(!rulesFail)}  ${matrix.length - rulesFail}/${matrix.length} scenarios (every slider stop, chip, language)`);
  failures += rulesFail + (leak ? 1 : 0);

  const traces = loadTraces();
  if (!traces.length) {
    console.log(`[4] Recorded Nemotron traces ................. NONE  run \`npm run agent:record\` with NEBIUS_API_KEY to record`);
  } else {
    let bad = 0;
    let drift = 0;
    for (const t of traces) {
      const r = reverify(t, promptNum(t) < 4);
      if (!r.outputsMatch) drift++;
      // A recorded fallback run is honest data, not a tampering signal; only accepted ones must re-verify.
      if (t.verdict.accepted && !r.pass) {
        bad++;
        console.log("    FAIL", t.scenarioKey, r.checks.filter((c) => !c.pass));
      }
    }
    console.log(
      `[4] Recorded Nemotron traces re-verified ....... ${ok(!bad && !drift)}  ${traces.length} traces · ${[...new Set(traces.map((t) => t.model))].join(", ")}` +
        (drift ? ` · ${drift} with tool-output drift (engine changed since recording — re-record)` : ""),
    );
    failures += bad + drift;
    const rep = buildReport(traces);
    console.log(
      `    accepted first try ${rep.acceptedFirstTry}/${rep.scenarios} · after feedback ${rep.acceptedAfterRetries}/${rep.scenarios} · agrees with rules ${rep.agreesWithRules}/${rep.acceptedAfterRetries} · p50 ${(rep.latencyMs.p50 / 1000).toFixed(1)} s`,
    );
  }

  for (const dir of historyDirs()) {
    const hist = loadTraces(join(dir, "traces"));
    let bad = 0;
    for (const t of hist) {
      const r = reverify(t, promptNum(t) < 4);
      if (!r.outputsMatch || (t.verdict.accepted && !r.pass)) bad++;
    }
    const rep = buildReport(hist);
    console.log(
      `    history ${dir.split("/").pop()}: ${ok(!bad)} ${hist.length} traces re-verified · first try ${rep.acceptedFirstTry}/${rep.scenarios} · after feedback ${rep.acceptedAfterRetries}/${rep.scenarios}`,
    );
    failures += bad;
  }

  // ---- v5: Zetaris evidence, Meterless H-MEM memory, Meterless Scout guard (offline) ----
  console.log("");
  const csvOk = sha256("data/ops/handling_history.csv") === HISTORY_CSV_SHA256;
  console.log(`[5] Station history CSV pinned (SHA-256) ...... ${ok(csvOk)}  data/ops/handling_history.csv`);
  failures += csvOk ? 0 : 1;

  let v5Fail = 0;
  let flips = 0;
  const v5Scenarios = evalMatrixV5().filter((s) => !s.operatorMessage?.startsWith("Ignore"));
  for (const sc of v5Scenarios) {
    const { external } = await gatherContext(sc, { offline: true });
    const run = await runRulesAgent(sc, () => {}, external);
    if (!run.verdict.accepted) {
      v5Fail++;
      console.log("    FAIL", run.scenarioKey, run.verdict.checks.filter((c) => !c.pass));
    }
    const engineRec = buildContext(sc).analysis.options.find((o) => o.recommended)?.id;
    if (run.decision.recommended_option_id !== engineRec) flips++;
  }
  console.log(`[6] v5 rules agent with evidence + memory ...... ${ok(!v5Fail)}  ${v5Scenarios.length - v5Fail}/${v5Scenarios.length} scenarios · ${flips} where station evidence overrides keep-first`);
  failures += v5Fail;

  const v5Traces = traces.filter((t) => t.external);
  let extBad = 0;
  for (const t of v5Traces) {
    const problems = await reverifyExternal(t);
    if (problems.length) {
      extBad++;
      console.log("    FAIL", t.scenarioKey, problems);
    }
  }
  const zetarisRuns = v5Traces.filter((t) => t.external?.evidence?.backend === "zetaris").length;
  console.log(
    `[7] Recorded v5 context re-derived offline ...... ${v5Traces.length ? ok(!extBad) : "NONE"}  ${v5Traces.length} traces` +
      (v5Traces.length ? ` · ${zetarisRuns} answered by Zetaris, each checked against the mirror` : "  (record with npm run agent:record)"),
  );
  failures += extBad;

  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const s of SHIPMENTS) {
    const got = seedMemory()
      .query((await recallFor(s.id)).query, { topN: 4, threshold: RECALL_THRESHOLD })
      .memories.map((m) => m.memory.id);
    const want = MEMORY_TRUTH[s.id] ?? [];
    tp += got.filter((x) => want.includes(x)).length;
    fp += got.filter((x) => !want.includes(x)).length;
    fn += want.filter((x) => !got.includes(x)).length;
  }
  console.log(`[8] H-MEM recall, ${HANDOVER_NOTES.length} handover notes ......... INFO  precision ${(tp / (tp + fp)).toFixed(2)} · recall ${(tp / (tp + fn)).toFixed(2)} (${tp} relevant, ${fp} noise, ${fn} missed)`);

  const met = await scoutScore("tests/fixtures/meterless-scout-v1/adversarial.jsonl");
  const desk = await scoutScore("tests/fixtures/desk-guard.jsonl");
  const scoutOk = met.recall === 1 && met.precision === 1 && desk.fp === 0;
  console.log(`[9] Scout guard, Meterless injection set v1 .... ${ok(scoutOk)}  blocked ${met.tp}/${met.tp + met.fn} attacks · ${met.fp}/${met.fp + met.tn} benign blocked`);
  console.log(`    desk set (cargo attacks + desk phrasing) ... blocked ${desk.tp}/${desk.tp + desk.fn} attacks · ${desk.fp}/${desk.fp + desk.tn} benign blocked`);
  failures += scoutOk ? 0 : 1;

  console.log(`\n${failures ? "FAILED" : "ALL CHECKS PASSED"} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(failures ? 1 : 0);
}

async function models() {
  if (!cfg.apiKey) throw new Error("Set NEBIUS_API_KEY (env or .env).");
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/models`, { headers: { authorization: `Bearer ${cfg.apiKey}` } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { id: string }[] };
  const ids = json.data.map((m) => m.id);
  const nem = ids.filter((id) => /nemotron/i.test(id));
  console.log(`${ids.length} models on ${cfg.baseUrl}. Nemotron:`);
  for (const id of nem) console.log(`  ${id}${id === cfg.model ? "   ← NEBIUS_MODEL" : ""}`);
  if (!nem.includes(cfg.model)) console.log(`\n⚠ NEBIUS_MODEL="${cfg.model}" is not in this list. Set it to one of the ids above.`);
}

async function record() {
  if (!cfg.apiKey) throw new Error("Set NEBIUS_API_KEY (env or .env).");
  mkdirSync(TRACES, { recursive: true });
  // This build records prompt v5 (Zetaris evidence + H-MEM + Scout). RECORD_V4=1 records the Nebius build's matrix.
  const v5 = process.env.RECORD_V4 !== "1";
  const zcfg = zetarisConfigFromEnv();
  if (v5) console.log(zcfg ? `Station evidence via Zetaris at ${zcfg.restUrl}` : "ZETARIS_REST_URL not set: station evidence from the offline mirror");
  const matrix = v5 ? evalMatrixV5() : evalMatrix();
  const only = process.argv[3];
  const todo = only ? matrix.filter((s) => s.shipmentId === only) : matrix;
  if (!only) {
    const archived = archiveCurrent();
    if (archived) console.log(`Archived previous recording → ${archived}`);
  }
  console.log(`Recording ${todo.length} live runs with ${cfg.model} …`);
  const runs = await pool(todo, Number(process.env.RECORD_CONCURRENCY ?? 3), async (sc, i) => {
    let run: AgentRun;
    if (v5) {
      const pre = await gatherContext(sc, { scoutOnly: true });
      if (pre.blocked) run = blockedRun(sc, pre.external, pre.blocked.flags);
      else {
        const g = await gatherContext({ ...sc, operatorMessage: undefined }, { zetaris: zcfg });
        run = await runLiveAgent(sc, cfg, () => {}, undefined, { ...g.external, ...(pre.external.scout ? { scout: pre.external.scout } : {}) });
      }
    } else run = await runLiveAgent(sc, cfg);
    writeFileSync(fileFor(run.scenarioKey), JSON.stringify(run, null, 2));
    const tag = run.verdict.fellBack ? "FALLBACK" : run.verdict.attempts > 1 ? `ok after ${run.verdict.attempts}` : "ok";
    console.log(
      `  [${String(i + 1).padStart(2)}/${todo.length}] ${run.scenarioKey.padEnd(28)} ${tag.padEnd(12)} pick=${run.decision.recommended_option_id.padEnd(9)} rules=${run.baseline.recommended_option_id.padEnd(9)} ${(run.latencyMs / 1000).toFixed(1)} s`,
    );
    return run;
  });
  void runs;
  const rep = writeReport(loadTraces());
  console.log(`\nWrote ${TRACES}/ and ${EVAL}/report.md — accepted ${rep.acceptedAfterRetries}/${rep.scenarios}, first try ${rep.acceptedFirstTry}/${rep.scenarios}.`);
}

const cmd = process.argv[2];
const run = cmd === "judge" ? judge : cmd === "models" ? models : cmd === "record" ? record : cmd === "eval" ? async () => {
  const rep = writeReport(loadTraces());
  console.log(`Wrote ${EVAL}/report.md from ${rep.scenarios} traces.`);
} : null;
if (!run) {
  console.log("usage: tsx scripts/agent-cli.ts judge | models | record [shipmentId] | eval");
  process.exit(2);
}
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
