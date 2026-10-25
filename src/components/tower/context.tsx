import { Brain, CloudFog, Database, ShieldAlert, ShieldCheck } from "lucide-react";
import { L, type Locale } from "@/lib/cargo/engine";
import { useCargo } from "@/lib/cargo/store";
import { LEGS, stationEvidence } from "@/lib/ops/evidence";
import type { Wx } from "@/lib/ops/weather";
import type { AgentRun } from "@/lib/agent/types";
import { cn } from "@/lib/cn";

const WX_TONE: Record<Wx, string> = {
  VFR: "border-good/60 text-good",
  MVFR: "border-line text-frost",
  IFR: "border-amber/70 text-amber",
  LIFR: "border-critical text-alert",
};

/**
 * What the agent saw from outside the cargo network on this run:
 * Zetaris station evidence, Meterless H-MEM desk memory, Meterless Scout's verdict.
 * The weather what-if chips sit here because they change the evidence.
 */
export function ContextPanel({ run, shipmentId, locale }: { run: AgentRun | null; shipmentId: string; locale: Locale }) {
  const legs = LEGS[shipmentId] ?? [];
  const ext = run?.external;
  return (
    <section aria-label={L(locale, "Context from outside the network", "Contexte hors réseau")} className="flex flex-col gap-3">
      {ext?.scout ? <ScoutLine run={run!} locale={locale} /> : null}
      {legs.length ? <Evidence run={run} shipmentId={shipmentId} locale={locale} /> : null}
      {ext?.memory ? <Memory run={run!} locale={locale} /> : null}
    </section>
  );
}

