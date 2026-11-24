// Deterministic suites only. off-live-check.cjs is an optional external-service diagnostic.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const suites = ['check', 'scan-check', 'quest-check', 'food-check', 'browser-check', 'regression-check', 'v9-browser-check', 'v9-undo-check', 'v9-ai-check', 'v9-design-check', 'v9-motion-check', 'sw-update-check', 'v9-button-count'];
for (const name of suites) {
  const result = spawnSync(process.execPath, [path.join(__dirname, name + '.cjs')], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error('FAIL ' + name); process.exit(result.status || 1); }
}
console.log('PASS all ' + suites.length + ' automated suites. Live service diagnostics are opt-in.');
