export class CheckoutError extends Error {
  constructor(message, code, status = 422, details = undefined) {
    super(message);
    this.name = 'CheckoutError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const asCheckoutError = (error) => {
  if (error instanceof CheckoutError) return error;
  return new CheckoutError(
    'Không thể xử lý yêu cầu thanh toán.',
    'CHECKOUT_INTERNAL_ERROR',
    500,
  );
};

export const sendCheckoutError = (res, error) => {
  const normalized = asCheckoutError(error);
  const body = {
    error: normalized.message,
    code: normalized.code,
  };
  if (normalized.details !== undefined) body.details = normalized.details;
  return res.status(normalized.status).json(body);
};
