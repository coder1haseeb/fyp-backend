const Interaction = require('../models/Interaction');

// Recommendation telemetry must never make cart or checkout fail.
module.exports = async (customer, product, interactionType) => {
  try {
    await Interaction.create({ customer, product, interactionType });
  } catch (err) {
    console.warn('Could not record product interaction:', err.message);
  }
};
