# CargoPilot agent eval

Generated 2026-10-25T23:24:58.322Z from 20 recorded live runs of nvidia/nemotron-3-super-120b-a12b on Nebius Token Factory (prompt v5).
Scenarios: `src/lib/agent/matrix.ts` (`evalMatrix`). Reproduce: `npm run agent:record` (needs NEBIUS_API_KEY).

| Metric | Value |
| --- | --- |
| Decision accepted by the verifier on first submission | 0/20 (0%) |
| Accepted after verifier feedback (≤3 submissions) | 20/20 (100%) |
| Fell back to rules engine | 0/20 |
| Verified pick = rules-engine pick | 18/20 (90%) |
| Latency p50 / p95 | 16.2 s / 23.9 s |
| Tool calls per run (min / mean / max) | 5 / 7.8 / 10 |
| Tokens (prompt → completion) | 764,091 → 48,928 |
| Cost at list price ($0.3/$0.9 per 1M) | $0.2733 |

## What the verifier sent back

- `tools`: 20 rejection(s)
- `evidence`: 4 rejection(s)
- `language`: 2 rejection(s)

Each rejection, exactly as the verifier returned it to the model:

| Scenario | Attempt | Failures |
| --- | --- | --- |
| `s020|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s074|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s080|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s125|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s125|d0|-|en|-|wx:CDG=IFR` | 1 | tools: Not called: get_station_evidence, recall_desk_memory<br>evidence: CDG in IFR held its window 6 of 12; below the desk's two-in-three bar, keep-first does not apply |
| `s131|d0|-|en|-` | 1 | tools: Not called: get_station_evidence, recall_desk_memory |
| `s157|d25|-|en|-` | 1 | tools: Not called: get_station_evidence, recall_desk_memory |
| `s172|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s176|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s235|d0|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 1 | tools: Not called: get_station_evidence, recall_desk_memory |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 1 | tools: Not called: recall_desk_memory<br>language: why reads as en; the desk works in fr |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 2 | language: why reads as en; the desk works in fr |
| `s615|d60|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-|mem:a40553de` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 1 | tools: Not called: recall_desk_memory<br>evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d60|-|en|-|wx:LEJ=MVFR` | 1 | tools: Not called: recall_desk_memory |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 1 | tools: Not called: get_station_evidence, recall_desk_memory<br>evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 1 | tools: Not called: recall_desk_memory<br>evidence: LEJ in IFR held its window 5 of 8; below the desk's two-in-three bar, keep-first does not apply |
| `s615|d90|-|en|-` | 1 | tools: Not called: recall_desk_memory |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 1 | tools: Not called: recall_desk_memory |

## Where Nemotron and the rules engine disagree

A disagreement is not an error: both picks passed the hard constraints. These rows are where the model's ranking (protected cargo first, then risk → delay → cost) differs from the engine's fixed order.

| Scenario | Nemotron | Rules |
| --- | --- | --- |
| `s080|d0|-|en|-` | active | repack |
| `s131|d0|-|en|-` | hold | inspect |

## Every run

| Scenario | AWB | Submissions | Verdict | Pick | Rules | Tools | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s020|d0|-|en|-` | 020-77120562 | 2 | accepted | main | main | 9 | 14.4 s |
| `s074|d0|-|en|-` | 074-33019873 | 2 | accepted | later | later | 8 | 15.9 s |
| `s080|d0|-|en|-` | 080-22991006 | 2 | accepted | active | repack | 7 | 12.3 s |
| `s125|d0|-|en|-` | 125-88342111 | 2 | accepted | keep | keep | 9 | 15.2 s |
| `s125|d0|-|en|-|wx:CDG=IFR` | 125-88342111 | 2 | accepted | fra | fra | 10 | 19.0 s |
| `s131|d0|-|en|-` | 131-77881204 | 2 | accepted | hold | inspect | 10 | 16.2 s |
| `s157|d25|-|en|-` | 157-88001233 | 2 | accepted | rush | rush | 10 | 15.6 s |
| `s172|d0|-|en|-` | 172-44091832 | 2 | accepted | freighter | freighter | 9 | 15.3 s |
| `s176|d0|-|en|-` | 176-55287190 | 2 | accepted | chase | chase | 6 | 10.4 s |
| `s235|d0|-|en|-` | 235-10092832 | 2 | accepted | next | next | 7 | 12.3 s |
| `s615|d120|-|en|172b8ea0` “What if the truck is delayed another 30 minutes?” | 615-12345675 | 2 | accepted | zrh | zrh | 6 | 18.3 s |
| `s615|d45|-|fr|962111ae` “Le camion est en retard de 45 minutes. Qu'est-ce qu'on fait ?” | 615-12345675 | 3 | accepted | keep | keep | 6 | 20.1 s |
| `s615|d60|-|en|-` | 615-12345675 | 2 | accepted | keep | keep | 7 | 16.7 s |
| `s615|d60|-|en|-|mem:a40553de` | 615-12345675 | 2 | accepted | keep | keep | 7 | 16.1 s |
| `s615|d60|-|en|-|wx:LEJ=IFR` | 615-12345675 | 2 | accepted | zrh | zrh | 10 | 23.9 s |
| `s615|d60|-|en|-|wx:LEJ=MVFR` | 615-12345675 | 2 | accepted | keep | keep | 9 | 23.1 s |
| `s615|d60|-|en|228cfc09|wx:LEJ=IFR` “Why not keep the booking? The truck is only an hour late.” | 615-12345675 | 2 | accepted | zrh | zrh | 7 | 22.4 s |
| `s615|d60|-|fr|-|wx:LEJ=IFR` | 615-12345675 | 2 | accepted | zrh | zrh | 7 | 20.0 s |
| `s615|d90|-|en|-` | 615-12345675 | 2 | accepted | zrh | zrh | 7 | 18.7 s |
| `s615|d90|-|en|9d0870b6` “Why this call?” | 615-12345675 | 2 | accepted | zrh | zrh | 5 | 14.2 s |
