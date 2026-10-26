const RecommendationImpression = require('../models/RecommendationImpression');
const Interaction = require('../models/Interaction');
const Product = require('../models/Product');
const featureNames = require('../utils/recommendationFeatures.json');
const config = require('../config/recommendationTraining.json');
const { getActiveModel, score } = require('../utils/learnedRecommendationRanker');
const { success, error } = require('../utils/ApiResponse');

const weights = { view: 1, add_to_cart: 2, purchase: 3 };
const maxRows = 50000;
const pageSize = 10;

async function getInsights(req, res) {
  try {
    const now = Date.now();
    const cutoff = new Date(now - config.feedbackWindowHours * 3600000);
    const start = new Date(cutoff.getTime() - config.lookbackDays * 86400000);
    const recentStart = new Date(now - config.lookbackDays * 86400000);
    const [impressions, interactions] = await Promise.all([
      RecommendationImpression.find({ createdAt: { $gte: start, $lt: new Date(now) } })
        .select('requestId customer product position features baselineScore createdAt')
        .sort({ createdAt: 1 }).limit(maxRows + 1).lean(),
      Interaction.find({ createdAt: { $gte: start, $lt: new Date(now) },
        interactionType: { $in: Object.keys(weights) } })
        .select('customer product interactionType createdAt')
        .limit(maxRows + 1).lean(),
    ]);
    const truncated = impressions.length > maxRows || interactions.length > maxRows;
    const byPair = new Map();
    for (const event of interactions.slice(0, maxRows)) {
      const key = `${event.customer}:${event.product}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(event);
    }

    const eligibleByRequest = new Map();
    const pendingByRequest = new Map();
    for (const impression of impressions.slice(0, maxRows)) {
      if (!Array.isArray(impression.features) || impression.features.length !== featureNames.length ||
        impression.features.some(value => !Number.isFinite(value))) continue;
      const target = impression.createdAt < cutoff ? eligibleByRequest : pendingByRequest;
      if (!target.has(impression.requestId)) target.set(impression.requestId, []);
      const events = byPair.get(`${impression.customer}:${impression.product}`) || [];
      let label = 0;
      for (const event of events) {
        if (event.createdAt > impression.createdAt &&
          event.createdAt <= new Date(impression.createdAt.getTime() + config.feedbackWindowHours * 3600000)) {
          label = Math.max(label, weights[event.interactionType]);
        }
      }
      target.get(impression.requestId).push({
        product: impression.product,
        position: impression.position,
        features: impression.features,
        baselineScore: impression.baselineScore,
        createdAt: impression.createdAt,
        label,
      });
    }

    const makeGroups = (source, eligible) => [...source.entries()]
      .filter(([, rows]) => rows.length >= 2)
      .map(([requestId, rows]) => ({ requestId, eligible,
        shownAt: new Date(Math.min(...rows.map(row => row.createdAt.getTime()))),
        rows: rows.sort((a, b) => a.position - b.position),
        positive: rows.some(row => row.label > 0),
      }))
      .sort((a, b) => a.shownAt - b.shownAt);
    const eligible = makeGroups(eligibleByRequest, true);
    const pending = makeGroups(pendingByRequest, false);
    const split = Math.floor(eligible.length * 0.8);
    const validation = eligible.slice(split);
    const positives = eligible.filter(group => group.positive).length;
    const available = [...eligible, ...pending].filter(group => group.shownAt >= recentStart)
      .sort((a, b) => a.shownAt - b.shownAt);
    const availableValidation = available.slice(Math.floor(available.length * 0.8));
    const availablePositives = available.filter(group => group.positive).length;
    const model = getActiveModel();
    const view = req.query.view || 'all';
    const pool = view === 'eligible' ? eligible : view === 'pending' ? pending : [...eligible, ...pending];
    pool.sort((a, b) => b.shownAt - a.shownAt);
    const page = Number(req.query.page || 1);
    const pageItems = pool.slice((page - 1) * pageSize, page * pageSize);
    const requested = req.query.requestId && pool.find(group => group.requestId === req.query.requestId);
    const selected = requested || pageItems[0];
    let sample = null;

    if (selected) {
      const productIds = [...new Set(selected.rows.map(row => String(row.product)))];
      const products = await Product.find({ _id: { $in: productIds } }).select('name').lean();
      const names = new Map(products.map(product => [String(product._id), product.name]));
      const rows = selected.rows.map(row => ({
        productId: String(row.product),
        productName: names.get(String(row.product)) || 'Deleted product',
        shownPosition: row.position + 1,
        baselineScore: row.baselineScore,
        modelScore: model ? score(model, row.features) : null,
        feedbackLabel: row.label,
        features: featureNames.map((name, index) => ({ name, value: row.features[index] })),
      }));
      const key = row => `${row.productId}:${row.shownPosition}`;
      const hybridOrder = [...rows].sort((a, b) => b.baselineScore - a.baselineScore || a.shownPosition - b.shownPosition);
      const modelOrder = model ? [...rows].sort((a, b) => b.modelScore - a.modelScore ||
        b.baselineScore - a.baselineScore || a.productId.localeCompare(b.productId)) : [];
      const hybridRanks = new Map(hybridOrder.map((row, index) => [key(row), index + 1]));
      const modelRanks = new Map(modelOrder.map((row, index) => [key(row), index + 1]));
      sample = {
        requestId: selected.requestId,
        shownAt: selected.shownAt,
        eligible: selected.eligible,
        rows: rows.map(row => ({ ...row, hybridRank: hybridRanks.get(key(row)),
          modelRank: modelRanks.get(key(row)) || null })),
      };
    }

    return success(res, 200, 'Recommendation training insights retrieved', {
      summary: {
        eligibleRequests: eligible.length,
        pendingRequests: pending.length,
        positiveRequests: positives,
        validationRequests: validation.length,
        validationPositiveRequests: validation.filter(group => group.positive).length,
        availableRequests: available.length,
        availablePositiveRequests: availablePositives,
        availableValidationRequests: availableValidation.length,
        availableValidationPositiveRequests: availableValidation.filter(group => group.positive).length,
        canTrainNow: !truncated && available.length >= config.minRequests &&
          availablePositives >= config.minPositiveRequests &&
          availableValidation.length >= config.minValidationRequests &&
          availableValidation.some(group => group.positive),
        ready: !truncated && eligible.length >= config.minRequests &&
          positives >= config.minPositiveRequests &&
          validation.length >= config.minValidationRequests && validation.some(group => group.positive),
        truncated,
        feedbackCutoff: cutoff,
        nextEligibleAt: pending[0] ? new Date(pending[0].shownAt.getTime() + config.feedbackWindowHours * 3600000) : null,
        requirements: config,
      },
      model: model ? {
        trainedAt: model.trained_at,
        source: model.training_source || 'real_feedback',
        validationNdcg: model.validation_ndcg_at_4,
        baselineNdcg: model.baseline_ndcg_at_4,
        treeCount: model.tree_info.length,
      } : null,
      requests: pageItems.map(group => ({ requestId: group.requestId, shownAt: group.shownAt,
        productCount: group.rows.length, positive: group.positive, eligible: group.eligible })),
      sample,
      pagination: { page, pageSize, total: pool.length, totalPages: Math.ceil(pool.length / pageSize) },
    });
  } catch (err) {
    console.error('Recommendation insights error:', err);
    return error(res, 500, 'Could not load recommendation training insights', 'RECOMMENDATION_INSIGHTS_ERROR');
  }
}

module.exports = { getInsights };
