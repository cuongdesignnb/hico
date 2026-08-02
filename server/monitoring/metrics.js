export const createMetrics = () => {
  const counters = new Map();
  return {
    increment(name) { counters.set(name, (counters.get(name) ?? 0) + 1); },
    snapshot() { return Object.fromEntries(counters); },
  };
};
