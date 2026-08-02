import type { CheckoutCustomer, CheckoutEngine, CheckoutItemRequest, CheckoutShipping, CheckoutValidationResponse } from '../types/checkout';

const readError = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error || 'Không thể xử lý checkout.');
};

export const getCheckoutConfig = async (): Promise<{ engine: CheckoutEngine }> => {
  const response = await fetch('/api/checkout/config');
  if (!response.ok) throw await readError(response);
  return response.json();
};

export const validateCheckout = async (payload: { items: CheckoutItemRequest[]; shipping: CheckoutShipping | null; topup: unknown }) : Promise<CheckoutValidationResponse> => {
  const response = await fetch('/api/checkout/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return response.json();
};

export const createCheckoutOrder = async (payload: { idempotencyKey: string; items: CheckoutItemRequest[]; customer: CheckoutCustomer; shipping: CheckoutShipping | null; topup: unknown }) => {
  const response = await fetch('/api/checkout/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readError(response);
  return response.json();
};
