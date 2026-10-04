import { SHIPMENTS, clampDelay, parseCommand, type FlagKey } from "../cargo/engine";
import type { Scenario } from "./types";

/**
 * What the desk does with a typed operator message before the agent runs:
 * delay commands move the scenario, the message itself goes to the agent.
 * The UI store and the recorder both use this, so a recorded replay matches
 * exactly what the UI sends.
 */
export function operatorScenario(base: Scenario, text: string): Scenario {
  const shipment = SHIPMENTS.find((s) => s.id === base.shipmentId);
  if (!shipment) throw new Error(`Unknown shipment ${base.shipmentId}`);
  const { command, localeHint } = parseCommand(text);
  const locale = localeHint ?? base.locale;
  let delayMin = base.delayMin;
  let flags = base.flags;
  if (command.type === "reset") {
    delayMin = 0;
    flags = {};
  } else if (command.type === "live") {
    delayMin = shipment.baseDelay;
  } else if (command.type === "delay" && shipment.usesDelay) {
    delayMin = clampDelay(command.mode === "add" ? base.delayMin + command.minutes : command.minutes);
  }
  return { ...base, delayMin, flags, locale, operatorMessage: text };
}

const CHIP_FOR: Partial<Record<string, FlagKey>> = {
  dg: "freighterFull",
  dims: "dropTall",
  uld: "forceSplit",
  temp: "confirmExcursion",
};

/** The scenarios recorded for replay and scored in the eval report. */
export function evalMatrix(): Scenario[] {
  const out: Scenario[] = [];
  const add = (s: Scenario) => out.push(s);
  for (const s of SHIPMENTS) {
    add({ shipmentId: s.id, delayMin: s.baseDelay, flags: {}, locale: "en" });
    const chip = CHIP_FOR[s.kind];
    if (chip) add({ shipmentId: s.id, delayMin: s.baseDelay, flags: { [chip]: true }, locale: "en" });
  }
  for (const d of [0, 30, 60, 120, 150]) add({ shipmentId: "s615", delayMin: d, flags: {}, locale: "en" });
  for (const d of [90, 120]) add({ shipmentId: "s615", delayMin: d, flags: {}, locale: "fr" });
  for (const d of [20, 40]) add({ shipmentId: "s125", delayMin: d, flags: {}, locale: "en" });
  for (const d of [0, 50]) add({ shipmentId: "s157", delayMin: d, flags: {}, locale: "en" });
  add({ shipmentId: "s172", delayMin: 0, flags: {}, locale: "fr" });

  // The exact operator turns used in the demo video.
  const hero: Scenario = { shipmentId: "s615", delayMin: 90, flags: {}, locale: "en" };
  add(operatorScenario(hero, "What if the truck is delayed another 30 minutes?"));
  add(operatorScenario(hero, "Why this call?"));
  add(operatorScenario({ ...hero, locale: "fr" }, "Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?"));
  add(operatorScenario({ shipmentId: "s172", delayMin: 0, flags: {}, locale: "en" }, "Can we just put it on the passenger flight?"));
  return out;
}

/** Every scenario the rules engine can be put in from the UI (for judge-demo). */
export function fullRulesMatrix(): Scenario[] {
  const out: Scenario[] = [];
  for (const locale of ["en", "fr"] as const) {
    for (const s of SHIPMENTS) {
      const delays = s.usesDelay ? Array.from({ length: 37 }, (_, i) => i * 5) : [s.baseDelay];
      const chip = CHIP_FOR[s.kind];
      for (const delayMin of delays) {
        out.push({ shipmentId: s.id, delayMin, flags: {}, locale });
        if (chip) out.push({ shipmentId: s.id, delayMin, flags: { [chip]: true }, locale });
      }
    }
  }
  return out;
}
