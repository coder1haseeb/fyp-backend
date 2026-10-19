const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Business = require('../models/Business');
const recordInteraction = require('../utils/recordInteraction');
const { success, error } = require('../utils/ApiResponse');

// Get Cart
const getCart = async (req, res) => {
  try {
    const customerId = req.user.userId;

    let cart = await Cart.findOne({ customer: customerId }).populate({
      path: 'items.product',
      select: 'name price images business stockQty',
      populate: {
        path: 'business',
        select: 'storeName',
      },
    });

    if (!cart) {
      cart = new Cart({ customer: customerId, items: [] });
      await cart.save();
    }

    return success(res, 200, 'Cart retrieved', cart);
  } catch (err) {
    console.error('Get cart error:', err);
    return error(res, 500, 'Error retrieving cart', 'GET_CART_ERROR');
  }
};

// Add to Cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const customerId = req.user.userId;

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return error(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
    }

    const visibleBusiness = await Business.exists({ _id: product.business, approvalStatus: 'approved', isActive: true });
    if (!visibleBusiness) return error(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
    if (product.stockQty < quantity) {
      return error(res, 400, 'Insufficient stock', 'INSUFFICIENT_STOCK');
    }

    let cart = await Cart.findOne({ customer: customerId });

    if (!cart) {
      cart = new Cart({ customer: customerId, items: [] });
    }

    // Check if product already in cart
    const existingItem = cart.items.find((item) => item.product.toString() === productId);

    if (existingItem) {
      if (existingItem.quantity + quantity > product.stockQty) {
        return error(res, 400, 'Insufficient stock', 'INSUFFICIENT_STOCK');
      }
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        quantity,
      });
    }

    await cart.save();
    await recordInteraction(customerId, productId, 'add_to_cart');

    const populated = await cart.populate({
      path: 'items.product',
      select: 'name price images business stockQty',
      populate: {
        path: 'business',
        select: 'storeName',
      },
    });

    return success(res, 201, 'Product added to cart', populated);
  } catch (err) {
    console.error('Add to cart error:', err);
    return error(res, 500, 'Error adding to cart', 'ADD_CART_ERROR');
  }
};

// Update Cart Item
const updateCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    const customerId = req.user.userId;

    if (quantity < 1) {
      return error(res, 400, 'Quantity must be at least 1', 'INVALID_QUANTITY');
    }

    const cart = await Cart.findOne({ customer: customerId });
    if (!cart) {
      return error(res, 404, 'Cart not found', 'CART_NOT_FOUND');
    }

    const item = cart.items.find((i) => i._id.toString() === cartItemId);
    if (!item) {
      return error(res, 404, 'Cart item not found', 'ITEM_NOT_FOUND');
    }

    // Check stock
    const product = await Product.findById(item.product);
    if (product.stockQty < quantity) {
      return error(res, 400, 'Insufficient stock', 'INSUFFICIENT_STOCK');
    }

    item.quantity = quantity;
    await cart.save();

    const populated = await cart.populate({
      path: 'items.product',
      select: 'name price images business stockQty',
      populate: {
        path: 'business',
        select: 'storeName',
      },
    });

    return success(res, 200, 'Cart item updated', populated);
  } catch (err) {
    console.error('Update cart item error:', err);
    return error(res, 500, 'Error updating cart item', 'UPDATE_CART_ERROR');
  }
};

// Remove Cart Item
const removeCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const customerId = req.user.userId;

    const cart = await Cart.findOneAndUpdate(
      { customer: customerId },
      { $pull: { items: { _id: cartItemId } } },
      { new: true }
    ).populate({
      path: 'items.product',
      select: 'name price images business stockQty',
      populate: {
        path: 'business',
        select: 'storeName',
      },
    });

    if (!cart) {
      return error(res, 404, 'Cart not found', 'CART_NOT_FOUND');
    }

    return success(res, 200, 'Item removed from cart', cart);
  } catch (err) {
    console.error('Remove cart item error:', err);
    return error(res, 500, 'Error removing cart item', 'REMOVE_CART_ERROR');
  }
};

// Clear Cart
const clearCart = async (req, res) => {
  try {
    const customerId = req.user.userId;

    const cart = await Cart.findOneAndUpdate(
      { customer: customerId },
      { items: [] },
      { new: true }
    );

    if (!cart) {
      return error(res, 404, 'Cart not found', 'CART_NOT_FOUND');
    }

    return success(res, 200, 'Cart cleared', cart);
  } catch (err) {
    console.error('Clear cart error:', err);
    return error(res, 500, 'Error clearing cart', 'CLEAR_CART_ERROR');
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
