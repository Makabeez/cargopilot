/**
 * Gathers what the model needs from outside the cargo network before a v5 run:
 *
 *   1. Scout (Meterless spec) screens the duty officer's free text. A "block"
 *      ends the run here: the message never reaches Nemotron.
 *   2. Zetaris answers the federated station-evidence query (or the offline
 *      mirror does, labelled).
 *   3. H-MEM recalls desk memory for the file. Adverse weather found in step 2
 *      is added to the memory query, so "LEJ is IFR tonight" pulls the night
 *      shift's fog notes: one source steers the next.
 *
 * Everything gathered is stored in the run (AgentRun.external), which is what
 * lets judge-demo re-verify a recorded run without any network.
 */
import { Scout } from "../guard/scout";
import { stationCategories } from "../ops/evidence";
import { loadEvidence, type ZetarisConfig } from "../ops/zetaris";
import { recallFor } from "../memory/desk-memory";
import type { ExternalContext, Scenario } from "./types";

export type GatherOptions = {
  zetaris?: ZetarisConfig | null;
  /** No network at all: mirror only, no live weather. */
  offline?: boolean;
  now?: number;
  fetchImpl?: typeof fetch;
  /** Only run Scout (cheap, local): used to block a message before deciding how to serve it. */
  scoutOnly?: boolean;
};

let scout: Scout | null = null;
export function deskScout(): Scout {
  scout ??= new Scout();
  return scout;
}

/**
 * Handover notes are screened by Scout before H-MEM mines them: a note is
 * persisted context the model reads on every later file, so an injected note
 * is a worse injection than a one-off message.
 */
export function screenNotes(notes: string[] = []): { accepted: string[]; rejected: string[] } {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const n of notes) (deskScout().guard(n).level === "block" ? rejected : accepted).push(n);
  return { accepted, rejected };
}

/** Weather words added to the memory query for stations in IFR or LIFR. */
export function adverseConditions(cats: { station: string; category: string | null }[]): string {
  return cats
    .filter((c) => c.category === "IFR" || c.category === "LIFR")
    .map((c) => `${c.station} fog ${c.category}`)
    .join(" ");
}

export async function gatherContext(
  scenario: Scenario,
  opts: GatherOptions = {},
): Promise<{ external: ExternalContext; blocked?: { flags: string[] } }> {
  const external: ExternalContext = {};
  const msg = scenario.operatorMessage?.trim();
  if (msg) {
    external.scout = await deskScout().decide({ prompt: msg, user: { id: "duty-officer", role: "duty_officer" }, surface: "desk" });
    if (external.scout.risk.level === "block") return { external, blocked: { flags: external.scout.risk.flags } };
  }
  if (opts.scoutOnly) return { external };
  external.evidence = await loadEvidence(scenario.shipmentId, {
    zetaris: opts.zetaris,
    offline: opts.offline,
    now: opts.now,
    fetchImpl: opts.fetchImpl,
  });
  const conditions = adverseConditions(stationCategories(scenario.shipmentId, external.evidence, scenario.wx ?? {}));
  const notes = screenNotes(scenario.memoryNotes);
  external.memory = await recallFor(scenario.shipmentId, notes.accepted, conditions);
  if (notes.rejected.length) external.memory.rejected = notes.rejected;
  return { external };
}
