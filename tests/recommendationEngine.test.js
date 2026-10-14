const test = require('node:test');
const assert = require('node:assert/strict');
const { rankProducts, similarProducts } = require('../utils/recommendationEngine');

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
