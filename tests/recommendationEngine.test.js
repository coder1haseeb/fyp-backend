const test = require('node:test');
const assert = require('node:assert/strict');
const { rankProducts, similarProducts, FEATURE_NAMES } = require('../utils/recommendationEngine');

const products = [
  { _id: 'soap', name: 'Charcoal soap', category: 'Bath', description: 'Handmade skin care', business: { city: 'Lahore' } },
  { _id: 'shampoo', name: 'Natural shampoo', category: 'Bath', description: 'Handmade skin care', business: { city: 'Lahore' } },
  { _id: 'laptop', name: 'Laptop computer', category: 'Electronics', description: 'Fast processor', business: { city: 'Karachi' } },
];
const event = (customer, product, interactionType) => ({ customer, product, interactionType, createdAt: new Date() });

test('cold-start customers get available products ordered by popularity', () => {
  const ranked = rankProducts({ products, interactions: [event('peer', 'laptop', 'purchase')], customerId: 'new', limit: 3 });
  assert.equal(ranked[0]._id, 'laptop');
  assert.equal(ranked.length, 3);
});

test('content and peer behavior personalize the ranking', () => {
  const interactions = [event('mine', 'soap', 'view'), event('peer', 'soap', 'view'), event('peer', 'shampoo', 'purchase')];
  const ranked = rankProducts({ products, interactions, customerId: 'mine', limit: 3 });
  assert.equal(ranked[0]._id, 'shampoo');
});

test('similar results exclude the source and use product text', () => {
  const ranked = similarProducts(products, products[0], 2);
  assert.equal(ranked[0]._id, 'shampoo');
  assert.ok(ranked.every(product => product._id !== 'soap'));
});

test('previous purchases are omitted when alternatives exist', () => {
  const ranked = rankProducts({ products, interactions: [event('mine', 'soap', 'purchase')], customerId: 'mine', limit: 2 });
  assert.ok(ranked.every(product => product._id !== 'soap'));
});

test('candidate features are finite and match the training schema', () => {
  const candidates = rankProducts({ products, interactions: [event('mine', 'soap', 'view')],
    customerId: 'mine', limit: 3, withScores: true });
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    assert.equal(candidate.features.length, FEATURE_NAMES.length);
    assert.ok(candidate.features.every(Number.isFinite));
    assert.ok(Number.isFinite(candidate.score));
  }
});

test('personalized candidates exclude unrelated popular products', () => {
  const interactions = [event('mine', 'soap', 'view'), ...Array.from({ length: 20 }, () => event('peer', 'laptop', 'purchase'))];
  const ranked = rankProducts({ products, interactions, customerId: 'mine', limit: 10 });
  assert.ok(ranked.some(product => product._id === 'soap'));
  assert.ok(ranked.some(product => product._id === 'shampoo'));
  assert.ok(ranked.every(product => product._id !== 'laptop'));
});

test('search history personalizes recommendations and does not leak between customers', () => {
  const interactions = [{ customer: 'mine', interactionType: 'search', searchQuery: 'soap', createdAt: new Date() }];
  const ranked = rankProducts({ products, interactions, customerId: 'mine', limit: 10 });
  assert.deepEqual(new Set(ranked.map(product => product._id)), new Set(['soap', 'shampoo']));
  assert.equal(rankProducts({ products, interactions, customerId: 'other', limit: 10 }).length, 3);
});

test('unmatched searches do not fill personalized recommendations with unrelated items', () => {
  const ranked = rankProducts({ products, interactions: [{ customer: 'mine', interactionType: 'search', searchQuery: 'bicycle', createdAt: new Date() }], customerId: 'mine' });
  assert.equal(ranked.length, 0);
});

test('history of an unavailable product can still find its category', () => {
  const ranked = rankProducts({ products: products.slice(1), historyProducts: [products[0]], interactions: [event('mine', 'soap', 'view')], customerId: 'mine' });
  assert.deepEqual(ranked.map(product => product._id), ['shampoo']);
});
