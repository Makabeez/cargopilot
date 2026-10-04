import type { Scenario } from "./types";

/** Stable id for a scenario: same key → same tool outputs. */
export function scenarioKey(s: Scenario): string {
  const flags = Object.entries(s.flags)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .join("+");
  const msg = (s.operatorMessage ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  let h = 0x811c9dc5;
  for (let i = 0; i < msg.length; i++) h = Math.imul(h ^ msg.charCodeAt(i), 0x01000193) >>> 0;
  return `${s.shipmentId}|d${s.delayMin}|${flags || "-"}|${s.locale}|${msg ? h.toString(16) : "-"}`;
}
