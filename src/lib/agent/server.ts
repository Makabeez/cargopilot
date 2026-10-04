/**
 * Server side of /api/agent. Picks the mode, enforces spend limits, streams
 * steps as NDJSON. The API key never leaves the server.
 */
import { z } from "zod";
import { SHIPMENTS } from "../cargo/engine";
import { asReplay, runLiveAgent, runRulesAgent, scenarioKey, streamReplay, DEFAULT_MODEL, PROVIDER } from "./agent";
import type { AgentRun, Scenario, Step } from "./types";

const RequestSchema = z.object({
  scenario: z.object({
    shipmentId: z.string().refine((id) => SHIPMENTS.some((s) => s.id === id), "unknown shipment"),
    delayMin: z.number().int().min(0).max(180),
    flags: z
      .object({
        dropTall: z.boolean().optional(),
        freighterFull: z.boolean().optional(),
        confirmExcursion: z.boolean().optional(),
        forceSplit: z.boolean().optional(),
      })
      .default({}),
    locale: z.enum(["en", "fr"]),
    operatorMessage: z.string().max(400).optional(),
  }),
  mode: z.enum(["auto", "rules"]).default("auto"),
  /** Replay an archived recording set, e.g. "v1" → data/eval/history/*-prompt-v1. */
  replaySet: z
    .string()
    .max(60)
    .regex(/^[\w.-]+$/)
    .optional(),
});

// Local development: pick up NEBIUS_API_KEY etc. from .env (never on a deploy).
try {
  if (!process.env.VERCEL && !process.env.NEBIUS_API_KEY) process.loadEnvFile(".env");
} catch {
  /* no .env — fine */
}

// Recorded live runs, bundled at build time (see `npm run agent:record`).
const RECORDED = import.meta.glob<AgentRun>("/data/traces/*.json", { eager: true, import: "default" });
const recordedByKey = new Map<string, AgentRun>();
for (const run of Object.values(RECORDED)) recordedByKey.set(run.scenarioKey, run);

// Archived recordings (earlier prompt versions), replayable with ?replay=<set>.
const HISTORY = import.meta.glob<AgentRun>("/data/eval/history/*/traces/*.json", { eager: true, import: "default" });
const historySets = new Map<string, Map<string, AgentRun>>();
for (const [path, run] of Object.entries(HISTORY)) {
  const set = path.split("/history/")[1].split("/")[0];
  if (!historySets.has(set)) historySets.set(set, new Map());
  historySets.get(set)!.set(run.scenarioKey, run);
}
function historyRun(wanted: string, key: string): AgentRun | undefined {
  const sets = [...historySets.keys()].filter((s) => s.includes(wanted)).sort().reverse();
  for (const s of sets) {
    const run = historySets.get(s)!.get(key);
    if (run) return run;
  }
  return undefined;
}

// Live runs served from this instance, reused for identical scenarios.
const cache = new Map<string, { run: AgentRun; at: number }>();
const CACHE_MS = 30 * 60_000;

const hits = new Map<string, number[]>();
let liveThisHour: number[] = [];

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function allowLive(ip: string): string | null {
  const now = Date.now();
  const perIp = num("AGENT_RATE_PER_10MIN", 30);
  const perHour = num("AGENT_MAX_LIVE_PER_HOUR", 300);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > 10 * 60_000) hits.delete(k);
  const mine = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  liveThisHour = liveThisHour.filter((t) => now - t < 3_600_000);
  if (mine.length >= perIp) return "Live model rate limit reached for this visitor — serving replay/rules.";
  if (liveThisHour.length >= perHour) return "Hourly live budget reached — serving replay/rules.";
  mine.push(now);
  hits.set(ip, mine);
  liveThisHour.push(now);
  return null;
}

function extraBody(): Record<string, unknown> | undefined {
  const raw = process.env.NEBIUS_EXTRA_BODY?.trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function agentStatus() {
  return {
    live: !!process.env.NEBIUS_API_KEY?.trim(),
    model: process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL,
    provider: PROVIDER,
    recorded: recordedByKey.size,
    history: [...historySets.entries()].map(([set, runs]) => ({ set, runs: runs.size })),
  };
}

export async function handleAgentRequest(request: Request): Promise<Response> {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await request.json());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "bad request" }, { status: 400 });
  }
  const scenario: Scenario = parsed.scenario;
  const key = scenarioKey(scenario);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const apiKey = process.env.NEBIUS_API_KEY?.trim();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const onStep = (step: Step) => send({ type: "step", step });
      try {
        let run: AgentRun | undefined;
        const cached = cache.get(key);
        const recorded = recordedByKey.get(key);

        const archived = parsed.replaySet ? historyRun(parsed.replaySet, key) : undefined;

        if (parsed.mode === "rules") {
          send({ type: "start", mode: "rules", model: "rules-engine", provider: "local" });
          run = await runRulesAgent(scenario, onStep);
        } else if (archived) {
          run = asReplay(archived);
          send({ type: "start", mode: "replay", model: run.model, provider: run.provider, replayOf: run.replayOf });
          await streamReplay(run, onStep);
        } else if (cached && Date.now() - cached.at < CACHE_MS) {
          run = asReplay(cached.run);
          send({ type: "start", mode: "replay", model: run.model, provider: run.provider, replayOf: run.replayOf });
          await streamReplay(run, onStep, 60);
        } else if (apiKey) {
          const limited = allowLive(ip);
          if (!limited) {
            const model = process.env.NEBIUS_MODEL?.trim() || DEFAULT_MODEL;
            send({ type: "start", mode: "live", model, provider: PROVIDER });
            run = await runLiveAgent(
              scenario,
              {
                apiKey,
                model,
                baseUrl: process.env.NEBIUS_BASE_URL?.trim() || undefined,
                temperature: process.env.AGENT_TEMPERATURE ? Number(process.env.AGENT_TEMPERATURE) : undefined,
                extraBody: extraBody(),
              },
              onStep,
              request.signal,
            );
            if (run.verdict.accepted) cache.set(key, { run, at: Date.now() });
            else if (run.verdict.fellBack && recorded) {
              // The live call failed or was rejected; a verified recording is the better answer.
              onStep({ kind: "note", text: "Live run did not produce a verified decision — serving the recorded run." });
              run = undefined;
            }
          } else {
            onStep({ kind: "note", text: limited });
          }
        }

        if (!run && recorded) {
          run = asReplay(recorded);
          send({ type: "start", mode: "replay", model: run.model, provider: run.provider, replayOf: run.replayOf });
          await streamReplay(run, onStep);
        }
        if (!run) {
          send({ type: "start", mode: "rules", model: "rules-engine", provider: "local" });
          run = await runRulesAgent(scenario, onStep);
        }
        send({ type: "done", run });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
