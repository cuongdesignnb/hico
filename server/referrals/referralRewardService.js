export const createReferralRewardService = ({ referralService } = {}) => ({
  qualifyForFulfillment: (input) => referralService.qualifyForFulfillment(input),
  reverseForFulfillment: (input) => referralService.reverseForFulfillment(input),
});
