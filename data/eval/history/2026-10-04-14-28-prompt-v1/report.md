# CargoPilot agent eval

Generated 2026-10-04T14:29:47.517Z from 30 recorded live runs of nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory.
Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).

| Metric | Value |
| --- | --- |
| Decision accepted by the verifier on first submission | 27/30 (90%) |
| Accepted after verifier feedback (≤3 submissions) | 30/30 (100%) |
| Fell back to rules engine | 0/30 |
| Verified pick = rules-engine pick | 27/30 (90%) |
| Latency p50 / p95 | 8.3 s / 12.7 s |
| Tool calls per run (min / mean / max) | 4 / 5.3 / 7 |
| Tokens (prompt → completion) | 505,931 → 31,711 |
| Cost at list price ($0.3/$0.9 per 1M) | $0.1803 |

## What the verifier sent back

- `schema`: 1 rejection(s)
- `tools`: 2 rejection(s)
- `option`: 1 rejection(s)
- `allowed`: 1 rejection(s)
- `ranking`: 2 rejection(s)
- `reply`: 2 rejection(s)

## Where Nemotron and the rules engine disagree

A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (delay → risk → cost, protected cargo first) differs from the engine's fixed order.

| Scenario | Nemotron | Rules |
| --- | --- | --- |
| `s020|d0|dropTall|en|-` | main | split |
| `s615|d45|-|fr|962111ae` | zrh | keep |
| `s615|d60|-|en|-` | zrh | keep |

## Every run

| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s020|d0|-|en|-` | 020-77120562 | 1 | accepted | main | main | 4 | 7.1 s |
| `s020|d0|dropTall|en|-` | 020-77120562 | 1 | accepted | main | split | 5 | 8.4 s |
| `s074|d0|-|en|-` | 074-33019873 | 1 | accepted | later | later | 7 | 11.5 s |
| `s074|d0|forceSplit|en|-` | 074-33019873 | 1 | accepted | later | later | 6 | 10.4 s |
| `s080|d0|-|en|-` | 080-22991006 | 1 | accepted | repack | repack | 7 | 9.7 s |
| `s125|d0|-|en|-` | 125-88342111 | 1 | accepted | keep | keep | 5 | 7.3 s |
| `s125|d20|-|en|-` | 125-88342111 | 1 | accepted | fra | fra | 4 | 5.5 s |
| `s125|d40|-|en|-` | 125-88342111 | 1 | accepted | fra | fra | 5 | 7.3 s |
| `s131|d0|-|en|-` | 131-77881204 | 1 | accepted | inspect | inspect | 5 | 7.6 s |
| `s131|d0|confirmExcursion|en|-` | 131-77881204 | 1 | accepted | hold | hold | 4 | 6.7 s |
| `s157|d0|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 5 | 6.6 s |
| `s157|d25|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 7 | 9.9 s |
| `s157|d50|-|en|-` | 157-88001233 | 1 | accepted | roll | roll | 5 | 8.3 s |
| `s172|d0|-|en|-` | 172-44091832 | 1 | accepted | freighter | freighter | 6 | 10.5 s |
| `s172|d0|-|en|17fb5ffc` “Can we just put it on the passenger flight?” | 172-44091832 | 1 | accepted | freighter | freighter | 4 | 7.2 s |
| `s172|d0|-|fr|-` | 172-44091832 | 1 | accepted | freighter | freighter | 5 | 7.5 s |
| `s172|d0|freighterFull|en|-` | 172-44091832 | 1 | accepted | next | next | 7 | 12.0 s |
| `s176|d0|-|en|-` | 176-55287190 | 1 | accepted | chase | chase | 5 | 6.6 s |
| `s235|d0|-|en|-` | 235-10092832 | 1 | accepted | next | next | 7 | 11.1 s |
| `s615|d0|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 5 | 7.0 s |
| `s615|d120|-|en|-` | 615-12345675 | 2 | accepted | zrh | zrh | 5 | 12.9 s |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 615-12345675 | 2 | accepted | zrh | zrh | 4 | 12.7 s |
| `s615|d120|-|fr|-` | 615-12345675 | 1 | accepted | zrh | zrh | 7 | 10.0 s |
| `s615|d150|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 8.2 s |
| `s615|d30|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 6 | 7.7 s |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 615-12345675 | 1 | accepted | zrh | keep | 4 | 7.6 s |
| `s615|d60|-|en|-` | 615-12345675 | 1 | accepted | zrh | keep | 5 | 7.9 s |
| `s615|d90|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 9.1 s |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 615-12345675 | 2 | accepted | zrh | zrh | 4 | 12.2 s |
| `s615|d90|-|fr|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 9.5 s |
