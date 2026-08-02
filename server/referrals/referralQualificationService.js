export const createReferralQualificationService = ({ referralService } = {}) => ({
  qualifyForFulfillment: (input) => referralService.qualifyForFulfillment(input),
  reverseForFulfillment: (input) => referralService.reverseForFulfillment(input),
});
