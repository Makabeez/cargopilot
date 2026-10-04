import { useEffect, useState } from "react";
import { Check as CheckIcon, Cpu, History, Loader2, ShieldCheck, ShieldX, Wrench, X } from "lucide-react";
import { chrome } from "@/lib/cargo/copy";
import { L, SHIPMENTS, type Locale } from "@/lib/cargo/engine";
import { scenarioOf, useCargo, useRows } from "@/lib/cargo/store";
import { baseKeyFor, useAgent } from "@/lib/agent/client";
import type { AgentRun, Step, ToolStep, VerifyStep } from "@/lib/agent/types";
import { cn } from "@/lib/cn";

export function AgentLog() {
  const locale = useCargo((s) => s.locale);
  const selectedId = useCargo((s) => s.selectedId);
  const delayMin = useCargo((s) => s.delayMin);
  const extras = useCargo((s) => s.extras);
  const note = useCargo((s) => s.note);
  const ask = useCargo((s) => s.ask);
  const rows = useRows();
  const copy = chrome(locale);
  const row = rows.find((item) => item.shipment.id === selectedId) ?? rows[0];
  const [draft, setDraft] = useState("");

  const agent = useAgent();
  const scenario = scenarioOf({ selectedId, delayMin, extras, locale });
  const currentBase = baseKeyFor(scenario, agent.rulesOnly);

  // Re-run the agent whenever the file, the scenario or the language changes.
  useEffect(() => {
    if (useAgent.getState().base === currentBase) return;
    const t = setTimeout(() => {
      if (useAgent.getState().base !== currentBase) void useAgent.getState().start(scenario);
    }, 450);
    return () => clearTimeout(t);
    // scenario is fully described by currentBase
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBase]);

  const stale = agent.base !== currentBase;
  const run = !stale && agent.status === "done" ? agent.run : null;

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-mute">{copy.agent}</p>
        <h2 className="mt-1 font-display text-2xl tracking-wide text-frost">{row.analysis.signal}</h2>
        <ModeBadge locale={locale} />
      </header>

      {run ? (
        <DecisionCard
          run={run}
          locale={locale}
          titles={Object.fromEntries(row.analysis.options.map((o) => [o.id, o.title]))}
        />
      ) : <Working locale={locale} stale={stale} />}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          ask(text);
          setDraft("");
        }}
      >
        <label className="text-xs uppercase tracking-wide text-mute" htmlFor="desk-ask">
          {copy.ask}
        </label>
        <textarea
          id="desk-ask"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          maxLength={400}
          placeholder={row.shipment.usesDelay ? copy.placeholder : copy.placeholderStatic}
          className="mt-1 min-h-20 w-full resize-none border border-line bg-panel-2 px-3 py-2 text-sm text-frost placeholder:text-mute"
        />
        <button type="submit" className="mt-2 min-h-11 bg-amber px-4 text-sm font-semibold text-amber-ink">
          {copy.send}
        </button>
      </form>

      {note ? (
        <p role="status" className="border border-line bg-panel-2 px-3 py-2 text-sm leading-relaxed text-frost">
          {note}
        </p>
      ) : null}

      <Trace locale={locale} />

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 border border-line px-3 py-2 text-sm text-mute">
        <span>
          {L(locale, "Rules engine only (no model call)", "Moteur de règles seul (aucun appel modèle)")}
        </span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--color-amber)]"
          checked={agent.rulesOnly}
          onChange={(e) => agent.setRulesOnly(e.target.checked)}
        />
      </label>

      <details className="border border-line px-3 py-2 text-sm text-mute">
        <summary className="min-h-11 cursor-pointer py-2 text-frost">{copy.model}</summary>
        <p className="pb-2 leading-relaxed">{copy.modelBody}</p>
      </details>
    </div>
  );
}

