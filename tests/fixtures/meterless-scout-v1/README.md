Copied unchanged from Meterless Scout's locked regression set (Apache-2.0):
https://github.com/Meterless/Meterless/tree/main/engines/scout-intent/evals/regression-set/v1/injection
Commit 1742dec56a66e58eef9dda2d2b865823758ca8cd.

Scored the way the official runner scores it: an example counts as detected
when `decide()` returns `risk.level === "block"`. To run the official harness
itself against CargoPilot's Scout:

    npx degit meterless/meterless/engines/scout-intent scout-spec && cd scout-spec
    npm install
    SCOUT_IMPL=/abs/path/to/cargopilot/src/lib/guard/scout.ts npx tsx evals/runner/index.ts injection
