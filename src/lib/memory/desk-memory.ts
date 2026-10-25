/**
 * Desk memory across shifts, on the Meterless H-MEM engine (vendored reference,
 * src/vendor/meterless-hmem). A night desk forgets everything at handover; the
 * duty officers' notes, customer preferences and past overrides are exactly the
 * context a recovery decision needs and no system of record holds.
 *
 *   MemoryStoreService      — handover notes are stored with source + provenance
 *   MemoryMiningService     — "remember …" typed by the duty officer is mined into memory
 *   MemoryRetrievalService  — hybrid-ranked recall for the open file (the recall_desk_memory tool)
 *   TrustLedgerService      — every read/feedback is on the append-only ledger
 *
 * The seed notes below are SIMULATED, like the rest of the network. The H-MEM
 * clock is pinned to the desk clock, so the same notes always give the same
 * recall; that is what makes a recorded run re-verifiable offline.
 */
import { HMEM, type MemoryRecord } from "../../vendor/meterless-hmem/index";
import { SHIPMENTS } from "../cargo/engine";

/** Wed 14 Oct 2026 17:42 GVA (15:42 UTC): the desk clock. */
export const DESK_CLOCK_MS = Date.UTC(2026, 9, 14, 15, 42);
const DAY = 86_400_000;

type Seed = { daysAgo: number; author: string; text: string; tags: string[]; confidence?: number };

/** Simulated handover log of the GVA export desk. Invented people and events. */
export const HANDOVER_NOTES: Seed[] = [
  { daysAgo: 3, author: "night shift", tags: ["lej", "7841", "late", "truck"], text: "LEJ build-up for AYC 7841 runs one team short after 19:30 local this month; late RFS trucks into LEJ are the first thing to slip." },
  { daysAgo: 9, author: "duty officer", tags: ["lej", "fog", "ifr", "override"], text: "Override: kept the LEJ booking on a foggy evening against advice and the freight missed AYC 7841. In fog at LEJ, take the ZRH reroute early." },
  { daysAgo: 21, author: "duty officer", tags: ["zrh", "2204", "reroute", "lej"], text: "When LEJ is at risk, the preferred fallback is the RFS 2204 truck to ZRH; it has been reliable all quarter." },
  { daysAgo: 5, author: "key account", tags: ["nyon", "precision", "customer"], text: "Nyon Precision SA (LEJ–DEL lane) accepts a later arrival if told before the evening, but refuses split shipments. Always write to them in French." },
  { daysAgo: 12, author: "DG desk", tags: ["helvetia", "dgr", "un3480", "lithium"], text: "Helvetia Cell AG lithium shipments: book cargo aircraft only from the start; their forwarder keeps defaulting to passenger flights." },
  { daysAgo: 7, author: "build-up", tags: ["dxb", "pmc", "uld"], text: "DXB main deck positions sell out on Wednesdays; ask for a PMC hold before 16:00 when a heavy file is pending." },
  { daysAgo: 15, author: "duty officer", tags: ["cdg", "connection", "fog", "ifr"], text: "CDG transfer team: the 50 min connection holds on clear evenings but slips in morning and evening fog. Watch the CDG forecast before keeping a tight connection." },
  { daysAgo: 4, author: "pharma desk", tags: ["sin", "pharma", "pil", "excursion"], text: "SIN pharma lane, Klinik Nord: customer QA wants the excursion report within the shift whenever a probe leaves the range, even if the reading recovers." },
  { daysAgo: 2, author: "acceptance", tags: ["mad", "perishables", "per", "acceptance"], text: "Perishables to MAD: acceptance at GVA closes on time even when the truck is minutes away; call ahead, do not count on a late tender." },
  { daysAgo: 18, author: "duty officer", tags: ["yyz", "gel", "clinical"], text: "YYZ clinical samples (Maple Clinical) with gel packs qualified below the lane time: switch to the active container offer rather than re-icing at transfer." },
  { daysAgo: 30, author: "night shift", tags: ["bom", "sli", "documents"], text: "BOM files with a missing SLI: the forwarder answers fastest on the phone; email requests go unanswered after 18:00." },
];

