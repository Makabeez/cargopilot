import { create } from "zustand";
import type { AgentMode, AgentRun, Scenario, Step } from "./types";
import { scenarioKey } from "./key";

export type AgentState = {
  status: "idle" | "running" | "done" | "error";
  key: string | null;
  /** Scenario key without the operator message — what the auto-run watches. */
  base: string | null;
  mode: AgentMode | null;
  model: string | null;
  provider: string | null;
  replayOf?: { recordedAt: string; model: string; promptVersion?: string };
  startedAt: number | null;
  steps: Step[];
  run: AgentRun | null;
  error: string | null;
  rulesOnly: boolean;
  /** Finished runs by scenario key, so revisiting a file is instant. */
  done: Record<string, AgentRun>;
  setRulesOnly: (v: boolean) => void;
  start: (scenario: Scenario) => Promise<void>;
};

let inflight: AbortController | null = null;

export const useAgent = create<AgentState>((set, get) => ({
  status: "idle",
  key: null,
  base: null,
  mode: null,
  model: null,
  provider: null,
  startedAt: null,
  steps: [],
  run: null,
  error: null,
  rulesOnly: false,
  done: {},
  setRulesOnly: (rulesOnly) => set({ rulesOnly, done: {}, base: null }),
  start: async (scenario) => {
    const replaySet = replaySetFromUrl();
    const suffix = (get().rulesOnly ? "#rules" : "") + (replaySet ? `#${replaySet}` : "");
    const key = scenarioKey(scenario) + suffix;
    const base = scenarioKey({ ...scenario, operatorMessage: undefined }) + suffix;
    const cached = get().done[key];
    if (cached && !scenario.operatorMessage) {
      inflight?.abort();
      inflight = null;
      set({
        status: "done",
        key,
        base,
        mode: cached.mode,
        model: cached.model,
        provider: cached.provider,
        replayOf: cached.replayOf,
        steps: cached.steps,
        run: cached,
        error: null,
        startedAt: null,
      });
      return;
    }
    inflight?.abort();
    const ac = new AbortController();
    inflight = ac;
    set({ status: "running", key, base, steps: [], run: null, error: null, mode: null, startedAt: Date.now() });
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, mode: get().rulesOnly ? "rules" : "auto", ...(replaySet ? { replaySet } : {}) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Agent request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || inflight !== ac) continue;
          const msg = JSON.parse(line) as
            | { type: "start"; mode: AgentMode; model: string; provider: string; replayOf?: AgentState["replayOf"] }
            | { type: "step"; step: Step }
            | { type: "done"; run: AgentRun }
            | { type: "error"; message: string };
          if (msg.type === "start") set({ mode: msg.mode, model: msg.model, provider: msg.provider, replayOf: msg.replayOf });
          else if (msg.type === "step") set((s) => ({ steps: [...s.steps, msg.step] }));
          else if (msg.type === "done")
            set((s) => ({
              status: "done",
              run: msg.run,
              steps: msg.run.steps,
              done: scenario.operatorMessage ? s.done : { ...s.done, [key]: msg.run },
            }));
          else if (msg.type === "error") set({ status: "error", error: msg.message });
        }
      }
      if (inflight === ac && get().status === "running") {
        // Stream closed without a result (platform timeout, dropped connection).
        set({ status: "error", error: "The agent connection closed before a decision arrived.", base: null });
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      set({ status: "error", error: e instanceof Error ? e.message : String(e), base: null });
    } finally {
      if (inflight === ac) inflight = null;
    }
  },
}));

/** `?replay=v1` replays an archived recording set (labelled with its prompt version). */
export function replaySetFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("replay");
  return v && /^[\w.-]{1,60}$/.test(v) ? v : null;
}

export function baseKeyFor(scenario: Scenario, rulesOnly: boolean): string {
  const replaySet = replaySetFromUrl();
  return (
    scenarioKey({ ...scenario, operatorMessage: undefined }) + (rulesOnly ? "#rules" : "") + (replaySet ? `#${replaySet}` : "")
  );
}
