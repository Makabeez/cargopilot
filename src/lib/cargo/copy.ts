import { L, type Locale, type Risk } from "@/lib/cargo/engine";

export type Filter = "all" | "critical" | "risk" | "ok";

export function chrome(locale: Locale) {
  const fr = locale === "fr";
  return {
    product: "CargoPilot",
    desk: fr ? "Contrôle fret GVA" : "GVA cargo control",
    shift: fr ? "Vacation soir" : "Evening shift",
    clock: fr ? "mer. 14 oct. 2026 · 17:42 LT" : "Wed 14 Oct 2026 · 17:42 LT",
    live: fr ? "Réseau simulé" : "Simulated network",
    critical: fr ? "Critique" : "Critical",
    atRisk: fr ? "À risque" : "At risk",
    onTrack: fr ? "Dans les temps" : "On track",
    queue: fr ? "File d'action" : "Action queue",
    quiet: (n: number) =>
      fr
        ? `${n} envois stables hors de cette file.`
        : `${n} stable shipments sit outside this queue.`,
    empty: fr ? "Aucun envoi dans ce filtre." : "No shipments in this filter.",
    open: fr ? "Dossier" : "File",
    awb: fr ? "LTA" : "AWB",
    execute: fr ? "Exécuter le plan de reprise" : "Execute recovery plan",
    staged: fr ? "Plan préparé" : "Plan staged",
    none: fr ? "Aucune reprise nécessaire" : "No recovery needed",
    why: fr ? "Pourquoi cet appel" : "Why this call",
    options: fr ? "Options" : "Options",
    delay: fr ? "Retard camion" : "Truck delay",
    minutes: (n: number) => `${n} min`,
    before: fr ? "Avant le retard" : "Before the delay",
    restore: (n: number) => (fr ? `Live +${n}` : `Live +${n}`),
    scenario: (now: number, base: number) =>
      fr ? `Scénario +${now} min · live +${base} min` : `Scenario +${now} min · live disruption +${base} min`,
    agent: fr ? "Agent pupitre" : "Desk agent",
    ask: fr ? "Écrire au pupitre" : "Ask the desk",
    placeholder: fr
      ? "Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?"
      : "What if the truck is delayed another 30 minutes?",
    placeholderStatic: fr ? "Pourquoi cet appel ?" : "Why this call?",
    send: fr ? "Envoyer" : "Send",
    model: fr ? "Comment ça marche" : "How this works",
    modelBody: fr
      ? "Avec une clé Nebius, NVIDIA Nemotron 3 Super (Nebius Token Factory) pilote la boucle : il choisit les outils, lit les faits, classe les options et soumet une décision. Un vérificateur contrôle chaque heure, chaque chiffre et chaque vol cité contre les sorties d'outils, et refuse toute option bloquée ; en cas d'échec la décision repart au modèle (3 essais), puis le moteur de règles prend le relais. Sans clé : rejeu d'un run enregistré s'il existe, sinon moteur de règles seul — toujours affiché comme tel. Réseau, vols et clients sont simulés."
      : "With a Nebius key, NVIDIA Nemotron 3 Super on Nebius Token Factory drives the loop: it picks the tools, reads the facts, ranks the options and submits a decision. A verifier checks every time, figure and flight it cites against the tool outputs and refuses blocked options; a failed decision goes back to the model (3 tries), then the rules engine takes over. Without a key: a recorded run is replayed if one exists, otherwise the rules engine runs alone — always labelled as such. Network, flights and customers are simulated.",
    notSent: fr
      ? "Rien n'est envoyé à une compagnie. Les textes sont prêts à copier."
      : "Nothing is sent to a carrier. The texts are ready to copy.",
    was: fr ? "Était" : "Was",
    recommended: fr ? "Recommandé" : "Recommended",
    rulesPick: fr ? "Règles" : "Rules",
    selected: fr ? "Retenu" : "Selected",
    infeasible: fr ? "Infaisable" : "Not feasible",
    chain: fr ? "Chaîne" : "Chain",
    customerLang: fr ? "Le client écrit en anglais." : "The customer writes in French.",
    langEn: "EN",
    langFr: "FR",
    pieces: (n: number, kg: number) => (fr ? `${n} pcs · ${kg} kg` : `${n} pcs · ${kg} kg`),
    filterAll: fr ? "Toute la file" : "Full queue",
  };
}

export function stampTone(risk: Risk): string {
  if (risk === "critical") return "bg-critical text-paper";
  if (risk === "high") return "bg-amber text-amber-ink";
  if (risk === "watch") return "bg-paper-2 text-paper-ink ring-1 ring-amber";
  return "bg-safe text-paper";
}

export function metricTone(tone: "bad" | "good" | "neutral"): string {
  if (tone === "bad") return "text-critical";
  if (tone === "good") return "text-safe";
  return "text-paper-ink";
}

export function matches(risk: Risk, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "critical") return risk === "critical";
  if (filter === "risk") return risk === "high" || risk === "watch";
  return risk === "ok";
}

export function bucketLabel(locale: Locale, risk: Risk): string {
  return L(
    locale,
    risk === "critical" ? "Critical" : risk === "high" ? "At risk" : risk === "watch" ? "Watch" : "On track",
    risk === "critical" ? "Critique" : risk === "high" ? "À risque" : risk === "watch" ? "Veille" : "Dans les temps",
  );
}
