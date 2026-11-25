// Deterministic suites only. off-live-check.cjs is an optional external-service diagnostic, v12-ai-live-check.cjs an
// opt-in check against the real proxy, and v12-screenshots.cjs makes pictures (not a test).
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = ['check', 'v12-secret-scan', 'scan-check', 'quest-check', 'food-check', 'v12-migration-check', 'browser-check', 'regression-check', 'v12-browser-check', 'v12-undo-check', 'v12-workout-check', 'v12-meals-check', 'v12-ai-check', 'v12-scan-check', 'v12-offline-check', 'v12-design-check', 'v12-motion-check', 'sw-update-check', 'v12-button-count'];
for (const name of suites) {
  const result = spawnSync(process.execPath, [path.join(__dirname, name + '.cjs')], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error(`\n${name} failed (exit ${result.status}).`); process.exit(result.status || 1); }
}
console.log(`\nAll ${suites.length} suites passed.`);
