# CargoPilot agent eval

Generated 2026-10-04T14:47:33.860Z from 30 recorded live runs of nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory (prompt v3).
Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).

| Metric | Value |
| --- | --- |
| Decision accepted by the verifier on first submission | 30/30 (100%) |
| Accepted after verifier feedback (≤3 submissions) | 30/30 (100%) |
| Fell back to rules engine | 0/30 |
| Verified pick = rules-engine pick | 29/30 (97%) |
| Latency p50 / p95 | 10.4 s / 12.5 s |
| Tool calls per run (min / mean / max) | 4 / 5.8 / 8 |
| Tokens (prompt → completion) | 572,096 → 31,070 |
| Cost at list price ($0.3/$0.9 per 1M) | $0.1996 |

## What the verifier sent back

- Nothing: every submission passed on the first try.

## Where Nemotron and the rules engine disagree

A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (protected cargo first, then risk → delay → cost) differs from the engine's fixed order.

| Scenario | Nemotron | Rules |
| --- | --- | --- |
| `s020|d0|dropTall|en|-` | main | split |

## Every run

| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s020|d0|-|en|-` | 020-77120562 | 1 | accepted | main | main | 5 | 8.9 s |
| `s020|d0|dropTall|en|-` | 020-77120562 | 1 | accepted | main | split | 6 | 10.9 s |
| `s074|d0|-|en|-` | 074-33019873 | 1 | accepted | later | later | 7 | 12.5 s |
| `s074|d0|forceSplit|en|-` | 074-33019873 | 1 | accepted | later | later | 7 | 11.7 s |
| `s080|d0|-|en|-` | 080-22991006 | 1 | accepted | repack | repack | 7 | 10.4 s |
| `s125|d0|-|en|-` | 125-88342111 | 1 | accepted | keep | keep | 5 | 9.2 s |
| `s125|d20|-|en|-` | 125-88342111 | 1 | accepted | fra | fra | 7 | 10.5 s |
| `s125|d40|-|en|-` | 125-88342111 | 1 | accepted | fra | fra | 5 | 8.7 s |
| `s131|d0|-|en|-` | 131-77881204 | 1 | accepted | inspect | inspect | 7 | 11.6 s |
| `s131|d0|confirmExcursion|en|-` | 131-77881204 | 1 | accepted | hold | hold | 8 | 12.3 s |
| `s157|d0|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 8 | 9.9 s |
| `s157|d25|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 7 | 9.9 s |
| `s157|d50|-|en|-` | 157-88001233 | 1 | accepted | roll | roll | 7 | 10.9 s |
| `s172|d0|-|en|-` | 172-44091832 | 1 | accepted | freighter | freighter | 6 | 11.1 s |
| `s172|d0|-|en|17fb5ffc` “Can we just put it on the passenger flight?” | 172-44091832 | 1 | accepted | freighter | freighter | 4 | 9.4 s |
| `s172|d0|-|fr|-` | 172-44091832 | 1 | accepted | freighter | freighter | 6 | 10.2 s |
| `s172|d0|freighterFull|en|-` | 172-44091832 | 1 | accepted | next | next | 5 | 9.6 s |
| `s176|d0|-|en|-` | 176-55287190 | 1 | accepted | chase | chase | 5 | 9.1 s |
| `s235|d0|-|en|-` | 235-10092832 | 1 | accepted | next | next | 7 | 11.6 s |
| `s615|d0|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 5 | 8.7 s |
| `s615|d120|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 9.5 s |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 13.1 s |
| `s615|d120|-|fr|-` | 615-12345675 | 1 | accepted | zrh | zrh | 6 | 12.4 s |
| `s615|d150|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 11.3 s |
| `s615|d30|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 5 | 9.0 s |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 615-12345675 | 1 | accepted | keep | keep | 4 | 7.4 s |
| `s615|d60|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 5 | 8.7 s |
| `s615|d90|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 10.4 s |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 615-12345675 | 1 | accepted | zrh | zrh | 4 | 10.6 s |
| `s615|d90|-|fr|-` | 615-12345675 | 1 | accepted | zrh | zrh | 5 | 9.1 s |
