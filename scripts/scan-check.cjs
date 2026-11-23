const assert = require('node:assert/strict');
const scan = require('../scan.js');
const item = { name: 'Synthetic rice bowl', portion: '250 g', kcal: 420, protein: 22, carbs: 55, fat: 12 };
(async () => {
  let request;
  const result = await scan.analyze('data:image/jpeg;base64,c3ludGhldGlj', 'synthetic-test-token', async (url, options) => {
    request = { url, ...options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ items: [item], total: 999 }) } }] }) };
  });
  assert.equal(result.total, 420); // Recompute untrusted totals.
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer synthetic-test-token');
  const body = JSON.parse(request.body);
  assert.equal(body.model, 'gpt-4o-mini'); assert.equal(body.store, false);
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/jpeg;base64,c3ludGhldGlj');
  for (const [status, pattern] of [[401, /key was rejected/], [429, /usage limit/], [500, /unavailable/]]) {
    await assert.rejects(scan.analyze('image', 'synthetic-test-token', async () => ({ status, ok: false })), pattern);
  }
  await assert.rejects(scan.analyze('image', '', () => { throw Error('Must not fetch'); }), /Settings/);
  await assert.rejects(scan.analyze('image', 'synthetic-test-token', async () => { throw TypeError('offline'); }), /internet connection/);
  await assert.rejects(scan.analyze('image', 'synthetic-test-token', async () => { throw Object.assign(Error(), { name: 'AbortError' }); }), /timed out/);
  for (const content of ['broken', '{}', '{"items":[]}', JSON.stringify({ items: [{ ...item, kcal: -1 }] }), JSON.stringify({ items: [{ ...item, carbs: '55' }] })]) {
    await assert.rejects(scan.analyze('image', 'synthetic-test-token', async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })), /Could not read/);
  }
  console.log('PASS: mocked vision success, request contract, recomputed total, no key, 401, 429, server error, malformed/invalid JSON, offline and timeout.');
})().catch(error => { console.error(error); process.exitCode = 1; });