function ModeBadge({ locale }: { locale: Locale }) {
  const { mode, model, provider, replayOf, status } = useAgent();
  if (!mode) {
    return (
      <p className="mt-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-mute">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        {status === "error" ? L(locale, "Agent unavailable", "Agent indisponible") : L(locale, "Connecting", "Connexion")}
      </p>
    );
  }
  const base = "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border px-2 py-1.5 text-xs";
  if (mode === "live") {
    return (
      <p className={cn(base, "border-good/60 text-good")}>
        <span className="live-dot size-2 rounded-full bg-good" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wide">Live</span>
        <span className="text-frost">NVIDIA Nemotron · {provider}</span>
        <span className="font-mono text-mute">{model}</span>
      </p>
    );
  }
  if (mode === "replay") {
    return (
      <p className={cn(base, "border-amber/60 text-amber")}>
        <History className="size-3.5" aria-hidden="true" />
        <span className="font-semibold uppercase tracking-wide">
          {L(locale, "Replay", "Rejeu")}
          {replayOf?.promptVersion ? ` · prompt ${replayOf.promptVersion}` : ""}
        </span>
        <span className="text-frost">
          {L(locale, "recorded", "enregistré")} {replayOf ? replayOf.recordedAt.slice(0, 16).replace("T", " ") : ""} UTC
        </span>
        <span className="font-mono text-mute">{replayOf?.model ?? model}</span>
      </p>
    );
  }
  return (
    <p className={cn(base, "border-line text-mute")}>
      <Cpu className="size-3.5" aria-hidden="true" />
      <span className="font-semibold uppercase tracking-wide">{L(locale, "Rules only", "Règles seules")}</span>
      <span>{L(locale, "no model call", "aucun appel modèle")}</span>
    </p>
  );
}

function Working({ locale, stale }: { locale: Locale; stale: boolean }) {
  const { status, startedAt, mode, error } = useAgent();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [status]);
  if (status === "error") {
    return <p className="border border-critical bg-panel-2 px-3 py-2 text-sm text-alert">{error}</p>;
  }
  const secs = startedAt && status === "running" ? ((now - startedAt) / 1000).toFixed(1) : null;
  const who = mode === "live" ? "Nemotron" : mode === "replay" ? L(locale, "Replay", "Rejeu") : L(locale, "Agent", "Agent");
  return (
    <p className="flex items-center gap-2 border border-line bg-panel px-3 py-3 text-sm text-frost">
      <Loader2 className="size-4 animate-spin text-amber" aria-hidden="true" />
      <span>
        {stale && status !== "running"
          ? L(locale, "Scenario changed — re-running…", "Scénario modifié — nouvelle analyse…")
          : L(locale, `${who} is working the file`, `${who} traite le dossier`)}
      </span>
      {secs ? <span className="ml-auto font-mono text-xs tabular-nums text-mute">{secs} s</span> : null}
    </p>
  );
}

