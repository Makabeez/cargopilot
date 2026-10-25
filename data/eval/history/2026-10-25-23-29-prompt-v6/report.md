# CargoPilot agent eval

Generated 2026-10-25T23:32:27.349Z from 20 recorded live runs of nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory (prompt v6).
Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).

| Metric | Value |
| --- | --- |
| Decision accepted by the verifier on first submission | 3/20 (15%) |
| Accepted after verifier feedback (≤3 submissions) | 19/20 (95%) |
| Fell back to rules engine | 1/20 |
| Verified pick = rules-engine pick | 19/19 (100%) |
| Latency p50 / p95 | 18.7 s / 43.7 s |
| Tool calls per run (min / mean / max) | 7 / 9.6 / 10 |
| Tokens (prompt → completion) | 890,211 → 46,690 |
| Cost at list price ($0.3/$0.9 per 1M) | $0.3091 |

## What the verifier sent back

- `tools`: 15 rejection(s)
- `evidence`: 3 rejection(s)
- `reply`: 1 rejection(s)
- `figures`: 1 rejection(s)

Each rejection, exactly as the verifier returned it to the model:

| Scenario | Attempt | Failures |
| --- | --- | --- |
| `s074|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s125|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s125|d0|-|en|-|wx:CDG=IFR` | 1 | evidence: CDG in IFR held its window 6 of 12; below the desk's two-in-three bar, keep-first does not apply |
| `s131|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s172|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s176|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s235|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 1 | tools: Not called: recall_desk_memory |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-|mem:a40553de` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-|wx:LEJ=MVFR` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 1 | evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply<br>reply: reply reads as fr, operator wrote en |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 1 | tools: Not called: recall_desk_memory<br>evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 2 | figures: Not found in tool outputs: 62% |
| `s615|d90|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 1 | tools: Not called: recall_desk_memory |

## Where Nemotron and the rules engine disagree

A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (protected cargo first, then risk → delay → cost) differs from the engine's fixed order.

| Scenario | Nemotron | Rules |
| --- | --- | --- |

## Every run

| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s020|d0|-|en|-` | 020-77120562 | 1 | accepted | main | main | 10 | 18.8 s |
| `s074|d0|-|en|-` | 074-33019873 | 2 | accepted | later | later | 10 | 17.3 s |
| `s080|d0|-|en|-` | 080-22991006 | 1 | accepted | repack | repack | 9 | 11.7 s |
| `s125|d0|-|en|-` | 125-88342111 | 2 | accepted | keep | keep | 10 | 15.6 s |
| `s125|d0|-|en|-|wx:CDG=IFR` | 125-88342111 | 2 | accepted | fra | fra | 10 | 17.1 s |
| `s131|d0|-|en|-` | 131-77881204 | 2 | accepted | inspect | inspect | 10 | 16.3 s |
| `s157|d25|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 10 | 12.1 s |
| `s172|d0|-|en|-` | 172-44091832 | 2 | accepted | freighter | freighter | 9 | 18.7 s |
| `s176|d0|-|en|-` | 176-55287190 | 2 | accepted | chase | chase | 10 | 13.8 s |
| `s235|d0|-|en|-` | 235-10092832 | 2 | accepted | next | next | 10 | 16.0 s |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 615-12345675 | 2 | accepted | zrh | zrh | 9 | 43.7 s |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 615-12345675 | 2 | accepted | keep | keep | 10 | 32.5 s |
| `s615|d60|-|en|-` | 615-12345675 | 2 | accepted | keep | keep | 10 | 17.8 s |
| `s615|d60|-|en|-|mem:a40553de` | 615-12345675 | 2 | accepted | keep | keep | 10 | 25.2 s |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 615-12345675 | 2 | accepted | zrh | zrh | 10 | 24.1 s |
| `s615|d60|-|en|-|wx:LEJ=MVFR` | 615-12345675 | 2 | accepted | keep | keep | 10 | 17.1 s |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 615-12345675 | 2 | accepted | zrh | zrh | 7 | 39.0 s |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 615-12345675 | 2 | fallback | zrh | zrh | 10 | 34.5 s |
| `s615|d90|-|en|-` | 615-12345675 | 2 | accepted | zrh | zrh | 9 | 19.6 s |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 615-12345675 | 2 | accepted | zrh | zrh | 8 | 26.4 s |
