export class FulfillmentValidationError extends Error {
  constructor(message, { code = 'FULFILLMENT_VALIDATION_FAILED', status = 422 } = {}) {
    super(message);
    this.name = 'FulfillmentValidationError';
    this.code = code;
    this.status = status;
  }
}

const salePlanDaysFrom = (event) => {
  const value = event?.salePlanDays
    ?? event?.payload?.salePlanDays
    ?? event?.payload?.data?.salePlanDays
    ?? event?.data?.salePlanDays;
  const days = Number(value);
  return Number.isInteger(days) && days > 0 ? days : null;
};

const normalizedWmid = (value) => String(value ?? '').normalize('NFC').trim().toUpperCase();

const callbackWmids = (event) => [
  event?.wmproductId,
  event?.payload?.wmproductId,
  event?.item?.wmproductId,
  ...(Array.isArray(event?.itemList) ? event.itemList.map((item) => item?.wmproductId) : []),
].map(normalizedWmid).filter(Boolean);

export const validateProvisioningEntitlement = ({ item, event }) => {
  const expectedWmid = normalizedWmid(item?.providerWmproductId ?? item?.wmproductId);
  const reportedWmids = callbackWmids(event);
  if (expectedWmid && reportedWmids.some((wmid) => wmid !== expectedWmid)) {
    throw new FulfillmentValidationError(
      'Provider callback WMID does not match the sold catalog item.',
      { code: 'PROVIDER_WMID_MISMATCH', status: 409 },
    );
  }
  const salePlanDays = salePlanDaysFrom(event);
  if (!salePlanDays) return { checked: false, salePlanDays: null };

  const soldDays = Number(item?.soldDurationDays ?? item?.durationDays);
  const providerDays = Number(item?.providerDurationDays);
  if (Number.isInteger(soldDays) && salePlanDays < soldDays) {
    throw new FulfillmentValidationError(
      'Provider callback entitlement is shorter than the sold catalog duration.',
      { code: 'PROVISIONING_ENTITLEMENT_MISMATCH', status: 409 },
    );
  }
  if (Number.isInteger(providerDays) && providerDays > 0 && salePlanDays !== providerDays) {
    throw new FulfillmentValidationError(
      'Provider callback entitlement does not match the provider snapshot.',
      { code: 'PROVISIONING_ENTITLEMENT_MISMATCH', status: 409 },
    );
  }
  return { checked: true, salePlanDays };
};
