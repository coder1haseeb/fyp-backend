const Product = require('../models/Product');
const { success, error } = require('../utils/ApiResponse');

const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;

// Get Inventory
const getInventory = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const products = await Product.find({ business: businessId }).lean();

    const inventory = products.map((product) => {
      let stockStatus = 'in_stock';
      if (product.stockQty === 0) {
        stockStatus = 'out_of_stock';
      } else if (product.stockQty <= LOW_STOCK_THRESHOLD) {
        stockStatus = 'low_stock';
      }

      return {
        ...product,
        stockStatus,
      };
    });

    const counts = {
      total: inventory.length,
      inStock: inventory.filter((p) => p.stockStatus === 'in_stock').length,
      lowStock: inventory.filter((p) => p.stockStatus === 'low_stock').length,
      outOfStock: inventory.filter((p) => p.stockStatus === 'out_of_stock').length,
    };

    return success(res, 200, 'Inventory retrieved', {
      inventory,
      counts,
    });
  } catch (err) {
    console.error('Get inventory error:', err);
    return error(res, 500, 'Error retrieving inventory', 'GET_INVENTORY_ERROR');
  }
};

// Get Low Stock Alerts
const getLowStockAlerts = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const lowStockProducts = await Product.find({
      business: businessId,
      stockQty: { $gt: 0, $lte: LOW_STOCK_THRESHOLD },
    })
      .sort({ stockQty: 1 })
      .lean();

    return success(res, 200, 'Low stock alerts retrieved', {
      alerts: lowStockProducts,
      count: lowStockProducts.length,
    });
  } catch (err) {
    console.error('Get low stock alerts error:', err);
    return error(res, 500, 'Error retrieving alerts', 'ALERTS_ERROR');
  }
};

// Update Stock
const updateStock = async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { productId } = req.params;
    const { operation, quantity } = req.body;

    // operation: 'set' | 'increment' | 'decrement'
    if (!['set', 'increment', 'decrement'].includes(operation)) {
      return error(res, 400, 'Invalid operation', 'INVALID_OPERATION');
    }

    const product = await Product.findById(productId);

    if (!product || product.business.toString() !== businessId) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    let newStock;
    switch (operation) {
      case 'set':
        newStock = parseInt(quantity);
        break;
      case 'increment':
        newStock = product.stockQty + parseInt(quantity);
        break;
      case 'decrement':
        newStock = product.stockQty - parseInt(quantity);
        break;
    }

    if (newStock < 0) {
      return error(res, 400, 'Stock cannot be negative', 'INVALID_STOCK');
    }

    product.stockQty = newStock;
    await product.save();

    return success(res, 200, 'Stock updated', {
      productId: product._id,
      oldStock: product.stockQty,
      newStock: newStock,
      status: newStock <= LOW_STOCK_THRESHOLD ? 'low_stock' : 'in_stock',
    });
  } catch (err) {
    console.error('Update stock error:', err);
    return error(res, 500, 'Error updating stock', 'UPDATE_STOCK_ERROR');
  }
};

// Export Inventory CSV
const exportInventoryCSV = async (req, res) => {
  try {
    const businessId = req.user.businessId;

    const products = await Product.find({ business: businessId })
      .select('name price stockQty status category')
      .lean();

    let csv = 'Product Name,Price (PKR),Stock Quantity,Status,Category\n';

    products.forEach((product) => {
      const row = [
        `"${product.name}"`,
        product.price,
        product.stockQty,
        product.status,
        product.category || 'N/A',
      ].join(',');
      csv += row + '\n';
    });

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', 'attachment; filename="inventory.csv"');
    return res.send(csv);
  } catch (err) {
    console.error('Export inventory error:', err);
    return error(res, 500, 'Error exporting inventory', 'EXPORT_ERROR');
  }
};

module.exports = {
  getInventory,
  getLowStockAlerts,
  updateStock,
  exportInventoryCSV,
};
