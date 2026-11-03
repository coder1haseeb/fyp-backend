const test = require('node:test');
const assert = require('node:assert/strict');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Interaction = require('../models/Interaction');
const { addToCart } = require('../controllers/cart.controller');
const { placeOrder } = require('../controllers/order.controller');
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('products from the same store can still be added and quantities updated', async t => {
  const cart = { items: [{ product: 'product', quantity: 1 }], save: t.mock.fn(async () => {}), populate: async () => cart };
  t.mock.method(Product, 'findById', async () => ({ business: 'store-a', status: 'active', stockQty: 10 }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Cart, 'findOne', async () => cart);
  t.mock.method(Product, 'find', () => ({ select: async () => [{ business: 'store-a' }] }));
  t.mock.method(Interaction, 'create', async () => ({}));
  const res = response();
  await addToCart({ user: { userId: 'customer' }, body: { productId: 'product', quantity: 2 } }, res);
  assert.equal(res.code, 201);
  assert.equal(cart.items[0].quantity, 3);
  assert.equal(cart.save.mock.callCount(), 1);
});

test('guest cart rejects another store and retains the existing items', async t => {
  const data = new Map();
  const oldWindow = Object.getOwnPropertyDescriptor(global, 'window');
  const oldStorage = Object.getOwnPropertyDescriptor(global, 'localStorage');
  Object.defineProperty(global, 'window', { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(global, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) } });
  t.after(() => {
    if (oldWindow) Object.defineProperty(global, 'window', oldWindow); else delete global.window;
    if (oldStorage) Object.defineProperty(global, 'localStorage', oldStorage); else delete global.localStorage;
  });
  const first = '111111111111111111111111';
  const second = '222222222222222222222222';
  t.mock.method(global, 'fetch', async url => ({ ok: true, json: async () => ({ success: true, data: { business: { _id: url.endsWith(first) ? 'store-a' : 'store-b' } } }) }));
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../frontend/lib/guestCart.js'), 'utf8');
  const guest = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  await guest.addGuestItem(first, 1);
  await assert.rejects(guest.addGuestItem(second, 1), /one store at a time/);
  assert.deepEqual(guest.readGuestCart(), [{ productId: first, quantity: 1 }]);
  await guest.addGuestItem(first, 2);
  assert.deepEqual(guest.readGuestCart(), [{ productId: first, quantity: 3 }]);
});

test('adding a different store product leaves the current cart untouched', async t => {
  const save = t.mock.fn();
  t.mock.method(Product, 'findById', async () => ({ business: 'store-b', status: 'active', stockQty: 10 }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Cart, 'findOne', async () => ({ items: [{ product: 'old-product', quantity: 1 }], save }));
  t.mock.method(Product, 'find', () => ({ select: async () => [{ business: 'store-a' }] }));
  const res = response();
  await addToCart({ user: { userId: 'customer' }, body: { productId: 'new-product', quantity: 1 } }, res);
  assert.equal(res.code, 409);
  assert.equal(res.body.error, 'MULTI_STORE_CART');
  assert.equal(save.mock.callCount(), 0);
});

test('unavailable existing products must be removed before adding new products', async t => {
  t.mock.method(Product, 'findById', async () => ({ business: 'store-a', status: 'active', stockQty: 10 }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Cart, 'findOne', async () => ({ items: [{ product: 'missing' }] }));
  t.mock.method(Product, 'find', () => ({ select: async () => [] }));
  const res = response();
  await addToCart({ user: { userId: 'customer' }, body: { productId: 'new-product' } }, res);
  assert.equal(res.body.error, 'PRODUCT_UNAVAILABLE');
});

test('all payment methods reject mixed-store checkout before creating orders', async t => {
  const items = ['store-a', 'store-b'].map(business => ({ quantity: 1, product: { _id: business, business, status: 'active', stockQty: 10, price: 100 } }));
  t.mock.method(Cart, 'findOne', () => ({ populate: async () => ({ items }) }));
  const create = t.mock.method(Order, 'create', async () => assert.fail('must not create an order'));
  for (const paymentMethod of ['cod', 'pay_at_store', 'bank_transfer', 'safepay', 'jazzcash', 'easypaisa', 'rapidgateway']) {
    const res = response();
    await placeOrder({ user: { userId: 'customer' }, body: { paymentMethod } }, res);
    assert.equal(res.code, 400, paymentMethod);
    assert.equal(res.body.error, 'MULTI_STORE_CART', paymentMethod);
  }
  assert.equal(create.mock.callCount(), 0);
});

test('concurrent cart changes return a conflict instead of overwriting', async t => {
  t.mock.method(Product, 'findById', async () => ({ business: 'store-a', status: 'active', stockQty: 10 }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Cart, 'findOne', async () => ({ items: [], save: async () => { const err = new Error(); err.name = 'VersionError'; throw err; } }));
  const res = response();
  await addToCart({ user: { userId: 'customer' }, body: { productId: 'new-product' } }, res);
  assert.equal(res.code, 409);
  assert.equal(res.body.error, 'CART_CHANGED');
});
