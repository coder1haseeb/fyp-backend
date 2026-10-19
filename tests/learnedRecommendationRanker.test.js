const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const FEATURE_NAMES = require('../utils/recommendationFeatures.json');
const { rankWithLearnedModel } = require('../utils/learnedRecommendationRanker');

test('a validated LightGBM tree changes candidate order and an invalid model falls back', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'localbiz-ranker-'));
  const filename = path.join(directory, 'ranker.json');
  const previous = process.env.RECOMMENDER_MODEL_PATH;
  const candidates = [
    { product: { _id: 'a' }, score: 0.8, features: [0, 0, 0, 0, 0, 0, 0, 0] },
    { product: { _id: 'b' }, score: 0.2, features: [1, 0, 0, 0, 0, 0, 0, 0] },
  ];
  try {
    process.env.RECOMMENDER_MODEL_PATH = filename;
    assert.equal(rankWithLearnedModel(candidates).model, 'hybrid');
    fs.writeFileSync(filename, JSON.stringify({
      feature_names: FEATURE_NAMES,
      baseline_ndcg_at_4: 0.4,
      validation_ndcg_at_4: 0.6,
      tree_info: [{ tree_structure: {
        split_feature: 0, decision_type: '<=', threshold: 0.5,
        left_child: { leaf_value: -1 }, right_child: { leaf_value: 1 },
      } }],
    }));
    const learned = rankWithLearnedModel(candidates);
    assert.equal(learned.model, 'lightgbm');
    assert.equal(learned.candidates[0].product._id, 'b');
    fs.writeFileSync(filename, JSON.stringify({ feature_names: FEATURE_NAMES, tree_info: [] }));
    process.env.RECOMMENDER_MODEL_PATH = `${filename}.missing`;
    assert.equal(rankWithLearnedModel(candidates).model, 'hybrid');
  } finally {
    if (previous === undefined) delete process.env.RECOMMENDER_MODEL_PATH;
    else process.env.RECOMMENDER_MODEL_PATH = previous;
    fs.rmSync(filename, { force: true });
    fs.rmdirSync(directory);
  }
});
