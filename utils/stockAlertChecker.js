const Product = require('../models/Product');
const createNotification = require('./createNotification');

const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;

const checkLowStockAndNotify = async (productId) => {
  try {
    const product = await Product.findById(productId).populate('business');

    if (!product) return;

    // Check if stock is low
    if (product.stockQty > 0 && product.stockQty <= LOW_STOCK_THRESHOLD) {
      await createNotification(
        product.business.owner,
        'BusinessOwner',
        'low_stock',
        `Low Stock Alert: ${product.name}`,
        `Only ${product.stockQty} units left of ${product.name}. Please restock soon.`,
        {
          productId: product._id,
          productName: product.name,
          currentStock: product.stockQty,
        }
      );
      console.log(`⚠️ Low stock alert created for ${product.name}`);
    }

    // If out of stock
    if (product.stockQty === 0) {
      await createNotification(
        product.business.owner,
        'BusinessOwner',
        'low_stock',
        `Out of Stock: ${product.name}`,
        `${product.name} is now out of stock. Please restock immediately.`,
        {
          productId: product._id,
          productName: product.name,
          currentStock: 0,
        }
      );
      console.log(`⚠️ Out of stock alert created for ${product.name}`);
    }
  } catch (error) {
    console.error('❌ Stock alert checker error:', error);
  }
};

module.exports = checkLowStockAndNotify;
