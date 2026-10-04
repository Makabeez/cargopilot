import type { FlagKey, Locale, Risk } from "../cargo/engine";

/** Everything that determines one agent run. Same scenario → same tool outputs. */
export type Scenario = {
  shipmentId: string;
  delayMin: number;
  flags: Partial<Record<FlagKey, boolean>>;
  locale: Locale;
  /** Free text the operator typed, if any. The agent answers it in its language. */
  operatorMessage?: string;
};

export type AgentMode = "live" | "replay" | "rules";

export type ToolStep = {
  kind: "tool";
  callId: string;
  name: string;
  args: Record<string, unknown>;
  output: unknown;
  ms: number;
  error?: string;
};

export type ModelStep = {
  kind: "model";
  turn: number;
  ms: number;
  promptTokens?: number;
  completionTokens?: number;
  reasoningChars?: number;
  /** Free text the model emitted alongside (or instead of) tool calls. */
  text?: string;
  toolCalls: string[];
};

export type Check = { id: string; label: string; pass: boolean; detail?: string };

export type VerifyStep = {
  kind: "verify";
  attempt: number;
  accepted: boolean;
  checks: Check[];
  /** What the model submitted on this attempt (kept for rejected attempts too). */
  submitted?: Decision | { raw: string };
};

export type NoteStep = { kind: "note"; text: string };

export type Step = ToolStep | ModelStep | VerifyStep | NoteStep;

export type Decision = {
  risk: Risk;
  recommended_option_id: string;
  ranking: string[];
  summary: string;
  why: string[];
  reply?: string;
  customer_note?: string;
};

export type Verdict = {
  /** Decision passed every check. */
  accepted: boolean;
  /** Number of submit_decision attempts the model used. */
  attempts: number;
  /** Model never produced an acceptable decision; the rules decision was used. */
  fellBack: boolean;
  checks: Check[];
};

export type AgentRun = {
  version: 1;
  scenarioKey: string;
  scenario: Scenario;
  mode: AgentMode;
  /** Model id for live/replay runs; "rules-engine" otherwise. */
  model: string;
  provider: string;
  startedAt: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  steps: Step[];
  decision: Decision;
  verdict: Verdict;
  baseline: { recommended_option_id: string; risk: Risk; agrees: boolean };
  /** System-prompt revision used for a live run (absent on v1 recordings). */
  promptVersion?: string;
  /** Set when this run was served from a recorded trace. */
  replayOf?: { recordedAt: string; model: string; promptVersion?: string };
};

export type StepSink = (step: Step) => void;
