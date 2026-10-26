# CargoPilot · Open Agent Hackathon 2026 · Wildcard [Tinkerer]

**Team:** SwissDev (solo: Aymen Gnaba, @Makabeez)
**Repo:** https://github.com/Makabeez/cargopilot (branch `open-agent`)
**Delta judged:** `git log nebius-submitted..open-agent`

## One line

The night desk of an air-cargo station has to decide whether a tight transfer will hold *tonight*. CargoPilot puts NVIDIA Nemotron on that desk. Zetaris joins the station's handling history with live airport weather. Meterless H-MEM brings back what earlier shifts learned, and Meterless Scout screens everything the duty officer types. A verifier rejects any recommendation that quotes a number, a flight or a memory the tools did not return.

## User and problem

- **User:** the duty officer on an export cargo desk (GVA in the demo) on the evening shift. One person, 10 files going wrong, about 40 minutes to act on each.
- **Problem:** a recovery call depends on facts held in systems that do not talk to each other:
  - the booking and cut-offs (cargo system);
  - tonight's weather at the transfer station (public METAR/TAF);
  - how that station actually performed in that weather (handling history in a warehouse);
  - what the last shift learned (a handover log nobody re-reads).

  v4 of CargoPilot only saw the first one.
- **In:** an AWB with a live disruption (late truck, tight connection, acceptance close), plus optional free text from the duty officer.
- **Out:** a ranked, verified recovery decision with the evidence quoted, a customer note in the customer's language, and the staged rebooking.
- **Why an agent:** the model chooses which evidence to pull, and when the evidence overrides the booking. The verifier sends a wrong decision back, up to three times. A fixed pipeline cannot weigh "the booking holds on paper" against "LEJ held 5 of 8 times in IFR".

## How Zetaris is used

- **Two fragmented sources, one query.**
  - `ops_pg.handling_history` is a Postgres datasource registered in Zetaris. It holds 90 days of station handling times, tagged with the flight category on the day.
  - `cargo_wx.metar_now` is a SchemaStore view over a Lightning **REST table** with live METAR for the five stations. It reads aviationweather.gov through `scripts/wx-adapter.mjs`, a container on the Zetaris network. The adapter pins the field types: the REST table infers its schema at creation, and aviationweather's `wdir` flips between a number and `"VRB"`, which broke every query an hour after creation. That finding is documented in the README.
  - The agent's `get_station_evidence` tool sends one federated SQL statement that joins them and aggregates by station, flight and weather category: count, hits, Spark `percentile_approx` p50/p90, max. Setup is in `zetaris/02_zetaris_setup.sql`, and the query is built by `zetarisSql()`.
- **Called from the app server** through the Zetaris REST SQL endpoint (`/sql-editor/sqls/run`, bearer token, org id). The token stays on the server.
- **Trusted, then checked.** Every Zetaris answer is recorded in the run and re-derived offline by `npm run judge-demo` from the same SHA-256-pinned CSV. Each answer is also reconciled live against an in-process mirror ("identical aggregates" is shown in the UI).
- **Fails safe.** If Zetaris is unreachable, the mirror answers, and the UI badge reads "offline mirror" instead of "Zetaris".

## How Meterless is used

- **H-MEM (desk memory).** The Meterless H-MEM reference engine is vendored unmodified (Apache-2.0), apart from one documented and measured embedder patch.
  - `MemoryStoreService` holds the handover log, with source and provenance.
  - `MemoryMiningService` mines "Remember: …" notes typed at the desk.
  - `MemoryRetrievalService` ranks recall for the open file.
  - The TrustLedger records every read.
  - The weather found by Zetaris is added to the memory query, so fog at LEJ brings back the night shift's fog override note.
  - Recall is reinjected into the prompt, and memory is cited as `(mem-N)`. The verifier rejects any id that recall did not return.
  - Measured on the seed notes: precision 0.63, recall 1.00.
