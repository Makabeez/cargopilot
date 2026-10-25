# Vendored: Meterless H-MEM reference engine

Source: https://github.com/Meterless/Meterless/tree/main/engines/hmem/reference/src
Commit: 1742dec56a66e58eef9dda2d2b865823758ca8cd (19 Oct 2026)
License: Apache-2.0 (see LICENSE in this folder). Copied as published, with the
one patch described below; this is how
Meterless distributes it (`npx degit meterless/meterless/engines/hmem`, the
`agentathon-starter` template vendors it the same way). Not authored by CargoPilot.

CargoPilot's use of it lives in `src/lib/memory/desk-memory.ts`.

## One local patch

`embeddings.ts`: the reference's deterministic hash embedder uses 64 dimensions,
which collides short operational notes ("LEJ", "ZRH", customer names) into the
same buckets. CargoPilot raises it to 1024 dimensions and skips common English
stopwords. The function stays a pure, deterministic `text → number[]`, which is
the contract H-MEM's spec asks a replacement embedder to keep. Measured on the
11 seed notes with the desk's query and threshold (`npm run judge-demo`, line
[8]): precision 0.53 → 0.63, recall 0.90 → 1.00. Everything else is unmodified.
