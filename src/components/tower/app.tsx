import { useEffect } from "react";
import { Radio } from "lucide-react";
import { AgentLog } from "@/components/tower/agent";
import { ShipmentFile } from "@/components/tower/file";
import { Queue } from "@/components/tower/queue";
import { chrome } from "@/lib/cargo/copy";
import { useCargo } from "@/lib/cargo/store";
import { cn } from "@/lib/cn";

export function TowerApp() {
  const locale = useCargo((s) => s.locale);
  const setLocale = useCargo((s) => s.setLocale);
  const copy = chrome(locale);

  useEffect(() => {
    document.documentElement.lang = locale === "fr" ? "fr" : "en";
    document.title = locale === "fr" ? "CargoPilot · Contrôle GVA" : "CargoPilot · GVA control";
  }, [locale]);

  return (
    <div className="min-h-dvh bg-ink text-frost lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <header className="border-b border-line">
        <div className="h-1 bg-amber" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-amber font-display text-xl text-amber-ink" aria-hidden="true">
              CP
            </span>
            <div>
              <p className="font-display text-2xl leading-none tracking-wide">{copy.product}</p>
              <p className="text-sm text-mute">
                {copy.desk} · {copy.shift}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden items-center gap-2 text-sm text-mute sm:flex">
              <Radio className="live-dot size-4 text-amber" aria-hidden="true" />
              <span>{copy.live}</span>
            </p>
            <p className="font-mono text-sm tabular-nums text-frost">{copy.clock}</p>
            <div className="flex border border-line">
              <LangButton active={locale === "en"} onClick={() => setLocale("en")} label={copy.langEn} />
              <LangButton active={locale === "fr"} onClick={() => setLocale("fr")} label={copy.langFr} />
            </div>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-12">
        <aside className="border-b border-line lg:col-span-3 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Queue />
        </aside>
        <main className="bg-ink lg:col-span-6 lg:min-h-0 lg:overflow-y-auto">
          <div className="p-3 sm:p-4 lg:min-h-full">
            <ShipmentFile />
          </div>
        </main>
        <aside className="border-t border-line lg:col-span-3 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <AgentLog />
        </aside>
      </div>
    </div>
  );
}

function LangButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("min-h-11 min-w-11 px-3 text-sm font-semibold", active ? "bg-amber text-amber-ink" : "text-mute")}
    >
      {label}
    </button>
  );
}
