import { create } from "zustand";
import { useMemo } from "react";
import {
  SHIPMENTS,
  analyze,
  cannotExecuteNote,
  clampDelay,
  defaultFlags,
  L,
  notDelayNote,
  parseCommand,
  type FlagKey,
  type Locale,
} from "@/lib/cargo/engine";
import type { Filter } from "@/lib/cargo/copy";
import { useAgent } from "@/lib/agent/client";
import type { Scenario } from "@/lib/agent/types";
import { operatorScenario } from "@/lib/agent/matrix";

type Extra = Partial<Record<FlagKey, boolean>>;

type CargoState = {
  locale: Locale;
  selectedId: string;
  filter: Filter;
  delayMin: Record<string, number>;
  extras: Record<string, Extra>;
  executed: Record<string, string>;
  picked: Record<string, string>;
  note: string | null;
  setLocale: (locale: Locale) => void;
  select: (id: string) => void;
  setFilter: (filter: Filter) => void;
  setDelay: (id: string, minutes: number) => void;
  toggleFlag: (id: string, key: FlagKey) => void;
  pick: (id: string, optionId: string) => void;
  execute: (id: string, optionId: string) => void;
  ask: (text: string) => void;
};

export function scenarioOf(
  state: Pick<CargoState, "selectedId" | "delayMin" | "extras" | "locale">,
  operatorMessage?: string,
): Scenario {
  const shipment = SHIPMENTS.find((item) => item.id === state.selectedId) ?? SHIPMENTS[0];
  return {
    shipmentId: shipment.id,
    delayMin: state.delayMin[shipment.id] ?? shipment.baseDelay,
    flags: { ...(state.extras[shipment.id] ?? {}) },
    locale: state.locale,
    ...(operatorMessage ? { operatorMessage } : {}),
  };
}

/** The model's recommendation for this exact scenario, only if it passed the verifier. */
export function verifiedModelPick(scenario: Scenario): string | null {
  const agent = useAgent.getState();
  const run = agent.run;
  if (agent.rulesOnly || !run || agent.status !== "done" || run.mode === "rules" || !run.verdict.accepted) return null;
  const { operatorMessage: _ignored, ...base } = run.scenario;
  void _ignored;
  const same =
    base.shipmentId === scenario.shipmentId &&
    base.delayMin === scenario.delayMin &&
    JSON.stringify(Object.entries(base.flags).filter(([, v]) => v).sort()) ===
      JSON.stringify(Object.entries(scenario.flags).filter(([, v]) => v).sort());
  return same ? run.decision.recommended_option_id : null;
}

/** Send the operator's message to the agent for the scenario as it stands now. */
function askAgent(text: string) {
  void useAgent.getState().start(operatorScenario(scenarioOf(useCargo.getState()), text));
}

function omit(record: Record<string, string>, id: string) {
  const next = { ...record };
  delete next[id];
  return next;
}

export const useCargo = create<CargoState>((set, get) => ({
  locale: "en",
  selectedId: "s615",
  filter: "all",
  delayMin: {},
  extras: {},
  executed: {},
  picked: {},
  note: null,
  setLocale: (locale) => set({ locale }),
  select: (selectedId) => set({ selectedId, note: null }),
  setFilter: (filter) => set({ filter }),
  setDelay: (id, minutes) =>
    set((state) => ({
      delayMin: { ...state.delayMin, [id]: clampDelay(minutes) },
      executed: omit(state.executed, id),
      picked: omit(state.picked, id),
      note: null,
    })),
  toggleFlag: (id, key) =>
    set((state) => {
      const prev = state.extras[id] ?? {};
      return {
        extras: { ...state.extras, [id]: { ...prev, [key]: !prev[key] } },
        executed: omit(state.executed, id),
        picked: omit(state.picked, id),
        note: null,
      };
    }),
  pick: (id, optionId) =>
    set((state) => ({
      picked: { ...state.picked, [id]: optionId },
    })),
  execute: (id, optionId) =>
    set((state) => ({
      executed: { ...state.executed, [id]: optionId },
      note: null,
    })),
  ask: (text) => {
    const { command, localeHint } = parseCommand(text);
    const state = get();
    const locale = localeHint ?? state.locale;
    const shipment = SHIPMENTS.find((item) => item.id === state.selectedId) ?? SHIPMENTS[0];

    if (command.type === "unknown" || command.type === "why" || command.type === "options") {
      // Free-form questions go to the agent, which answers in the operator's language.
      set({ locale, note: null });
      askAgent(text);
      return;
    }

    if (command.type === "execute") {
      if (state.executed[shipment.id]) {
        set({
          locale,
          note: L(locale, "Recovery is already staged.", "La reprise est déjà préparée."),
        });
        return;
      }
      const flags = defaultFlags(shipment, state.delayMin[shipment.id], state.extras[shipment.id]);
      const analysis = analyze(shipment, flags, locale, null);
      const modelPick = verifiedModelPick(scenarioOf(state));
      const chosen =
        analysis.options.find((o) => o.id === state.picked[shipment.id] && o.executable) ??
        analysis.options.find((o) => o.id === modelPick && o.executable) ??
        analysis.options.find((o) => o.recommended && o.executable);
      if (!chosen) {
        set({ locale, note: cannotExecuteNote(locale) });
        return;
      }
      set({
        locale,
        executed: { ...state.executed, [shipment.id]: chosen.id },
        note: L(locale, `Staged: ${chosen.title}.`, `Préparé : ${chosen.title}.`),
      });
      return;
    }

    if (command.type === "delay" && !shipment.usesDelay) {
      set({ locale, note: notDelayNote(locale) });
      askAgent(text);
      return;
    }

    const next = operatorScenario(scenarioOf(state), text);
    set({
      locale: next.locale,
      extras: { ...state.extras, [shipment.id]: next.flags },
      delayMin: { ...state.delayMin, [shipment.id]: next.delayMin },
      executed: omit(state.executed, shipment.id),
      picked: omit(state.picked, shipment.id),
      note: null,
    });
    void useAgent.getState().start(next);
  },
}));

export function useRows() {
  const locale = useCargo((s) => s.locale);
  const delayMin = useCargo((s) => s.delayMin);
  const extras = useCargo((s) => s.extras);
  const executed = useCargo((s) => s.executed);
  return useMemo(
    () =>
      SHIPMENTS.map((shipment) => ({
        shipment,
        flags: defaultFlags(shipment, delayMin[shipment.id], extras[shipment.id]),
        analysis: analyze(shipment, defaultFlags(shipment, delayMin[shipment.id], extras[shipment.id]), locale, executed[shipment.id] ?? null),
      })),
    [locale, delayMin, extras, executed],
  );
}
