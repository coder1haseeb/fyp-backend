const Product = require('../models/Product');
const Interaction = require('../models/Interaction');
const { success, error } = require('../utils/ApiResponse');
const collaborativeFilter = require('../utils/collaborativeFilter');

// Get Recommendations
const getRecommendations = async (req, res) => {
  try {
    const customerId = req.user.userId;
    const { limit = 10 } = req.query;

    const recommendations = await collaborativeFilter(customerId, parseInt(limit));

    return success(res, 200, 'Recommendations retrieved', {
      products: recommendations,
      count: recommendations.length,
    });
  } catch (err) {
    console.error('Get recommendations error:', err);
    return error(res, 500, 'Error retrieving recommendations', 'REC_ERROR');
  }
};

// Get Similar Products
const getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 5 } = req.query;

    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    // Find products in same category, exclude source product
    const similarProducts = await Product.aggregate([
      {
        $match: {
          category: product.category,
          _id: { $ne: product._id },
          status: 'active',
        },
      },
      {
        $lookup: {
          from: 'interactions',
          localField: '_id',
          foreignField: 'product',
          as: 'interactions',
        },
      },
      {
        $addFields: {
          interactionCount: { $size: '$interactions' },
        },
      },
      {
        $sort: { interactionCount: -1 },
      },
      {
        $limit: parseInt(limit),
      },
      {
        $lookup: {
          from: 'businesses',
          localField: 'business',
          foreignField: '_id',
          as: 'business',
        },
      },
      {
        $unwind: '$business',
      },
      {
        $project: {
          name: 1,
          description: 1,
          price: 1,
          images: 1,
          category: 1,
          stockQty: 1,
          status: 1,
          'business.storeName': 1,
          'business.logo': 1,
          'business.rating': 1,
          interactionCount: 1,
        },
      },
    ]);

    return success(res, 200, 'Similar products retrieved', {
      products: similarProducts,
      count: similarProducts.length,
    });
  } catch (err) {
    console.error('Get similar products error:', err);
    return error(res, 500, 'Error retrieving similar products', 'SIMILAR_ERROR');
  }
};

// Log Interaction
const logInteraction = async (req, res) => {
  try {
    const { productId, interactionType, durationSeconds = 0 } = req.body;
    const customerId = req.user.userId;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return error(res, 404, 'Product not found', 'NOT_FOUND');
    }

    // Create interaction
    const interaction = new Interaction({
      customer: customerId,
      product: productId,
      interactionType,
      durationSeconds,
    });

    await interaction.save();

    return success(res, 201, 'Interaction logged', {
      interactionId: interaction._id,
    });
  } catch (err) {
    console.error('Log interaction error:', err);
    return error(res, 500, 'Error logging interaction', 'LOG_ERROR');
  }
};

module.exports = {
  getRecommendations,
  getSimilarProducts,
  logInteraction,
};
