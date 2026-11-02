const test = require('node:test');
const assert = require('node:assert/strict');
const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const Business = require('../models/Business');
const Order = require('../models/Order');
const Product = require('../models/Product');
const controller = require('../controllers/admin.controller');
const router = require('../routes/admin.routes');
const { validationResult } = require('express-validator');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('management validation rejects malformed IDs and contact details', async () => {
  const route = router.stack.find(layer => layer.route?.path === '/users/:userId' && layer.route.methods.put).route;
  const req = { params: { userId: 'invalid' }, body: { email: 'invalid', phone: 'abc', fullName: ' ' } };
  for (const layer of route.stack) if (layer.handle.run) await layer.handle.run(req);
  const fields = validationResult(req).array().map(item => item.path);
  for (const field of ['userId', 'email', 'phone', 'fullName']) assert.ok(fields.includes(field));
});

test('store activation requires an actual boolean', async () => {
  const route = router.stack.find(layer => layer.route?.path === '/businesses/:businessId' && layer.route.methods.put).route;
  const req = { params: { businessId: '507f1f77bcf86cd799439011' }, body: { isActive: 'false' } };
  for (const layer of route.stack) if (layer.handle.run) await layer.handle.run(req);
  assert.ok(validationResult(req).array().some(item => item.path === 'isActive'));
});

test('admin routes reject customer and business owner roles', () => {
  const guard = router.stack.find(layer => layer.handle.name === 'auth');
  assert.ok(guard, 'authentication is registered before admin routes');
  const authorize = router.stack[router.stack.indexOf(guard) + 1].handle;
  for (const role of ['customer', 'business_admin']) {
    const res = response();
    authorize({ user: { role } }, res, () => assert.fail('must not authorize non-admins'));
    assert.equal(res.statusCode, 403);
  }
});

test('user editing ignores role, password and active status fields', async t => {
  const user = { _id: 'user', role: 'customer', fullName: 'Old name', email: 'a@example.com', save: async () => {} };
  t.mock.method(Customer, 'findById', async () => user);
  const res = response();
  await controller.updateUser({ params: { userId: 'user' }, body: { fullName: 'New name', role: 'super_admin', passwordHash: 'bad', isActive: false } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(user.fullName, 'New name');
  assert.equal(user.role, 'customer');
  assert.equal(user.passwordHash, undefined);
  assert.equal(user.isActive, undefined);
});

test('changing customer email clears verification and OTP', async t => {
  const user = { _id: 'user', role: 'customer', email: 'old@example.com', emailVerified: true, otpCode: '123', otpExpiry: new Date(), save: async () => {} };
  t.mock.method(Customer, 'findById', async () => user);
  await controller.updateUser({ params: { userId: 'user' }, body: { email: 'new@example.com' } }, response());
  assert.equal(user.emailVerified, false);
  assert.equal(user.otpCode, undefined);
  assert.equal(user.otpExpiry, undefined);
});

test('stores cannot bypass approval through activation', async t => {
  t.mock.method(Business, 'findById', async () => ({ approvalStatus: 'pending' }));
  const res = response();
  await controller.updateBusiness({ params: { businessId: 'store' }, body: { isActive: true } }, res);
  assert.equal(res.statusCode, 400);
});

test('store edits cannot change owner or approval', async t => {
  const business = { approvalStatus: 'approved', owner: 'owner', save: async () => {} };
  t.mock.method(Business, 'findById', async () => business);
  await controller.updateBusiness({ params: { businessId: 'store' }, body: { storeName: 'Updated', owner: 'other', approvalStatus: 'rejected', isActive: false } }, response());
  assert.equal(business.owner, 'owner');
  assert.equal(business.approvalStatus, 'approved');
  assert.equal(business.storeName, 'Updated');
  assert.equal(business.isActive, false);
});

test('stores with orders or products cannot be deleted', async t => {
  t.mock.method(Business, 'findById', async () => ({ _id: 'store' }));
  t.mock.method(Order, 'exists', async () => null);
  t.mock.method(Product, 'exists', async () => ({ _id: 'product' }));
  const remove = t.mock.method(Business, 'deleteOne', async () => {});
  const res = response();
  await controller.deleteBusiness({ params: { businessId: 'store' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(remove.mock.callCount(), 0);
});

test('unlinked stores can be deleted and removed from owner list', async t => {
  t.mock.method(Business, 'findById', async () => ({ _id: 'store', owner: 'owner' }));
  t.mock.method(Order, 'exists', async () => null);
  t.mock.method(Product, 'exists', async () => null);
  const unlink = t.mock.method(BusinessOwner, 'updateOne', async () => {});
  const remove = t.mock.method(Business, 'deleteOne', async () => {});
  const res = response();
  await controller.deleteBusiness({ params: { businessId: 'store' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(remove.mock.callCount(), 1);
  assert.deepEqual(unlink.mock.calls[0].arguments, [{ _id: 'owner' }, { $pull: { businesses: 'store' } }]);
});

test('customers with orders cannot be deleted', async t => {
  const remove = t.mock.fn();
  t.mock.method(Customer, 'findById', async () => ({ deleteOne: remove }));
  t.mock.method(Order, 'exists', async () => ({ _id: 'order' }));
  const res = response();
  await controller.deleteUser({ params: { userId: 'user' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(remove.mock.callCount(), 0);
});

test('owners with stores cannot be deleted', async t => {
  const remove = t.mock.fn();
  t.mock.method(Customer, 'findById', async () => null);
  t.mock.method(BusinessOwner, 'findById', async () => ({ deleteOne: remove }));
  t.mock.method(Business, 'exists', async () => ({ _id: 'store' }));
  const res = response();
  await controller.deleteUser({ params: { userId: 'user' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(remove.mock.callCount(), 0);
});
