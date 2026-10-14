// Small-catalogue hybrid recommender. TF-IDF learns product content from the
// current catalogue; customer and peer behaviour adjusts the ranking.
const WEIGHTS = { view: 1, add_to_cart: 3, purchase: 6 };

const tokens = product => `${product.name || ''} ${product.category || ''} ${product.description || ''}`
  .toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

const buildVectors = products => {
  const documents = products.map(tokens);
  const documentFrequency = new Map();
  for (const words of documents) {
    for (const word of new Set(words)) documentFrequency.set(word, (documentFrequency.get(word) || 0) + 1);
  }
  return documents.map(words => {
    const vector = new Map();
    for (const word of words) vector.set(word, (vector.get(word) || 0) + 1);
    let magnitude = 0;
    for (const [word, count] of vector) {
      const weight = (1 + Math.log(count)) * (1 + Math.log((products.length + 1) / ((documentFrequency.get(word) || 0) + 1)));
      vector.set(word, weight);
      magnitude += weight * weight;
    }
    const length = Math.sqrt(magnitude) || 1;
    for (const [word, weight] of vector) vector.set(word, weight / length);
    return vector;
  });
};

const similarity = (left, right) => {
  if (!left || !right) return 0;
  let score = 0;
  for (const [word, weight] of left) score += weight * (right.get(word) || 0);
  return score;
};

const normalize = (value, maximum) => maximum > 0 ? value / maximum : 0;

function rankProducts({ products, interactions = [], customerId, customerCity = '', limit = 10, excludeId }) {
  const vectors = buildVectors(products);
  const index = new Map(products.map((product, position) => [String(product._id), position]));
  const customerEvents = interactions.filter(event => String(event.customer) === String(customerId) && WEIGHTS[event.interactionType]);
  const seen = new Map();
  const purchased = new Set();
  const profile = new Map();
  const now = Date.now();

  for (const event of customerEvents) {
    const id = String(event.product);
    const position = index.get(id);
    if (position === undefined) continue;
    const ageDays = Math.max(0, (now - new Date(event.createdAt).getTime()) / 86400000);
    const weight = WEIGHTS[event.interactionType] * Math.exp(-ageDays / 45);
    seen.set(id, (seen.get(id) || 0) + weight);
    if (event.interactionType === 'purchase') purchased.add(id);
    for (const [word, value] of vectors[position]) profile.set(word, (profile.get(word) || 0) + value * weight);
  }
  const profileLength = Math.sqrt([...profile.values()].reduce((sum, value) => sum + value * value, 0)) || 1;
  for (const [word, value] of profile) profile.set(word, value / profileLength);

  // Find peers through products they interacted with, then score their other products.
  const peerEvents = new Map();
  const popularity = new Map();
  for (const event of interactions) {
    const id = String(event.product);
    if (!index.has(id) || !WEIGHTS[event.interactionType]) continue;
    popularity.set(id, (popularity.get(id) || 0) + WEIGHTS[event.interactionType]);
    if (String(event.customer) === String(customerId)) continue;
    const peerId = String(event.customer);
    if (!peerEvents.has(peerId)) peerEvents.set(peerId, new Map());
    const peer = peerEvents.get(peerId);
    peer.set(id, (peer.get(id) || 0) + WEIGHTS[event.interactionType]);
  }
  const collaborative = new Map();
  for (const peer of peerEvents.values()) {
    const overlap = [...seen].reduce((sum, [id, weight]) => sum + Math.min(weight, peer.get(id) || 0), 0);
    if (!overlap) continue;
    for (const [id, weight] of peer) {
      if (!seen.has(id)) collaborative.set(id, (collaborative.get(id) || 0) + overlap * weight);
    }
  }
  const maxCollaborative = Math.max(0, ...collaborative.values());
  const maxPopularity = Math.max(0, ...popularity.values());
  const hasHistory = seen.size > 0;
  const available = products.filter(product => String(product._id) !== String(excludeId || ''));
  const unseen = available.filter(product => !purchased.has(String(product._id)));
  const candidates = unseen.length ? unseen : available;

  return candidates.map(product => {
    const id = String(product._id);
    const content = similarity(profile, vectors[index.get(id)]);
    const collaborativeScore = normalize(collaborative.get(id) || 0, maxCollaborative);
    const popular = normalize(popularity.get(id) || 0, maxPopularity);
    const local = customerCity && product.business?.city?.toLowerCase() === customerCity.toLowerCase() ? 1 : 0;
    const fresh = Math.exp(-Math.max(0, (now - new Date(product.createdAt || now).getTime()) / 86400000) / 90);
    const score = hasHistory
      ? 0.55 * content + 0.25 * collaborativeScore + 0.12 * popular + 0.05 * local + 0.03 * fresh
      : 0.65 * popular + 0.2 * local + 0.15 * fresh;
    return { product, score };
  }).sort((a, b) => b.score - a.score || String(a.product._id).localeCompare(String(b.product._id)))
    .slice(0, limit).map(({ product }) => product);
}

function similarProducts(products, source, limit = 5) {
  const catalogue = [...products, source];
  const vectors = buildVectors(catalogue);
  const sourceVector = vectors[vectors.length - 1];
  return products.map((product, index) => ({ product, score: similarity(vectors[index], sourceVector) }))
    .filter(({ product }) => String(product._id) !== String(source._id))
    .sort((a, b) => b.score - a.score || String(a.product._id).localeCompare(String(b.product._id)))
    .slice(0, limit).map(({ product }) => product);
}

module.exports = { rankProducts, similarProducts };
