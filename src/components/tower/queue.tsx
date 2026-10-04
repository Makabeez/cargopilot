import { Boxes, Clock, FileWarning, Plane, ShieldAlert, Snowflake, Thermometer, Truck, Warehouse } from "lucide-react";
import { bucketLabel, chrome, matches, stampTone, type Filter } from "@/lib/cargo/copy";
import type { Kind, Risk } from "@/lib/cargo/engine";
import { QUIET_BOOK } from "@/lib/cargo/engine";
import { useCargo, useRows } from "@/lib/cargo/store";
import { cn } from "@/lib/cn";

const ICONS: Record<Kind, typeof Plane> = {
  connection: Truck,
  dg: ShieldAlert,
  dims: Boxes,
  uld: Warehouse,
  capacity: Plane,
  docs: FileWarning,
  tight: Clock,
  temp: Thermometer,
  accept: Truck,
  gel: Snowflake,
};

export function Queue({ className }: { className?: string }) {
  const locale = useCargo((s) => s.locale);
  const filter = useCargo((s) => s.filter);
  const selectedId = useCargo((s) => s.selectedId);
  const select = useCargo((s) => s.select);
  const setFilter = useCargo((s) => s.setFilter);
  const rows = useRows();
  const copy = chrome(locale);
  const visible = rows.filter((row) => matches(row.analysis.risk, filter));

  function applyFilter(next: Filter) {
    const resolved = filter === next ? "all" : next;
    setFilter(resolved);
    const nextRows = rows.filter((row) => matches(row.analysis.risk, resolved));
    if (!nextRows.some((row) => row.shipment.id === selectedId) && nextRows[0]) {
      select(nextRows[0].shipment.id);
    }
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="grid grid-cols-3 gap-2 p-3">
        <Stat
          label={copy.critical}
          value={rows.filter((row) => row.analysis.risk === "critical").length}
          active={filter === "critical"}
          tone="critical"
          onClick={() => applyFilter("critical")}
        />
        <Stat
          label={copy.atRisk}
          value={rows.filter((row) => row.analysis.risk === "high" || row.analysis.risk === "watch").length}
          active={filter === "risk"}
          tone="risk"
          onClick={() => applyFilter("risk")}
        />
        <Stat
          label={copy.onTrack}
          value={QUIET_BOOK + rows.filter((row) => row.analysis.risk === "ok").length}
          active={filter === "ok"}
          tone="ok"
          onClick={() => applyFilter("ok")}
        />
      </div>
      <div className="px-3 pb-3 lg:hidden">
        <label className="block text-xs uppercase tracking-wide text-mute" htmlFor="shipment-picker">
          {copy.queue}
        </label>
        <select
          id="shipment-picker"
          className="mt-1 min-h-11 w-full border border-line bg-panel-2 px-3 text-sm text-frost"
          value={selectedId}
          onChange={(event) => select(event.target.value)}
        >
          {visible.map((row) => (
            <option key={row.shipment.id} value={row.shipment.id}>
              {row.shipment.awb} · {row.analysis.stamp}
            </option>
          ))}
        </select>
      </div>
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        <p className="px-3 pb-2 text-xs uppercase tracking-wide text-mute">{copy.queue}</p>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-3 py-6 text-sm text-mute">{copy.empty}</li>
          ) : (
            visible.map((row) => {
              const Icon = ICONS[row.shipment.kind];
              const active = row.shipment.id === selectedId;
              return (
                <li key={row.shipment.id}>
                  <button
                    type="button"
                    onClick={() => select(row.shipment.id)}
                    className={cn(
                      "flex w-full gap-3 border-l-2 px-3 py-3 text-left",
                      active ? "border-amber bg-panel-2" : "border-transparent hover:bg-panel-2",
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-mute" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm text-frost tabular-nums">{row.shipment.awb}</span>
                        <Mark risk={row.analysis.risk} label={bucketLabel(locale, row.analysis.risk)} />
                      </span>
                      <span className="mt-1 block font-display text-base tracking-wide text-frost">
                        {row.shipment.route}
                      </span>
                      <span className="mt-0.5 block text-sm text-mute">{row.analysis.queueCause}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="border-t border-line px-3 py-3 text-xs text-mute">{copy.quiet(QUIET_BOOK)}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  tone: "critical" | "risk" | "ok";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 border px-2 py-2 text-left",
        active ? "border-amber bg-panel-2" : "border-line bg-panel hover:border-amber",
      )}
    >
      <span
        className={cn(
          "block font-mono text-xl tabular-nums",
          tone === "critical" && "text-alert",
          tone === "risk" && "text-amber",
          tone === "ok" && "text-good",
        )}
      >
        {value}
      </span>
      <span className="block text-xs uppercase tracking-wide text-mute">{label}</span>
    </button>
  );
}

function Mark({ risk, label }: { risk: Risk; label: string }) {
  return (
    <span className={cn("shrink-0 px-1.5 py-0.5 text-xs uppercase tracking-wide", stampTone(risk))}>
      {label}
    </span>
  );
}
