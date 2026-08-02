import { assertFulfillmentSupported } from './fulfillmentValidation.js';

export const createFulfillmentRegistry = (strategies = {}) => {
  const registry = new Map(Object.entries(strategies));
  return {
    register(method, strategy) { registry.set(method, strategy); },
    resolve(item) {
      const method = assertFulfillmentSupported(item);
      const strategy = registry.get(method);
      if (!strategy) throw new Error(`Missing fulfillment strategy: ${method}`);
      return strategy;
    },
    list() { return [...registry.keys()]; },
  };
};
