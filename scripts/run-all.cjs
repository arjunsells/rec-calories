// Deterministic suites only. off-live-check.cjs is an optional external-service diagnostic, v9-ai-live-check.cjs an
// opt-in check against the real proxy, and v11-screenshots.cjs makes pictures (not a test).
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = ['check', 'v11-secret-scan', 'scan-check', 'quest-check', 'food-check', 'v11-migration-check', 'browser-check', 'regression-check', 'v11-browser-check', 'v11-undo-check', 'v11-workout-check', 'v11-meals-check', 'v9-ai-check', 'v11-design-check', 'v11-motion-check', 'sw-update-check', 'v11-button-count'];
for (const name of suites) {
  const result = spawnSync(process.execPath, [path.join(__dirname, name + '.cjs')], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error('FAIL ' + name); process.exit(result.status || 1); }
}
console.log('PASS all ' + suites.length + ' automated suites. Live service diagnostics are opt-in.');
