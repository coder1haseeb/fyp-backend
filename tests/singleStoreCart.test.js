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

test('guest cart accepts products from different stores', async t => {
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
  await guest.addGuestItem(second, 1);
  assert.deepEqual(guest.readGuestCart(), [{ productId: first, quantity: 1 }, { productId: second, quantity: 1 }]);
  await guest.addGuestItem(first, 2);
  assert.deepEqual(guest.readGuestCart(), [{ productId: first, quantity: 3 }, { productId: second, quantity: 1 }]);
});

test('adding products from another store preserves existing products', async t => {
  const cart = { items: [{ product: 'old-product', quantity: 1 }], save: async () => {}, populate: async () => cart };
  t.mock.method(Product, 'findById', async () => ({ business: 'store-b', status: 'active', stockQty: 10 }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Cart, 'findOne', async () => cart);
  t.mock.method(Interaction, 'create', async () => ({}));
  const res = response();
  await addToCart({ user: { userId: 'customer' }, body: { productId: 'new-product', quantity: 1 } }, res);
  assert.equal(res.code, 201);
  assert.deepEqual(cart.items.map(item => item.product), ['old-product', 'new-product']);
});

test('all payment methods reject mixed-store checkout before creating orders', async t => {
  const items = ['store-a', 'store-b'].map(business => ({ quantity: 1, product: { _id: business, business, status: 'active', stockQty: 10, price: 100 } }));
  t.mock.method(Cart, 'findOne', () => ({ populate: async () => ({ items }) }));
  const create = t.mock.method(Order, 'create', async () => assert.fail('must not create an order'));
  for (const paymentMethod of ['cod', 'pay_at_store', 'bank_transfer', 'safepay', 'jazzcash', 'easypaisa', 'rapidgateway']) {
    const res = response();
    await placeOrder({ user: { userId: 'customer' }, body: { paymentMethod } }, res);
    assert.equal(res.code, 400, paymentMethod);
    assert.equal(res.body.error, 'STORE_SELECTION_REQUIRED', paymentMethod);
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

const { selectStoreItems } = require('../utils/cartSelection');
test('placing an order charges and removes only the selected store items', async t => {
  const mongoose = require('mongoose');
  const Payment = require('../models/Payment');
  const Notification = require('../models/Notification');
  const id = () => new mongoose.Types.ObjectId();
  const customer = id(), storeA = id(), storeB = id(), productA = id(), productB = id(), itemA = id(), itemB = id();
  const items = [
    { _id: itemA, quantity: 2, product: { _id: productA, business: storeA, status: 'active', stockQty: 10, price: 150 } },
    { _id: itemB, quantity: 1, product: { _id: productB, business: storeB, status: 'active', stockQty: 0, price: 999 } },
  ];
  t.mock.method(Cart, 'findOne', () => ({ populate: async () => ({ items }) }));
  t.mock.method(Business, 'exists', async () => ({}));
  t.mock.method(Business, 'findById', () => ({ select: async () => ({ owner: id() }) }));
  t.mock.method(Order, 'countDocuments', async () => 0);
  const orders = [];
  t.mock.method(Order.prototype, 'save', async function () { orders.push(this); });
  const payments = [];
  t.mock.method(Payment.prototype, 'save', async function () { payments.push(this); });
  t.mock.method(Notification.prototype, 'save', async () => {});
  t.mock.method(Interaction, 'create', async () => ({}));
  t.mock.method(Product, 'findById', () => ({ populate: async () => null }));
  const stock = t.mock.method(Product, 'findByIdAndUpdate', async () => ({}));
  const cleanup = t.mock.method(Cart, 'findOneAndUpdate', async () => ({}));
  const res = response();
  await placeOrder({ user: { userId: customer }, body: { businessId: String(storeA), paymentMethod: 'cod', contact: { fullName: 'Customer', email: 'customer@example.com', phone: '03001234567' } } }, res);
  assert.equal(res.code, 201);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].totalAmount, 300);
  assert.equal(payments[0].amount, 300);
  assert.equal(String(stock.mock.calls[0].arguments[0]), String(productA));
  assert.equal(stock.mock.callCount(), 1);
  const update = cleanup.mock.calls[0].arguments[1];
  assert.deepEqual(update.$pull.items._id.$in, [itemA]);
  assert.equal(update.$set, undefined);
});

test('checkout selects only the requested store and excludes unavailable items from other stores', () => {
  const selected = { _id: 'a', product: { business: 'store-a' }, quantity: 2 };
  const other = { _id: 'b', product: { business: 'store-b', stockQty: 0 }, quantity: 1 };
  const items = [selected, other, { _id: 'missing', product: null }];
  assert.deepEqual(selectStoreItems(items, 'store-a').items, [selected]);
  assert.ok(selectStoreItems(items).error);
  assert.ok(selectStoreItems(items, 'store-c').error);
  assert.equal(selectStoreItems([selected]).businessId, 'store-a');
});
