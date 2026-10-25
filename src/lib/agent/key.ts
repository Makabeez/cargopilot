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
  const base = `${s.shipmentId}|d${s.delayMin}|${flags || "-"}|${s.locale}|${msg ? h.toString(16) : "-"}`;
  // v5 additions only extend the key when used, so every earlier recording keeps its key.
  const wx = Object.entries(s.wx ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join(",");
  const notes = (s.memoryNotes ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean);
  let nh = 0x811c9dc5;
  for (const c of notes.join("\n")) nh = Math.imul(nh ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return base + (wx ? `|wx:${wx}` : "") + (notes.length ? `|mem:${nh.toString(16)}` : "");
}
