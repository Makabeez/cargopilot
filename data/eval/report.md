# CargoPilot agent eval

Generated 2026-10-25T23:46:16.446Z from 20 recorded live runs of nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory (prompt v7).
Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).

| Metric | Value |
| --- | --- |
| Decision accepted by the verifier on first submission | 17/20 (85%) |
| Accepted after verifier feedback (≤3 submissions) | 20/20 (100%) |
| Fell back to rules engine | 0/20 |
| Verified pick = rules-engine pick | 19/20 (95%) |
| Latency p50 / p95 | 16.4 s / 26.0 s |
| Tool calls per run (min / mean / max) | 6 / 8.4 / 10 |
| Tokens (prompt → completion) | 741,545 → 33,122 |
| Cost at list price ($0.3/$0.9 per 1M) | $0.2523 |

## What the verifier sent back

- `evidence`: 3 rejection(s)

Each rejection, exactly as the verifier returned it to the model:

| Scenario | Attempt | Failures |
| --- | --- | --- |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 1 | evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 1 | evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 1 | evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |

## Where Nemotron and the rules engine disagree

A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (protected cargo first, then risk → delay → cost) differs from the engine's fixed order.

| Scenario | Nemotron | Rules |
| --- | --- | --- |
| `s131|d0|-|en|-` | hold | inspect |

## Every run

| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s020|d0|-|en|-` | 020-77120562 | 1 | accepted | main | main | 9 | 16.1 s |
| `s074|d0|-|en|-` | 074-33019873 | 1 | accepted | later | later | 6 | 9.4 s |
| `s080|d0|-|en|-` | 080-22991006 | 1 | accepted | repack | repack | 9 | 16.7 s |
| `s125|d0|-|en|-` | 125-88342111 | 1 | accepted | keep | keep | 7 | 12.3 s |
| `s125|d0|-|en|-|wx:CDG=IFR` | 125-88342111 | 1 | accepted | fra | fra | 9 | 15.5 s |
| `s131|d0|-|en|-` | 131-77881204 | 1 | accepted | hold | inspect | 9 | 12.2 s |
| `s157|d25|-|en|-` | 157-88001233 | 1 | accepted | rush | rush | 9 | 16.4 s |
| `s172|d0|-|en|-` | 172-44091832 | 1 | accepted | freighter | freighter | 9 | 16.5 s |
| `s176|d0|-|en|-` | 176-55287190 | 1 | accepted | chase | chase | 6 | 11.3 s |
| `s235|d0|-|en|-` | 235-10092832 | 1 | accepted | next | next | 9 | 12.4 s |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 615-12345675 | 1 | accepted | zrh | zrh | 8 | 19.4 s |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 615-12345675 | 1 | accepted | keep | keep | 9 | 18.5 s |
| `s615|d60|-|en|-` | 615-12345675 | 1 | accepted | keep | keep | 9 | 13.8 s |
| `s615|d60|-|en|-|mem:a40553de` | 615-12345675 | 1 | accepted | keep | keep | 9 | 16.7 s |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 615-12345675 | 2 | accepted | zrh | zrh | 9 | 18.7 s |
| `s615|d60|-|en|-|wx:LEJ=MVFR` | 615-12345675 | 1 | accepted | keep | keep | 9 | 16.2 s |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 615-12345675 | 2 | accepted | zrh | zrh | 9 | 22.6 s |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 615-12345675 | 2 | accepted | zrh | zrh | 10 | 26.0 s |
| `s615|d90|-|en|-` | 615-12345675 | 1 | accepted | zrh | zrh | 9 | 18.2 s |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 615-12345675 | 1 | accepted | zrh | zrh | 6 | 15.5 s |
