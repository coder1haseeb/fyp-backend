function parseStoreLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
      value.latitude === '' || value.longitude === '') return null;
  return { type: 'Point', coordinates: [longitude, latitude] };
}

module.exports = { parseStoreLocation };
