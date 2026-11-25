// Install once, outside the repository:
// npm install --prefix "%USERPROFILE%\.chad-proxy\tools" --no-audit --no-fund --ignore-scripts qrcode@1.5.4
// Run: node scripts/pair-qr.cjs
// The setup link stays in memory; errors are deliberately silent to avoid disclosing it.
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');

(async () => {
  const dir = path.join(process.env.USERPROFILE || os.homedir(), '.chad-proxy');
  const qr = require(path.join(dir, 'tools', 'node_modules', 'qrcode'));
  const link = (await fs.readFile(path.join(dir, 'setup-link.txt'), 'utf8')).trim();
  if (!link) throw new Error('Empty input');
  const output = path.join(dir, 'pair-qr.png');
  await qr.toFile(output, link, { type: 'png', errorCorrectionLevel: 'M', margin: 4, scale: 8 });
  console.log(`wrote ${output} (${(await fs.stat(output)).size} bytes)`);
})().catch(() => { process.exitCode = 1; });
