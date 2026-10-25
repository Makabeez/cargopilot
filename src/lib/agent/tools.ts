/**
 * The tool layer. Every tool is a pure function over the simulated cargo
 * network (src/lib/cargo/engine.ts). Tools return FACTS only — the rules
 * engine's own recommendation is never exposed to the model. Nemotron has to
 * read the facts, rank the options and justify the call itself; the verifier
 * then checks that call against these same outputs.
 *
 * Tool outputs are always English (canonical facts). The model replies to the
 * operator in the operator's language.
 */
import {
  SHIPMENTS,
  analyze,
  defaultFlags,
  type Analysis,
  type Option,
  type Shipment,
} from "../cargo/engine";
import type { ExternalContext, Scenario } from "./types";
import { bookedLegVerdict, stationEvidence } from "../ops/evidence";
import { memoryToolOutput } from "../memory/desk-memory";

export type ToolContext = {
  scenario: Scenario;
  shipment: Shipment;
  /** Rules-engine view of the scenario, English. Never sent to the model whole. */
  analysis: Analysis;
  /** Prompt v5: Zetaris evidence + H-MEM recall gathered before the run. */
  external?: ExternalContext;
};

export function buildContext(scenario: Scenario, external?: ExternalContext): ToolContext {
  const shipment = SHIPMENTS.find((s) => s.id === scenario.shipmentId);
  if (!shipment) throw new Error(`Unknown shipment ${scenario.shipmentId}`);
  const flags = defaultFlags(shipment, scenario.delayMin, scenario.flags);
  const analysis = analyze(shipment, flags, "en", null);
  return { scenario, shipment, analysis, external };
}

const AWB_PARAM = {
  type: "object",
  properties: {
    awb: { type: "string", description: "Air waybill number, e.g. 615-12345675" },
  },
  required: ["awb"],
  additionalProperties: false,
} as const;

export const TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "get_shipment",
      description:
        "Booking record for an AWB: route, pieces, weight, volume, dimensions, commodity, handling code, priority, customer and the customer's language.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "get_disruption",
      description:
        "Live operational signal for the AWB (truck delay, booking conflict, probe reading, missing document) and the operational chain as times/positions with their state.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "get_cutoffs",
      description: "Station acceptance / cut-off times and handling windows that apply to this AWB.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "check_connection",
      description:
        "Computes whether the freight can physically make its connection: live ETA vs required-by time vs cut-off, in minutes.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "get_capacity",
      description: "Free weight and ULD positions on the booked and candidate flights.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "check_restrictions",
      description:
        "Hard restrictions: dangerous goods vs aircraft type, dimensions vs door/hold limits, temperature rules, protected bookings.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_risk",
      description:
        "Deterministic risk class for the AWB (critical | high | watch | ok) with the measured drivers behind it.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "find_alternatives",
      description:
        "Every recovery option for the AWB with its routing, revised ETA, delay, cost, risk and constraint check. Options with status 'blocked' violate a hard constraint and must never be recommended.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "submit_decision",
      description:
        "Submit the final recovery decision. It is checked against the tool outputs; if a check fails you get the failures back and must resubmit.",
      parameters: {
        type: "object",
        properties: {
          risk: { type: "string", enum: ["critical", "high", "watch", "ok"] },
          recommended_option_id: {
            type: "string",
            description: "option_id from find_alternatives",
          },
          ranking: {
            type: "array",
            items: { type: "string" },
            description: "All allowed option_ids, best first. Must start with recommended_option_id.",
          },
          summary: {
            type: "string",
            description: "Two sentences max for the duty officer: what breaks and what to do.",
          },
          why: {
            type: "array",
            items: { type: "string" },
            description:
              "2-4 short evidence bullets. Quote times, kilos, minutes, flights exactly as the tools returned them.",
          },
          reply: {
            type: "string",
            description: "Direct answer to the operator's message, in the operator's language. Omit if no message.",
          },
          customer_note: {
            type: "string",
            description:
              "Short note to the customer in the customer's language, mentioning the AWB and the revised ETA. Omit if nothing changes for them.",
          },
        },
        required: ["risk", "recommended_option_id", "ranking", "summary", "why"],
        additionalProperties: false,
      },
    },
  },
] as const;

/** Prompt v5 adds two tools backed by sources outside the cargo network. */
export const V5_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "get_station_evidence",
      description:
        "Federated evidence from Zetaris for the stations this file depends on: live weather (METAR now, worst TAF category next 6 h) joined with 90 days of that station's handling history in the same weather category. Returns how often the window held (counts and %), median and p90 times. Use it to judge whether a tight plan will hold tonight.",
      parameters: AWB_PARAM,
    },
  },
  {
    type: "function",
    function: {
      name: "recall_desk_memory",
      description:
        "Desk memory across shifts (Meterless H-MEM): handover notes, customer preferences and past overrides relevant to this file, each with a memory_id. Memory is context, not live data; tool facts win if they disagree.",
      parameters: AWB_PARAM,
    },
  },
] as const;