function DecisionCard({ run, locale, titles }: { run: AgentRun; locale: Locale; titles: Record<string, string> }) {
  const d = run.decision;
  const shipment = SHIPMENTS.find((s) => s.id === run.scenario.shipmentId);
  const passed = run.verdict.checks.filter((c) => c.pass).length;
  const total = run.verdict.checks.length;
  const verified = run.verdict.accepted && !run.verdict.fellBack;
  const optionTitle = (id: string) => titles[id] ?? id;
  return (
    <section className="border border-line bg-panel" aria-live="polite">
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs uppercase tracking-wide",
          verified ? "text-good" : run.verdict.fellBack ? "text-alert" : "text-mute",
        )}
      >
        {verified || run.mode === "rules" ? (
          <ShieldCheck className="size-4" aria-hidden="true" />
        ) : (
          <ShieldX className="size-4" aria-hidden="true" />
        )}
        <span className="font-semibold">
          {run.verdict.fellBack
            ? L(locale, `Model rejected ×${run.verdict.attempts} → rules decision`, `Modèle rejeté ×${run.verdict.attempts} → décision règles`)
            : run.mode === "rules"
              ? L(locale, "Rules decision", "Décision règles")
              : L(locale, "Verified decision", "Décision vérifiée")}
        </span>
        <span className="text-mute normal-case tracking-normal">
          {passed}/{total} {L(locale, "checks", "contrôles")}
          {run.mode !== "rules" ? ` · ${L(locale, "attempt", "essai")} ${run.verdict.attempts}` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-3 py-3">
        {d.reply ? (
          <p className="border-l-2 border-amber pl-3 text-sm leading-relaxed text-frost">{d.reply}</p>
        ) : null}
        <p className="text-sm leading-relaxed text-frost">{d.summary}</p>
        {d.why.length > 0 ? (
          <ul className="flex flex-col gap-1.5 text-sm leading-snug text-frost">
            {d.why.map((w) => (
              <li key={w} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 bg-amber" aria-hidden="true" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="uppercase tracking-wide text-mute">{L(locale, "Pick", "Choix")}</dt>
            <dd className="text-frost">{optionTitle(d.recommended_option_id)}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-mute">{L(locale, "Rules engine", "Moteur de règles")}</dt>
            <dd className={cn(run.baseline.agrees ? "text-good" : "text-amber")}>
              {run.baseline.agrees
                ? L(locale, "agrees", "d'accord")
                : L(
                    locale,
                    `would pick: ${optionTitle(run.baseline.recommended_option_id)}`,
                    `choisirait : ${optionTitle(run.baseline.recommended_option_id)}`,
                  )}
            </dd>
          </div>
          {run.mode !== "rules" ? (
            <>
              <div>
                <dt className="uppercase tracking-wide text-mute">{L(locale, "Latency", "Latence")}</dt>
                <dd className="font-mono tabular-nums text-frost">{(run.latencyMs / 1000).toFixed(1)} s</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-mute">Tokens</dt>
                <dd className="font-mono tabular-nums text-frost">
                  {run.promptTokens.toLocaleString("en")} → {run.completionTokens.toLocaleString("en")}
                </dd>
              </div>
            </>
          ) : null}
        </dl>
        {d.customer_note ? (
          <details className="border border-line px-2 py-1 text-sm">
            <summary className="min-h-9 cursor-pointer py-1.5 text-xs uppercase tracking-wide text-mute">
              {L(locale, "Customer note", "Note client")} · {shipment?.customer} ({shipment?.customerLang.toUpperCase()})
            </summary>
            <p className="pb-2 leading-relaxed whitespace-pre-wrap text-frost">{d.customer_note}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function Trace({ locale }: { locale: Locale }) {
  const steps = useAgent((s) => s.steps);
  if (steps.length === 0) return null;
  return (
    <section aria-label={L(locale, "Agent trace", "Trace de l'agent")}>
      <h3 className="font-display text-lg tracking-wide text-amber">{L(locale, "Agent trace", "Trace de l'agent")}</h3>
      <ol className="mt-2 flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={i} className="trace-in">
            <StepView step={step} locale={locale} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function StepView({ step, locale }: { step: Step; locale: Locale }) {
  if (step.kind === "note") {
    return <p className="px-1 text-xs italic leading-snug text-mute">{step.text}</p>;
  }
  if (step.kind === "model") {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-line/70 bg-ink px-3 py-2 text-xs">
        <Cpu className="size-3.5 text-good" aria-hidden="true" />
        <span className="font-semibold text-frost">Nemotron</span>
        <span className="text-mute">
          {L(locale, "turn", "tour")} {step.turn} · {(step.ms / 1000).toFixed(1)} s
          {step.completionTokens ? ` · ${step.completionTokens} tok` : ""}
          {step.reasoningChars ? ` · ${L(locale, "reasoned", "raisonné")} ${(step.reasoningChars / 1000).toFixed(1)}k` : ""}
        </span>
        {step.toolCalls.length ? (
          <span className="w-full font-mono text-amber">→ {step.toolCalls.join(", ")}</span>
        ) : step.text ? (
          <span className="w-full text-frost">{step.text.slice(0, 240)}</span>
        ) : null}
      </div>
    );
  }
  if (step.kind === "verify") {
    return (
      <div className={cn("border px-3 py-2", step.accepted ? "border-good/50" : "border-critical")}>
        <p className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", step.accepted ? "text-good" : "text-alert")}>
          {step.accepted ? <ShieldCheck className="size-4" aria-hidden="true" /> : <ShieldX className="size-4" aria-hidden="true" />}
          {L(locale, "Verifier", "Vérificateur")} · {L(locale, "attempt", "essai")} {step.attempt} ·{" "}
          {step.accepted ? L(locale, "accepted", "accepté") : L(locale, "sent back", "renvoyé")}
        </p>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs">
          {step.checks.map((c) => (
            <li key={c.id} className="flex gap-2">
              {c.pass ? (
                <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden="true" />
              ) : (
                <X className="mt-0.5 size-3.5 shrink-0 text-alert" aria-hidden="true" />
              )}
              <span className={c.pass ? "text-mute" : "text-frost"}>
                {c.label}
                {c.detail ? <span className="block text-alert">{c.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {!step.accepted && step.submitted ? <Rejected submitted={step.submitted} locale={locale} /> : null}
      </div>
    );
  }
  return <ToolView step={step} />;
}

/** What the model actually submitted on a rejected attempt. */
function Rejected({ submitted, locale }: { submitted: NonNullable<VerifyStep["submitted"]>; locale: Locale }) {
  const lines =
    "raw" in submitted
      ? [submitted.raw.slice(0, 280)]
      : [
          `${L(locale, "pick", "choix")}: ${submitted.recommended_option_id} · risk: ${submitted.risk}`,
          ...(submitted.reply ? [`reply: “${submitted.reply.slice(0, 200)}”`] : []),
          ...(!submitted.reply ? [submitted.summary.slice(0, 200)] : []),
        ];
  return (
    <details className="mt-2 border-t border-line pt-1.5 text-xs">
      <summary className="cursor-pointer py-1 uppercase tracking-wide text-mute">
        {L(locale, "What Nemotron submitted", "Ce que Nemotron a soumis")}
      </summary>
      <ul className="flex flex-col gap-1 pb-1 font-mono leading-snug text-frost">
        {lines.map((l, i) => (
          <li key={i} className="break-words">
            {l}
          </li>
        ))}
      </ul>
    </details>
  );
}

function preview(step: ToolStep): string[] {
  const o = step.output as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return [String(o)];
  if (typeof o.error === "string") return [o.error];
  if (Array.isArray(o.options)) {
    return (o.options as { option_id: string; status: string; via: string; delay: string; cost: string }[]).map(
      (x) => `${x.status === "blocked" ? "✕" : "·"} ${x.option_id} — ${x.via} · ${x.delay} · ${x.cost}`,
    );
  }
  if (Array.isArray(o.facts)) {
    return (o.facts as string[]).length ? (o.facts as string[]) : [String(o.note ?? "n/a")];
  }
  if (typeof o.risk === "string") return [`${String(o.risk).toUpperCase()} · ${String(o.classification ?? "")}`];
  if (typeof o.signal === "string") return [String(o.signal), ...((o.observed as string[]) ?? [])];
  if (typeof o.awb === "string") {
    return [`${String(o.awb)} · ${String(o.booked_route)} · ${String(o.weight_kg)} kg · ${String(o.pieces)} pcs · ${String(o.handling_code)}`];
  }
  return [JSON.stringify(o).slice(0, 160)];
}

function ToolView({ step }: { step: ToolStep }) {
  return (
    <details className={cn("border bg-panel px-3 py-2", step.error ? "border-critical" : "border-line")}>
      <summary className="cursor-pointer list-none">
        <p className="flex items-center gap-2 font-mono text-xs text-amber">
          <Wrench className="size-3.5" aria-hidden="true" />
          {step.name}
          <span className="text-mute">({String(step.args.awb ?? "")})</span>
        </p>
        <ul className="mt-1 flex flex-col gap-0.5">
          {preview(step).map((line, i) => (
            <li key={i} className="text-sm leading-snug text-frost">
              {line}
            </li>
          ))}
        </ul>
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto bg-ink p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-mute">
        {JSON.stringify(step.output, null, 2)}
      </pre>
    </details>
  );
}
