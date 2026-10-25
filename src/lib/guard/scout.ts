/**
 * Scout Intent for the duty officer's free text: a CargoPilot implementation
 * of the Meterless Scout spec (github.com/Meterless/Meterless, engines/scout-intent).
 * Meterless publishes Scout as a spec plus a locked eval harness, not as code;
 * this file implements the specified surface:
 *
 *   new Scout({ intentRegistry, policyPack }).decide({ prompt, user, surface })
 *     → { intent, candidates, risk, toolPlan, executionContract, clarification? }
 *
 * Pipeline: sense (intent) → guard (injection, tool tampering, exfiltration,
 * privilege) → route (tool plan) → contract (HMAC-signed). The desk only lets a
 * typed message reach Nemotron when Scout returns a contract; a "block" stops
 * the message before any model call, and the run is labelled.
 *
 * It is deterministic and local: no model call, no network.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

export type RiskLevel = "low" | "medium" | "high" | "block";

export type IntentDef = { id: string; description?: string; keywords?: string[]; tools?: string[] };

export type ScoutDecision = {
  intent: { primary: string | null; confidence: number };
  candidates: { intent: string; score: number }[];
  risk: { level: RiskLevel; flags: string[] };
  toolPlan: { capability: string }[];
  clarification?: { question: string };
  executionContract: null | {
    version: 1;
    intent: { primary: { id: string; confidence: number } };
    toolPlan: string[];
    risk: RiskLevel;
    issuedAt: string;
    promptHash: string;
    signature: string;
  };
};

/** The desk's own intents. Each maps to the tools the agent may use for it. */
export const DESK_INTENTS: IntentDef[] = [
  { id: "desk.whatif", description: "What-if on the open file (delay, toggle)", keywords: ["what if", "delayed", "delay", "late", "another", "minutes", "retard", "et si", "si le camion"], tools: ["get_shipment", "get_disruption", "get_cutoffs", "check_connection", "calculate_risk", "find_alternatives", "get_station_evidence"] },
  { id: "desk.explain", description: "Why this call / explain the decision", keywords: ["why", "explain", "reason", "pourquoi", "explique", "justify"], tools: ["get_shipment", "calculate_risk", "find_alternatives", "get_station_evidence", "recall_desk_memory"] },
  { id: "desk.alternatives", description: "Ask about another option or routing", keywords: ["option", "reroute", "via", "instead", "passenger", "freighter", "split", "fastest", "cheapest", "alternative", "autre", "plutôt"], tools: ["get_shipment", "check_restrictions", "get_capacity", "calculate_risk", "find_alternatives", "get_station_evidence"] },
  { id: "desk.memory", description: "Remember or recall a handover note", keywords: ["remember", "note that", "handover", "last time", "rappelle", "retiens", "note"], tools: ["recall_desk_memory"] },
  { id: "desk.customer", description: "Customer note or message", keywords: ["customer", "client", "note", "tell them", "message", "email them"], tools: ["get_shipment", "find_alternatives"] },
  { id: "desk.weather", description: "Weather at a station", keywords: ["weather", "fog", "taf", "metar", "météo", "brouillard", "visibility"], tools: ["get_station_evidence"] },
];

type Rule = { flag: string; level: RiskLevel; re: RegExp };

/**
 * Guard rules. Ordered from structural (role/markup) to semantic. Written
 * against attack families, not against individual eval strings; the desk eval
 * (tests/fixtures/desk-guard.jsonl) holds benign desk phrasing such as
 * "ignore the cost" and "forget the ZRH option" that must pass.
 */
const OVERRIDE_OBJECT = String.raw`(?:(?:previous|prior|above|earlier|all|your|the|any|these|those|system|original)\s+){0,2}(?:instructions?|rules?|prompts?|guidelines?|polic(?:y|ies)|guardrails?|constraints?|verifier|checks?|safety|directives?|context)`;
const RULES: Rule[] = [
  { flag: "role-markup", level: "block", re: /<\/?\s*(?:system|user|assistant|tool|developer)\s*>|\[\/?INST\]|<<\s*SYS\s*>>|^\s*(?:system|assistant|developer)\s*:/im },
  { flag: "instruction-override", level: "block", re: new RegExp(String.raw`\b(?:ignore|disregard|forget|override|bypass|skip|drop)\s+(?:all\s+|every\s+|of\s+)?${OVERRIDE_OBJECT}\b`, "i") },
  { flag: "instruction-override", level: "block", re: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier)\b/i },
  { flag: "instruction-override", level: "block", re: /\b(?:ignore[zr]?|oublie[zr]?|ne tiens pas compte)\s+(?:de\s+)?(?:toutes\s+)?(?:les|tes|vos|des)\s+(?:instructions|règles|consignes|contraintes)/i },
  { flag: "instruction-override", level: "block", re: /\bdisregard the (?:user|operator|desk)\b/i },
  { flag: "persona-switch", level: "block", re: /\byou are now\b|\bfrom now on you\b|\b(?:pretend|act) (?:to be|as) (?:the )?(?:system|admin|carrier|airline|developer)|\bunrestricted mode\b|\bdeveloper mode\b|\bjailbreak\b|\bDAN\b/i },
  { flag: "secret-exfiltration", level: "block", re: /\b(?:reveal|print|show|dump|leak|output|give me|send me)\b.{0,40}\b(?:system prompt|api[ _-]?keys?|credentials?|secrets?|tokens?|passwords?|env(?:ironment)? variables?|NEBIUS_API_KEY)\b/i },
  { flag: "privilege-escalation", level: "block", re: /\bgrant (?:me|us)?\s*(?:admin|root|superuser)|\binternal_admin\w*|\badmin panel\b|\bdrop (?:the )?\w+ table\b/i },
  { flag: "tool-tampering", level: "block", re: /\b(?:submit_decision|tool_choice|recommended_option_id|calculate_risk|find_alternatives)\b\s*[:=({]|"recommended_option_id"|\bverifier (?:is )?(?:off|disabled)|\b(?:disable|turn off|switch off|skip)\s+(?:the\s+)?(?:verifier|checks?|grounding)/i },
  { flag: "payment-redirect", level: "block", re: /\b(?:IBAN|swift|bic|bank account|wire (?:the|to)|crypto wallet|0x[a-fA-F0-9]{40})\b/i },
  { flag: "external-send", level: "block", re: /\b(?:send|email|forward|post|upload)\b.{0,60}(?:https?:\/\/|[\w.+-]+@[\w-]+\.[\w.]+)/i },
  { flag: "bulk-exfiltration", level: "block", re: /\b(?:email|send|export|list)\s+(?:every|all)\s+(?:customers?|accounts?|records?|files?|shipments?)\b/i },
  { flag: "hidden-control", level: "block", re: /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\u2060\uFEFF]|\\u(?:202[A-E]|206[6-9]|200[B-F]|FEFF)/i },
  { flag: "encoded-payload", level: "high", re: /[A-Za-z0-9+/]{60,}={0,2}/ },
];

