/**
 * CargoPilot agent runner.
 *
 *  live   — NVIDIA Nemotron on Nebius Token Factory drives the loop: it picks
 *           which tools to call, reads the facts, ranks the options and
 *           submits a decision. The verifier checks the decision; failures go
 *           back to the model (max 3 submissions), then fall back to rules.
 *  replay — a recorded live run, served unchanged and labelled as a replay.
 *  rules  — no model call: the deterministic rules engine walks the same
 *           tools and decides. Used when there is no API key and no recording.
 */
import { L, SHIPMENTS, analyze, defaultFlags } from "../cargo/engine";
import { optionStatus, rulesChoice, TOOL_SCHEMAS, buildContext, executeTool, type ToolContext } from "./tools";
import { coerceDecision, verifyDecision } from "./verifier";
import type { AgentRun, Check, Decision, Scenario, Step, StepSink, ToolStep } from "./types";
import { scenarioKey } from "./key";
export { scenarioKey };

export const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
export const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const PROVIDER = "Nebius Token Factory";
/** Bump when the system/user prompt changes; recorded in every live run. */
export const PROMPT_VERSION = "v4";
const MAX_TURNS = 12;
const MAX_SUBMISSIONS = 3;
const DESK_CLOCK = "Wed 14 Oct 2026, 17:42 local time (GVA)";

// ---------------------------------------------------------------------------
// Rules agent (no model)
// ---------------------------------------------------------------------------

const RULES_TOOL_ORDER = [
  "get_shipment",
  "get_disruption",
  "get_cutoffs",
  "check_connection",
  "get_capacity",
  "check_restrictions",
  "calculate_risk",
  "find_alternatives",
] as const;

function localizedAnalysis(s: Scenario) {
  const shipment = SHIPMENTS.find((x) => x.id === s.shipmentId);
  if (!shipment) throw new Error(`Unknown shipment ${s.shipmentId}`);
  return analyze(shipment, defaultFlags(shipment, s.delayMin, s.flags), s.locale, null);
}

function rulesDecision(ctx: ToolContext): Decision {
  const { scenario } = ctx;
  // Same engine, prose in the operator's language.
  const localized = scenario.locale === "en" ? ctx.analysis : localizedAnalysis(scenario);
  const choice = rulesChoice(ctx);
  const pick = localized.options.find((o) => o.id === choice.recommended);
  return {
    risk: ctx.analysis.risk,
    recommended_option_id: choice.recommended,
    ranking: choice.ranking,
    summary: localized.narrative,
    why: pick ? [pick.reason] : [],
    reply: scenario.operatorMessage?.trim() ? localized.decision || localized.narrative : undefined,
  };
}

/** Everything a decision may quote from: this run's tool outputs plus what the desk told the model. */
export function groundingFor(scenario: Scenario, toolOutputs: string[]): string[] {
  return [
    ...toolOutputs,
    scenario.operatorMessage ?? "",
    scenario.priorDelayMin !== undefined
      ? `previous truck delay ${scenario.priorDelayMin} min, current truck delay ${scenario.delayMin} min`
      : "",
    DESK_CLOCK,
  ];
}

function groundingTexts(ctx: ToolContext, toolSteps: ToolStep[]): string[] {
  return groundingFor(ctx.scenario, toolSteps.map((t) => JSON.stringify(t.output)));
}

function baselineOf(ctx: ToolContext, decision: Decision) {
  const rec = rulesChoice(ctx).recommended;
  return { recommended_option_id: rec, risk: ctx.analysis.risk, agrees: decision.recommended_option_id === rec };
}

