const Counter = require('../models/Counter');

/**
 * Generates an atomic sequential ID for a given model prefix using MySQL
 * @param {string} modelName - Name of the tracker (e.g. 'Customer', 'Order')
 * @param {string} prefix - The ID prefix (e.g. 'CUST', 'ORD')
 * @returns {Promise<string>} The generated sequential ID (e.g. 'CUST-001')
 */
const generateId = async (modelName, prefix) => {
  // Find the counter or create it with seq = 0
  const [counter] = await Counter.findOrCreate({
    where: { idName: modelName },
    defaults: { seq: 0 }
  });

  // Increment seq atomically
  const updatedCounter = await counter.increment('seq', { by: 1 });
  
  // Reload to get the latest seq value
  await updatedCounter.reload();

  const seqStr = String(updatedCounter.seq).padStart(3, '0');
  return `${prefix}-${seqStr}`;
};

module.exports = generateId;
