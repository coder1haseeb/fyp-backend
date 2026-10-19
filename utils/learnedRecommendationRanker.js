const fs = require('fs');
const path = require('path');
const FEATURE_NAMES = require('./recommendationFeatures.json');

const modelPath = () => process.env.RECOMMENDER_MODEL_PATH ||
  path.join(__dirname, '..', 'artifacts', 'recommendation-ranker.json');

let cachedPath;
let cachedMtime;
let cachedModel;
let checkedAt = 0;

const validModel = model => model?.feature_names?.length === FEATURE_NAMES.length &&
  model.feature_names.every((name, index) => name === FEATURE_NAMES[index]) &&
  Array.isArray(model.tree_info) && model.tree_info.length > 0 &&
  Number.isFinite(model.validation_ndcg_at_4) &&
  Number.isFinite(model.baseline_ndcg_at_4) &&
  model.validation_ndcg_at_4 >= model.baseline_ndcg_at_4 + 0.01;

function loadModel() {
  const filename = modelPath();
  if (filename !== cachedPath || cachedMtime === undefined || Date.now() - checkedAt > 30000) {
    if (filename !== cachedPath) cachedMtime = undefined;
    checkedAt = Date.now();
    cachedPath = filename;
    try {
      const mtime = fs.statSync(filename).mtimeMs;
      if (mtime !== cachedMtime) {
        const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
        cachedModel = validModel(parsed) ? parsed : null;
        cachedMtime = mtime;
      }
    } catch {
      cachedModel = null;
      cachedMtime = undefined;
    }
  }
  return cachedModel;
}

function treeValue(node, features) {
  while (node && node.split_feature !== undefined) {
    if (node.decision_type !== '<=') throw new Error('Unsupported LightGBM split');
    const value = features[node.split_feature];
    const left = !Number.isFinite(value) ? Boolean(node.default_left) :
      value <= Number(node.threshold);
    node = left ? node.left_child : node.right_child;
  }
  if (!Number.isFinite(node?.leaf_value)) throw new Error('Invalid LightGBM leaf');
  return node.leaf_value;
}

function score(model, features) {
  if (!Array.isArray(features) || features.length !== FEATURE_NAMES.length ||
      features.some(value => !Number.isFinite(value))) throw new Error('Invalid recommendation features');
  return model.tree_info.reduce((total, tree) => total + treeValue(tree.tree_structure, features), 0);
}

function rankWithLearnedModel(candidates) {
  const model = loadModel();
  if (!model || (model.training_source === 'synthetic_demo' &&
      Date.now() >= Date.parse(model.demo_expires_at))) {
    return { candidates, model: 'hybrid' };
  }
  try {
    return {
      model: 'lightgbm',
      candidates: candidates.map(candidate => ({ ...candidate, modelScore: score(model, candidate.features) }))
        .sort((a, b) => b.modelScore - a.modelScore || b.score - a.score ||
          String(a.product._id).localeCompare(String(b.product._id))),
    };
  } catch (err) {
    console.error('Recommendation ranker error:', err);
    return { candidates, model: 'hybrid' };
  }
}

module.exports = { rankWithLearnedModel, score };
