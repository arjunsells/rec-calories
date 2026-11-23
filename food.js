'use strict';
// Open Food Facts data: https://world.openfoodfacts.org (ODbL).
((root) => {
  const API = 'https://world.openfoodfacts.org';
  const FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments';
  const finite = n => n !== null && n !== '' && n !== undefined && Number.isFinite(Number(n)) && Number(n) >= 0;
  const round = n => Math.round((n + Number.EPSILON) * 10) / 10;
  function normalize(product) {
    if (!product || typeof product !== 'object') return null;
    const n = product.nutriments || {};
    const energy = suffix => finite(n[`energy-kcal_${suffix}`]) ? Number(n[`energy-kcal_${suffix}`]) : finite(n[`energy_${suffix}`]) ? Number(n[`energy_${suffix}`]) / 4.184 : null;
    const values = suffix => ({ kcal: energy(suffix), protein: n[`proteins_${suffix}`], carbs: n[`carbohydrates_${suffix}`], fat: n[`fat_${suffix}`] });
    const complete = values => Object.values(values).every(finite) && Number(values.kcal) > 0;
    const servingText = String(product.serving_size || '').slice(0, 100);
    const quantityMatch = servingText.match(/([\d.]+)\s*(g|ml)\b/i);
    const servingGrams = finite(product.serving_quantity) && Number(product.serving_quantity) > 0 ? Number(product.serving_quantity) : quantityMatch && Number(quantityMatch[1]) > 0 ? Number(quantityMatch[1]) : null;
    let nutrition = values('serving'), basis = 'serving';
    if (!complete(nutrition)) {
      nutrition = values('100g');
      if (!complete(nutrition)) return null;
      if (servingGrams) nutrition = Object.fromEntries(Object.entries(nutrition).map(([k, v]) => [k, Number(v) * servingGrams / 100]));
      else basis = '100g';
    }
    return {
      name: String(product.product_name || product.product_name_en || product.brands || 'Packaged food').slice(0, 80),
      ...Object.fromEntries(Object.entries(nutrition).map(([k, v]) => [k, round(Number(v))])),
      portion: basis === 'serving' ? servingText || `${servingGrams || 1}${servingGrams ? ' g' : ' serving'}` : '100 g / ml (check pack)',
      basis, servingGrams: basis === 'serving' ? servingGrams : 100,
      code: String(product.code || ''), source: 'barcode'
    };
  }
  function scale(item, multiplier) {
    if (!Number.isFinite(Number(multiplier)) || Number(multiplier) <= 0 || Number(multiplier) > 100) throw Error('Choose a valid portion.');
    return { ...item, ...Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(k => [k, round(item[k] * Number(multiplier))])) };
  }
  async function request(url, fetcher = root.fetch) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(url, { signal: controller.signal });
      if (!response.ok) throw Error('Open Food Facts is busy. Try again in a moment.');
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw Error('Food lookup timed out. Try again.');
      if (error instanceof TypeError) throw Error('Could not reach Open Food Facts. Check your connection.');
      if (error instanceof SyntaxError) throw Error('Food lookup returned an unreadable result. Try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function lookup(code, fetcher) {
    const barcode = String(code).trim();
    if (!/^\d{8,14}$/.test(barcode)) throw Error('Enter the 8–14 digits below the barcode.');
    const result = await request(`${API}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, fetcher);
    if (result.status === 0 || !result.product) throw Error('Barcode not found. Try food search or enter it manually.');
    const item = normalize({ ...result.product, code: barcode });
    if (!item) throw Error('This product has incomplete nutrition. Check the pack and enter it manually.');
    return item;
  }
  async function search(query, fetcher) {
    const term = String(query).trim().slice(0, 100);
    if (term.length < 2) throw Error('Type at least two letters to search.');
    const params = new URLSearchParams({ search_terms: term, search_simple: '1', action: 'process', json: '1', page_size: '12', fields: FIELDS });
    const endpoint = `${API}/cgi/search.pl?`;
    const local = new URLSearchParams(params);
    local.set('tagtype_0', 'countries'); local.set('tag_contains_0', 'contains'); local.set('tag_0', 'australia');
    let products = [], localError;
    try { products = (await request(endpoint + local, fetcher)).products || []; } catch (error) { localError = error; }
    let items = products.map(normalize).filter(Boolean);
    if (!items.length) {
      try { items = ((await request(endpoint + params, fetcher)).products || []).map(normalize).filter(Boolean); }
      catch (error) { throw localError || error; }
    }
    return items.map(item => ({ ...item, source: 'search' }));
  }
  async function startScanner(video, onCode) {
    if (!root.ZXingBrowser) throw Error('Barcode scanner is unavailable. Enter the barcode digits below.');
    if (!root.navigator?.mediaDevices?.getUserMedia) throw Error('Camera is unavailable. Enter the barcode digits below.');
    video.setAttribute('playsinline', ''); video.muted = true;
    const reader = new root.ZXingBrowser.BrowserMultiFormatOneDReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 1000 });
    try {
      let found = false;
      return await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (result, error, controls) => {
        if (result && !found && /^\d{8,14}$/.test(result.getText())) {
          found = true; controls.stop(); onCode(result.getText());
        }
      });
    } catch (error) {
      video.srcObject?.getTracks().forEach(track => track.stop());
      throw Error(error.name === 'NotAllowedError' ? 'Camera permission was declined. Enter the barcode digits below.' : 'Could not open the camera. Enter the barcode digits below.');
    }
  }
  const api = { search, lookup, normalize, scale, startScanner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHADFood = api;
})(globalThis);