export async function runRulesAgent(scenario: Scenario, onStep: StepSink = () => {}): Promise<AgentRun> {
  const t0 = Date.now();
  const ctx = buildContext(scenario);
  const steps: Step[] = [];
  const emit = (s: Step) => {
    steps.push(s);
    onStep(s);
  };
  emit({
    kind: "note",
    text: L(
      scenario.locale,
      "Rules engine only — no model call. Set NEBIUS_API_KEY to let Nemotron drive this loop.",
      "Moteur de règles seul — aucun appel modèle. Renseigner NEBIUS_API_KEY pour que Nemotron pilote la boucle.",
    ),
  });
  const toolSteps: ToolStep[] = [];
  for (const name of RULES_TOOL_ORDER) {
    const s0 = Date.now();
    const args = { awb: ctx.shipment.awb };
    const output = executeTool(name, args, ctx);
    const step: ToolStep = { kind: "tool", callId: `rules-${name}`, name, args, output, ms: Date.now() - s0 };
    toolSteps.push(step);
    emit(step);
  }
  const decision = rulesDecision(ctx);
  const checks = verifyDecision(decision, ctx, RULES_TOOL_ORDER.slice(), groundingTexts(ctx, toolSteps));
  const accepted = checks.every((c) => c.pass);
  emit({ kind: "verify", attempt: 1, accepted, checks, submitted: decision });
  return {
    version: 1,
    scenarioKey: scenarioKey(scenario),
    scenario,
    mode: "rules",
    model: "rules-engine",
    provider: "local",
    startedAt: new Date(t0).toISOString(),
    latencyMs: Date.now() - t0,
    promptTokens: 0,
    completionTokens: 0,
    steps,
    decision,
    verdict: { accepted, attempts: 1, fellBack: false, checks },
    baseline: baselineOf(ctx, decision),
  };
}

// ---------------------------------------------------------------------------
// Live agent (Nemotron on Nebius Token Factory)
// ---------------------------------------------------------------------------

export type LiveConfig = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Merged into every request body (e.g. reasoning toggles). */
  extraBody?: Record<string, unknown>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: RawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type RawToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

function systemPrompt(s: Scenario): string {
  const lang = s.locale === "fr" ? "French" : "English";
  return [
    "You are CargoPilot, the recovery agent on the evening shift of a Geneva (GVA) air-cargo control desk.",
    "The network you query is a simulation. Flights AYC xxx are aircraft, RFS xxxx are road-feeder trucks.",
    "",
    "Work the open file like a duty officer:",
    "1. Establish the facts with tools. Always call get_shipment, calculate_risk and find_alternatives; call get_disruption, get_cutoffs, check_connection, get_capacity and check_restrictions when they bear on the case.",
    "2. Decide, then call submit_decision exactly once with your decision.",
    "",
    "Hard rules (the verifier enforces them and will send your decision back):",
    "- Never recommend or rank an option whose status is 'blocked'.",
    "- risk must equal calculate_risk.risk.",
    "- Quote every time, weight, duration, size, temperature and cost exactly as a tool returned it. Only a difference of two tool figures in the same unit may be computed (e.g. 780 kg − 410 kg = 370 kg short); delays in hours and CHF costs must be quoted, never computed. No invented probabilities or percentages.",
    "- Only mention flights, trucks and AWBs that appear in tool outputs.",
    "",
    "Desk policy — keep first: if the booked plan (the option that keeps the current flight, usually 'Keep …') is allowed and rated Low or Medium, recommend keeping it. Do not spend hours and CHF on a reroute while the booking still holds. In why, state the exact trigger that would force a reroute, quoted from the tools (e.g. \"reroute if the truck ETA passes 19:15\"), and name the fallback option by its title.",
    "",
    "Only when the booked plan is blocked or rated High, rank the allowed alternatives in this order:",
    "  a) protect hard constraints and must-ride / priority cargo;",
    "  b) lowest risk of failing again (Low < Medium < High) — a High-risk plan that depends on an exception is a last resort, because when it fails the freight loses a day;",
    "  c) the customer's arrival (smaller delay is better);",
    "  d) cost.",
    "",
    `The duty officer reads ${lang}. Write summary, why and reply in ${lang} — always, even when the customer reads another language.`,
    "Write customer_note in the customer's language (get_shipment.customer_language), only when the routing or ETA changes for them.",
    "Keep summary to two sentences. why: 2-4 bullets, each carrying the figures that decide the case.",
    "In summary, why, reply and customer_note, name options by their title (e.g. \"Rebook via ZRH\"), never by option_id. option_id is only for recommended_option_id and ranking.",
    "risk is the FILE's risk class exactly as calculate_risk.risk returns it (critical | high | watch | ok) — not an option's Low/Medium/High label.",
  ].join("\n");
}

