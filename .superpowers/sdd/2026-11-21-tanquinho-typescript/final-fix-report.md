# Final whole-branch review fixes

1. view-model.ts readMinuteSettings: loop instead of Object.fromEntries (projects/tanquinho/src/ui/view-model.ts, ~line 95).
2. Guard: tsconfig.src.json (ES2017 lib, types []), `typecheck` runs both configs (package.json); scripts/check-bundle.mjs + `check:bundle` script; CI step "Bundle check" replaces inline size step (.github/workflows/tanquinho.yml).
   Guard-proof: appended `export const probe = Object.fromEntries(...)` to src/ui/view-model.ts; `tsc --noEmit -p tsconfig.src.json` failed with TS2550 (Property 'fromEntries' does not exist... lib es2019), while plain `tsc --noEmit` passed. Probe then removed (grep confirms 0 occurrences); src typecheck clean again.
3. copy.ts: file-level comment moved to line 1.
4. view-model.ts: NaN -> undefined via !Number.isNaN; test "maps non-numeric and NaN settings to undefined" in test/ui/view-model.test.ts.
5. wash.ts: blank line after CycleProgress interface. .gitignore in projects/tanquinho already had a single /dist/ and /node_modules/ (no duplicates present), so unchanged.
6. entities.ts: RELAYS doc comment restored; new test/domain/entities.test.ts asserts MINUTE_SETTINGS order (fill L/M/H, drain L/M/H, mix, soak, wash).
7. Plan doc Task 9: step 1 reads four relays (old names) and requires all OFF; step 4 mentions "Tanquinho Fallback" hotspot.

Verification: `npm run check` passed (typecheck x2, lint 0 warnings, prettier, jest 12 suites / 62 tests). `npm run build:ui` -> dist/ui.js 24.8kb; `npm run check:bundle` -> "dist/ui.js: 25380 bytes" (limit 40960), exit 0. `npm run build` -> "Successfully compiled program."
Note: lint's no-console forced process.stdout/stderr.write in check-bundle.mjs.
