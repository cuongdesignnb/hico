import axios from 'axios';
import {
  createEsimOrderAndRedeemSignature,
  createEsimOrderSignature,
  createQuotationSignature,
  createRedeemSignature,
  createTopupSignature,
  createUsageSignature,
  sha1Worldmove,
} from './worldmoveSignature.js';

const QUOTATION_PATH = '/Api/QuoteMg/myQueryAll';
const DEFAULT_TIMEOUT_MS = 15000;
const ESIM_ORDER_PATH = '/Api/SOrder/mybuyesim';
const ESIM_REDEEM_ORDER_PATH = '/Api/SOrder/mybuyesimRedemption';
const PHYSICAL_ORDER_PATH = '/Api/SOrder/mybuysim';
const TOPUP_PATH = '/Api/SOrder/mydeposit';
const REDEEM_PATH = '/Api/OrderRedemption/redemption';
const VERIFY_SIM_PATH = '/Api/SimQuery/simExists';
const QUERY_ESIM_ORDER_PATH = '/Api/SOrder/querybuyesim';
const QUERY_ESIM_REDEEM_PATH = '/Api/SOrder/querybuyesimRedemption';
const QUERY_USAGE_PATH = '/Api/UseageDetail/queryUsage';
const QUERY_ESIM_BASIC_PATH = '/Api/UseageDetail/queryEsimBasicInfo';
const QUERY_ESIM_PROGRESS_PATH = '/Api/UseageDetail/queryEsimProgress';

const asInteger = (value, field) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new WorldmoveRequestError(`${field} không hợp lệ.`);
  return number;
};

const asSimNumber = (value) => {
  const simNum = String(value ?? '').trim();
  if (!/^\d{20}$/.test(simNum)) {
    const error = new WorldmoveRequestError('Số SIM phải gồm đúng 20 chữ số.');
    error.code = 'SIM_NUMBER_INVALID';
    error.retryable = false;
    throw error;
  }
  return simNum;
};

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
          error.code = response.data.code === 802 ? 'TOPUP_DAYS_EXCEEDED' : response.data.code === 411 ? 'SIM_NUMBER_NOT_FOUND' : 'PROVIDER_REQUEST_FAILED';
          error.providerCode = response.data.code;
          error.retryable = response.data.code === 408;
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
    async createEsimOrder({ email, wmproductId, quantity, idempotencyKey }) {
      const prodList = [{ wmproductId, qty: asInteger(quantity, 'Số lượng') }];
      return this.request(ESIM_ORDER_PATH, {
        merchantId,
        deptId,
        email,
        prodList,
        systemMail: false,
        encStr: createEsimOrderSignature({ merchantId, deptId, email, prodList, token }),
      }, idempotencyKey);
    },
    async createEsimOrderAndRedeem({ wmproductId, quantity, qrcodeType = 2, idempotencyKey }) {
      const prodList = [{ wmproductId, qty: asInteger(quantity, 'Số lượng') }];
      return this.request(ESIM_REDEEM_ORDER_PATH, {
        merchantId,
        deptId,
        qrcodeType,
        prodList,
        encStr: createEsimOrderAndRedeemSignature({ merchantId, deptId, qrcodeType, prodList, token }),
      }, idempotencyKey);
    },
    async createPhysicalOrder({ email, wmproductId, quantity, shipping, idempotencyKey }) {
      const response = await this.request(PHYSICAL_ORDER_PATH, {
        merchantId,
        deptId,
        email,
        prodList: [{ wmproductId, qty: quantity }],
        shipping,
        encStr: sha1Worldmove(`${merchantId}${deptId}${email}${wmproductId}${quantity}${token}`),
      }, idempotencyKey);
      return response;
    },
    async redeem({ rcode, qrcodeType = 2, idempotencyKey }) {
      return this.request(REDEEM_PATH, {
        merchantId,
        rcode,
        qrcodeType,
        encStr: createRedeemSignature({ merchantId, rcode, qrcodeType, token }),
      }, idempotencyKey);
    },
    async topup({ wmproductId, simNum, day, idempotencyKey }) {
      const prodList = [{ wmproductId, day: asInteger(day, 'Số ngày top-up'), simNum: asSimNumber(simNum) }];
      if (prodList[0].day > 30) {
        const error = new WorldmoveRequestError('Số ngày top-up không được vượt quá 30 ngày.');
        error.code = 'TOPUP_DAYS_EXCEEDED';
        error.retryable = false;
        throw error;
      }
      return this.request(TOPUP_PATH, {
        merchantId,
        deptId,
        prodList,
        encStr: createTopupSignature({ merchantId, deptId, prodList, token }),
      }, idempotencyKey);
    },
    async verifySimNumber({ simNum, idempotencyKey }) {
      const normalizedSimNum = asSimNumber(simNum);
      return this.request(VERIFY_SIM_PATH, {
        merchantId,
        simNum: normalizedSimNum,
        encStr: createUsageSignature({ merchantId, rcode: normalizedSimNum, token }),
      }, idempotencyKey);
    },
    async queryEsimOrder({ orderId, idempotencyKey }) {
      return this.request(QUERY_ESIM_ORDER_PATH, { merchantId, orderId, encStr: createUsageSignature({ merchantId, rcode: orderId, token }) }, idempotencyKey);
    },
    async queryEsimOrderAndRedeem({ orderId, idempotencyKey }) {
      return this.request(QUERY_ESIM_REDEEM_PATH, { merchantId, orderId, encStr: createUsageSignature({ merchantId, rcode: orderId, token }) }, idempotencyKey);
    },
    async queryUsage({ rcode, simNum, orderId, idempotencyKey }) {
      const identity = rcode ?? simNum ?? orderId;
      return this.request(QUERY_USAGE_PATH, {
        merchantId,
        ...(rcode ? { rcode } : {}),
        ...(simNum ? { simNum } : {}),
        ...(orderId ? { orderId } : {}),
        encStr: createUsageSignature({ merchantId, rcode: identity, token }),
      }, idempotencyKey);
    },
    async queryEsimBasicInfo({ rcode, idempotencyKey }) {
      return this.request(QUERY_ESIM_BASIC_PATH, { merchantId, rcode, encStr: createUsageSignature({ merchantId, rcode, token }) }, idempotencyKey);
    },
    async queryEsimProgress({ rcode, idempotencyKey }) {
      return this.request(QUERY_ESIM_PROGRESS_PATH, { merchantId, rcode, encStr: createUsageSignature({ merchantId, rcode, token }) }, idempotencyKey);
    },
  };
};

export const createWorldmoveClientFromEnv = (env = process.env) => {
  const config = readWorldmoveConfig(env);
  return createWorldmoveClient(config);
};
