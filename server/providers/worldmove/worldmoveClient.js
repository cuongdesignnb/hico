import axios from 'axios';
import { createHash } from 'node:crypto';
import { createQuotationSignature } from './worldmoveSignature.js';

const QUOTATION_PATH = '/Api/QuoteMg/myQueryAll';
const DEFAULT_TIMEOUT_MS = 15000;
const ESIM_ORDER_PATH = '/Api/SOrder/mybuyesim';
const ESIM_REDEEM_ORDER_PATH = '/Api/SOrder/mybuyesimRedemption';
const PHYSICAL_ORDER_PATH = '/Api/SOrder/mybuysim';
const TOPUP_PATH = '/Api/SOrder/mydeposit';
const REDEEM_PATH = '/Api/OrderRedemption/redemption';

const sha1 = (value) => createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();

export class WorldmoveConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorldmoveConfigurationError';
  }
}

export class WorldmoveRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorldmoveRequestError';
  }
}

const requireEnvironmentValue = (env, name) => {
  const value = env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new WorldmoveConfigurationError(`Missing Worldmove environment: ${name}`);
  }

  return value.trim();
};

export const readWorldmoveConfig = (env = process.env) => {
  const apiUrl = requireEnvironmentValue(env, 'WORLDMOVE_API_URL');
  let parsedUrl;

  try {
    parsedUrl = new URL(apiUrl);
  } catch {
    throw new WorldmoveConfigurationError('WORLDMOVE_API_URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new WorldmoveConfigurationError('WORLDMOVE_API_URL must use HTTP or HTTPS');
  }

  return {
    merchantId: requireEnvironmentValue(env, 'WORLDMOVE_MERCHANT_ID'),
    deptId: requireEnvironmentValue(env, 'WORLDMOVE_DEPT_ID'),
    token: requireEnvironmentValue(env, 'WORLDMOVE_TOKEN'),
    apiUrl: parsedUrl.toString().replace(/\/$/, ''),
  };
};

export const createWorldmoveClient = ({
  merchantId,
  deptId = '',
  token,
  apiUrl,
  httpClient = axios,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  const quotationUrl = apiUrl.endsWith(QUOTATION_PATH)
    ? apiUrl
    : `${apiUrl}${QUOTATION_PATH}`;

  return {
    async fetchQuotation() {
      try {
        const response = await httpClient.post(
          quotationUrl,
          {
            merchantId,
            encStr: createQuotationSignature(merchantId, token),
          },
          {
            timeout: timeoutMs,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        return response.data;
      } catch (error) {
        const status = error?.response?.status;
        const statusSuffix = Number.isInteger(status) ? ` (${status})` : '';
        throw new WorldmoveRequestError(
          `Không thể kết nối Worldmove${statusSuffix}.`,
        );
      }
    },
    async request(path, payload, idempotencyKey) {
      try {
        const response = await httpClient.post(`${apiUrl}${path}`, payload, {
          timeout: timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            'X-HICO-Checkout-Engine': 'canonical',
          },
        });
        if (response.data?.code !== undefined && response.data.code !== 0) {
          const error = new WorldmoveRequestError('Worldmove từ chối yêu cầu.');
          error.code = 'PROVIDER_REQUEST_FAILED';
          error.retryable = false;
          throw error;
        }
        return response.data;
      } catch (error) {
        if (error instanceof WorldmoveRequestError) throw error;
        const wrapped = new WorldmoveRequestError(
          error?.code === 'ECONNABORTED' ? 'Worldmove timeout.' : 'Không thể kết nối Worldmove.',
        );
        wrapped.code = error?.code === 'ECONNABORTED' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_REQUEST_FAILED';
        wrapped.retryable = true;
        throw wrapped;
      }
    },
    async createEsimOrder({
      email,
      wmproductId,
      quantity,
      redeem = false,
      qrcodeType = 2,
      idempotencyKey,
    }) {
      if (redeem) {
        return this.createEsimOrderAndRedeem({
          wmproductId,
          quantity,
          qrcodeType,
          idempotencyKey,
        });
      }

      const prodSum = `${wmproductId}${quantity}`;
      return this.request(ESIM_ORDER_PATH, {
        merchantId,
        deptId,
        email,
        prodList: [{ wmproductId, qty: quantity }],
        systemMail: false,
        encStr: sha1(`${merchantId}${deptId}${email}${prodSum}${token}`),
      }, idempotencyKey);
    },

    async createEsimOrderAndRedeem({
      wmproductId,
      quantity,
      qrcodeType = 2,
      idempotencyKey,
    }) {
      const prodSum = `${wmproductId}${quantity}`;

      return this.request(ESIM_REDEEM_ORDER_PATH, {
        merchantId,
        deptId,
        qrcodeType,
        prodList: [{ wmproductId, qty: quantity }],
        encStr: sha1(
          `${merchantId}${deptId}${qrcodeType}${prodSum}${token}`,
        ),
      }, idempotencyKey);
    },
    async createPhysicalOrder({ email, wmproductId, quantity, shipping, idempotencyKey }) {
      const response = await this.request(PHYSICAL_ORDER_PATH, {
        merchantId,
        deptId,
        email,
        prodList: [{ wmproductId, qty: quantity }],
        shipping,
        encStr: sha1(`${merchantId}${deptId}${email}${wmproductId}${quantity}${token}`),
      }, idempotencyKey);
      return response;
    },
    async redeem({ rcode, qrcodeType = 0, idempotencyKey }) {
      return this.request(REDEEM_PATH, {
        merchantId,
        rcode,
        qrcodeType,
        encStr: sha1(`${merchantId}${rcode}${qrcodeType}${token}`),
      }, idempotencyKey);
    },
    async topup({ email, wmproductId, simNum, day, idempotencyKey }) {
      return this.request(TOPUP_PATH, {
        merchantId,
        deptId,
        email,
        prodList: [{ wmproductId, day, simNum }],
        encStr: sha1(`${merchantId}${deptId}${email}${wmproductId}${day}${simNum}${token}`),
      }, idempotencyKey);
    },
  };
};

export const createWorldmoveClientFromEnv = (env = process.env) => {
  const config = readWorldmoveConfig(env);
  return createWorldmoveClient(config);
};