export const TOOL_SCHEMAS_V5 = [...TOOL_SCHEMAS.slice(0, -1), ...V5_TOOL_SCHEMAS, TOOL_SCHEMAS[TOOL_SCHEMAS.length - 1]];

export type ToolName = (typeof TOOL_SCHEMAS)[number]["function"]["name"];

function facts(ctx: ToolContext, tool: string): string[] {
  return ctx.analysis.traces.filter((t) => t.tool === tool).map((t) => t.result);
}

function normalizeAwb(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length === 11 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : String(raw ?? "");
}

/**
 * 'blocked' = violates a hard constraint (infeasible), or is an explicit
 * do-not-do (not executable and rated high/critical risk).
 */
export function optionStatus(o: Option): "allowed" | "blocked" {
  if (!o.feasible) return "blocked";
  if (!o.executable && (o.risk === "high" || o.risk === "critical")) return "blocked";
  return "allowed";
}

export function optionFacts(o: Option) {
  return {
    option_id: o.id,
    title: o.title,
    via: o.via,
    revised_eta: o.eta,
    delay: o.deltaLabel,
    cost: o.costLabel,
    risk: o.riskLabel,
    status: optionStatus(o),
    constraint_check: o.reason,
    action: o.action,
  };
}

export function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): unknown {
  const awb = normalizeAwb(args.awb);
  const { shipment, analysis } = ctx;
  if (name !== "submit_decision" && awb !== shipment.awb) {
    const other = SHIPMENTS.find((s) => s.awb === awb);
    if (!other) return { error: `Unknown AWB ${String(args.awb)}. The open file is ${shipment.awb}.` };
    return {
      error: `AWB ${awb} is a different file. This desk session is working ${shipment.awb}; query that AWB.`,
    };
  }

  switch (name) {
    case "get_shipment":
      return {
        awb: shipment.awb,
        origin: shipment.origin,
        destination: shipment.destination,
        booked_route: shipment.route,
        pieces: shipment.pieces,
        weight_kg: shipment.weightKg,
        volume_m3: shipment.volumeM3,
        dims: shipment.dims,
        commodity: shipment.commodity.en,
        handling_code: shipment.handling,
        priority: shipment.priority,
        customer: shipment.customer,
        customer_language: shipment.customerLang === "fr" ? "French" : "English",
      };
    case "get_disruption":
      return {
        signal: analysis.signal,
        observed: facts(ctx, "get_disruption"),
        ...(shipment.usesDelay ? { truck_delay_min: ctx.scenario.delayMin } : {}),
        what_if: analysis.chips.filter((c) => c.pressed).map((c) => c.label),
        operational_chain: analysis.chain.map((n) => ({
          point: n.label,
          value: n.time,
          note: n.hint,
          state: n.state,
        })),
      };
    case "get_cutoffs":
    case "check_connection":
    case "get_capacity":
    case "check_restrictions": {
      const f = facts(ctx, name);
      return f.length > 0
        ? { applicable: true, facts: f }
        : { applicable: false, facts: [], note: `No ${name.replace(/_/g, " ")} issue recorded for this file.` };
    }
    case "calculate_risk":
      return {
        risk: analysis.risk,
        classification: analysis.stamp,
        rule: facts(ctx, "calculate_risk"),
        drivers: analysis.metrics.map((m) => ({ measure: m.label, value: m.value, assessment: m.tone })),
      };
    case "find_alternatives":
      return {
        summary: facts(ctx, "find_alternatives"),
        options: analysis.options.map(optionFacts),
      };
    case "get_station_evidence":
      if (!ctx.external) return { error: "Unknown tool get_station_evidence" };
      return stationEvidence(shipment.id, ctx.external.evidence, ctx.scenario.wx ?? {});
    case "recall_desk_memory":
      if (!ctx.external) return { error: "Unknown tool recall_desk_memory" };
      return memoryToolOutput(ctx.external.memory);
    default:
      return { error: `Unknown tool ${name}` };
  }
}

/** The rules engine's own answer — used as the no-model baseline and fallback. */
export function rulesChoice(ctx: ToolContext): { recommended: string; ranking: string[] } {
  const opts = ctx.analysis.options;
  const riskOrder = { ok: 0, watch: 1, high: 2, critical: 3 } as const;
  let rec = opts.find((o) => o.recommended) ?? opts.find((o) => optionStatus(o) === "allowed") ?? opts[0];
  // v5 desk policy: weak station evidence for tonight's weather removes keep-first.
  if (rec.id === "keep" && ctx.external?.evidence && bookedLegVerdict(ctx.shipment.id, ctx.external.evidence, ctx.scenario.wx ?? {})?.overridesKeep) {
    const alt = opts
      .filter((o) => o.id !== "keep" && optionStatus(o) === "allowed")
      .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk])[0];
    if (alt) rec = alt;
  }
  const rest = opts
    .filter((o) => o.id !== rec.id && optionStatus(o) === "allowed")
    .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
  return { recommended: rec.id, ranking: [rec.id, ...rest.map((o) => o.id)] };
}
