/**
 * Tests for the agent core. The live loop is exercised against a scripted
 * OpenAI-compatible responder (no network) so the protocol, the verifier
 * round-trip and the fallback are covered without a Nebius key.
 * Nothing here claims to be Nemotron output.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SHIPMENTS } from "../src/lib/cargo/engine";
import { isValidAwb } from "../src/lib/agent/awb";
import { runLiveAgent, runRulesAgent } from "../src/lib/agent/agent";
import { scenarioKey } from "../src/lib/agent/key";
import { buildContext, executeTool } from "../src/lib/agent/tools";
import { verifyDecision } from "../src/lib/agent/verifier";
import type { Decision, Scenario } from "../src/lib/agent/types";

const HERO: Scenario = { shipmentId: "s615", delayMin: 90, flags: {}, locale: "en" };

test("every AWB in the simulated network has a valid IATA check digit", () => {
  for (const s of SHIPMENTS) assert.ok(isValidAwb(s.awb), `${s.awb} fails mod-7`);
  assert.ok(isValidAwb("057-66219005"));
  assert.equal(isValidAwb("615-12345678"), false);
});

test("tool outputs never leak the rules engine's recommendation", () => {
  for (const s of SHIPMENTS) {
    const ctx = buildContext({ shipmentId: s.id, delayMin: s.baseDelay, flags: {}, locale: "en" });
    const out = JSON.stringify(executeTool("find_alternatives", { awb: s.awb }, ctx));
    assert.equal(out.includes("recommended"), false, s.id);
  }
});

test("rules agent passes its own verifier on every scenario in both languages", async () => {
  for (const locale of ["en", "fr"] as const)
    for (const s of SHIPMENTS)
      for (const delayMin of s.usesDelay ? [0, 30, 60, s.baseDelay, 120, 180] : [0]) {
        const run = await runRulesAgent({ shipmentId: s.id, delayMin, flags: {}, locale });
        const failed = run.verdict.checks.filter((c) => !c.pass);
        assert.equal(failed.length, 0, `${locale} ${s.id} +${delayMin}: ${JSON.stringify(failed)}`);
      }
});

test("verifier rejects invented figures, references, probabilities and blocked picks", () => {
  const ctx = buildContext(HERO);
  const tools = ["get_shipment", "get_disruption", "get_cutoffs", "check_connection", "get_capacity", "check_restrictions", "calculate_risk", "find_alternatives"];
  const outs = tools.map((t) => JSON.stringify(executeTool(t, { awb: ctx.shipment.awb }, ctx)));
  const good: Decision = {
    risk: "high",
    recommended_option_id: "zrh",
    ranking: ["zrh", "fra", "later"],
    summary: "RFS 1840 reaches LEJ at 19:45, 30 min after the 19:15 handling deadline.",
    why: ["AYC 7842 has 410 kg free against 780 kg — 370 kg short.", "ZRH: +4 h, +CHF 180."],
  };
  const failing = (d: Decision) => verifyDecision(d, ctx, tools, outs).filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(failing(good), []);
  assert.deepEqual(failing({ ...good, summary: "ETA 19:52." }), ["figures"]);
  assert.deepEqual(failing({ ...good, why: ["85% chance to miss"] }), ["figures"]);
  assert.deepEqual(failing({ ...good, why: ["AYC 9999 has room"] }), ["refs"]);
  assert.deepEqual(failing({ ...good, why: ["ZRH costs CHF 250"] }), ["figures"]);
  assert.deepEqual(failing({ ...good, risk: "critical" }), ["risk"]);
  assert.deepEqual(failing({ ...good, recommended_option_id: "next", ranking: ["next"] }), ["allowed", "ranking"]);
  assert.deepEqual(verifyDecision(good, ctx, ["get_shipment"], outs).filter((c) => !c.pass).map((c) => c.id), ["tools"]);
});

test("verifier checks reply language and customer note", () => {
  const sc: Scenario = { ...HERO, locale: "fr", operatorMessage: "Le camion est en retard. On fait quoi ?" };
  const ctx = buildContext(sc);
  const tools = ["calculate_risk", "find_alternatives", "check_connection"];
  const outs = tools.map((t) => JSON.stringify(executeTool(t, { awb: ctx.shipment.awb }, ctx)));
  const base = {
    risk: "high" as const,
    recommended_option_id: "zrh",
    ranking: ["zrh"],
    summary: "x",
    why: [],
  };
  const ids = (d: object) => verifyDecision(d as never, ctx, tools, outs).filter((c) => !c.pass).map((c) => c.id);
  assert.deepEqual(ids({ ...base, reply: "The truck is late and the flight is gone, we rebook the cargo via ZRH." }), ["reply"]);
  assert.deepEqual(ids({ ...base, reply: "Le camion est en retard, on passe le fret par ZRH pour le vol du soir." }), []);
  assert.deepEqual(ids({ ...base, reply: "Le fret passe par ZRH et le camion est en retard.", customer_note: "Votre envoi part par ZRH, le vol est confirmé pour le fret." }), ["customer"]);
});

// --- scripted OpenAI-compatible responder ---------------------------------

type Turn = { tool_calls?: { name: string; args: unknown }[]; content?: string };
function scripted(turns: Turn[]) {
  const seen: unknown[] = [];
  let i = 0;
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    seen.push(JSON.parse(init.body));
    const t = turns[Math.min(i++, turns.length - 1)];
    const message = {
      role: "assistant",
      content: t.content ?? null,
      reasoning_content: "scripted",
      tool_calls: t.tool_calls?.map((c, k) => ({
        id: `call_${i}_${k}`,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.args) },
      })),
    };
    return new Response(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 100, completion_tokens: 20 } }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

const AWB = { awb: "615-12345675" };
const GOOD = {
  risk: "high",
  recommended_option_id: "zrh",
  ranking: ["zrh", "fra", "later"],
  summary: "RFS 1840 reaches LEJ at 19:45, 30 min after the 19:15 deadline. Rebook via ZRH.",
  why: ["AYC 7842: 410 kg free for 780 kg.", "ZRH: +4 h, +CHF 180."],
  customer_note: "Votre envoi 615-12345675 est réacheminé via ZRH. Nouvelle arrivée le 15 Oct 13:10 LT DEL, pour un coût de +CHF 180.",
};

test("live loop: tools → bad decision sent back → corrected decision accepted", async () => {
  const { fetchImpl, seen } = scripted([
    { tool_calls: [{ name: "get_shipment", args: AWB }, { name: "calculate_risk", args: AWB }] },
    { tool_calls: [{ name: "check_connection", args: AWB }, { name: "find_alternatives", args: AWB }] },
    { tool_calls: [{ name: "submit_decision", args: { ...GOOD, why: ["AYC 9999 has room, 85% safer"] } }] },
    { tool_calls: [{ name: "submit_decision", args: GOOD }] },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.mode, "live");
  assert.equal(run.verdict.accepted, true);
  assert.equal(run.verdict.fellBack, false);
  assert.equal(run.verdict.attempts, 2);
  assert.equal(run.decision.recommended_option_id, "zrh");
  assert.equal(run.baseline.agrees, true);
  assert.equal(run.promptTokens, 400);
  const verifies = run.steps.filter((s) => s.kind === "verify");
  assert.equal(verifies.length, 2);
  // The rejected submission is kept in the trace, not just the verdict.
  const rejected = verifies[0];
  assert.ok(rejected.kind === "verify" && rejected.submitted && "why" in rejected.submitted);
  assert.match(JSON.stringify(rejected.kind === "verify" ? rejected.submitted : null), /AYC 9999/);
  // The failure feedback reached the model as a tool message.
  const last = seen[3] as { messages: { role: string; content: string }[] };
  const fb = last.messages.filter((m) => m.role === "tool").pop()!;
  assert.match(fb.content, /AYC 9999/);
  assert.match(fb.content, /85%/);
  // Request shape: tools + tool_choice + model id.
  const first = seen[0] as { model: string; tools: unknown[]; tool_choice: string };
  assert.equal(first.model, "nvidia/nemotron-3-super-120b-a12b");
  assert.equal(first.tool_choice, "auto");
  assert.equal(first.tools.length, 9);
});

test("live loop: submitting before reading the options is refused", async () => {
  const { fetchImpl } = scripted([
    { tool_calls: [{ name: "submit_decision", args: GOOD }] },
    { tool_calls: [{ name: "calculate_risk", args: AWB }, { name: "find_alternatives", args: AWB }] },
    { tool_calls: [{ name: "submit_decision", args: GOOD }] },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.verdict.accepted, true);
  assert.equal(run.verdict.attempts, 2);
});

test("live loop: three bad decisions → rules fallback, clearly flagged", async () => {
  const bad = { ...GOOD, recommended_option_id: "next", ranking: ["next"] };
  const { fetchImpl } = scripted([
    { tool_calls: [{ name: "calculate_risk", args: AWB }, { name: "find_alternatives", args: AWB }] },
    { tool_calls: [{ name: "submit_decision", args: bad }] },
    { tool_calls: [{ name: "submit_decision", args: bad }] },
    { tool_calls: [{ name: "submit_decision", args: bad }] },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.verdict.accepted, false);
  assert.equal(run.verdict.fellBack, true);
  assert.equal(run.verdict.attempts, 3);
  assert.equal(run.decision.recommended_option_id, "zrh");
});

test("live loop: decision returned as plain text JSON is still verified", async () => {
  const { fetchImpl } = scripted([
    { tool_calls: [{ name: "calculate_risk", args: AWB }, { name: "find_alternatives", args: AWB }] },
    { content: `Here is my decision: ${JSON.stringify(GOOD)}` },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.verdict.accepted, true);
});

test("live loop: API failure falls back to rules with a note", async () => {
  const fetchImpl = (async () => new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
  const run = await runLiveAgent(HERO, { apiKey: "bad", fetchImpl });
  assert.equal(run.verdict.fellBack, true);
  assert.ok(run.steps.some((s) => s.kind === "note" && /401/.test(s.text)));
});

test("scenario keys are stable and message-sensitive", () => {
  assert.equal(scenarioKey(HERO), "s615|d90|-|en|-");
  assert.notEqual(scenarioKey({ ...HERO, operatorMessage: "why" }), scenarioKey(HERO));
  assert.equal(scenarioKey({ ...HERO, flags: { dropTall: false } }), scenarioKey(HERO));
});

// --- regressions from the independent review -------------------------------

test("verifier: piece counts, French clock times, quoted-only delays and costs", () => {
  const ids = (sc: Scenario, prose: string, rec: string, risk: Decision["risk"]) => {
    const ctx = buildContext(sc);
    const tools = ["get_shipment", "get_disruption", "get_cutoffs", "check_connection", "get_capacity", "check_restrictions", "calculate_risk", "find_alternatives"];
    const outs = tools.map((t) => JSON.stringify(executeTool(t, { awb: ctx.shipment.awb }, ctx)));
    const d: Decision = { risk, recommended_option_id: rec, ranking: [rec], summary: prose, why: [] };
    return verifyDecision(d, ctx, tools, outs).filter((c) => !c.pass).map((c) => `${c.id}:${c.detail ?? ""}`);
  };
  const dims: Scenario = { shipmentId: "s020", delayMin: 0, flags: {}, locale: "en" };
  assert.deepEqual(ids(dims, "5 pieces fit the belly; piece 3 goes main deck.", "main", "critical"), []);
  assert.equal(ids(dims, "9 pieces fit the belly.", "main", "critical").length, 1);
  const hero: Scenario = { shipmentId: "s615", delayMin: 90, flags: {}, locale: "en" };
  assert.deepEqual(ids(hero, "Le camion arrive à 19 h 45, besoin pour 19 h 15.", "zrh", "high"), []);
  assert.equal(ids(hero, "Le camion arrive à 19 h 52.", "zrh", "high").length, 1);
  assert.equal(ids(hero, "Via ZRH: +5 h.", "zrh", "high").length, 1);
  assert.equal(ids(hero, "Via ZRH for CHF 270.", "zrh", "high").length, 1);
  assert.deepEqual(ids(hero, "Via ZRH: +4 h, +CHF 180; AYC 7842 is 370 kg short.", "zrh", "high"), []);
});

test("live loop: facts in the same batch are run before the decision is judged", async () => {
  const { fetchImpl } = scripted([
    {
      tool_calls: [
        { name: "submit_decision", args: GOOD },
        { name: "calculate_risk", args: AWB },
        { name: "find_alternatives", args: AWB },
        { name: "get_disruption", args: AWB },
        { name: "check_connection", args: AWB },
      ],
    },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.verdict.accepted, true);
  assert.equal(run.verdict.attempts, 1);
});

test("live loop: a second submit after acceptance is ignored", async () => {
  const bad = { ...GOOD, recommended_option_id: "next", ranking: ["next"] };
  const { fetchImpl } = scripted([
    { tool_calls: [{ name: "calculate_risk", args: AWB }, { name: "find_alternatives", args: AWB }, { name: "check_connection", args: AWB }, { name: "get_disruption", args: AWB }] },
    { tool_calls: [{ name: "submit_decision", args: GOOD }, { name: "submit_decision", args: bad }] },
  ]);
  const run = await runLiveAgent(HERO, { apiKey: "test", fetchImpl });
  assert.equal(run.verdict.accepted, true);
  assert.equal(run.decision.recommended_option_id, "zrh");
  assert.ok(run.verdict.checks.every((c) => c.pass));
});

test("decision coercion: option ids arrive as '[keep]', \"'zrh'\" or 'zrh, fra'", async () => {
  const { coerceDecision } = await import("../src/lib/agent/verifier");
  const d = coerceDecision({ risk: "High", recommended_option_id: "'zrh'", ranking: "[\"zrh\", \"fra\"]", summary: "s", why: "w" }).decision!;
  assert.equal(d.risk, "high");
  assert.equal(d.recommended_option_id, "zrh");
  assert.deepEqual(d.ranking, ["zrh", "fra"]);
  assert.deepEqual(d.why, ["w"]);
  assert.deepEqual(coerceDecision({ risk: "ok", recommended_option_id: "keep", ranking: ["[keep]"], summary: "", why: [] }).decision!.ranking, ["keep"]);
  assert.match(coerceDecision({ risk: "Low", recommended_option_id: "zrh", ranking: [], summary: "", why: [] }).error!, /Low/);
});
