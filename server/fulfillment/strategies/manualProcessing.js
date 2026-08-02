import { result } from '../strategyUtils.js';

export const createManualProcessingStrategy = () => ({
  async execute() {
    return result('PENDING_CALLBACK', { internalNote: 'Manual processing required.' });
  },
});
