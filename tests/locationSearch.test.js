const test = require('node:test');
const assert = require('node:assert/strict');
const { searchLocations } = require('../controllers/locationSearch.controller');
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('search normalizes provider results, filters invalid locations, and caches repeat queries', async t => {
  t.mock.method(Date, 'now', () => 10000);
  const request = t.mock.method(global, 'fetch', async url => {
    assert.equal(url.searchParams.get('countrycode'), 'PK');
    assert.equal(url.searchParams.get('q'), 'Lahore');
    return { ok: true, json: async () => ({ features: [
      { geometry: { type: 'Point', coordinates: [74.35, 31.52] }, properties: { name: 'Lahore', city: 'Lahore', countrycode: 'PK', country: 'Pakistan' } },
      { geometry: { type: 'Point', coordinates: [200, 31] }, properties: { name: 'Bad', countrycode: 'PK' } },
      { geometry: { type: 'Point', coordinates: [12, 51] }, properties: { name: 'Other country', countrycode: 'DE' } },
    ] }) };
  });
  const res = response();
  await searchLocations({ query: { q: 'Lahore' } }, res);
  assert.deepEqual(res.body.data.locations, [{ latitude: 31.52, longitude: 74.35, label: 'Lahore, Pakistan' }]);
  await searchLocations({ query: { q: ' lahore ' } }, response());
  assert.equal(request.mock.callCount(), 1);
});

test('upstream failures return an actionable error', async t => {
  t.mock.method(Date, 'now', () => 20000);
  t.mock.method(global, 'fetch', async () => { throw new Error('offline'); });
  const res = response();
  await searchLocations({ query: { q: 'Karachi' } }, res);
  assert.equal(res.code, 503);
  assert.match(res.body.message, /place a pin/);
});

test('rapid uncached requests are limited before calling provider', async t => {
  t.mock.method(Date, 'now', () => 20001);
  const request = t.mock.method(global, 'fetch', async () => assert.fail('provider must not be called'));
  const res = response();
  await searchLocations({ query: { q: 'Islamabad' } }, res);
  assert.equal(res.code, 429);
  assert.equal(request.mock.callCount(), 0);
});