export type ScoutOptions = { intentRegistry?: string | IntentDef[]; policyPack?: string | string[]; secret?: string; clock?: () => number };

function loadRegistry(reg: ScoutOptions["intentRegistry"]): IntentDef[] {
  if (!reg) return DESK_INTENTS;
  if (Array.isArray(reg)) return reg;
  try {
    const raw = JSON.parse(readFileSync(reg, "utf8")) as unknown;
    const list = Array.isArray(raw) ? raw : ((raw as { intents?: unknown[] }).intents ?? []);
    return (list as Record<string, unknown>[]).map((d) => ({
      id: String(d.id ?? d.name),
      description: d.description as string | undefined,
      keywords: (d.keywords ?? d.examples ?? []) as string[],
      tools: ((d.tools ?? d.capabilities ?? []) as unknown[]).map(String),
    }));
  } catch {
    return DESK_INTENTS;
  }
}

const norm = (s: string) => s.toLowerCase().normalize("NFKC");

export class Scout {
  private intents: IntentDef[];
  private secret: string;
  private clock: () => number;

  constructor(opts: ScoutOptions = {}) {
    this.intents = loadRegistry(opts.intentRegistry);
    // The contract is signed so the agent loop can refuse an unsigned or altered one.
    this.secret = opts.secret ?? process.env.SCOUT_CONTRACT_SECRET ?? "cargopilot-scout-dev";
    this.clock = opts.clock ?? Date.now;
  }

  guard(prompt: string): { level: RiskLevel; flags: string[] } {
    const flags = new Set<string>();
    let level: RiskLevel = "low";
    const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, block: 3 };
    for (const r of RULES) {
      if (r.re.test(prompt)) {
        flags.add(r.flag);
        if (rank[r.level] > rank[level]) level = r.level;
      }
    }
    return { level, flags: [...flags] };
  }

  sense(prompt: string): { intent: string; score: number }[] {
    const p = norm(prompt);
    const scored = this.intents.map((d) => {
      const hits = (d.keywords ?? []).filter((k) => p.includes(norm(k))).length;
      return { intent: d.id, score: hits ? Math.min(1, 0.4 + 0.2 * hits) : 0 };
    });
    return scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score);
  }

  async decide(input: { prompt: string; user?: { id?: string; role?: string }; surface?: string }): Promise<ScoutDecision> {
    const prompt = input.prompt ?? "";
    const risk = this.guard(prompt);
    const candidates = this.sense(prompt);
    const top = candidates[0];
    const primary = top?.intent ?? null;
    const def = this.intents.find((d) => d.id === primary);
    const toolPlan = (def?.tools ?? []).map((capability) => ({ capability }));
    const promptHash = createHmac("sha256", "prompt").update(prompt).digest("hex").slice(0, 16);
    if (risk.level === "block") {
      return { intent: { primary, confidence: top?.score ?? 0 }, candidates, risk, toolPlan: [], executionContract: null };
    }
    const body = {
      version: 1 as const,
      intent: { primary: { id: primary ?? "desk.general", confidence: top?.score ?? 0.3 } },
      toolPlan: toolPlan.map((t) => t.capability),
      risk: risk.level,
      issuedAt: new Date(this.clock()).toISOString(),
      promptHash,
    };
    const signature = createHmac("sha256", this.secret).update(JSON.stringify(body)).digest("hex");
    return {
      intent: { primary, confidence: top?.score ?? 0 },
      candidates,
      risk,
      toolPlan,
      ...(primary ? {} : { clarification: undefined }),
      executionContract: { ...body, signature },
    };
  }

  verifyContract(c: NonNullable<ScoutDecision["executionContract"]>): boolean {
    const { signature, ...body } = c;
    return createHmac("sha256", this.secret).update(JSON.stringify(body)).digest("hex") === signature;
  }
}
