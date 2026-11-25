// Synthetic planned-food journal and UI checks. Browser suites run sequentially via run-all.cjs.
const assert = require('node:assert/strict');
const { serve, launch, watch, saved, IPHONE, NOON } = require('./harness.cjs');
const key = '2026-11-24';
(async () => {
  const server = await serve(8112), browser = await launch();
  try {
    for (const [width, height] of [[393, 852], [375, 667]]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height }, ...IPHONE, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(), errors = watch(page);
      await page.clock.install({ time: new Date(NOON) });
      await page.goto('http://127.0.0.1:8112/');
      const old = { schemaVersion: 5, appVersion: 11, target: 1900, proteinGoal: 220, entries: [{ id: 'old-food', day: '2026-11-23', name: 'Vegetable soup', kcal: 200, protein: 12 }], questsV5: { '2026-11-23': { water: 2 } }, syntheticBookmark: { keep: true } };
      await page.evaluate(s => { localStorage.removeItem('rec-calories-v11-backup'); localStorage.setItem('rec-calories-v1', JSON.stringify(s)); }, old);
      await page.reload();
      assert.equal(await page.locator('#planned12').isVisible(), false);
      const tap = async s => { const e = page.locator(s); await e.scrollIntoViewIfNeeded(); await e.tap(); };
      const undo = async () => { await page.waitForTimeout(450); await tap('#undo-toast button'); };
      const manual = async () => {
        await tap('#add-food'); await tap('#builder-type');
        await page.locator('#n12-name').fill('Chicken salad');
        for (const [id, value] of [['kcal', '420'], ['protein', '35'], ['carbs', '24'], ['fat', '18']]) await page.locator('#n12-' + id).fill(value);
      };
      await manual(); await tap('#n12-later');
      let s = await saved(page), item = s.planned12[key][0];
      assert.deepEqual([item.name, item.kcal, item.p, item.c, item.f], ['Chicken salad', 420, 35, 24, 18]);
      assert.ok(item.id && Number.isFinite(Date.parse(item.at)));
      assert.deepEqual(s.entries, old.entries); assert.deepEqual(s.questsV5, old.questsV5); assert.deepEqual(s.syntheticBookmark, old.syntheticBookmark);
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('rec-calories-v11-backup'))), old);
      assert.equal(await page.locator('#remaining').innerText(), '1,900');
      await page.reload(); assert.equal(await page.locator('#planned12-list li').count(), 1);
      assert.equal(await page.locator('#planned12-list button').count(), 1, 'one round action per row');
      const tick = await page.locator('.ch-planned__tick').boundingBox(); assert.ok(tick.width >= 48 && tick.height >= 48);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok(await page.locator('#planned12').evaluate(e => e.compareDocumentPosition(document.getElementById('now')) & Node.DOCUMENT_POSITION_FOLLOWING));
      await tap('.ch-planned__tick');
      s = await saved(page); const logged = s.entries.find(e => e.day === key);
      assert.deepEqual([logged.name, logged.kcal, logged.protein, logged.carbs, logged.fat], ['Chicken salad', 420, 35, 24, 18]);
      assert.equal(s.planned12, undefined); assert.equal(await page.locator('#planned12').isVisible(), false);
      assert.equal(await page.locator('#remaining').innerText(), '1,480'); assert.equal(await page.locator('#protein-left').innerText(), '185');
      assert.equal(await page.locator('#carbs-left').innerText(), '126'); assert.equal(await page.locator('#fat-left').innerText(), '27');
      assert.match(await page.locator('#recent12').innerText(), /Chicken salad/);
      await undo(); s = await saved(page); assert.deepEqual(s.planned12[key], [item]); assert.deepEqual(s.entries, old.entries);
      await undo(); assert.equal((await saved(page)).planned12, undefined); await undo();
      // A real held pointer opens the same detail sheet pattern; a moving pointer cancels it.
      await page.waitForTimeout(450);
      const row = page.locator('#planned12-list li'); await row.scrollIntoViewIfNeeded();
      const box = await row.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.clock.runFor(650); await page.mouse.up();
      await tap('#planned12-remove'); assert.equal((await saved(page)).planned12, undefined); await undo();
      // Export includes plans; importing merges without replacing local values or duplicating IDs, and is undoable.
      await page.evaluate(() => CHADUX.showView('settings'));
      await page.locator('#data-settings').evaluate(e => { e.open = true; });
      const download = page.waitForEvent('download'); await tap('#export-backup'); const backup = await download;
      const fs = require('node:fs'); const payload = JSON.parse(fs.readFileSync(await backup.path(), 'utf8'));
      assert.deepEqual(payload.journal.planned12[key], [item]);
      const imported = { ...payload.journal, planned12: { ...payload.journal.planned12, '2026-11-23': [{ ...item, id: 'synthetic-other-day' }] } };
      await page.locator('#import-backup-file').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ journal: imported })) });
      await page.waitForFunction(() => !!CHADUX.journal().planned12?.['2026-11-23']);
      assert.equal((await saved(page)).planned12[key].length, 1); await undo(); assert.equal((await saved(page)).planned12['2026-11-23'], undefined);
      await page.evaluate(() => CHADUX.showView('today'));
      // Planning the builder contents and ordinary manual logging both remain available.
      await tap('#add-food'); await tap('#builder-chips [data-food=eggs]'); await tap('#builder-later');
      assert.equal((await saved(page)).planned12[key].length, 2); await undo();
      await manual(); await tap('#n12-done'); await tap('#builder-log');
      assert.equal((await saved(page)).entries.filter(e => e.day === key).length, 1);
      assert.equal((await saved(page)).planned12[key].length, 1);
      await page.reload(); assert.equal((await saved(page)).planned12[key].length, 1);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS planned food ${width}x${height} ${theme}: manual plan/log, macros, one tick, Undo/Redo, reload, long-press remove, additive migration, backup export/import`);
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
