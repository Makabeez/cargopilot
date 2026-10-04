import { chrome, metricTone, stampTone } from "@/lib/cargo/copy";
import { messages } from "@/lib/cargo/engine";
import { scenarioOf, useCargo, useRows, verifiedModelPick } from "@/lib/cargo/store";
import { useAgent } from "@/lib/agent/client";
import { L } from "@/lib/cargo/engine";
import { cn } from "@/lib/cn";

export function ShipmentFile() {
  const locale = useCargo((s) => s.locale);
  const selectedId = useCargo((s) => s.selectedId);
  const picked = useCargo((s) => s.picked);
  const setDelay = useCargo((s) => s.setDelay);
  const toggleFlag = useCargo((s) => s.toggleFlag);
  const pick = useCargo((s) => s.pick);
  const execute = useCargo((s) => s.execute);
  const delayMin = useCargo((s) => s.delayMin);
  const extras = useCargo((s) => s.extras);
  const agentRun = useAgent((s) => s.run);
  useAgent((s) => s.status);
  const rows = useRows();
  const copy = chrome(locale);
  const row = rows.find((item) => item.shipment.id === selectedId) ?? rows[0];
  const { shipment, analysis, flags } = row;
  const modelPick = verifiedModelPick(scenarioOf({ selectedId, delayMin, extras, locale }));
  const chosen =
    analysis.options.find((option) => option.id === picked[shipment.id] && option.feasible) ??
    analysis.options.find((option) => option.id === modelPick && option.feasible) ??
    analysis.options.find((option) => option.recommended) ??
    analysis.options.find((option) => option.feasible);
  const basePack =
    analysis.staged && chosen ? messages(shipment, analysis, chosen.id, locale) : null;
  const modelNote =
    agentRun && modelPick && chosen?.id === modelPick ? agentRun.decision.customer_note : undefined;
  const pack =
    basePack && modelNote
      ? {
          ...basePack,
          customerTitle: L(locale, "Customer message · drafted by Nemotron, verified", "Message client · rédigé par Nemotron, vérifié"),
          customer: modelNote,
        }
      : basePack;
  const showCustomerNote = shipment.customerLang !== locale;

  return (
    <article className="flex min-h-full flex-col bg-paper text-paper-ink">
      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-paper-mute">
              {copy.awb} · {shipment.handling}
            </p>
            <h2 className="font-mono text-lg tabular-nums">{shipment.awb}</h2>
            <p className="font-display text-4xl leading-none tracking-wide">{shipment.route}</p>
            <p className="mt-2 text-sm text-paper-mute">
              {copy.pieces(shipment.pieces, shipment.weightKg)} · {shipment.commodity[locale]} · {shipment.dims}
            </p>
            <p className="text-sm text-paper-mute">
              {shipment.customer}
              {shipment.priority !== "standard" ? ` · ${shipment.priority}` : ""}
            </p>
          </div>
          <p className={cn("px-3 py-2 text-sm font-semibold uppercase tracking-wide", stampTone(analysis.risk))}>
            {analysis.stamp}
          </p>
        </header>

        {analysis.was ? (
          <p className="mt-3 text-sm text-paper-mute">
            {copy.was}: {analysis.was}
          </p>
        ) : null}

        <p className="mt-4 max-w-3xl text-sm leading-relaxed">{analysis.narrative}</p>

        <section className="mt-4" aria-label={copy.why}>
          <h3 className="text-xs uppercase tracking-wide text-paper-mute">{copy.why}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {analysis.metrics.map((metric) => (
              <div key={metric.label} className="bg-paper-2 px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-paper-mute">{metric.label}</dt>
                <dd className={cn("font-mono text-lg tabular-nums", metricTone(metric.tone))}>{metric.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-4" aria-label={copy.chain}>
          <h3 className="text-xs uppercase tracking-wide text-paper-mute">{copy.chain}</h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-5">
            {analysis.chain.map((node) => (
              <li
                key={`${node.label}-${node.time}`}
                className={cn(
                  "border-l-2 pl-2",
                  node.state === "risk" && "border-critical",
                  node.state === "ok" && "border-safe",
                  node.state === "done" && "border-paper-mute",
                  node.state === "future" && "border-paper-line",
                )}
              >
                <p className="text-xs text-paper-mute">{node.label}</p>
                <p className="font-mono text-sm tabular-nums">{node.time}</p>
                <p className="text-xs text-paper-mute">{node.hint}</p>
              </li>
            ))}
          </ol>
        </section>

        {shipment.usesDelay ? (
          <section className="mt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="min-w-0 flex-1" htmlFor="truck-delay">
                <span className="text-xs uppercase tracking-wide text-paper-mute">
                  {copy.delay} · {copy.minutes(flags.delayMin)}
                </span>
                <input
                  id="truck-delay"
                  type="range"
                  min={0}
                  max={180}
                  step={5}
                  value={flags.delayMin}
                  onChange={(event) => setDelay(shipment.id, Number(event.target.value))}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 border border-paper-line px-3 text-sm"
                  onClick={() => setDelay(shipment.id, 0)}
                >
                  {copy.before}
                </button>
                <button
                  type="button"
                  className="min-h-11 border border-paper-line px-3 text-sm"
                  onClick={() => setDelay(shipment.id, shipment.baseDelay)}
                >
                  {copy.restore(shipment.baseDelay)}
                </button>
              </div>
            </div>
            {flags.delayMin !== shipment.baseDelay ? (
              <p className="mt-2 text-sm text-paper-mute">{copy.scenario(flags.delayMin, shipment.baseDelay)}</p>
            ) : null}
          </section>
        ) : null}

        {analysis.chips.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            {analysis.chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={chip.pressed}
                onClick={() => toggleFlag(shipment.id, chip.id)}
                className={cn(
                  "min-h-11 border px-3 text-left text-sm",
                  chip.pressed ? "border-amber bg-amber text-amber-ink" : "border-paper-line",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}

        <section className="mt-5" aria-label={copy.options}>
          <h3 className="text-xs uppercase tracking-wide text-paper-mute">{copy.options}</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {analysis.options.map((option) => {
              const active = chosen?.id === option.id;
              return (
                <li key={option.id}>
                  {option.feasible && option.executable ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => pick(shipment.id, option.id)}
                      className={cn(
                        "w-full border px-3 py-2 text-left",
                        active ? "border-amber bg-paper-2" : "border-paper-line hover:border-amber",
                      )}
                    >
                      <OptionBody option={option} copy={copy} modelPick={modelPick === option.id} />
                    </button>
                  ) : (
                    <div className="border border-paper-line px-3 py-2 opacity-70">
                      <OptionBody option={option} copy={copy} modelPick={modelPick === option.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {pack ? (
          <section className="mt-5 space-y-3" aria-live="polite">
            <p className="text-sm text-paper-mute">{copy.notSent}</p>
            {showCustomerNote ? <p className="text-sm text-paper-mute">{copy.customerLang}</p> : null}
            <Message title={pack.rebookingTitle} body={pack.rebooking} />
            <Message title={pack.customerTitle} body={pack.customer} />
            <Message title={pack.handlingTitle} body={pack.handling} />
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-paper-line bg-paper px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-paper-mute">
            {chosen && chosen.id === modelPick
              ? L(locale, "Nemotron pick", "Choix Nemotron")
              : chosen?.recommended
                ? L(locale, "Rules pick", "Choix règles")
                : copy.selected}
          </p>
          <p className="truncate text-sm font-medium">{chosen?.title ?? copy.none}</p>
        </div>
        <button
          type="button"
          disabled={analysis.staged || !chosen?.executable}
          onClick={() => chosen && execute(shipment.id, chosen.id)}
          className="min-h-11 shrink-0 bg-amber px-4 text-sm font-semibold text-amber-ink disabled:bg-paper-2 disabled:text-paper-mute"
        >
          {analysis.staged ? copy.staged : chosen?.executable ? copy.execute : copy.none}
        </button>
      </div>
    </article>
  );
}

function OptionBody({
  option,
  copy,
  modelPick,
}: {
  modelPick: boolean;
  option: {
    title: string;
    via: string;
    deltaLabel: string;
    costLabel: string;
    riskLabel: string;
    reason: string;
    recommended: boolean;
    feasible: boolean;
  };
  copy: ReturnType<typeof chrome>;
}) {
  return (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{option.title}</span>
        <span className="font-mono text-xs tabular-nums text-paper-mute">
          {option.deltaLabel} · {option.costLabel}
        </span>
      </span>
      <span className="mt-1 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-paper-mute">
        {modelPick ? <span className="bg-paper-ink px-1 text-paper">Nemotron</span> : null}
        {option.recommended ? <span className="text-paper-ink">{copy.rulesPick}</span> : null}
        {!option.feasible ? <span>{copy.infeasible}</span> : null}
        <span>{option.riskLabel}</span>
        <span>{option.via}</span>
      </span>
      <span className="mt-1 block text-sm leading-snug text-paper-ink">{option.reason}</span>
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-paper-line bg-paper-2 p-3">
      <h3 className="text-xs uppercase tracking-wide text-paper-mute">{title}</h3>
      <pre className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-paper-ink">{body}</pre>
    </div>
  );
}