- **Scout Intent (guard + execution contract).** Meterless ships Scout as a spec with a locked eval harness. CargoPilot implements the spec surface (`decide()` → intent, risk, tool plan, HMAC-signed execution contract).
  - Every operator message and every handover note goes through it before any model call or memory write.
  - Meterless injection set v1: 7/7 attacks blocked, 0/3 benign blocked.
  - Desk set: 15/15 cargo attacks blocked, 0/22 desk phrasings blocked.
  - A blocked message is shown as a labelled "Blocked by Scout" run, with no model call.
- **Prompt library / Cursor:** not used. The build was done with Claude as the coding assistant. Cursor was optional per the rules.

## Where NVIDIA contributes

NVIDIA **Nemotron 3 Super 120B-A12B** on Nebius Token Factory drives the whole tool loop through native function calling:

- It chooses among 10 tools and decides when station evidence or desk memory changes the call.
- It writes the duty-officer summary and the customer note in English or French.
- It corrects itself from verifier feedback.

Recorded live runs (traces with model id, tokens and latency) are in `data/traces/` and replay in the app.

## Results (live, prompt v7, 25–26 Oct 2026)

- **20 Nemotron runs plus 1 Scout block.** 17/20 were accepted on the first submission and 20/20 after verifier feedback, with no fallback to rules.
- **p50 latency** 16.4 s; **cost** $0.25 for all 20 runs.
- **Zetaris** answered 14 of 14 evidence calls, and every answer matched the offline mirror.
- **The verifier's 3 catches were the same mistake:** with LEJ in IFR (5 of 8), Nemotron had the evidence and still kept the booking. Each time it was sent back and rerouted via ZRH.
- **Desk memory** was cited once and did not change a decision. That is reported as such.
- **Prompt history.** Prompts v5 and v6 got 0/20 and 3/20 on the first submission, because Nemotron skipped the memory tool. v7 reinjects the H-MEM recall instead. All three recordings are kept and re-verified.

## What is unique

- **Evidence that can be audited, not just retrieved.** Every external fact the model quotes (a rate from Zetaris, a memory id from H-MEM) is checked by a deterministic verifier against this run's tool outputs. Every external answer re-derives offline.
- **Federation drives memory.** Live weather from Zetaris steers what the agent remembers.
- **Memory poisoning is treated as injection.** A handover note is screened before H-MEM stores it, because a stored note reaches every later decision.
- **Honest numbers.**
  - The keep-first threshold is labelled as a policy choice, with a sensitivity table.
  - Recall precision is measured and published (0.63).
  - The real-vs-simulated table names every simulated element.

## Pre-existing work (declared)

CargoPilot v4 was built for the Nebius × NVIDIA Global AI Hackathon before this window: tag `nebius-submitted`, commit `e2bf3f8`, and everything before it. That includes the cargo network, the 8 cargo tools, the Nemotron loop, the v1–v4 verifier and the desk UI.

**New in this window:**
- the Zetaris integration, the station history and the weather module;
- the H-MEM integration and handover log;
- the Scout implementation and both eval sets;
- prompt v5 and the two new verifier checks;
- the evidence-aware rules baseline;
- the context UI panel and weather what-if;
- judge-demo lines [5]–[9];
- a lockfile fix.

**Third-party code:** `src/vendor/meterless-hmem/` (Meterless, Apache-2.0) and `tests/fixtures/meterless-scout-v1/` (Meterless eval data).

## Links

- Demo video: https://youtu.be/77ZOa_HV2Tk
- Slides (PDF): https://drive.google.com/file/d/1aimYU6n5NHwdCdz13PDLWXsLDtO5E4b1/view?usp=sharing
- Live app (preview of `open-agent`: replays the recorded v7 runs with their recorded Zetaris answers; a fresh run there uses the offline mirror, because Zetaris runs on the author's machine): https://cargopilot-git-open-agent-makabeezs-projects.vercel.app
