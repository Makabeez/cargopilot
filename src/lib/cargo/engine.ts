export type Locale = "en" | "fr";
export type Risk = "critical" | "high" | "watch" | "ok";
export type Kind =
  | "connection"
  | "dg"
  | "dims"
  | "uld"
  | "capacity"
  | "docs"
  | "temp"
  | "tight"
  | "accept"
  | "gel";
export type FlagKey = "dropTall" | "freighterFull" | "confirmExcursion" | "forceSplit";

export type Flags = {
  delayMin: number;
  dropTall: boolean;
  freighterFull: boolean;
  confirmExcursion: boolean;
  forceSplit: boolean;
};

export type Shipment = {
  id: string;
  awb: string;
  origin: string;
  destination: string;
  route: string;
  pieces: number;
  weightKg: number;
  volumeM3: number;
  dims: string;
  commodity: Record<Locale, string>;
  handling: string;
  customer: string;
  customerLang: Locale;
  priority: "standard" | "priority" | "must-ride";
  kind: Kind;
  baseDelay: number;
  usesDelay: boolean;
};

export type Option = {
  id: string;
  title: string;
  via: string;
  eta: string;
  deltaLabel: string;
  risk: Risk;
  riskLabel: string;
  costLabel: string;
  reason: string;
  feasible: boolean;
  recommended: boolean;
  executable: boolean;
  doc: "rebook" | "notify" | "hold";
  action: string;
};

export type Trace = { step: string; tool: string; result: string };
export type Chip = { id: FlagKey; label: string; pressed: boolean };
export type Metric = { label: string; value: string; tone: "bad" | "good" | "neutral" };
export type ChainNode = { label: string; time: string; hint: string; state: "done" | "risk" | "ok" | "future" };

export type Analysis = {
  shipmentId: string;
  risk: Risk;
  stamp: string;
  narrative: string;
  queueCause: string;
  metrics: Metric[];
  chain: ChainNode[];
  options: Option[];
  traces: Trace[];
  decision: string;
  signal: string;
  chips: Chip[];
  staged: boolean;
  was: string | null;
};

export type MessagePack = {
  rebookingTitle: string;
  rebooking: string;
  customerTitle: string;
  customer: string;
  handlingTitle: string;
  handling: string;
};

export const QUIET_BOOK = 42;

const HERO_SCHED = "2026-10-14T16:15:00.000Z";
const HERO_CUTOFF = "2026-10-14T18:00:00.000Z";
const HERO_DEP = "2026-10-14T19:00:00.000Z";
const TIGHT_SCHED = "2026-10-14T18:40:00.000Z";
const TIGHT_CUTOFF = "2026-10-14T19:05:00.000Z";
const TIGHT_DEP = "2026-10-14T19:42:00.000Z";
const ACC_SCHED = "2026-10-14T15:47:00.000Z";
const ACC_CLOSE = "2026-10-14T16:30:00.000Z";

export const SHIPMENTS: Shipment[] = [
  {
    id: "s615",
    awb: "615-12345675",
    origin: "GVA",
    destination: "DEL",
    route: "GVA → LEJ → DEL",
    pieces: 4,
    weightKg: 780,
    volumeM3: 4.2,
    dims: "120×80×100 cm",
    commodity: { en: "General cargo", fr: "Fret général" },
    handling: "GCR",
    customer: "Nyon Precision SA",
    customerLang: "fr",
    priority: "standard",
    kind: "connection",
    baseDelay: 90,
    usesDelay: true,
  },
  {
    id: "s172",
    awb: "172-44091832",
    origin: "GVA",
    destination: "NRT",
    route: "GVA → ZRH → NRT",
    pieces: 2,
    weightKg: 186,
    volumeM3: 0.8,
    dims: "60×40×40 cm",
    commodity: { en: "UN3480 lithium ion batteries", fr: "UN3480 batteries lithium-ion" },
    handling: "DGR",
    customer: "Helvetia Cell AG",
    customerLang: "en",
    priority: "priority",
    kind: "dg",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s020",
    awb: "020-77120562",
    origin: "GVA",
    destination: "GRU",
    route: "GVA → FRA → GRU",
    pieces: 6,
    weightKg: 960,
    volumeM3: 5.1,
    dims: "piece 3 · 160×120×168 cm",
    commodity: { en: "Machine parts", fr: "Pièces machine" },
    handling: "GCR",
    customer: "Atelier Fonte SA",
    customerLang: "fr",
    priority: "standard",
    kind: "dims",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s074",
    awb: "074-33019873",
    origin: "GVA",
    destination: "DXB",
    route: "GVA → DXB",
    pieces: 8,
    weightKg: 1850,
    volumeM3: 8.4,
    dims: "built as 1 PMC",
    commodity: { en: "Industrial components", fr: "Composants industriels" },
    handling: "GCR",
    customer: "Rhône Freight",
    customerLang: "en",
    priority: "standard",
    kind: "uld",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s235",
    awb: "235-10092832",
    origin: "GVA",
    destination: "EWR",
    route: "GVA → ZRH → EWR",
    pieces: 5,
    weightKg: 780,
    volumeM3: 4.6,
    dims: "loose",
    commodity: { en: "Textiles", fr: "Textiles" },
    handling: "GCR",
    customer: "Alpine Textiles SA",
    customerLang: "en",
    priority: "standard",
    kind: "capacity",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s176",
    awb: "176-55287190",
    origin: "GVA",
    destination: "BOM",
    route: "GVA → BOM",
    pieces: 12,
    weightKg: 640,
    volumeM3: 3.3,
    dims: "loose",
    commodity: { en: "Dry goods", fr: "Denrées sèches" },
    handling: "GCR",
    customer: "Desk India",
    customerLang: "en",
    priority: "standard",
    kind: "docs",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s125",
    awb: "125-88342111",
    origin: "GVA",
    destination: "JFK",
    route: "GVA → CDG → JFK",
    pieces: 3,
    weightKg: 410,
    volumeM3: 2.1,
    dims: "100×80×70 cm",
    commodity: { en: "General cargo", fr: "Fret général" },
    handling: "GCR",
    customer: "Laurent & Fils",
    customerLang: "fr",
    priority: "standard",
    kind: "tight",
    baseDelay: 0,
    usesDelay: true,
  },
  {
    id: "s131",
    awb: "131-77881204",
    origin: "GVA",
    destination: "SIN",
    route: "GVA → SIN",
    pieces: 1,
    weightKg: 240,
    volumeM3: 1.2,
    dims: "active box",
    commodity: { en: "Pharma +2/+8 °C", fr: "Pharma +2/+8 °C" },
    handling: "PIL",
    customer: "Klinik Nord Pharma",
    customerLang: "en",
    priority: "must-ride",
    kind: "temp",
    baseDelay: 0,
    usesDelay: false,
  },
  {
    id: "s157",
    awb: "157-88001233",
    origin: "GVA",
    destination: "MAD",
    route: "GVA → MAD",
    pieces: 10,
    weightKg: 520,
    volumeM3: 2.8,
    dims: "loose",
    commodity: { en: "Cheese, perishable", fr: "Fromage, périssable" },
    handling: "PER",
    customer: "Fromage de Gruyère Export",
    customerLang: "fr",
    priority: "priority",
    kind: "accept",
    baseDelay: 25,
    usesDelay: true,
  },
  {
    id: "s080",
    awb: "080-22991006",
    origin: "GVA",
    destination: "YYZ",
    route: "GVA → YYZ",
    pieces: 2,
    weightKg: 90,
    volumeM3: 0.5,
    dims: "gel-pack shipper",
    commodity: { en: "Clinical samples", fr: "Échantillons cliniques" },
    handling: "PER",
    customer: "Maple Clinical",
    customerLang: "en",
    priority: "priority",
    kind: "gel",
    baseDelay: 0,
    usesDelay: false,
  },
];

export function L<T>(locale: Locale, en: T, fr: T): T {
  return locale === "fr" ? fr : en;
}