export function seedMemory(): HMEM {
  const hmem = new HMEM({ clock: () => DESK_CLOCK_MS, actor: "cargopilot-desk" });
  for (const n of HANDOVER_NOTES) {
    hmem.add({
      content: n.text,
      type: "factual",
      layer: "long_term",
      tags: n.tags,
      confidence: n.confidence ?? 0.9,
      source: `handover log (${n.author})`,
      provenance: { origin: "document", learnedAt: DESK_CLOCK_MS - n.daysAgo * DAY, label: `GVA desk handover, ${n.daysAgo} days ago` },
    });
  }
  return hmem;
}

/**
 * What the desk asks memory for when a file opens: the stations on the route
 * (GVA is on every file, so it is left out), the customer, the commodity and
 * handling code, and any adverse weather the station evidence just reported
 * (e.g. "LEJ fog"): the federated evidence steers what memory is recalled.
 */
export function memoryQueryFor(shipmentId: string, extra = ""): string {
  const s = SHIPMENTS.find((x) => x.id === shipmentId);
  if (!s) return extra;
  const stations = s.route.split("→").map((x) => x.trim()).filter((x) => x !== "GVA");
  // Short queries rank best with H-MEM's hybrid formula (measured in tests/memory.test.ts).
  return [...stations, s.customer.split(" ")[0], extra].join(" ").replace(/\s+/g, " ").trim();
}

/** Final-score cut-off (after the confidence multiplier), tuned on the seed notes: see tests. */
export const RECALL_THRESHOLD = 0.22;

export type RecalledMemory = { id: string; content: string; source: string; learned: string; relevance: number };

export type MemorySnapshot = {
  engine: "meterless-hmem-reference@1742dec";
  query: string;
  recalled: RecalledMemory[];
  /** Notes the duty officer added in this session (not in the seed). */
  added: { id: string; content: string }[];
  trace: { strategy: string; reason: string };
};

const fmt = (m: MemoryRecord) => new Date(m.provenance.learnedAt).toISOString().slice(0, 10);

/** Recall for a file. `added` are operator notes to mine first (same session). */
export async function recallFor(shipmentId: string, addedNotes: string[] = [], conditions = "", topN = 4): Promise<MemorySnapshot> {
  const hmem = seedMemory();
  const added: MemorySnapshot["added"] = [];
  for (const text of addedNotes) {
    const recs = await hmem.mine("user_correction", text);
    for (const r of recs) added.push({ id: r.id, content: r.content });
  }
  const query = memoryQueryFor(shipmentId, [conditions, ...addedNotes].join(" "));
  const res = hmem.query(query, { topN, threshold: RECALL_THRESHOLD });
  return {
    engine: "meterless-hmem-reference@1742dec",
    query,
    recalled: res.memories.map((r) => ({
      id: r.memory.id,
      content: r.memory.content,
      source: r.memory.source,
      learned: fmt(r.memory),
      relevance: Math.round(r.relevance * 100) / 100,
    })),
    added,
    trace: { strategy: res.trace.strategy, reason: res.trace.retrievalReason },
  };
}

/** The recall_desk_memory tool output. */
export function memoryToolOutput(snap: MemorySnapshot | undefined) {
  if (!snap) return { applicable: false, note: "Desk memory unavailable for this run." };
  return {
    engine: "Meterless H-MEM",
    recalled: snap.recalled.map((m) => ({ memory_id: m.id, note: m.content, source: m.source, learned: m.learned })),
    note: snap.recalled.length
      ? "Handover memory, not live data: cite memory_id when a note changes the call; tool facts win if they disagree."
      : "Nothing relevant in desk memory for this file.",
  };
}
