/**
 * The verifier: the model proposes, the rules check.
 *
 * Every figure Nemotron writes (times, kilos, minutes, hours, cm, °C, m³, CHF,
 * %) and every reference (flight, truck, AWB, UN, PI) must be traceable to a
 * tool output from THIS run — quoted directly, or (for kg, min, cm, m³, °C)
 * the difference of two quoted figures of the same unit. Delays in hours and
 * CHF costs must be quoted exactly. Anything else is treated as
 * invented and the decision is sent back.
 */
import type { Locale } from "../cargo/engine";
import { optionStatus, type ToolContext } from "./tools";
import type { Check, Decision } from "./types";

type Unit = "kg" | "min" | "h" | "cm" | "C" | "m3" | "%" | "pcs" | "CHF";
/**
 * `alt` is set when a space or apostrophe could be a thousands separator OR a
 * word gap: "2 400 kg" (French 2,400) vs "piece 3 168 cm" (piece 3, 168 cm).
 * The figure is grounded if either reading is.
 */
type Quantity = { raw: string; value: number; unit: Unit; alt?: number };

function altReading(raw: string): number | undefined {
  const s = raw.trim();
  if (!/^\d{1,3}(?:[ ']\d{3})+$/.test(s)) return undefined;
  return Number(s.split(/[ ']/).pop());
}

function clean(text: string): string {
  return text.replace(/[\u202f\u00a0\u2009]/g, " ").replace(/\u2212/g, "-");
}

function parseNumber(raw: string): number {
  const s = raw.trim();
  // 2,200 / 2 200 / 2'200 → thousands; 9,2 → decimal
  if (/^\d{1,3}(?:[ ,']\d{3})+$/.test(s)) return Number(s.replace(/[ ,']/g, ""));
  return Number(s.replace(",", "."));
}

const NUM = String.raw`(?<!\d)(\d{1,3}(?:[ ,']\d{3})+(?!\d)|\d+(?:[.,]\d+)?)`;
const UNIT = String.raw`(kg|kilos?|minutes?|mins?|hours?|heures?|h|cm|°\s?C|m³|m3|%|pcs|pieces?|pièces?)`;
const QTY_RE = new RegExp(`${NUM}\\s*${UNIT}(?![A-Za-zÀ-ÿ0-9])`, "gi");
const CHF_BEFORE = new RegExp(`CHF\\s*${NUM}`, "gi");
const CHF_AFTER = new RegExp(`${NUM}\\s*CHF`, "gi");
const TIME_RE = /(?<![\d:])([01]?\d|2[0-3])(?::|\s?h\s?)([0-5]\d)(?![\d:])/g;

function unitOf(u: string): Unit {
  const s = u.toLowerCase().replace(/\s/g, "");
  if (s.startsWith("kilo") || s === "kg") return "kg";
  if (s.startsWith("min")) return "min";
  if (s === "h" || s.startsWith("hour") || s.startsWith("heure")) return "h";
  if (s === "cm") return "cm";
  if (s === "°c") return "C";
  if (s === "m³" || s === "m3") return "m3";
  if (s === "%") return "%";
  return "pcs";
}

export function extractQuantities(text: string): Quantity[] {
  // Clock times ("19:45", "19h45", "18 h 12") are not durations: blank them first.
  const t = clean(text).replace(TIME_RE, (m) => " ".repeat(m.length));
  const out: Quantity[] = [];
  for (const m of t.matchAll(QTY_RE)) out.push({ raw: m[0], value: parseNumber(m[1]), unit: unitOf(m[2]), alt: altReading(m[1]) });
  for (const m of t.matchAll(CHF_BEFORE)) out.push({ raw: m[0], value: parseNumber(m[1]), unit: "CHF", alt: altReading(m[1]) });
  for (const m of t.matchAll(CHF_AFTER)) out.push({ raw: m[0], value: parseNumber(m[1]), unit: "CHF", alt: altReading(m[1]) });
  return out.filter((q) => Number.isFinite(q.value));
}

/** Minutes after midnight for each HH:MM / HHhMM. */
export function extractTimes(text: string): { raw: string; minutes: number }[] {
  return [...clean(text).matchAll(TIME_RE)].map((m) => ({
    raw: m[0],
    minutes: Number(m[1]) * 60 + Number(m[2]),
  }));
}

export function extractRefs(text: string): string[] {
  const t = clean(text);
  const refs = new Set<string>();
  for (const m of t.matchAll(/\b(AYC|RFS)\s?(\d{1,4})\b/g)) refs.add(`${m[1]} ${m[2]}`);
  for (const m of t.matchAll(/(?<!\d)(\d{3})-(\d{8})(?!\d)/g)) refs.add(`${m[1]}-${m[2]}`);
  for (const m of t.matchAll(/\bUN\s?(\d{4})\b/g)) refs.add(`UN${m[1]}`);
  for (const m of t.matchAll(/\bPI\s?(\d{3})\b/g)) refs.add(`PI${m[1]}`);
  return [...refs];
}

export type GroundingSource = {
  byUnit: Map<Unit, number[]>;
  times: number[];
  refs: Set<string>;
};

export function buildSource(texts: string[]): GroundingSource {
  const joined = texts.join("\n");
  const byUnit = new Map<Unit, number[]>();
  for (const q of extractQuantities(joined)) {
    const arr = byUnit.get(q.unit) ?? [];
    arr.push(q.value);
    byUnit.set(q.unit, arr);
  }
  // Bare numbers next to known JSON keys ("weight_kg": 780) count as quantities too.
  const keyed: [RegExp, Unit][] = [
    [/"weight_kg":\s*(\d+(?:\.\d+)?)/g, "kg"],
    [/"truck_delay_min":\s*(\d+)/g, "min"],
    [/"volume_m3":\s*(\d+(?:\.\d+)?)/g, "m3"],
    [/"pieces":\s*(\d+)/g, "pcs"],
  ];
  for (const [re, unit] of keyed) {
    for (const m of joined.matchAll(re)) {
      const arr = byUnit.get(unit) ?? [];
      arr.push(Number(m[1]));
      byUnit.set(unit, arr);
    }
  }
  return {
    byUnit,
    times: extractTimes(joined).map((t) => t.minutes),
    refs: new Set(extractRefs(joined)),
  };
}

const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** One subtraction between two quoted figures of the same unit ("780 − 410 = 370 kg short"). */
function derivable(v: number, pool: number[]): boolean {
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (eq(Math.abs(pool[i] - pool[j]), v)) return true;
    }
  }
  return false;
}

function timeDiffs(times: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < times.length; i++) {
    for (let j = i + 1; j < times.length; j++) {
      const d = Math.abs(times[i] - times[j]);
      out.push(d, 1440 - d);
    }
  }
  return out;
}

export function isGroundedQuantity(q: Quantity, src: GroundingSource): boolean {
  if (q.alt !== undefined && isGroundedQuantity({ ...q, value: q.alt, alt: undefined }, src)) return true;
  const pool = src.byUnit.get(q.unit) ?? [];
  if (pool.some((p) => eq(p, q.value))) return true;
  if (q.unit === "%") return false; // no invented probabilities
  // Any whole count of pieces up to the shipment's total ("5 pieces fit the belly").
  if (q.unit === "pcs") return Number.isInteger(q.value) && q.value >= 1 && q.value <= Math.max(1, ...pool);
  // Delays and costs are per-option facts: they must be quoted, not computed.
  const quoteOnly = q.unit === "CHF" || q.unit === "h";
  if (!quoteOnly && derivable(q.value, pool)) return true;
  if (q.unit === "min") {
    if (timeDiffs(src.times).some((d) => eq(d, q.value))) return true;
    if ((src.byUnit.get("h") ?? []).some((h) => eq(h * 60, q.value))) return true;
  }
  if (q.unit === "h") {
    // Hours are delays/lane times: quoted, or a quoted minute figure restated.
    if ((src.byUnit.get("min") ?? []).some((m) => eq(m / 60, q.value))) return true;
  }
  return false;
}

export function isGroundedTime(minutes: number, src: GroundingSource): boolean {
  if (src.times.includes(minutes)) return true;
  const mins = src.byUnit.get("min") ?? [];
  return src.times.some((t) => mins.some((m) => (t + m) % 1440 === minutes || (t - m + 1440) % 1440 === minutes));
}

export function ungrounded(text: string, src: GroundingSource): string[] {
  const bad: string[] = [];
  for (const q of extractQuantities(text)) if (!isGroundedQuantity(q, src)) bad.push(q.raw.trim());
  for (const t of extractTimes(text)) if (!isGroundedTime(t.minutes, src)) bad.push(t.raw);
  return [...new Set(bad)];
}

const FR_WORDS = /\b(le|la|les|des|du|est|et|pour|sur|vous|nous|une|au|pas|avec|dans|camion|retard|vol|heure|fret)\b/gi;
const EN_WORDS = /\b(the|is|and|for|on|you|we|of|to|with|in|not|truck|delay|flight|freight|cargo)\b/gi;

export function guessLanguage(text: string): Locale | null {
  const fr = text.match(FR_WORDS)?.length ?? 0;
  const en = text.match(EN_WORDS)?.length ?? 0;
  if (fr >= 3 && fr > en * 1.5) return "fr";
  if (en >= 3 && en > fr * 1.5) return "en";
  return null;
}

/** Coerce whatever the model sent into a Decision, or explain why it can't. */
export function coerceDecision(raw: unknown): { decision?: Decision; error?: string } {
  let obj = raw;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch {
      return { error: "submit_decision arguments were not valid JSON." };
    }
  }
  if (!obj || typeof obj !== "object") return { error: "submit_decision needs an object." };
  const o = obj as Record<string, unknown>;
  const asList = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v !== "string" || !v.trim()) return [];
    const t = v.trim();
    if (t.startsWith("[")) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        /* fall through */
      }
    }
    return [t];
  };
  // Option ids sometimes arrive as "[keep]", "'zrh'", or "zrh, fra" — reduce to bare ids.
  const ids = (v: unknown): string[] =>
    asList(v)
      .flatMap((x) => x.split(","))
      .map((x) => x.replace(/[[\]"'`\s]/g, ""))
      .filter(Boolean);
  const risk = String(o.risk ?? "").toLowerCase();
  if (!["critical", "high", "watch", "ok"].includes(risk)) return { error: `risk must be critical|high|watch|ok, got "${String(o.risk)}".` };
  if (!o.recommended_option_id) return { error: "recommended_option_id is required." };
  const optStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return {
    decision: {
      risk: risk as Decision["risk"],
      recommended_option_id: ids(o.recommended_option_id)[0] ?? String(o.recommended_option_id),
      ranking: ids(o.ranking),
      summary: String(o.summary ?? ""),
      why: asList(o.why),
      reply: optStr(o.reply),
      customer_note: optStr(o.customer_note),
    },
  };
}

export function verifyDecision(
  decision: Decision,
  ctx: ToolContext,
  calledTools: string[],
  groundingTexts: string[],
): Check[] {
  const checks: Check[] = [];
  const opts = ctx.analysis.options;
  const byId = new Map(opts.map((o) => [o.id, o]));

  const missing = ["calculate_risk", "find_alternatives"].filter((t) => !calledTools.includes(t));
  checks.push({
    id: "tools",
    label: "Read the risk and the options before deciding",
    pass: missing.length === 0,
    detail: missing.length ? `Not called: ${missing.join(", ")}` : undefined,
  });

  const rec = byId.get(decision.recommended_option_id);
  checks.push({
    id: "option",
    label: "Recommended option exists",
    pass: !!rec,
    detail: rec ? undefined : `"${decision.recommended_option_id}" is not an option_id. Valid: ${opts.map((o) => o.id).join(", ")}`,
  });
  checks.push({
    id: "allowed",
    label: "Recommended option passes hard constraints",
    pass: !!rec && optionStatus(rec) === "allowed",
    detail: rec && optionStatus(rec) === "blocked" ? `"${rec.id}" is blocked: ${rec.reason}` : undefined,
  });

  const badRank = decision.ranking.filter((id) => !byId.has(id) || optionStatus(byId.get(id)!) === "blocked");
  const dup = new Set(decision.ranking).size !== decision.ranking.length;
  const rankOk = decision.ranking[0] === decision.recommended_option_id && badRank.length === 0 && !dup;
  checks.push({
    id: "ranking",
    label: "Ranking starts with the pick and holds only allowed options",
    pass: rankOk,
    detail: rankOk
      ? undefined
      : [
          decision.ranking[0] !== decision.recommended_option_id ? "first entry is not the recommendation" : "",
          badRank.length ? `invalid or blocked: ${badRank.join(", ")}` : "",
          dup ? "duplicates" : "",
        ]
          .filter(Boolean)
          .join("; "),
  });

  checks.push({
    id: "risk",
    label: "Risk class matches calculate_risk",
    pass: decision.risk === ctx.analysis.risk,
    detail: decision.risk === ctx.analysis.risk ? undefined : `said ${decision.risk}, tool says ${ctx.analysis.risk}`,
  });

  const src = buildSource(groundingTexts);
  const prose = [decision.summary, ...decision.why, decision.reply ?? "", decision.customer_note ?? ""].join("\n");
  const bad = ungrounded(prose, src);
  checks.push({
    id: "figures",
    label: "Every time and figure traces to a tool output",
    pass: bad.length === 0,
    detail: bad.length ? `Not found in tool outputs: ${bad.join(", ")}` : undefined,
  });

  const badRefs = extractRefs(prose).filter((r) => !src.refs.has(r));
  checks.push({
    id: "refs",
    label: "Every flight, truck and AWB reference is real",
    pass: badRefs.length === 0,
    detail: badRefs.length ? `Unknown references: ${badRefs.join(", ")}` : undefined,
  });

  {
    // summary + why are for the duty officer: same language as the operator.
    // Summary and evidence bullets are judged separately, so one cannot mask the other.
    const parts = [
      ["summary", guessLanguage(decision.summary)],
      ["why", guessLanguage(decision.why.join(" "))],
    ] as const;
    const wrong = parts.filter(([, lang]) => lang !== null && lang !== ctx.scenario.locale);
    checks.push({
      id: "language",
      label: "Summary and evidence are in the duty officer's language",
      pass: wrong.length === 0,
      detail: wrong.length
        ? `${wrong.map(([k, lang]) => `${k} reads as ${lang}`).join(", ")}; the desk works in ${ctx.scenario.locale}`
        : undefined,
    });
  }

  if (ctx.scenario.operatorMessage?.trim()) {
    const lang = decision.reply ? guessLanguage(decision.reply) : null;
    const ok = !!decision.reply && (lang === null || lang === ctx.scenario.locale);
    checks.push({
      id: "reply",
      label: "Answers the operator in the operator's language",
      pass: ok,
      detail: ok
        ? undefined
        : !decision.reply
          ? "reply is missing"
          : `reply reads as ${lang}, operator wrote ${ctx.scenario.locale}`,
    });
  }

  if (decision.customer_note) {
    const awbDigits = ctx.shipment.awb.replace(/\D/g, "");
    const mentions = decision.customer_note.replace(/\D/g, "").includes(awbDigits);
    const lang = guessLanguage(decision.customer_note);
    const langOk = lang === null || lang === ctx.shipment.customerLang;
    checks.push({
      id: "customer",
      label: "Customer note cites the AWB in the customer's language",
      pass: mentions && langOk,
      detail:
        mentions && langOk
          ? undefined
          : [!mentions ? `does not mention ${ctx.shipment.awb}` : "", !langOk ? `written in ${lang}, customer reads ${ctx.shipment.customerLang}` : ""]
              .filter(Boolean)
              .join("; "),
    });
  }

  return checks;
}