function lt(ms: number): string {
  const d = new Date(ms + 2 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

type DelaySolve = {
  eta: string;
  need: string;
  deadline: string;
  risk: Risk;
  shortfall: number;
  slackToDeadline: number;
};

function solveDelay(schedIso: string, deadlineIso: string, bufferMin: number, delayMin: number): DelaySolve {
  const etaMs = Date.parse(schedIso) + delayMin * 60000;
  const deadlineMs = Date.parse(deadlineIso);
  const needMs = deadlineMs - bufferMin * 60000;
  let risk: Risk;
  if (etaMs >= deadlineMs) risk = "critical";
  else if (etaMs > needMs) risk = "high";
  else if (needMs - etaMs < 20 * 60000) risk = "watch";
  else risk = "ok";
  return {
    eta: lt(etaMs),
    need: lt(needMs),
    deadline: lt(deadlineMs),
    risk,
    shortfall: Math.round((etaMs - needMs) / 60000),
    slackToDeadline: Math.round((deadlineMs - etaMs) / 60000),
  };
}

function riskWord(locale: Locale, risk: Risk): string {
  const map: Record<Risk, [string, string]> = {
    ok: ["Low", "Faible"],
    watch: ["Medium", "Moyen"],
    high: ["High", "Élevé"],
    critical: ["Blocked", "Bloqué"],
  };
  return L(locale, map[risk][0], map[risk][1]);
}

function money(cost: number | null): string {
  if (cost === null) return "—";
  if (cost === 0) return "CHF 0";
  return `${cost > 0 ? "+" : "−"}CHF ${Math.abs(cost)}`;
}

function deltaLabel(locale: Locale, hours: number): string {
  if (hours === 0) return L(locale, "On time", "À l'heure");
  return `+${hours} h`;
}

function opt(
  locale: Locale,
  o: {
    id: string;
    title: [string, string];
    via: string;
    eta: [string, string];
    deltaH: number;
    risk: Risk;
    costChf: number | null;
    reason: [string, string];
    feasible: boolean;
    executable?: boolean;
    doc: Option["doc"];
    action: [string, string];
  },
): Option {
  return {
    id: o.id,
    title: L(locale, o.title[0], o.title[1]),
    via: o.via,
    eta: L(locale, o.eta[0], o.eta[1]),
    deltaLabel: deltaLabel(locale, o.deltaH),
    risk: o.risk,
    riskLabel: riskWord(locale, o.risk),
    costLabel: money(o.costChf),
    reason: L(locale, o.reason[0], o.reason[1]),
    feasible: o.feasible,
    recommended: false,
    executable: o.executable ?? o.feasible,
    doc: o.doc,
    action: L(locale, o.action[0], o.action[1]),
  };
}

function choose(options: Option[], order: string[]): Option[] {
  const id = order.find((candidate) => options.some((o) => o.id === candidate && o.feasible));
  return options.map((o) => ({ ...o, recommended: o.id === id }));
}

function steps(locale: Locale) {
  return {
    observe: L(locale, "Observe", "Observer"),
    constraints: L(locale, "Constraints", "Contraintes"),
    risks: L(locale, "Risks", "Risques"),
    options: L(locale, "Options", "Options"),
    decide: L(locale, "Decide", "Décision"),
  };
}

function gapMetric(locale: Locale, shortfall: number): Metric {
  if (shortfall > 0) {
    return {
      label: L(locale, "Gap", "Écart"),
      value: L(locale, `${shortfall} min short`, `${shortfall} min trop tard`),
      tone: "bad",
    };
  }
  const slack = -shortfall;
  return {
    label: L(locale, "Slack", "Marge"),
    value: L(locale, `${slack} min`, `${slack} min`),
    tone: slack < 20 ? "neutral" : "good",
  };
}

function decisionLine(locale: Locale, chosen: Option | undefined, healthy: string): string {
  if (!chosen || !chosen.recommended) return healthy;
  if (!chosen.executable) return healthy;
  return L(
    locale,
    `${chosen.title}. ${chosen.riskLabel} risk, ${chosen.deltaLabel}, ${chosen.costLabel}.`,
    `${chosen.title}. Risque ${chosen.riskLabel.toLowerCase()}, ${chosen.deltaLabel}, ${chosen.costLabel}.`,
  );
}

type Core = Omit<Analysis, "staged" | "was">;

function finish(core: Core, executedId: string | null, locale: Locale): Analysis {
  const base: Analysis = { ...core, staged: false, was: null };
  if (!executedId) return base;
  const picked = base.options.find((o) => o.id === executedId);
  if (!picked) return base;
  return {
    ...base,
    staged: true,
    was: base.stamp,
    risk: "ok",
    stamp: L(locale, "Recovery staged", "Reprise préparée"),
    queueCause: L(locale, `Staged · ${picked.via}`, `Préparé · ${picked.via}`),
    decision: L(
      locale,
      `Staged: ${picked.title}. Nothing has been transmitted.`,
      `Préparé : ${picked.title}. Rien n'a été transmis.`,
    ),
  };
}

function connectionCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const d = solveDelay(HERO_SCHED, HERO_CUTOFF, 45, flags.delayMin);
  const missed = d.risk === "critical";
  const broken = d.risk === "high" || d.risk === "critical";
  const stamp =
    d.risk === "ok"
      ? L(locale, "Connection holding", "Connexion tenable")
      : d.risk === "watch"
        ? L(locale, "Connection tight", "Connexion juste")
        : missed
          ? L(locale, "Connection missed", "Connexion manquée")
          : L(locale, "Connection at risk", "Connexion à risque");
  const narrative = missed
    ? L(
        locale,
        `RFS 1840 reaches LEJ at ${d.eta}, after the ${d.deadline} cut-off. AYC 7841 cannot be met. The next LEJ flight with enough kilos is +18 h, and AYC 7842 has only 410 kg free.`,
        `Le RFS 1840 arrive à LEJ à ${d.eta}, après l'heure limite de ${d.deadline}. AYC 7841 est impossible. Le prochain vol LEJ avec assez de kilos est à +18 h, et AYC 7842 n'a que 410 kg libres.`,
      )
    : broken
      ? L(
          locale,
          `RFS 1840 reaches LEJ at ${d.eta}, ${d.shortfall} min after the ${d.need} handling deadline. The ${d.deadline} cut-off is still open, but the connection is not achievable. AYC 7842 is ${780 - 410} kg short.`,
          `Le RFS 1840 arrive à LEJ à ${d.eta}, ${d.shortfall} min après l'heure de handling de ${d.need}. L'heure limite de ${d.deadline} est encore ouverte, mais la connexion n'est pas tenable. AYC 7842 manque ${780 - 410} kg.`,
        )
      : L(
          locale,
          `RFS 1840 is planned in at ${d.eta}. Handling at LEJ needs the freight by ${d.need}, ahead of the ${d.deadline} cut-off. The original connection holds.`,
          `Le RFS 1840 est prévu à ${d.eta}. Le handling à LEJ veut le fret pour ${d.need}, avant l'heure limite de ${d.deadline}. La connexion d'origine tient.`,
        );

  const options = choose(
    [
      opt(locale, {
        id: "keep",
        title: ["Keep AYC 7841 via LEJ", "Garder AYC 7841 via LEJ"],
        via: "AYC 7841 LEJ–DEL",
        eta: ["15 Oct 09:05 LT DEL", "15 oct. 09:05 LT DEL"],
        deltaH: 0,
        risk: d.risk === "ok" ? "ok" : d.risk === "watch" ? "watch" : "high",
        costChf: 0,
        feasible: !missed,
        executable: broken && !missed,
        doc: "notify",
        reason: [
          missed
            ? "Truck arrives after the LEJ cut-off. The station will not accept it."
            : broken
              ? "Would need a station exception: the truck is inside the cut-off but short of the 45 min handling window."
              : "Truck meets the handling window. No change required.",
          missed
            ? "Le camion arrive après l'heure limite LEJ. La station ne prendra pas le fret."
            : broken
              ? "Il faudrait une dérogation station : le camion est avant l'heure limite, mais pas dans les 45 min de handling."
              : "Le camion tient la fenêtre de handling. Aucun changement.",
        ],
        action: [
          "Present AWB 615-12345675 to AYC 7841 only if LEJ accepts a late tender.",
          "Présenter la LTA 615-12345675 sur AYC 7841 seulement si LEJ accepte un retard de mise à disposition.",
        ],
      }),
      opt(locale, {
        id: "next",
        title: ["Roll to AYC 7842", "Reporter sur AYC 7842"],
        via: "AYC 7842 LEJ–DEL",
        eta: ["15 Oct 14:40 LT DEL", "15 oct. 14:40 LT DEL"],
        deltaH: 6,
        risk: "critical",
        costChf: 0,
        feasible: false,
        doc: "rebook",
        reason: [
          "AYC 7842 has 410 kg free. This shipment is 780 kg. Capacity is not theoretical — it is short.",
          "AYC 7842 a 410 kg libres. Cet envoi fait 780 kg. La capacité manque vraiment.",
        ],
        action: ["Do not plan AYC 7842.", "Ne pas planifier AYC 7842."],
      }),
      opt(locale, {
        id: "zrh",
        title: ["Rebook via ZRH", "Réacheminer via ZRH"],
        via: "RFS 2204 · AYC 9864 ZRH–DEL",
        eta: ["15 Oct 13:10 LT DEL", "15 oct. 13:10 LT DEL"],
        deltaH: 4,
        risk: "ok",
        costChf: 180,
        feasible: true,
        doc: "rebook",
        reason: [
          "RFS 2204 leaves GVA at 18:10, on hand ZRH 19:05, cut-off 21:30. Free capacity 2,200 kg and a loose position. Dispatch in the next 15 minutes.",
          "Le RFS 2204 quitte GVA à 18:10, disponible ZRH à 19:05, heure limite 21:30. 2 200 kg libres et une position vrac. Il faut lancer sous 15 minutes.",
        ],
        action: [
          "Pull AWB 615-12345675 off RFS 1840 and move it to RFS 2204 for AYC 9864 ZRH–DEL.",
          "Retirer la LTA 615-12345675 du RFS 1840 et la passer sur le RFS 2204 pour AYC 9864 ZRH–DEL.",
        ],
      }),
      opt(locale, {
        id: "fra",
        title: ["Rebook via FRA", "Réacheminer via FRA"],
        via: "RFS 3310 · AYC 552 FRA–DEL",
        eta: ["15 Oct 18:05 LT DEL", "15 oct. 18:05 LT DEL"],
        deltaH: 9,
        risk: "watch",
        costChf: 90,
        feasible: true,
        doc: "rebook",
        reason: [
          "Weight fits (900 kg free) but the remaining LD3 is 4.3 m³ against 4.2 m³ built. No contour tolerance.",
          "Le poids passe (900 kg libres) mais le LD3 restant fait 4,3 m³ pour 4,2 m³ montés. Aucune tolérance de contour.",
        ],
        action: [
          "Move the shipment to RFS 3310 GVA–FRA for AYC 552, and flag the volume as tight.",
          "Passer l'envoi sur le RFS 3310 GVA–FRA pour AYC 552, et signaler le volume juste.",
        ],
      }),
      opt(locale, {
        id: "later",
        title: ["Wait for AYC 7843", "Attendre AYC 7843"],
        via: "AYC 7843 LEJ–DEL",
        eta: ["16 Oct 03:10 LT DEL", "16 oct. 03:10 LT DEL"],
        deltaH: 18,
        risk: "high",
        costChf: 0,
        feasible: true,
        doc: "rebook",
        reason: [
          "Space is clean (3,100 kg) but the customer window on 15 Oct is missed by a full day.",
          "La place est propre (3 100 kg) mais la fenêtre client du 15 oct. est manquée d'une journée.",
        ],
        action: [
          "Hold at LEJ for AYC 7843 and warn the customer of +18 h.",
          "Mettre en attente à LEJ pour AYC 7843 et prévenir le client des +18 h.",
        ],
      }),
    ],
    broken ? ["zrh", "fra", "later", "keep"] : ["keep", "zrh", "fra", "later"],
  );

  const chosen = options.find((o) => o.recommended);
  const tone = d.shortfall > 0 ? "bad" : d.risk === "ok" ? "good" : "neutral";
  return {
    shipmentId: s.id,
    risk: d.risk,
    stamp,
    narrative,
    queueCause: L(locale, `Truck +${flags.delayMin} min`, `Camion +${flags.delayMin} min`),
    metrics: [
      { label: L(locale, "Truck ETA", "ETA camion"), value: d.eta, tone },
      { label: L(locale, "Need by", "Requis pour"), value: d.need, tone: d.shortfall > 0 ? "bad" : "neutral" },
      { label: L(locale, "Cut-off", "Heure limite"), value: d.deadline, tone: missed ? "bad" : "neutral" },
      gapMetric(locale, d.shortfall),
    ],
    chain: [
      { label: "RFS 1840", time: "18:15", hint: L(locale, "Scheduled LEJ", "Prévu LEJ"), state: "done" },
      { label: L(locale, "Live ETA", "ETA live"), time: d.eta, hint: `+${flags.delayMin} min`, state: broken ? "risk" : "ok" },
      { label: L(locale, "Need by", "Requis"), time: d.need, hint: L(locale, "45 min handling", "45 min handling"), state: d.shortfall > 0 ? "risk" : "ok" },
      { label: L(locale, "Cut-off", "Limite"), time: d.deadline, hint: "LEJ GCR", state: missed ? "risk" : "future" },
      { label: "AYC 7841", time: lt(Date.parse(HERO_DEP)), hint: "LEJ–DEL", state: missed ? "risk" : "future" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "615-12345675 · GVA–DEL · 780 kg · 4 pcs · GCR · no DGR" },
      {
        step: st.observe,
        tool: "get_disruption",
        result: L(
          locale,
          `RFS 1840 GVA–LEJ +${flags.delayMin} min · ETA ${d.eta} LT`,
          `RFS 1840 GVA–LEJ +${flags.delayMin} min · ETA ${d.eta} LT`,
        ),
      },
      {
        step: st.constraints,
        tool: "get_cutoffs",
        result: L(
          locale,
          `LEJ GCR ${d.deadline} · transfer 45 min · required ${d.need}`,
          `LEJ GCR ${d.deadline} · transfert 45 min · requis ${d.need}`,
        ),
      },
      {
        step: st.constraints,
        tool: "check_connection",
        result: missed
          ? L(locale, `ETA ${d.eta} is after the cut-off`, `ETA ${d.eta} après l'heure limite`)
          : L(
              locale,
              `ETA ${d.eta} vs required ${d.need} · ${d.shortfall > 0 ? `${d.shortfall} min short` : `${-d.shortfall} min slack`}`,
              `ETA ${d.eta} vs requis ${d.need} · ${d.shortfall > 0 ? `${d.shortfall} min trop tard` : `${-d.shortfall} min de marge`}`,
            ),
      },
      {
        step: st.constraints,
        tool: "get_capacity",
        result: "AYC 7841 free 2,400 kg · AYC 7842 free 410 kg · AYC 7843 free 3,100 kg · AYC 9864 free 2,200 kg",
      },
      {
        step: st.constraints,
        tool: "check_restrictions",
        result: L(locale, "General cargo, height 100 cm, no embargo", "Fret général, hauteur 100 cm, pas d'embargo"),
      },
      {
        step: st.risks,
        tool: "calculate_risk",
        result: `${d.risk.toUpperCase()} · ${stamp}`,
      },
      {
        step: st.options,
        tool: "find_alternatives",
        result: L(
          locale,
          "ZRH feasible · FRA tight on volume · AYC 7842 rejected · AYC 7843 +18 h",
          "ZRH faisable · FRA juste en volume · AYC 7842 rejeté · AYC 7843 +18 h",
        ),
      },
      {
        step: st.decide,
        tool: "select_action",
        result: chosen ? `${chosen.via} · ${chosen.deltaLabel} · ${chosen.costLabel}` : "—",
      },
    ],
    decision: broken
      ? decisionLine(locale, chosen, stamp)
      : L(locale, "Original connection holds. No recovery required.", "La connexion d'origine tient. Aucune reprise."),
    signal: `RFS 1840 · +${flags.delayMin} min · LEJ`,
    chips: [],
  };
}

function dgCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const full = flags.freighterFull;
  const options = choose(
    [
      opt(locale, {
        id: "freighter",
        title: ["Move to freighter AYC 9006", "Passer sur le cargo AYC 9006"],
        via: "AYC 9006 GVA–FRA–NRT",
        eta: ["16 Oct 06:40 LT NRT", "16 oct. 06:40 LT NRT"],
        deltaH: 7,
        risk: "ok",
        costChf: 260,
        feasible: !full,
        doc: "rebook",
        reason: [
          "Main-deck freighter accepts UN3480 PI965. Capacity confirmed. Passenger AYC 176 cannot carry it.",
          "Le cargo pont principal accepte UN3480 PI965. Capacité confirmée. L'AYC 176 passager ne peut pas le prendre.",
        ],
        action: [
          "Offload AWB 172-44091832 from passenger AYC 176 and rebook AYC 9006.",
          "Décharger la LTA 172-44091832 de l'AYC 176 passager et réserver AYC 9006.",
        ],
      }),
      opt(locale, {
        id: "next",
        title: ["Next freighter AYC 9012", "Cargo suivant AYC 9012"],
        via: "AYC 9012 GVA–NRT",
        eta: ["17 Oct 01:10 LT NRT", "17 oct. 01:10 LT NRT"],
        deltaH: 26,
        risk: "watch",
        costChf: 260,
        feasible: true,
        doc: "rebook",
        reason: [
          "Also legal for PI965. Use it only if AYC 9006 is full.",
          "Légal aussi pour PI965. À prendre seulement si AYC 9006 est complet.",
        ],
        action: [
          "Book AYC 9012 and keep the freight in the DGR cage.",
          "Réserver AYC 9012 et garder le fret en cage DGR.",
        ],
      }),
      opt(locale, {
        id: "pax",
        title: ["Ask for a pax variation", "Demander une dérogation passager"],
        via: "AYC 176 pax",
        eta: ["15 Oct 23:30 LT NRT", "15 oct. 23:30 LT NRT"],
        deltaH: 0,
        risk: "critical",
        costChf: null,
        feasible: false,
        doc: "notify",
        reason: [
          "UN3480 packed alone (PI965) is forbidden on passenger aircraft. There is no station variation.",
          "UN3480 emballé seul (PI965) est interdit en passager. Aucune dérogation station.",
        ],
        action: ["Do not tender to AYC 176.", "Ne pas présenter sur AYC 176."],
      }),
      opt(locale, {
        id: "return",
        title: ["Return to shipper", "Retour expéditeur"],
        via: L(locale, "Return GVA", "Retour GVA"),
        eta: [L(locale, "Not flying", "Ne part pas"), L(locale, "Ne part pas", "Ne part pas")],
        deltaH: 48,
        risk: "high",
        costChf: 0,
        feasible: true,
        doc: "hold",
        reason: [
          "Last resort. The customer has a legal freighter path tonight.",
          "Dernier recours. Le client a un cargo légal ce soir.",
        ],
        action: [
          "Hold in the DGR cage and call Helvetia Cell only if both freighters refuse.",
          "Garder en cage DGR et appeler Helvetia Cell seulement si les deux cargos refusent.",
        ],
      }),
    ],
    ["freighter", "next", "return"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: "critical",
    stamp: L(locale, "DG refused on passenger", "DGR refusé en passager"),
    narrative: L(
      locale,
      "UN3480 PI965 is booked on passenger AYC 176. The aircraft cannot accept it. This is a hard restriction, not a tight connection.",
      "UN3480 PI965 est réservé sur l'AYC 176 passager. L'avion ne peut pas l'accepter. C'est une restriction dure, pas une connexion juste.",
    ),
    queueCause: L(locale, "PI965 on pax", "PI965 en passager"),
    metrics: [
      { label: "UN", value: "3480", tone: "bad" },
      { label: "PI", value: "965", tone: "bad" },
      { label: L(locale, "Booked", "Réservé"), value: "AYC 176 pax", tone: "bad" },
      { label: L(locale, "Legal path", "Voie légale"), value: full ? "AYC 9012" : "AYC 9006", tone: "good" },
    ],
    chain: [
      { label: L(locale, "Booked", "Réservé"), time: "AYC 176", hint: L(locale, "Passenger", "Passager"), state: "risk" },
      { label: "PI965", time: L(locale, "Alone", "Seul"), hint: L(locale, "Pax forbidden", "Passager interdit"), state: "risk" },
      { label: "AYC 9006", time: full ? L(locale, "Full", "Complet") : L(locale, "Open", "Ouvert"), hint: L(locale, "Freighter", "Cargo"), state: full ? "risk" : "ok" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "172-44091832 · 186 kg · 2 pcs · UN3480 · class 9 · PI965" },
      { step: st.constraints, tool: "check_restrictions", result: L(locale, "PAX FORBIDDEN · no variation on AYC 176", "PASSAGER INTERDIT · pas de dérogation AYC 176") },
      { step: st.constraints, tool: "get_capacity", result: full ? "AYC 9006 full · AYC 9012 open" : "AYC 9006 DGR position open · AYC 9012 open" },
      { step: st.risks, tool: "calculate_risk", result: "CRITICAL · booked aircraft illegal for commodity" },
      { step: st.options, tool: "find_alternatives", result: full ? "AYC 9006 rejected (full) · AYC 9012 legal" : "AYC 9006 legal · pax variation rejected" },
      { step: st.decide, tool: "select_action", result: chosen?.via ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: full ? "AYC 9006 · full" : "AYC 176 · DGR reject",
    chips: [
      {
        id: "freighterFull",
        label: L(locale, "What if the freighter is full?", "Et si le cargo est complet ?"),
        pressed: full,
      },
    ],
  };
}

function dimsCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const dropped = flags.dropTall;
  const options = choose(
    [
      opt(locale, {
        id: "main",
        title: ["Rebook main deck", "Réserver le pont principal"],
        via: "AYC 777F FRA–GRU",
        eta: ["16 Oct 11:20 LT GRU", "16 oct. 11:20 LT GRU"],
        deltaH: 5,
        risk: "ok",
        costChf: 340,
        feasible: true,
        doc: "rebook",
        reason: [
          "Main-deck door is 300 cm. Piece 3 at 168 cm is legal. Belly max on the booked A330 is 160 cm.",
          "La porte pont principal fait 300 cm. La pièce 3 à 168 cm est légale. Le ventre de l'A330 réservé est limité à 160 cm.",
        ],
        action: [
          "Move all 6 pieces to AYC 777F. Do not attempt the A330 bulk hold.",
          "Passer les 6 pièces sur AYC 777F. Ne pas tenter la soute vrac A330.",
        ],
      }),
      opt(locale, {
        id: "split",
        title: ["Split off piece 3", "Sortir la pièce 3"],
        via: L(locale, "Belly + main deck", "Ventre + pont"),
        eta: ["16 Oct 11:20 LT GRU", "16 oct. 11:20 LT GRU"],
        deltaH: 5,
        risk: "watch",
        costChf: 210,
        feasible: true,
        doc: "rebook",
        reason: [
          "Five pieces fit the belly. Piece 3 still needs the freighter, so the customer receives a split — two arrivals.",
          "Cinq pièces passent en soute. La pièce 3 doit quand même le cargo : le client a un split, deux arrivées.",
        ],
        action: [
          "Keep pieces 1, 2, 4, 5 and 6 on the booked belly. Rebook piece 3 only on AYC 777F.",
          "Garder les pièces 1, 2, 4, 5 et 6 en soute. Réserver seulement la pièce 3 sur AYC 777F.",
        ],
      }),
      opt(locale, {
        id: "belly",
        title: ["Force the booked belly", "Forcer la soute réservée"],
        via: "AYC 441 A330",
        eta: ["16 Oct 06:15 LT GRU", "16 oct. 06:15 LT GRU"],
        deltaH: 0,
        risk: "critical",
        costChf: 0,
        feasible: dropped,
        executable: false,
        doc: "notify",
        reason: [
          dropped
            ? "Without piece 3 the rest is 140 cm and legal. Piece 3 is still on the dock with no flight."
            : "Piece 3 is 8 cm over the 160 cm bulk limit. The loadmaster will reject the lot.",
          dropped
            ? "Sans la pièce 3, le reste fait 140 cm et passe. La pièce 3 est encore au dock, sans vol."
            : "La pièce 3 dépasse de 8 cm la limite vrac de 160 cm. Le loadmaster refusera le lot.",
        ],
        action: [
          "Do not build piece 3 into the A330.",
          "Ne pas monter la pièce 3 dans l'A330.",
        ],
      }),
    ],
    dropped ? ["split", "main"] : ["main", "split"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: dropped ? "watch" : "critical",
    stamp: dropped
      ? L(locale, "Split still open", "Split encore ouvert")
      : L(locale, "Piece over height", "Pièce hors gabarit"),
    narrative: dropped
      ? L(
          locale,
          "Piece 3 is off this build. The other five fit the A330 belly. Piece 3 still has no flight unless you book the main deck.",
          "La pièce 3 est sortie du montage. Les cinq autres passent en soute A330. La pièce 3 n'a toujours pas de vol sans le pont principal.",
        )
      : L(
          locale,
          "Weight is fine at 960 kg. Piece 3 is 168 cm and the booked A330 bulk hold stops at 160 cm. The lot fails on height, not on kilos.",
          "Le poids passe à 960 kg. La pièce 3 fait 168 cm et la soute vrac de l'A330 s'arrête à 160 cm. Le lot échoue sur la hauteur, pas sur les kilos.",
        ),
    queueCause: dropped ? L(locale, "Piece 3 unplanned", "Pièce 3 sans vol") : L(locale, "168 cm vs 160 cm", "168 cm vs 160 cm"),
    metrics: [
      { label: L(locale, "Tallest", "Plus haut"), value: "168 cm", tone: dropped ? "neutral" : "bad" },
      { label: L(locale, "Belly max", "Max soute"), value: "160 cm", tone: "bad" },
      { label: L(locale, "Door MD", "Porte PP"), value: "300 cm", tone: "good" },
      { label: L(locale, "Weight", "Poids"), value: "960 kg", tone: "good" },
    ],
    chain: [
      { label: L(locale, "Piece 3", "Pièce 3"), time: "168 cm", hint: "160×120", state: dropped ? "future" : "risk" },
      { label: "A330", time: "160 cm", hint: L(locale, "Bulk hold", "Soute vrac"), state: "risk" },
      { label: "777F", time: "300 cm", hint: L(locale, "Main deck", "Pont"), state: "ok" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "020-77120562 · 960 kg · 6 pcs · piece 3 is 168 cm" },
      { step: st.constraints, tool: "check_restrictions", result: L(locale, "A330 bulk max height 160 cm · 777F door 300 cm", "A330 vrac hauteur max 160 cm · porte 777F 300 cm") },
      { step: st.risks, tool: "calculate_risk", result: dropped ? "WATCH · split incomplete" : "CRITICAL · height, not weight" },
      { step: st.decide, tool: "select_action", result: chosen?.via ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: "AYC 441 · height reject",
    chips: [
      {
        id: "dropTall",
        label: L(locale, "What if we drop the tall piece?", "Et si on sort la pièce haute ?"),
        pressed: dropped,
      },
    ],
  };
}

function uldCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const forced = flags.forceSplit;
  const options = choose(
    [
      opt(locale, {
        id: "later",
        title: ["Take the flight with a PMC", "Prendre le vol qui a un PMC"],
        via: "AYC 614 GVA–DXB",
        eta: ["16 Oct 02:15 LT DXB", "16 oct. 02:15 LT DXB"],
        deltaH: 11,
        risk: "ok",
        costChf: 40,
        feasible: true,
        doc: "rebook",
        reason: [
          "AYC 614 has two PMC positions. The build stays intact. Kilos were never the problem.",
          "AYC 614 a deux positions PMC. Le montage reste entier. Les kilos n'ont jamais été le problème.",
        ],
        action: [
          "Rebook AWB 074-33019873 onto AYC 614 as one PMC. Do not break the build for AYC 610.",
          "Réserver la LTA 074-33019873 sur AYC 614 en un PMC. Ne pas casser le montage pour AYC 610.",
        ],
      }),
      opt(locale, {
        id: "split",
        title: ["Force a split build", "Forcer un split"],
        via: "AYC 610 half + loose",
        eta: ["15 Oct 15:40 LT DXB", "15 oct. 15:40 LT DXB"],
        deltaH: 0,
        risk: "high",
        costChf: 0,
        feasible: true,
        doc: "rebook",
        reason: [
          forced
            ? "A half pallet takes 1,100 kg. This is 1,850 kg in one build. Forcing it splits the shipper unit and the transfer at DXB."
            : "Possible only by breaking one PMC into a half plus loose. The shipper booked a single unit.",
          forced
            ? "Une demi-palette prend 1 100 kg. Ici 1 850 kg en un montage. Le forcer casse l'unité et le transfert à DXB."
            : "Possible seulement en cassant un PMC en demi-palette plus vrac. L'expéditeur a réservé une seule unité.",
        ],
        action: [
          "Only if the customer accepts two handing units on AYC 610.",
          "Seulement si le client accepte deux unités de manutention sur AYC 610.",
        ],
      }),
      opt(locale, {
        id: "keep",
        title: ["Keep AYC 610 as booked", "Garder AYC 610 tel que réservé"],
        via: "AYC 610",
        eta: ["15 Oct 15:40 LT DXB", "15 oct. 15:40 LT DXB"],
        deltaH: 0,
        risk: "critical",
        costChf: null,
        feasible: false,
        doc: "notify",
        reason: [
          "2,400 kg are free and zero PMC positions remain. The shipment cannot occupy a half pallet.",
          "2 400 kg sont libres et il ne reste aucune position PMC. L'envoi ne tient pas sur une demi-palette.",
        ],
        action: ["Do not plan the PMC on AYC 610.", "Ne pas planifier le PMC sur AYC 610."],
      }),
    ],
    ["later", "split"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: "critical",
    stamp: L(locale, "Kilos without a position", "Kilos sans position"),
    narrative: L(
      locale,
      "AYC 610 shows 2,400 kg free and no PMC left. This shipment is built as one PMC at 1,850 kg. Free weight is not a loading position.",
      "AYC 610 affiche 2 400 kg libres et plus aucun PMC. Cet envoi est monté en un PMC de 1 850 kg. Le poids libre n'est pas une position.",
    ),
    queueCause: L(locale, "PMC 0 · 2,400 kg free", "PMC 0 · 2 400 kg libres"),
    metrics: [
      { label: L(locale, "Free kg", "Kg libres"), value: "2,400", tone: "neutral" },
      { label: "PMC", value: "0", tone: "bad" },
      { label: L(locale, "Need", "Besoin"), value: "1 PMC", tone: "bad" },
      { label: L(locale, "Half pallet", "Demi-palette"), value: "1", tone: "neutral" },
    ],
    chain: [
      { label: "AYC 610", time: "2,400 kg", hint: "PMC 0", state: "risk" },
      { label: L(locale, "Build", "Montage"), time: "1 PMC", hint: "1,850 kg", state: "risk" },
      { label: "AYC 614", time: "+11 h", hint: "2 PMC", state: "ok" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "074-33019873 · 1,850 kg · 8 pcs · ULD plan PMC" },
      { step: st.constraints, tool: "get_capacity", result: "AYC 610 · 2,400 kg free · PMC 0 · half 1 (max 1,100 kg)" },
      { step: st.risks, tool: "calculate_risk", result: "CRITICAL · position, not weight" },
      { step: st.options, tool: "find_alternatives", result: "AYC 614 has 2 PMC · split build is a commercial break" },
      { step: st.decide, tool: "select_action", result: chosen?.via ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: forced ? "Split forced on AYC 610" : "AYC 610 · no PMC",
    chips: [
      {
        id: "forceSplit",
        label: L(locale, "What if we force a split?", "Et si on force le split ?"),
        pressed: forced,
      },
    ],
  };
}

function capacityCase(s: Shipment, _flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const options = choose(
    [
      opt(locale, {
        id: "next",
        title: ["Rebook textiles next day", "Reporter le textile à demain"],
        via: "AYC 220 ZRH–EWR",
        eta: ["16 Oct 18:00 LT EWR", "16 oct. 18:00 LT EWR"],
        deltaH: 14,
        risk: "ok",
        costChf: 0,
        feasible: true,
        doc: "rebook",
        reason: [
          "AYC 220 has 3,200 kg free. Protect must-ride pharma 057-66219005 (620 kg) on today's last pallet.",
          "AYC 220 a 3 200 kg libres. Protéger le pharma must-ride 057-66219005 (620 kg) sur la dernière palette du jour.",
        ],
        action: [
          "Leave 057-66219005 on AYC 418. Move Alpine Textiles 235-10092832 to AYC 220.",
          "Laisser 057-66219005 sur AYC 418. Passer Alpine Textiles 235-10092832 sur AYC 220.",
        ],
      }),
      opt(locale, {
        id: "bump",
        title: ["Bump the pharma", "Déloger le pharma"],
        via: "AYC 418",
        eta: ["15 Oct 22:10 LT EWR", "15 oct. 22:10 LT EWR"],
        deltaH: 0,
        risk: "critical",
        costChf: null,
        feasible: false,
        doc: "notify",
        reason: [
          "Desk rule: never displace a must-ride pharma booking to recover general cargo.",
          "Règle pupitre : ne jamais déloger un pharma must-ride pour récupérer du fret général.",
        ],
        action: ["Do not offload 057-66219005.", "Ne pas décharger 057-66219005."],
      }),
      opt(locale, {
        id: "split",
        title: ["Fly 280 kg today, rest tomorrow", "280 kg aujourd'hui, le reste demain"],
        via: "AYC 418 + AYC 220",
        eta: ["16 Oct 18:00 LT EWR", "16 oct. 18:00 LT EWR"],
        deltaH: 14,
        risk: "watch",
        costChf: 70,
        feasible: true,
        doc: "rebook",
        reason: [
          "After the pharma, 280 kg remain. That is a partial, a second AWB, and a split delivery.",
          "Après le pharma, il reste 280 kg. C'est un partiel, une seconde LTA, et une livraison split.",
        ],
        action: [
          "Split only if Alpine Textiles accepts two arrivals. Otherwise take AYC 220 intact.",
          "Splitter seulement si Alpine Textiles accepte deux arrivées. Sinon garder AYC 220 entier.",
        ],
      }),
    ],
    ["next", "split"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: "high",
    stamp: L(locale, "Loses the last pallet", "Perd la dernière palette"),
    narrative: L(
      locale,
      "AYC 418 has 900 kg and one pallet left. Must-ride pharma 057-66219005 takes 620 kg. Alpine Textiles at 780 kg cannot follow. Do not bump the pharma.",
      "AYC 418 a 900 kg et une palette. Le pharma must-ride 057-66219005 prend 620 kg. Alpine Textiles à 780 kg ne peut pas suivre. Ne pas déloger le pharma.",
    ),
    queueCause: L(locale, "900 kg · pharma first", "900 kg · pharma d'abord"),
    metrics: [
      { label: L(locale, "Left", "Reste"), value: "900 kg", tone: "neutral" },
      { label: "Pharma", value: "620 kg", tone: "good" },
      { label: L(locale, "This file", "Ce dossier"), value: "780 kg", tone: "bad" },
      { label: L(locale, "After pharma", "Après pharma"), value: "280 kg", tone: "bad" },
    ],
    chain: [
      { label: "AYC 418", time: "900 kg", hint: "1 PMC", state: "risk" },
      { label: "057-66219005", time: "620 kg", hint: "Must-ride", state: "ok" },
      { label: "235-10092832", time: "780 kg", hint: L(locale, "No room", "Pas de place"), state: "risk" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "235-10092832 · 780 kg textiles · competing with 057-66219005" },
      { step: st.constraints, tool: "get_capacity", result: "AYC 418 · 900 kg · 1 PMC · pharma 620 kg must-ride" },
      { step: st.constraints, tool: "check_restrictions", result: L(locale, "Rule: must-ride pharma is not displaceable", "Règle : le pharma must-ride ne se déloge pas") },
      { step: st.risks, tool: "calculate_risk", result: "HIGH · 280 kg left after the protected booking" },
      { step: st.decide, tool: "select_action", result: chosen?.via ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: "AYC 418 · 1 pallet left",
    chips: [],
  };
}

function docsCase(s: Shipment, _flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const options = choose(
    [
      opt(locale, {
        id: "chase",
        title: ["Chase the SLI now", "Relancer la SLI maintenant"],
        via: L(locale, "Same flight", "Même vol"),
        eta: ["15 Oct 09:50 LT BOM", "15 oct. 09:50 LT BOM"],
        deltaH: 0,
        risk: "watch",
        costChf: 0,
        feasible: true,
        doc: "notify",
        reason: [
          "Acceptance closes 18:55. Screening needs about 40 min. There is still a window if the SLI lands now.",
          "L'acceptation ferme à 18:55. Le contrôle sûreté demande environ 40 min. La fenêtre existe encore si la SLI arrive maintenant.",
        ],
        action: [
          "Call Desk India for the SLI and security data. Do not offload yet.",
          "Appeler Desk India pour la SLI et les données sûreté. Ne pas décharger maintenant.",
        ],
      }),
      opt(locale, {
        id: "offload",
        title: ["Offload ahead of the close", "Décharger avant la fermeture"],
        via: "AYC 308 next",
        eta: ["16 Oct 11:20 LT BOM", "16 oct. 11:20 LT BOM"],
        deltaH: 22,
        risk: "high",
        costChf: 0,
        feasible: true,
        doc: "rebook",
        reason: [
          "Clean, and early. It spends a recovery the flight may still make.",
          "Propre, et trop tôt. On dépense une reprise que le vol peut encore tenir.",
        ],
        action: [
          "Roll to AYC 308 only if the SLI is still missing at 18:15.",
          "Reporter sur AYC 308 seulement si la SLI manque encore à 18:15.",
        ],
      }),
    ],
    ["chase", "offload"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: "high",
    stamp: L(locale, "SLI not on file", "SLI absente du dossier"),
    narrative: L(
      locale,
      "The freight is in the warehouse and the SLI is not. Acceptance closes at 18:55. This is a document failure, not a routing failure — yet.",
      "Le fret est au magasin, mais pas la SLI (instructions de l'expéditeur). L'acceptation ferme à 18:55. C'est un défaut documentaire, pas encore un défaut d'acheminement.",
    ),
    queueCause: L(locale, "SLI missing · close 18:55", "SLI absente · ferme 18:55"),
    metrics: [
      { label: "SLI", value: L(locale, "Missing", "Absente"), tone: "bad" },
      { label: L(locale, "Screening", "Sûreté"), value: L(locale, "Open", "Ouverte"), tone: "bad" },
      { label: L(locale, "Close", "Fermeture"), value: "18:55", tone: "neutral" },
      { label: L(locale, "Need", "Besoin"), value: L(locale, "~40 min", "~40 min"), tone: "neutral" },
    ],
    chain: [
      { label: L(locale, "Cargo", "Fret"), time: "GVA", hint: L(locale, "On hand", "En magasin"), state: "ok" },
      { label: "SLI", time: L(locale, "Missing", "Absente"), hint: L(locale, "Forwarder", "Transitaire"), state: "risk" },
      { label: L(locale, "Close", "Fermeture"), time: "18:55", hint: "GVA", state: "future" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "176-55287190 · 640 kg · on hand GVA · SLI missing" },
      { step: st.constraints, tool: "get_cutoffs", result: L(locale, "GVA acceptance 18:55 · screening ~40 min", "Acceptation GVA 18:55 · sûreté ~40 min") },
      { step: st.risks, tool: "calculate_risk", result: "HIGH · docs, flight still reachable" },
      { step: st.decide, tool: "select_action", result: chosen?.title ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: L(locale, "SLI chase · close 18:55", "Relance SLI · ferme 18:55"),
    chips: [],
  };
}

function tightCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const d = solveDelay(TIGHT_SCHED, TIGHT_CUTOFF, 13, flags.delayMin);
  const missed = d.risk === "critical";
  const broken = d.risk === "high" || missed;
  const stamp = missed
    ? L(locale, "CDG connection missed", "Connexion CDG manquée")
    : broken
      ? L(locale, "CDG connection at risk", "Connexion CDG à risque")
      : d.risk === "watch"
        ? L(locale, "CDG connection tight", "Connexion CDG juste")
        : L(locale, "CDG connection holding", "Connexion CDG tenable");
  const options = choose(
    [
      opt(locale, {
        id: "keep",
        title: ["Keep CDG connection", "Garder la connexion CDG"],
        via: "AYC 045 CDG–JFK",
        eta: ["15 Oct 01:20 LT JFK", "15 oct. 01:20 LT JFK"],
        deltaH: 0,
        risk: d.risk === "critical" ? "critical" : d.risk,
        costChf: 0,
        feasible: !missed,
        executable: broken && !missed,
        doc: "notify",
        reason: [
          `Arrival CDG ${d.eta}. Minimum connection wants the freight by ${d.need}. Cut-off ${d.deadline}.`,
          `Arrivée CDG ${d.eta}. La connexion minimale veut le fret pour ${d.need}. Heure limite ${d.deadline}.`,
        ],
        action: [
          "Keep AYC 045 only while the truck is inside the CDG window.",
          "Garder AYC 045 tant que le camion est dans la fenêtre CDG.",
        ],
      }),
      opt(locale, {
        id: "fra",
        title: ["Rebook via FRA", "Réacheminer via FRA"],
        via: "AYC 512 FRA–JFK",
        eta: ["15 Oct 07:30 LT JFK", "15 oct. 07:30 LT JFK"],
        deltaH: 6,
        risk: "ok",
        costChf: 150,
        feasible: true,
        doc: "rebook",
        reason: [
          "FRA truck is still open from GVA and AYC 512 has space. Use it once CDG is no longer legal.",
          "Le camion FRA est encore ouvert depuis GVA et AYC 512 a de la place. À prendre dès que CDG n'est plus légal.",
        ],
        action: [
          "Pull 125-88342111 off the CDG truck and move it to the FRA departure.",
          "Retirer 125-88342111 du camion CDG et le passer sur le départ FRA.",
        ],
      }),
    ],
    broken ? ["fra", "keep"] : ["keep", "fra"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: d.risk,
    stamp,
    narrative: L(
      locale,
      `CDG arrival is ${d.eta}. The connection needs the freight by ${d.need}, cut-off ${d.deadline}. Slack against the minimum connection is ${d.shortfall > 0 ? `${d.shortfall} min short` : `${-d.shortfall} min`}.`,
      `L'arrivée CDG est ${d.eta}. La connexion veut le fret pour ${d.need}, heure limite ${d.deadline}. La marge sur la connexion minimale est ${d.shortfall > 0 ? `${d.shortfall} min trop tard` : `${-d.shortfall} min`}.`,
    ),
    queueCause: L(locale, `CDG slack ${d.shortfall > 0 ? `-${d.shortfall}` : d.shortfall === 0 ? "0" : `+${-d.shortfall}`} min`, `Marge CDG ${d.shortfall > 0 ? `-${d.shortfall}` : `+${-d.shortfall}`} min`),
    metrics: [
      { label: L(locale, "CDG ETA", "ETA CDG"), value: d.eta, tone: broken ? "bad" : "neutral" },
      { label: L(locale, "Need by", "Requis"), value: d.need, tone: d.shortfall > 0 ? "bad" : "neutral" },
      { label: L(locale, "Cut-off", "Limite"), value: d.deadline, tone: missed ? "bad" : "neutral" },
      gapMetric(locale, d.shortfall),
    ],
    chain: [
      { label: "GVA–CDG", time: d.eta, hint: `+${flags.delayMin} min`, state: broken ? "risk" : "ok" },
      { label: L(locale, "Need by", "Requis"), time: d.need, hint: "50 min MCT", state: d.shortfall > 0 ? "risk" : "ok" },
      { label: "AYC 045", time: lt(Date.parse(TIGHT_DEP)), hint: "CDG–JFK", state: missed ? "risk" : "future" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_disruption", result: `GVA–CDG +${flags.delayMin} min · ETA ${d.eta}` },
      { step: st.constraints, tool: "check_connection", result: `need ${d.need} · cut-off ${d.deadline} · ${stamp}` },
      { step: st.decide, tool: "select_action", result: chosen?.via ?? "—" },
    ],
    decision: broken
      ? decisionLine(locale, chosen, stamp)
      : L(locale, "CDG still legal. Watch the slack — 30 more minutes misses it.", "CDG est encore légal. La marge est courte — 30 minutes de plus et c'est manqué."),
    signal: `CDG · ETA ${d.eta}`,
    chips: [],
  };
}

function tempCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const confirmed = flags.confirmExcursion;
  const options = choose(
    [
      opt(locale, {
        id: "inspect",
        title: ["Open the box on the dock", "Ouvrir la boîte au dock"],
        via: L(locale, "Same flight", "Même vol"),
        eta: ["16 Oct 16:40 LT SIN", "16 oct. 16:40 LT SIN"],
        deltaH: 0,
        risk: "watch",
        costChf: 0,
        feasible: !confirmed,
        doc: "notify",
        reason: [
          "9.2 °C for 18 min is not yet an excursion. The product rule trips at 30 min or at 10 °C. Look before you hold.",
          "9,2 °C pendant 18 min n'est pas encore une excursion. La règle produit bascule à 30 min ou à 10 °C. Vérifier avant de bloquer.",
        ],
        action: [
          "Open the active box, check gel and probe, and release only if the core is back inside +2/+8.",
          "Ouvrir la boîte active, contrôler les gels et la sonde, et libérer seulement si le cœur est revenu dans +2/+8.",
        ],
      }),
      opt(locale, {
        id: "hold",
        title: ["QA hold", "Blocage AQ"],
        via: L(locale, "Do not fly", "Ne pas embarquer"),
        eta: [L(locale, "Pending QA", "En attente AQ"), L(locale, "En attente AQ", "En attente AQ")],
        deltaH: 12,
        risk: "ok",
        costChf: 0,
        feasible: true,
        doc: "hold",
        reason: [
          confirmed
            ? "Excursion confirmed. The shipment does not fly until Klinik Nord releases it."
            : "Correct once an excursion is confirmed. Early, it only adds a day.",
          confirmed
            ? "Excursion confirmée. L'envoi ne part pas tant que Klinik Nord ne l'a pas libéré."
            : "Correct une fois l'excursion confirmée. Avant ça, ça n'ajoute qu'une journée.",
        ],
        action: [
          "Place AWB 131-77881204 on QA hold and call the product owner.",
          "Mettre la LTA 131-77881204 en blocage AQ et appeler le responsable produit.",
        ],
      }),
      opt(locale, {
        id: "fly",
        title: ["Fly as booked", "Faire partir tel quel"],
        via: "AYC 880 GVA–SIN",
        eta: ["16 Oct 16:40 LT SIN", "16 oct. 16:40 LT SIN"],
        deltaH: 0,
        risk: "critical",
        costChf: null,
        feasible: !confirmed,
        executable: false,
        doc: "notify",
        reason: [
          confirmed
            ? "A confirmed excursion cannot be tendered as in-range pharma."
            : "Ignoring a 9.2 °C probe without opening the box is how the claim starts.",
          confirmed
            ? "Une excursion confirmée ne s'expédie pas comme du pharma dans la plage."
            : "Ignorer une sonde à 9,2 °C sans ouvrir la boîte, c'est comme ça que le dossier sinistre commence.",
        ],
        action: ["Do not tender until the probe is explained.", "Ne pas présenter tant que la sonde n'est pas expliquée."],
      }),
    ],
    confirmed ? ["hold", "inspect"] : ["inspect", "hold"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: confirmed ? "critical" : "watch",
    stamp: confirmed
      ? L(locale, "Excursion confirmed", "Excursion confirmée")
      : L(locale, "Probe outside range", "Sonde hors plage"),
    narrative: confirmed
      ? L(
          locale,
          "Product owner rule is met: the probe stayed above +8 °C long enough to call it an excursion. The freight does not fly as booked.",
          "La règle du responsable produit est atteinte : la sonde est restée au-dessus de +8 °C assez longtemps. Le fret ne part pas tel que réservé.",
        )
      : L(
          locale,
          "Probe reads 9.2 °C and has done so for 18 minutes. The excursion rule is 30 minutes or 10 °C. It is a watch, not a hold — until someone confirms it.",
          "La sonde lit 9,2 °C depuis 18 minutes. La règle d'excursion est 30 minutes ou 10 °C. C'est une veille, pas un blocage — tant que personne ne confirme.",
        ),
    queueCause: confirmed ? L(locale, "Excursion · do not fly", "Excursion · ne pas embarquer") : "9.2 °C · 18 min",
    metrics: [
      { label: L(locale, "Probe", "Sonde"), value: "9.2 °C", tone: "bad" },
      { label: L(locale, "Range", "Plage"), value: "+2 / +8", tone: "neutral" },
      { label: L(locale, "Duration", "Durée"), value: confirmed ? "34 min" : "18 min", tone: confirmed ? "bad" : "neutral" },
      { label: L(locale, "Rule", "Règle"), value: L(locale, "30 min", "30 min"), tone: "neutral" },
    ],
    chain: [
      { label: L(locale, "Probe", "Sonde"), time: "9.2 °C", hint: confirmed ? "34 min" : "18 min", state: "risk" },
      { label: L(locale, "Rule", "Règle"), time: "30 min", hint: "+8 °C", state: confirmed ? "risk" : "future" },
      { label: "AYC 880", time: "SIN", hint: "PIL", state: confirmed ? "risk" : "future" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "131-77881204 · PIL +2/+8 · probe 9.2 °C" },
      { step: st.constraints, tool: "check_restrictions", result: confirmed ? "EXCURSION CONFIRMED · QA hold" : "18 min at 9.2 °C · rule trips at 30 min" },
      { step: st.decide, tool: "select_action", result: chosen?.title ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: confirmed ? "QA hold · SIN" : "Probe 9.2 °C · 18 min",
    chips: [
      {
        id: "confirmExcursion",
        label: L(locale, "What if the excursion is confirmed?", "Et si l'excursion est confirmée ?"),
        pressed: confirmed,
      },
    ],
  };
}

function acceptCase(s: Shipment, flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const d = solveDelay(ACC_SCHED, ACC_CLOSE, 0, flags.delayMin);
  const missed = d.risk === "critical";
  const options = choose(
    [
      opt(locale, {
        id: "rush",
        title: ["Priority door", "Porte prioritaire"],
        via: "AYC 090 GVA–MAD",
        eta: ["15 Oct 00:40 LT MAD", "15 oct. 00:40 LT MAD"],
        deltaH: 0,
        risk: "ok",
        costChf: 0,
        feasible: !missed,
        doc: "notify",
        reason: [
          `Dock ETA ${d.eta}, acceptance closes ${d.deadline}. A priority door keeps the cheese on AYC 090 if the truck is still legal.`,
          `ETA dock ${d.eta}, acceptation fermée à ${d.deadline}. Une porte prioritaire garde le fromage sur AYC 090 si le camion est encore légal.`,
        ],
        action: [
          "Meet RFS 441 at door 2 and accept ahead of the loose queue.",
          "Recevoir le RFS 441 à la porte 2 et accepter avant la file vrac.",
        ],
      }),
      opt(locale, {
        id: "roll",
        title: ["Roll to the next MAD", "Reporter sur le MAD suivant"],
        via: "AYC 092",
        eta: ["16 Oct 01:10 LT MAD", "16 oct. 01:10 LT MAD"],
        deltaH: 14,
        risk: "watch",
        costChf: 0,
        feasible: true,
        doc: "rebook",
        reason: [
          "Legal fallback once the 18:30 close is missed. The product is perishable — say so in the customer note.",
          "Repli légal une fois 18:30 passée. Le produit est périssable — le dire dans la note client.",
        ],
        action: [
          "Book AYC 092 and keep the cheese in the cooler. Do not leave it on the export floor.",
          "Réserver AYC 092 et garder le fromage au froid. Ne pas le laisser en zone export.",
        ],
      }),
    ],
    missed ? ["roll", "rush"] : ["rush", "roll"],
  );
  const chosen = options.find((o) => o.recommended);
  const stamp = missed
    ? L(locale, "Acceptance missed", "Acceptation manquée")
    : d.risk === "watch"
      ? L(locale, "Dock window tight", "Fenêtre dock juste")
      : L(locale, "Acceptance holding", "Acceptation tenable");
  return {
    shipmentId: s.id,
    risk: d.risk === "high" ? "watch" : d.risk,
    stamp,
    narrative: L(
      locale,
      `Shipper truck ETA ${d.eta}. GVA acceptance for AYC 090 closes at ${d.deadline}. ${d.slackToDeadline >= 0 ? `${d.slackToDeadline} min remain.` : "The close has passed."}`,
      `ETA camion expéditeur ${d.eta}. L'acceptation GVA pour AYC 090 ferme à ${d.deadline}. ${d.slackToDeadline >= 0 ? `Il reste ${d.slackToDeadline} min.` : "La fermeture est passée."}`,
    ),
    queueCause: L(locale, `Dock ${d.eta} · close ${d.deadline}`, `Dock ${d.eta} · ferme ${d.deadline}`),
    metrics: [
      { label: L(locale, "Dock ETA", "ETA dock"), value: d.eta, tone: missed ? "bad" : "neutral" },
      { label: L(locale, "Close", "Fermeture"), value: d.deadline, tone: missed ? "bad" : "neutral" },
      gapMetric(locale, d.shortfall),
      { label: L(locale, "Flight", "Vol"), value: "AYC 090", tone: "neutral" },
    ],
    chain: [
      { label: "RFS 441", time: d.eta, hint: `+${flags.delayMin} min`, state: missed ? "risk" : "ok" },
      { label: L(locale, "Close", "Fermeture"), time: d.deadline, hint: "GVA PER", state: missed ? "risk" : "future" },
      { label: "AYC 090", time: "21:10", hint: "GVA–MAD", state: "future" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_disruption", result: `RFS 441 +${flags.delayMin} min · dock ${d.eta}` },
      { step: st.constraints, tool: "get_cutoffs", result: `GVA PER close ${d.deadline}` },
      { step: st.risks, tool: "calculate_risk", result: `${(d.risk === "high" ? "watch" : d.risk).toUpperCase()} · ${stamp}` },
      { step: st.decide, tool: "select_action", result: chosen?.title ?? "—" },
    ],
    decision:
      d.risk === "ok"
        ? L(locale, "Acceptance window is comfortable.", "La fenêtre d'acceptation est confortable.")
        : decisionLine(locale, chosen, stamp),
    signal: `RFS 441 · dock ${d.eta}`,
    chips: [],
  };
}

function gelCase(s: Shipment, _flags: Flags, locale: Locale): Core {
  const st = steps(locale);
  const options = choose(
    [
      opt(locale, {
        id: "repack",
        title: ["Repack with fresh gels", "Reconditionner les gels"],
        via: "AYC 330",
        eta: ["15 Oct 21:00 LT YYZ", "15 oct. 21:00 LT YYZ"],
        deltaH: 0,
        risk: "ok",
        costChf: 60,
        feasible: true,
        doc: "notify",
        reason: [
          "Qualified gel life is 14 h and the lane is 16 h. A repack at GVA restores the qualification and still makes AYC 330.",
          "La durée qualifiée des gels est 14 h et la ligne fait 16 h. Un reconditionnement à GVA rétablit la qualification et tient AYC 330.",
        ],
        action: [
          "Repack AWB 080-22991006 with fresh gels before close-out. Note the new pack-out time on the checklist.",
          "Reconditionner la LTA 080-22991006 avec des gels neufs avant la clôture. Noter la nouvelle heure de conditionnement.",
        ],
      }),
      opt(locale, {
        id: "active",
        title: ["Upgrade to an active box", "Passer en boîte active"],
        via: "AYC 330",
        eta: ["15 Oct 21:00 LT YYZ", "15 oct. 21:00 LT YYZ"],
        deltaH: 0,
        risk: "ok",
        costChf: 220,
        feasible: true,
        doc: "rebook",
        reason: [
          "Removes the gel-life limit. Costs more than a repack and does not arrive earlier.",
          "Supprime la limite des gels. Coûte plus qu'un reconditionnement et n'arrive pas plus tôt.",
        ],
        action: [
          "Move the samples into an active +2/+8 box and keep the same flight.",
          "Passer les échantillons en boîte active +2/+8 et garder le même vol.",
        ],
      }),
      opt(locale, {
        id: "fly",
        title: ["Fly on the current gels", "Partir avec les gels actuels"],
        via: "AYC 330",
        eta: ["15 Oct 21:00 LT YYZ", "15 oct. 21:00 LT YYZ"],
        deltaH: 0,
        risk: "high",
        costChf: 0,
        feasible: true,
        executable: false,
        doc: "notify",
        reason: [
          "The box runs out of qualification two hours before delivery. That is a claim, not a plan.",
          "La boîte sort de qualification deux heures avant la livraison. C'est un sinistre, pas un plan.",
        ],
        action: ["Do not release without a repack or an active box.", "Ne pas libérer sans reconditionnement ou boîte active."],
      }),
    ],
    ["repack", "active"],
  );
  const chosen = options.find((o) => o.recommended);
  return {
    shipmentId: s.id,
    risk: "watch",
    stamp: L(locale, "Gel life short by 2 h", "Gels courts de 2 h"),
    narrative: L(
      locale,
      "Gels are qualified for 14 hours. Pack-out to delivery on this lane is 16. The flight is fine. The coolant is not.",
      "Les gels sont qualifiés 14 heures. Du conditionnement à la livraison, cette ligne fait 16. Le vol va. Le froid passif, non.",
    ),
    queueCause: L(locale, "14 h gels · 16 h lane", "Gels 14 h · ligne 16 h"),
    metrics: [
      { label: L(locale, "Qualified", "Qualifié"), value: "14 h", tone: "bad" },
      { label: L(locale, "Lane", "Ligne"), value: "16 h", tone: "bad" },
      { label: L(locale, "Flight", "Vol"), value: "AYC 330", tone: "good" },
      { label: L(locale, "Repack", "Recond."), value: L(locale, "Still legal", "Encore possible"), tone: "good" },
    ],
    chain: [
      { label: L(locale, "Pack-out", "Conditionnement"), time: "14 h", hint: L(locale, "Gel life", "Vie des gels"), state: "risk" },
      { label: L(locale, "Lane", "Ligne"), time: "16 h", hint: "GVA–YYZ", state: "risk" },
      { label: "AYC 330", time: L(locale, "Open", "Ouvert"), hint: L(locale, "If repacked", "Si reconditionné"), state: "ok" },
    ],
    options,
    traces: [
      { step: st.observe, tool: "get_shipment", result: "080-22991006 · gel shipper · 14 h qualification" },
      { step: st.constraints, tool: "check_restrictions", result: L(locale, "Lane time 16 h · short by 2 h", "Temps de ligne 16 h · court de 2 h") },
      { step: st.decide, tool: "select_action", result: chosen?.title ?? "—" },
    ],
    decision: decisionLine(locale, chosen, ""),
    signal: L(locale, "Gel life · short 2 h", "Vie des gels · 2 h trop court"),
    chips: [],
  };
}

export function defaultFlags(s: Shipment, delayOverride?: number, extra?: Partial<Flags>): Flags {
  return {
    delayMin: delayOverride ?? s.baseDelay,
    dropTall: extra?.dropTall ?? false,
    freighterFull: extra?.freighterFull ?? false,
    confirmExcursion: extra?.confirmExcursion ?? false,
    forceSplit: extra?.forceSplit ?? false,
  };
}

export function analyze(s: Shipment, flags: Flags, locale: Locale, executedId: string | null): Analysis {
  const core =
    s.kind === "connection"
      ? connectionCase(s, flags, locale)
      : s.kind === "dg"
        ? dgCase(s, flags, locale)
        : s.kind === "dims"
          ? dimsCase(s, flags, locale)
          : s.kind === "uld"
            ? uldCase(s, flags, locale)
            : s.kind === "capacity"
              ? capacityCase(s, flags, locale)
              : s.kind === "docs"
                ? docsCase(s, flags, locale)
                : s.kind === "tight"
                  ? tightCase(s, flags, locale)
                  : s.kind === "temp"
                    ? tempCase(s, flags, locale)
                    : s.kind === "accept"
                      ? acceptCase(s, flags, locale)
                      : gelCase(s, flags, locale);
  return finish(core, executedId, locale);
}

export function messages(s: Shipment, analysis: Analysis, optionId: string, locale: Locale): MessagePack | null {
  const picked = analysis.options.find((o) => o.id === optionId);
  if (!picked) return null;
  const fr = locale === "fr";
  const docTitle =
    picked.doc === "hold"
      ? fr
        ? "BLOCAGE / AQ (DÉMO — NON TRANSMIS)"
        : "HOLD / QA (DEMO — NOT TRANSMITTED)"
      : picked.doc === "notify"
        ? fr
          ? "INSTRUCTION PUPITRE (DÉMO — NON TRANSMISE)"
          : "DESK INSTRUCTION (DEMO — NOT TRANSMITTED)"
        : fr
          ? "DEMANDE DE RÉACHEMINEMENT (DÉMO — NON TRANSMISE)"
          : "REBOOKING REQUEST (DEMO — NOT TRANSMITTED)";

  const rebooking = [
    docTitle,
    `${fr ? "LTA" : "AWB"} ${s.awb}`,
    `${s.origin}–${s.destination} · ${s.route}`,
    `${s.pieces} PCS · ${s.weightKg} KG · ${s.commodity[locale]} · ${s.handling}`,
    `${fr ? "CLIENT" : "CUSTOMER"} ${s.customer}`,
    "",
    fr ? "ACTION" : "ACTION",
    picked.action,
    "",
    fr ? "POURQUOI" : "WHY",
    picked.reason,
    "",
    `${fr ? "ETA RÉVISÉE" : "REVISED ETA"} ${picked.eta} (${picked.deltaLabel})`,
    `${fr ? "COÛT" : "COST"} ${picked.costLabel}`,
    `${fr ? "VIA" : "VIA"} ${picked.via}`,
  ].join("\n");

  const customer = [
    fr ? `Objet : ${s.awb} ${s.origin}–${s.destination}` : `Subject: ${s.awb} ${s.origin}–${s.destination}`,
    "",
    `${s.customer},`,
    "",
    fr
      ? `Concernant la LTA ${s.awb} (${s.weightKg} kg, ${s.pieces} pcs, ${s.commodity.fr}).`
      : `Regarding AWB ${s.awb} (${s.weightKg} kg, ${s.pieces} pcs, ${s.commodity.en}).`,
    "",
    picked.action,
    "",
    picked.reason,
    "",
    fr
      ? `ETA révisée : ${picked.eta} (${picked.deltaLabel}). Indication de coût : ${picked.costLabel}. Rien n'est confirmé tant que vous n'avez pas répondu.`
      : `Revised ETA: ${picked.eta} (${picked.deltaLabel}). Cost indication: ${picked.costLabel}. Nothing is confirmed until you reply.`,
    "",
    fr ? "Pupitre CargoPilot · Genève" : "CargoPilot desk · Geneva",
  ].join("\n");

  const handling = [
    fr ? "INSTRUCTION HANDLING GVA (DÉMO)" : "GVA HANDLING INSTRUCTION (DEMO)",
    `${fr ? "LTA" : "AWB"} ${s.awb} · ${s.handling} · ${s.pieces} PCS / ${s.weightKg} KG`,
    picked.action,
    picked.via,
    fr
      ? "Ne pas s'écarter de cette instruction sans accord du pupitre. Aucun message compagnie n'a été envoyé."
      : "Do not depart from this instruction without desk approval. No carrier message has been sent.",
  ].join("\n");

  return {
    rebookingTitle: fr ? "Demande / instruction" : "Request / instruction",
    rebooking,
    customerTitle: fr ? "Message client" : "Customer message",
    customer,
    handlingTitle: fr ? "Instruction handling" : "Handling instruction",
    handling,
  };
}

export type Command =
  | { type: "delay"; minutes: number; mode: "set" | "add" }
  | { type: "execute" }
  | { type: "why" }
  | { type: "options" }
  | { type: "reset" }
  | { type: "live" }
  | { type: "unknown" };

export function detectLocale(text: string): Locale | null {
  const fr =
    /[àâçéèêëîïôùûœ]/i.test(text) ||
    /\b(le|la|les|des|est|camion|retard|pourquoi|execute|exécut|applique|options|que|fait|fret|connexion|minutes)\b/i.test(
      text,
    );
  const en = /\b(the|truck|delay|delayed|what|why|execute|options|minutes|another|shipment|plan)\b/i.test(text);
  if (fr && !en) return "fr";
  if (en && !fr) return "en";
  if (fr && en) return /[àâçéèêëîïôùûœ]/i.test(text) || /\b(camion|retard|pourquoi)\b/i.test(text) ? "fr" : "en";
  return null;
}

export function parseCommand(text: string): { command: Command; localeHint: Locale | null } {
  const raw = text.trim();
  const localeHint = raw ? detectLocale(raw) : null;
  if (!raw) return { command: { type: "unknown" }, localeHint };
  const num =
    raw.match(/(?:retard|delay(?:ed)?)(?:\s+\S+){0,4}?\s+(\d{1,3})/i)?.[1] ??
    raw.match(/(\d{1,3})\s*(?:min(?:ute)?s?)/i)?.[1] ??
    raw.match(/(?:another|encore)\s+(\d{1,3})/i)?.[1];
  const add = /(another|additional|more|extra|encore|de plus|suppl[eé]mentaire)/i.test(raw);

  if (/(retard live|live delay|back to live|retour au live)/i.test(raw)) {
    return { command: { type: "live" }, localeHint };
  }
  if (!num && /(reset|sans retard|avant le retard|before the delay|à l'heure|a l'heure)/i.test(raw)) {
    return { command: { type: "reset" }, localeHint };
  }
  if (num && /(retard|delay|camion|truck|minute|eta)/i.test(raw)) {
    return {
      command: { type: "delay", minutes: Number(num), mode: add ? "add" : "set" },
      localeHint,
    };
  }
  if (/(exécut|execut|applique|apply the|rebook|réachemin|reachemin)/i.test(raw)) {
    return { command: { type: "execute" }, localeHint };
  }
  if (/\b(pourquoi|why)\b/i.test(raw)) return { command: { type: "why" }, localeHint };
  if (/(options|alternative)/i.test(raw)) return { command: { type: "options" }, localeHint };
  return { command: { type: "unknown" }, localeHint };
}

export function unknownNote(locale: Locale): string {
  return L(
    locale,
    "Try “delayed another 30 minutes”, “why”, or “execute the plan”.",
    "Essayez « retard de 45 minutes », « pourquoi », ou « exécuter le plan ».",
  );
}

export function notDelayNote(locale: Locale): string {
  return L(
    locale,
    "This file does not turn on a truck delay. Open AWB 615-12345675.",
    "Ce dossier ne se joue pas sur un retard camion. Ouvrez la LTA 615-12345675.",
  );
}

export function cannotExecuteNote(locale: Locale): string {
  return L(locale, "Nothing to execute on the current plan.", "Rien à exécuter sur le plan actuel.");
}

export function clampDelay(n: number): number {
  return Math.max(0, Math.min(180, Math.round(n)));
}