function ScoutLine({ run, locale }: { run: AgentRun; locale: Locale }) {
  const s = run.external!.scout!;
  const blocked = s.risk.level === "block";
  return (
    <p className={cn("flex flex-wrap items-center gap-2 border px-3 py-2 text-xs", blocked ? "border-critical text-alert" : "border-good/50 text-good")}>
      {blocked ? <ShieldAlert className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
      <span className="font-semibold uppercase tracking-wide">Meterless Scout</span>
      <span className="text-frost">
        {blocked
          ? L(locale, `blocked before the model: ${s.risk.flags.join(", ")}`, `bloqué avant le modèle : ${s.risk.flags.join(", ")}`)
          : L(
              locale,
              `signed contract · intent ${s.executionContract?.intent.primary.id} · risk ${s.risk.level}`,
              `contrat signé · intention ${s.executionContract?.intent.primary.id} · risque ${s.risk.level}`,
            )}
      </span>
    </p>
  );
}

function Evidence({ run, shipmentId, locale }: { run: AgentRun | null; shipmentId: string; locale: Locale }) {
  const wxState = useCargo((s) => s.wx[shipmentId] ?? {});
  const setWx = useCargo((s) => s.setWx);
  const snap = run?.external?.evidence;
  const out = snap ? (stationEvidence(shipmentId, snap, run?.scenario.wx ?? {}) as ReturnType<typeof stationEvidence> & { stations?: EvidenceStation[] }) : null;
  const stations = out && "stations" in out ? (out.stations as EvidenceStation[]) : [];
  const zetaris = snap?.backend === "zetaris";
  const uniqueStations = [...new Set((LEGS[shipmentId] ?? []).map((l) => l.station))];
  return (
    <div className="border border-line bg-panel">
      <p className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs uppercase tracking-wide">
        <Database className="size-4 text-amber" aria-hidden="true" />
        <span className="font-semibold text-frost">{L(locale, "Station evidence", "Historique des stations")}</span>
        {snap ? (
          <span className={cn("border px-1.5 py-0.5 font-semibold", zetaris ? "border-good/60 text-good" : "border-line text-mute")}>
            {zetaris ? "Zetaris" : L(locale, "offline mirror", "miroir hors ligne")}
          </span>
        ) : null}
        {snap ? <span className="normal-case tracking-normal text-mute">{L(locale, "weather", "météo")}: {snap.weather_source}</span> : null}
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {stations.map((st) => {
          const cat = st.weather.flight_category as Wx | null;
          const inCat = cat ? st.history_90_days[`in_${cat}`] : undefined;
          return (
            <li key={st.flight} className="px-3 py-2 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold text-frost">{st.station}</span>
                <span className="text-mute">{st.role}</span>
                {cat ? (
                  <span className={cn("ml-auto inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-xs", WX_TONE[cat])}>
                    {cat === "IFR" || cat === "LIFR" ? <CloudFog className="size-3.5" aria-hidden="true" /> : null}
                    {cat}
                    {st.weather.basis.startsWith("what-if") ? ` · ${L(locale, "what-if", "simulé")}` : ""}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 leading-snug text-frost">
                {cat ? `${cat}: ${inCat ?? "—"}` : ""}
                <span className="block text-xs text-mute">
                  {L(locale, "all weather", "toutes météos")}: {st.history_90_days.all_weather}
                  {st.history_90_days.sample_note ? ` · ${st.history_90_days.sample_note}` : ""}
                </span>
              </p>
              {"metar" in st.weather && st.weather.metar ? (
                <p className="mt-1 break-words font-mono text-[11px] leading-snug text-mute">{String(st.weather.metar)}</p>
              ) : null}
            </li>
          );
        })}
        {!snap ? (
          <li className="px-3 py-2 text-xs text-mute">
            {run
              ? L(locale, "This run was recorded before station evidence existed (prompt v4).", "Ce rejeu date d'avant l'historique des stations (prompt v4).")
              : L(locale, "Loading…", "Chargement…")}
          </li>
        ) : null}
      </ul>
      <div className="flex flex-col gap-1.5 border-t border-line px-3 py-2">
        <p className="text-xs uppercase tracking-wide text-mute">{L(locale, "Weather what-if", "Météo simulée")}</p>
        {uniqueStations.map((station) => (
          <div key={station} className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${station} weather`}>
            <span className="w-10 font-mono text-xs text-frost">{station}</span>
            {([null, "MVFR", "IFR", "LIFR"] as (Wx | null)[]).map((cat) => {
              const pressed = (wxState[station] ?? null) === cat;
              return (
                <button
                  key={cat ?? "live"}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setWx(shipmentId, station, cat)}
                  className={cn(
                    "min-h-9 border px-2 font-mono text-xs",
                    pressed ? "border-amber bg-amber text-amber-ink" : "border-line text-mute hover:text-frost",
                  )}
                >
                  {cat ?? L(locale, "live", "réel")}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {snap ? (
        <details className="border-t border-line px-3 py-2 text-xs">
          <summary className="min-h-9 cursor-pointer py-1.5 uppercase tracking-wide text-mute">
            {L(locale, "Federated SQL sent to Zetaris", "SQL fédéré envoyé à Zetaris")}
          </summary>
          <pre className="overflow-auto bg-ink p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-mute">{snap.sql}</pre>
          {snap.backend_note ? <p className="pt-1 text-mute">{snap.backend_note}</p> : null}
        </details>
      ) : null}
    </div>
  );
}

type EvidenceStation = {
  station: string;
  role: string;
  flight: string;
  weather: { basis: string; flight_category: string | null; metar?: string | null };
  history_90_days: Record<string, string | undefined>;
};

function Memory({ run, locale }: { run: AgentRun; locale: Locale }) {
  const mem = run.external!.memory!;
  const cited = new Set([...[run.decision.summary, ...run.decision.why, run.decision.reply ?? ""].join(" ").matchAll(/\bmem-\d+\b/g)].map((m) => m[0]));
  return (
    <div className="border border-line bg-panel">
      <p className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs uppercase tracking-wide">
        <Brain className="size-4 text-amber" aria-hidden="true" />
        <span className="font-semibold text-frost">{L(locale, "Desk memory", "Mémoire du desk")}</span>
        <span className="border border-line px-1.5 py-0.5 text-mute">Meterless H-MEM</span>
      </p>
      {mem.recalled.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {mem.recalled.map((m) => (
            <li key={m.id} className="px-3 py-2 text-sm leading-snug">
              <span className={cn("mr-2 font-mono text-xs", cited.has(m.id) ? "text-good" : "text-mute")}>
                {m.id}
                {cited.has(m.id) ? ` · ${L(locale, "cited", "cité")}` : ""}
              </span>
              <span className="text-frost">{m.content}</span>
              <span className="block text-xs text-mute">
                {m.source} · {m.learned}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-xs text-mute">{L(locale, "Nothing relevant in desk memory for this file.", "Rien de pertinent en mémoire pour ce dossier.")}</p>
      )}
      {mem.rejected?.length ? (
        <p className="border-t border-line px-3 py-2 text-xs text-alert">
          {L(locale, "Scout refused to store", "Scout a refusé d'enregistrer")}: “{mem.rejected.join("”, “")}”
        </p>
      ) : null}
      <p className="border-t border-line px-3 py-2 text-xs text-mute">
        {L(locale, "Add a handover note: type “Remember: …”", "Ajouter une note de relève : « Retiens : … »")}
      </p>
    </div>
  );
}