function userPrompt(s: Scenario, awb: string): string {
  const lines = [`Open file: AWB ${awb}. Desk clock: ${DESK_CLOCK}.`];
  if (s.operatorMessage?.trim()) {
    lines.push(`The duty officer says: "${s.operatorMessage.trim()}"`);
    if (s.priorDelayMin !== undefined && s.priorDelayMin !== s.delayMin) {
      lines.push(
        `The desk has ALREADY applied this change: the truck delay is now ${s.delayMin} min (it was ${s.priorDelayMin} min). Every tool output reflects the new delay — do not add it again. In reply, give the before → after effect with the exact figures (ETA, gap or slack, risk class, recommendation).`,
      );
    }
    lines.push(
      "Work the file exactly as usual first — calculate_risk and find_alternatives are still required before any decision. Then call submit_decision with a full decision AND their answer in `reply`.",
    );
  } else {
    lines.push("Assess the file and submit your recovery decision. Omit `reply`.");
  }
  return lines.join("\n");
}

async function chat(
  cfg: LiveConfig,
  messages: ChatMessage[],
): Promise<{
  message: { content?: string | null; tool_calls?: RawToolCall[]; reasoning_content?: string; reasoning?: string };
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}> {
  const f = cfg.fetchImpl ?? fetch;
  const url = `${(cfg.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: cfg.model ?? DEFAULT_MODEL,
    messages,
    tools: TOOL_SCHEMAS,
    tool_choice: "auto",
    temperature: cfg.temperature ?? 0.2,
    max_tokens: cfg.maxTokens ?? 8192,
    ...(cfg.extraBody ?? {}),
  };
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.timeoutMs ?? 90_000);
    try {
      const res = await f(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { choices?: { message: never; finish_reason?: string }[]; usage?: never };
        const message = json.choices?.[0]?.message;
        if (!message) throw new Error("No choices in response");
        return { message, finishReason: json.choices?.[0]?.finish_reason, usage: json.usage };
      }
      lastErr = `${res.status} ${(await res.text()).slice(0, 300)}`;
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(`Token Factory request failed: ${lastErr}`);
}

/** Some deployments return the tool call as text. Recover a decision from it. */
function decisionFromText(text: string | null | undefined): unknown | null {
  if (!text || !text.includes("recommended_option_id")) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return (parsed.arguments as unknown) ?? parsed;
  } catch {
    return null;
  }
}

export async function runLiveAgent(
  scenario: Scenario,
  cfg: LiveConfig,
  onStep: StepSink = () => {},
  signal?: AbortSignal,
): Promise<AgentRun> {
  const t0 = Date.now();
  const ctx = buildContext(scenario);
  const model = cfg.model ?? DEFAULT_MODEL;
  const steps: Step[] = [];
  const emit = (s: Step) => {
    steps.push(s);
    onStep(s);
  };
  const toolSteps: ToolStep[] = [];
  const called: string[] = [];
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(scenario) },
    { role: "user", content: userPrompt(scenario, ctx.shipment.awb) },
  ];
  let promptTokens = 0;
  let completionTokens = 0;
  let submissions = 0;
  let nudges = 0;
  let lastChecks: Check[] = [];
  let accepted: Decision | null = null;

  const trySubmit = (raw0: unknown): { ok: boolean; feedback: Record<string, unknown> } => {
    submissions++;
    const { decision, error } = coerceDecision(raw0);
    if (!decision) {
      lastChecks = [{ id: "schema", label: "Decision matches the schema", pass: false, detail: error }];
      const raw = typeof raw0 === "string" ? raw0 : JSON.stringify(raw0);
      emit({ kind: "verify", attempt: submissions, accepted: false, checks: lastChecks, submitted: { raw: raw.slice(0, 2000) } });
      return { ok: false, feedback: { accepted: false, failures: [error] } };
    }
    lastChecks = verifyDecision(decision, ctx, called, groundingTexts(ctx, toolSteps));
    const ok = lastChecks.every((c) => c.pass);
    emit({ kind: "verify", attempt: submissions, accepted: ok, checks: lastChecks, submitted: decision });
    if (ok) accepted = decision;
    return {
      ok,
      feedback: ok
        ? { accepted: true }
        : {
            accepted: false,
            failures: lastChecks.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail ?? "failed"}`),
            instruction: "Fix every failure and call submit_decision again. Use only figures and references from the tool outputs.",
          },
    };
  };

  try {
    for (let turn = 1; turn <= MAX_TURNS && !accepted && submissions < MAX_SUBMISSIONS; turn++) {
      if (signal?.aborted) {
        emit({ kind: "note", text: "Request closed by the client — stopped before the next model call." });
        break;
      }
      const s0 = Date.now();
      const { message, usage, finishReason } = await chat({ ...cfg, model }, messages);
      promptTokens += usage?.prompt_tokens ?? 0;
      completionTokens += usage?.completion_tokens ?? 0;
      const calls = message.tool_calls ?? [];
      const reasoning = message.reasoning_content ?? message.reasoning ?? "";
      emit({
        kind: "model",
        turn,
        ms: Date.now() - s0,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        reasoningChars: reasoning.length || undefined,
        text: message.content?.trim() || undefined,
        toolCalls: calls.map((c) => c.function.name),
      });

      if (calls.length === 0) {
        const recovered = decisionFromText(message.content);
        messages.push({ role: "assistant", content: message.content ?? "" });
        if (recovered) {
          const r = trySubmit(recovered);
          if (r.ok) break;
          messages.push({ role: "user", content: JSON.stringify(r.feedback) });
          continue;
        }
        if (++nudges > 2) break;
        messages.push({
          role: "user",
          content:
            finishReason === "length"
              ? "You ran out of output tokens before acting. Think briefly, then call the tools or submit_decision."
              : "Use the tools. When you have the facts, call submit_decision with your decision.",
        });
        continue;
      }

      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
      // Fact tools first, decisions last: a batch like [submit_decision, find_alternatives]
      // must not be judged before its own facts are in. Every call still gets one reply.
      const ordered = [
        ...calls.filter((c) => c.function.name !== "submit_decision"),
        ...calls.filter((c) => c.function.name === "submit_decision"),
      ];
      for (const call of ordered) {
        if (accepted) {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ignored: true, reason: "decision already accepted" }) });
          continue;
        }
        let args: Record<string, unknown> = {};
        let parseError: string | undefined;
        try {
          args = call.function.arguments ? (JSON.parse(call.function.arguments) as Record<string, unknown>) : {};
        } catch {
          parseError = "arguments were not valid JSON";
        }
        if (call.function.name === "submit_decision") {
          const r = parseError ? trySubmit(call.function.arguments) : trySubmit(args);
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(r.feedback) });
          continue;
        }
        const ts0 = Date.now();
        const output = parseError ? { error: parseError } : executeTool(call.function.name, args, ctx);
        const step: ToolStep = {
          kind: "tool",
          callId: call.id,
          name: call.function.name,
          args,
          output,
          ms: Date.now() - ts0,
          error: (output as { error?: string })?.error,
        };
        if (!step.error) {
          called.push(call.function.name);
          toolSteps.push(step);
        }
        emit(step);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
      }
    }
  } catch (e) {
    emit({ kind: "note", text: `Model call failed: ${e instanceof Error ? e.message : String(e)}` });
  }

  let decision: Decision;
  let fellBack = false;
  if (accepted) {
    decision = accepted;
  } else {
    fellBack = true;
    decision = rulesDecision(ctx);
    emit({
      kind: "note",
      text: L(
        scenario.locale,
        "No verified decision from the model — showing the rules-engine decision instead.",
        "Aucune décision vérifiée du modèle — décision du moteur de règles affichée à la place.",
      ),
    });
  }

  return {
    version: 1,
    scenarioKey: scenarioKey(scenario),
    scenario,
    mode: "live",
    model,
    provider: PROVIDER,
    promptVersion: PROMPT_VERSION,
    startedAt: new Date(t0).toISOString(),
    latencyMs: Date.now() - t0,
    promptTokens,
    completionTokens,
    steps,
    decision,
    verdict: { accepted: !!accepted, attempts: submissions, fellBack, checks: lastChecks },
    baseline: baselineOf(ctx, decision),
  };
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export function asReplay(recorded: AgentRun): AgentRun {
  return {
    ...recorded,
    mode: "replay",
    replayOf: { recordedAt: recorded.startedAt, model: recorded.model, promptVersion: recorded.promptVersion ?? "v1" },
  };
}

export async function streamReplay(run: AgentRun, onStep: StepSink, paceMs = 120): Promise<AgentRun> {
  for (const s of run.steps) {
    onStep(s);
    if (paceMs) await new Promise((r) => setTimeout(r, paceMs));
  }
  return run;
}

export { optionStatus };
