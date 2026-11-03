const { success, error } = require('../utils/ApiResponse');

const cache = new Map();
let nextRequestAt = 0;

async function searchLocations(req, res) {
  const term = req.query.q.trim();
  const key = term.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return success(res, 200, 'Locations retrieved', { locations: cached.locations });
  if (Date.now() < nextRequestAt) return error(res, 429, 'Please wait a moment and search again.', 'SEARCH_BUSY');
  nextRequestAt = Date.now() + 1000;
  try {
    const url = new URL(process.env.PHOTON_SEARCH_URL || 'https://photon.komoot.io/api/');
    url.search = new URLSearchParams({ q: term, limit: '5', countrycode: 'PK', lang: 'en' }).toString();
    const response = await fetch(url, { headers: { 'User-Agent': 'LocalBiz/1.0 (location search)', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Location provider unavailable');
    const data = await response.json();
    if (!Array.isArray(data.features)) throw new Error('Invalid location response');
    const locations = data.features.flatMap(feature => {
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      const properties = feature.properties || {};
      if (feature.geometry?.type !== 'Point' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || properties.countrycode?.toUpperCase() !== 'PK') return [];
      const label = [...new Set([properties.name, [properties.housenumber, properties.street].filter(Boolean).join(' '), properties.district, properties.city, properties.state, properties.country].filter(Boolean))].join(', ');
      return label ? [{ latitude, longitude, label }] : [];
    }).slice(0, 5);
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { locations, expires: Date.now() + 86400000 });
    return success(res, 200, 'Locations retrieved', { locations });
  } catch {
    return error(res, 503, 'Location search is unavailable. Try again, use your location, or place a pin on the map.', 'LOCATION_SEARCH_UNAVAILABLE');
  }
}

module.exports = { searchLocations };
