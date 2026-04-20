const Interaction = require('../models/Interaction');
const Product = require('../models/Product');

const collaborativeFilter = async (customerId, topN = 10) => {
  try {
    // Get current user's interactions
    const userInteractions = await Interaction.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // If user has less than 5 interactions, return trending products
    if (userInteractions.length < 5) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trendingProducts = await Interaction.aggregate([
        {
          $match: {
            interactionType: 'purchase',
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: '$product',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: topN },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productData',
          },
        },
      ]);

      return trendingProducts.map((item) => item.productData[0]).filter(Boolean);
    }

    // Build user vector from interactions
    const userVector = {};
    userInteractions.forEach((interaction) => {
      const weight = {
        view: 1,
        add_to_cart: 3,
        purchase: 5,
        search: 0.5,
      }[interaction.interactionType] || 1;

      const productId = interaction.product.toString();
      userVector[productId] = (userVector[productId] || 0) + weight;
    });

    // Get all other users' interactions
    const otherUsersInteractions = await Interaction.aggregate([
      {
        $match: {
          customer: { $ne: customerId },
        },
      },
      {
        $group: {
          _id: '$customer',
          interactions: { $push: '$$ROOT' },
        },
      },
      { $limit: 500 },
    ]);

    // Compute similarity scores
    const similarityScores = [];

    otherUsersInteractions.forEach((userGroup) => {
      const otherUserVector = {};
      userGroup.interactions.forEach((interaction) => {
        const weight = {
          view: 1,
          add_to_cart: 3,
          purchase: 5,
          search: 0.5,
        }[interaction.interactionType] || 1;

        const productId = interaction.product.toString();
        otherUserVector[productId] = (otherUserVector[productId] || 0) + weight;
      });

      const similarity = cosineSimilarity(userVector, otherUserVector);
      if (similarity > 0) {
        similarityScores.push({
          userId: userGroup._id,
          vector: otherUserVector,
          similarity,
        });
      }
    });

    // Get top K similar users
    const topKUsers = similarityScores.sort((a, b) => b.similarity - a.similarity).slice(0, 10);

    // Collect products from similar users that current user hasn't seen
    const recommendedProducts = {};

    topKUsers.forEach((similarUser) => {
      Object.entries(similarUser.vector).forEach(([productId, weight]) => {
        if (!userVector[productId]) {
          recommendedProducts[productId] = (recommendedProducts[productId] || 0) + weight;
        }
      });
    });

    // Sort by weighted score and get top N
    const topProductIds = Object.entries(recommendedProducts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id]) => id);

    // Fetch product details
    const products = await Product.find({ _id: { $in: topProductIds } })
      .populate('business', 'storeName logo city rating')
      .lean();

    return products;
  } catch (error) {
    console.error('❌ Collaborative filtering error:', error);
    throw error;
  }
};

const cosineSimilarity = (vector1, vector2) => {
  const keys = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  keys.forEach((key) => {
    const val1 = vector1[key] || 0;
    const val2 = vector2[key] || 0;
    dotProduct += val1 * val2;
    magnitude1 += val1 * val1;
    magnitude2 += val2 * val2;
  });

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
};

module.exports = collaborativeFilter;
