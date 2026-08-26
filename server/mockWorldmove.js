import express from 'express';
import cors from 'cors';
import axios from 'axios';
import {
  createEsimOrderCallbackSignature,
  createEsimRedeemCallbackSignature,
  createRedeemCallbackSignature,
  createTopupCallbackSignature,
  createTopupSignature,
  sha1Worldmove,
} from './providers/worldmove/worldmoveSignature.js';

const app = express();
const PORT = 4000;
const TOKEN = process.env.WORLDMOVE_TOKEN || 'HICO_SECRET_TOKEN';

app.use(cors());
app.use(express.json());

// In-memory store for orders created on Worldmove
const activeOrders = new Map();
const activeRedemptions = new Map();
const esimUsageTracker = new Map(); // rcode -> totalBytes Used

// SHA1 encryption helper
function calculateSha1(content) {
  return sha1Worldmove(content);
}

const canonicalRequest = (req) => req.get('X-HICO-Checkout-Engine') === 'canonical';

async function sendCanonicalEvent(payload, attempt = 1) {
  const rawBody = JSON.stringify(payload);
  try {
    const response = await axios.post(
      process.env.HICO_WEBHOOK_URL || 'http://localhost:5000/api/webhooks/worldmove/events',
      rawBody,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (response.data !== '1' && response.data !== 1) throw new Error('HICO did not acknowledge canonical event');
  } catch (error) {
    console.error(`[WM] Canonical callback failed: ${error?.code ?? 'request_failed'}`);
    if (attempt < 4) setTimeout(() => sendCanonicalEvent(payload, attempt + 1), 5000);
  }
}

console.log('=== WORLDMOVE SIMULATOR ACTIVE ===');
console.log('Listening on Port:', PORT);

// 1. Quotations List (All Products)
app.post('/Api/QuoteMg/myQueryAll', (req, res) => {
  const { merchantId, encStr } = req.body;
  
  if (!merchantId || !encStr) {
    return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  }

  // Validate encStr = SHA1(merchantId + token)
  const expectedSignature = calculateSha1(merchantId + TOKEN);
  if (encStr !== expectedSignature) {
    return res.json({ code: 401, msg: 'Encryption verification failed.' });
  }

  const prodList = [
    { wmproductId: 'WM-e-JP-10GB', productId: 'jp-esim', productName: 'Japan eSIM 10GB - 15 Day', productRegion: 'Japan', productType: 0, productPrice: 600, productcPrice: 800, csight: 1, leSIM: true },
    { wmproductId: 'WM-e-US-20GB', productId: 'us-esim', productName: 'USA eSIM 20GB - 30 Day', productRegion: 'USA', productType: 0, productPrice: 900, productcPrice: 1200, csight: 1, leSIM: true },
    { wmproductId: 'WM-e-TH-10GB', productId: 'th-esim', productName: 'Thailand eSIM 10GB - 15 Day', productRegion: 'Thailand', productType: 0, productPrice: 480, productcPrice: 650, csight: 1, leSIM: true },
    { wmproductId: 'WM-e-UK-10GB', productId: 'uk-esim', productName: 'UK eSIM 10GB - 15 Day', productRegion: 'United Kingdom', productType: 0, productPrice: 540, productcPrice: 720, csight: 1, leSIM: true },
  ];

  res.json({ code: 0, msg: 'Success', prodList });
});

// 2. Buy eSIM (Async Order Creation)
app.post('/Api/SOrder/mybuyesim', (req, res) => {
  const { merchantId, deptId, email, prodList, systemMail, encStr } = req.body;

  if (!merchantId || !deptId || !email || !prodList || !encStr) {
    return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  }

  // Validate encStr = SHA1(merchantId + deptId + email + sum(wmproductId + qty) + token)
  let prodSum = '';
  prodList.forEach(p => {
    prodSum += (p.wmproductId + p.qty);
  });
  const expectedSignature = calculateSha1(merchantId + deptId + email + prodSum + TOKEN);
  
  if (encStr !== expectedSignature) {
    return res.json({ code: 401, msg: 'Encryption verification failed.' });
  }

  const orderId = 'WM_ORD_' + Date.now();
  console.log(`[WM] Created Order ${orderId}. Scheduling callback...`);

  // Save order details to trigger callback
  activeOrders.set(orderId, {
    orderId,
    email,
    prodList,
    merchantId,
    deptId,
    flow: 'esim_order',
  });

  // Return success response immediately as per specs
  res.json({ code: 0, msg: 'Success', orderId });

  // Schedule async callback to HICO Backend in 5 seconds
  if (canonicalRequest(req)) setTimeout(() => triggerCanonicalOrderEvent(orderId), 1000);
  else setTimeout(() => triggerOrderCallback(orderId), 5000);
});

// 2b. Buy leSIM (Async Order Creation without Email)
app.post('/Api/SOrder/mybuyesimRedemption', (req, res) => {
  const { merchantId, deptId, qrcodeType = 2, prodList, encStr } = req.body;

  if (!merchantId || !deptId || !prodList || !encStr) {
    return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  }

  // Validate the documented order-and-redeem signature.
  let prodSum = '';
  prodList.forEach(p => {
    prodSum += (p.wmproductId + p.qty);
  });
  const expectedSignature = calculateSha1(merchantId + deptId + qrcodeType + prodSum + TOKEN);
  
  if (encStr !== expectedSignature) {
    return res.json({ code: 401, msg: 'Encryption verification failed.' });
  }

  const orderId = 'WM_ORD_RED_' + Date.now();
  console.log(`[WM] Created Redemption Order ${orderId}. Scheduling callback...`);

  // Save order details to trigger callback
  activeOrders.set(orderId, {
    orderId,
    email: '0',
    prodList,
    merchantId,
    deptId,
    flow: 'esim_order_redeem',
    qrcodeType,
  });

  // Return success response immediately as per specs
  res.json({ code: 0, msg: 'Success', orderId });

  // Schedule async callback to HICO Backend in 5 seconds
  if (canonicalRequest(req)) setTimeout(() => triggerCanonicalOrderEvent(orderId), 1000);
  else setTimeout(() => triggerOrderCallback(orderId), 5000);
});

async function triggerCanonicalOrderEvent(orderId) {
  const order = activeOrders.get(orderId);
  if (!order) return;
  const itemList = order.prodList.map((p) => {
    const iccid = `89852${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
    const redemptionCode = `RC_${Math.random().toString(36).substring(2, 10).toLowerCase()}`;
    const productName = p.productName || 'Worldmove eSIM';
    activeRedemptions.set(redemptionCode, { iccid, productName, orderId, merchantId: order.merchantId });
    return order.flow === 'esim_order_redeem'
      ? {
        iccid,
        productName,
        rcode: redemptionCode,
        qrcodeType: order.qrcodeType ?? 2,
        qrcode: 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg',
        qrcodeContent: `LPA:1$rsp.worldmove.com$${redemptionCode}`,
        resultcode: '000',
        resultmsg: 'success',
        code: 0,
        msg: 'success',
        salePlanDays: 15,
        pin1: '1111',
        pin2: '2222',
        puk1: '33334444',
        puk2: '44445555',
        cfCode: '849372',
        apnExplain: 'Worldmove APN',
      }
      : { iccid, productName, redemptionCode };
  });
  const payload = {
    orderId,
    ...(order.flow === 'esim_order' ? { orderSN: `SN_${Date.now()}`, orderTime: new Date().toISOString().slice(0, 19).replace('T', ' ') } : {}),
    itemList,
  };
  payload.encStr = order.flow === 'esim_order'
    ? createEsimOrderCallbackSignature({ merchantId: order.merchantId, orderId, orderSN: payload.orderSN, orderTime: payload.orderTime, itemList, token: TOKEN })
    : createEsimRedeemCallbackSignature({ merchantId: order.merchantId, orderId, itemList, token: TOKEN });
  await sendCanonicalEvent(payload);
}

// Helper for Order Callback
async function triggerOrderCallback(orderId, attempt = 1) {
  const order = activeOrders.get(orderId);
  if (!order) return;

  const orderSN = 'SN_' + Math.random().toString(36).substring(2, 12).toUpperCase();
  const orderTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const itemList = order.prodList.map(p => {
    const iccid = '89852' + Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    const redemptionCode = 'RC_' + Math.random().toString(36).substring(2, 10).toLowerCase();
    
    // Save mapping for redemption step
    activeRedemptions.set(redemptionCode, {
      iccid,
      productName: p.wmproductId === 'WM-e-JP-10GB' ? 'Japan eSIM 10GB - 15 Day' : 'Global eSIM Pack',
      orderId
    });

    return {
      iccid,
      productName: p.wmproductId === 'WM-e-JP-10GB' ? 'Japan eSIM 10GB - 15 Day' : 'Global eSIM Pack',
      redemptionCode
    };
  });

  // Calculate encStr = SHA1(merchantId + orderId + orderSN + orderTime + sum(iccid + productName + redemptionCode) + token)
  let itemSum = '';
  itemList.forEach(item => {
    itemSum += (item.iccid + item.productName + item.redemptionCode);
  });
  const encStr = calculateSha1(order.merchantId + orderId + orderSN + orderTime + itemSum + TOKEN);

  const payload = {
    orderId,
    orderSN,
    orderTime,
    code: 0,
    msg: '成功',
    itemList,
    encStr
  };

  console.log(`[WM] Sending Order Callback to HICO (Attempt ${attempt})...`);
  try {
    const response = await axios.post('http://localhost:5000/api/wm/order-callback', payload);
    if (response.data === 1 || response.data === '1') {
      console.log(`[WM] Order Callback acknowledged by HICO with '1'.`);
    } else {
      throw new Error('HICO did not return "1"');
    }
  } catch (error) {
    console.error(`[WM] Order Callback failed: ${error.message}`);
    if (attempt < 4) {
      console.log(`[WM] Retrying callback in 5 seconds...`);
      setTimeout(() => triggerOrderCallback(orderId, attempt + 1), 5000);
    }
  }
}

// 3. Redeem Redemption Code
app.post('/Api/OrderRedemption/redemption', (req, res) => {
  const { merchantId, rcode, qrcodeType, encStr } = req.body;

  if (!merchantId || !rcode || qrcodeType === undefined || !encStr) {
    return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  }

  // Validate encStr = SHA1(merchantId + rcode + qrcodeType + token)
  const expectedSignature = calculateSha1(merchantId + rcode + qrcodeType + TOKEN);
  if (encStr !== expectedSignature) {
    return res.json({ code: 401, msg: 'Encryption verification failed.' });
  }

  const details = activeRedemptions.get(rcode);
  if (!details) {
    return res.json({ code: 411, msg: 'Redemption code does not exist.' });
  }

  console.log('[WM] Redemption received. Scheduling redeem callback...');
  res.json({ code: 0, msg: '成功' });

  // Schedule async callback to HICO Backend in 3 seconds
  if (canonicalRequest(req)) setTimeout(() => triggerCanonicalRedeemEvent(rcode, qrcodeType), 1000);
  else setTimeout(() => triggerRedeemCallback(rcode, qrcodeType), 3000);
});

async function triggerCanonicalRedeemEvent(rcode, qrcodeType) {
  const details = activeRedemptions.get(rcode);
  if (!details) return;
  const qrcode = 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg';
  const payload = {
    rcode,
    qrcodeType,
    qrcode,
    qrcodeContent: `LPA:1$rsp.worldmove.com$${rcode}`,
    iccid: details.iccid,
    productName: details.productName,
    resultcode: '000',
    pin1: '1111',
    pin2: '2222',
    puk1: '33334444',
    puk2: '44445555',
    cfCode: '849372',
    apnExplain: 'Worldmove APN',
  };
  payload.encStr = createRedeemCallbackSignature({ merchantId: details.merchantId ?? activeOrders.get(details.orderId)?.merchantId, qrcode, rcode, qrcodeType, token: TOKEN });
  await sendCanonicalEvent(payload);
}

app.post('/Api/SOrder/mybuysim', (req, res) => {
  const { merchantId, deptId, email, prodList, encStr } = req.body;
  if (!merchantId || !deptId || !email || !Array.isArray(prodList) || !encStr) return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  const orderId = `WM_SIM_${Date.now()}`;
  activeOrders.set(orderId, { orderId, email, prodList, merchantId, deptId });
  res.json({ code: 0, msg: 'Success', orderId });
  if (canonicalRequest(req)) setTimeout(() => sendCanonicalEvent({ eventId: `evt-${orderId}-shipping`, eventType: 'SHIPPING_UPDATE', providerOrderId: orderId, orderId, shipped: true, trackingCode: `QA-${orderId}` }), 1000);
});

app.post('/Api/SOrder/mydeposit', (req, res) => {
  const { merchantId, deptId, prodList, encStr } = req.body;
  if (!merchantId || !deptId || !Array.isArray(prodList) || !encStr) return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  if (prodList.some((item) => !/^\d{20}$/.test(String(item.simNum ?? '')) || Number(item.day) < 1 || Number(item.day) > 30)) return res.json({ code: 400, msg: 'Top-up parameters are invalid.' });
  const expectedSignature = createTopupSignature({ merchantId, deptId, prodList, token: TOKEN });
  if (encStr !== expectedSignature) return res.json({ code: 401, msg: 'Encryption verification failed.' });
  const orderId = `WM_TOPUP_${Date.now()}`;
  activeOrders.set(orderId, { orderId, merchantId, deptId, prodList, flow: 'topup' });
  res.json({ code: 0, msg: 'Success', orderId });
  if (canonicalRequest(req)) setTimeout(() => {
    const payload = { orderId, itemList: prodList.map((item) => ({ wmproductId: item.wmproductId, day: item.day, simNum: item.simNum, code: 1, msg: 'success' })) };
    payload.encStr = createTopupCallbackSignature({ merchantId, orderId, itemList: payload.itemList, token: TOKEN });
    return sendCanonicalEvent(payload);
  }, 1000);
});

app.post('/Api/SimQuery/simExists', (req, res) => {
  const { merchantId, simNum, encStr } = req.body;
  if (!merchantId || !/^\d{20}$/.test(String(simNum ?? '')) || encStr !== calculateSha1(`${merchantId}${simNum}${TOKEN}`)) return res.json({ code: 400, msg: 'SIM number is invalid.' });
  return res.json({ code: 0, exists: true, simNum });
});

app.post('/Api/SOrder/querybuyesim', (req, res) => {
  const order = activeOrders.get(req.body?.orderId);
  return res.json(order ? { code: 0, orderId: order.orderId, status: 'SUCCESS' } : { code: 411, msg: 'Order not found.' });
});

app.post('/Api/SOrder/querybuyesimRedemption', (req, res) => {
  const order = activeOrders.get(req.body?.orderId);
  return res.json(order ? { code: 0, orderId: order.orderId, status: 'SUCCESS' } : { code: 411, msg: 'Order not found.' });
});

app.post('/Api/UseageDetail/queryUsage', (req, res) => res.json({ code: 0, itemList: [], esimStatus: 'ACTIVE', simStatus: 'ACTIVE' }));
app.post('/Api/UseageDetail/queryEsimBasicInfo', (req, res) => res.json({ code: 0, rcode: req.body?.rcode ?? null }));
app.post('/Api/UseageDetail/queryEsimProgress', (req, res) => res.json({ code: 0, rcode: req.body?.rcode ?? null, status: 'PROVISIONED' }));

// Helper for Redeem Callback
async function triggerRedeemCallback(rcode, qrcodeType, attempt = 1) {
  const details = activeRedemptions.get(rcode);
  if (!details) return;

  const qrcode = 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg';
  const qrcodeContent = 'LPA:1$rsp.worldmove.com$' + rcode.toUpperCase() + '8985204000';
  
  // Calculate encStr = SHA1(merchantId + orderId + sum(iccid + productName + rcode + qrcodeType + qrcode) + token)
  const order = activeOrders.get(details.orderId);
  const itemSum = details.iccid + details.productName + rcode + qrcodeType + qrcode;
  const encStr = calculateSha1(order.merchantId + details.orderId + itemSum + TOKEN);

  const payload = {
    orderId: details.orderId,
    itemList: [{
      iccid: details.iccid,
      productName: details.productName,
      qrcode,
      rcode,
      qrcodeType,
      resultcode: '000',
      resultmsg: 'success',
      code: 0,
      msg: '成功',
      qrcodeContent,
      salePlanDays: 15,
      pin1: '1111',
      pin2: '2222',
      puk1: '33334444',
      puk2: '44445555',
      cfCode: '849372',
      apnExplain: 'Carrier NTT Docomo APN: spmode.ne.jp'
    }],
    encStr
  };

  console.log(`[WM] Sending Redeem Callback to HICO (Attempt ${attempt})...`);
  try {
    const response = await axios.post('http://localhost:5000/api/wm/redeem-callback', payload);
    if (response.data === 1 || response.data === '1') {
      console.log(`[WM] Redeem Callback acknowledged by HICO.`);
      
      // Immediately notify that eSIM has been activated on device
      setTimeout(() => {
        triggerActivationNotification(details.orderId, rcode, details.iccid);
      }, 4000);
    } else {
      throw new Error('HICO did not return "1"');
    }
  } catch (error) {
    console.error(`[WM] Redeem Callback failed: ${error.message}`);
    if (attempt < 4) {
      setTimeout(() => triggerRedeemCallback(rcode, qrcodeType, attempt + 1), 5000);
    }
  }
}

// Helper for eSIM Activation Notification
async function triggerActivationNotification(orderId, rcode, iccid, attempt = 1) {
  const order = activeOrders.get(orderId);
  if (!order) return;

  const useSDate = Math.floor(Date.now() / 1000).toString();
  const useEDate = Math.floor((Date.now() + 15 * 24 * 60 * 60 * 1000) / 1000).toString();

  const payload = {
    orderId,
    rcode,
    iccid,
    useSDate,
    useEDate
  };

  console.log(`[WM] Sending eSIM Activation Notification callback to HICO...`);
  try {
    const response = await axios.post('http://localhost:5000/api/wm/activation-notification', payload);
    if (response.data === 1 || response.data === '1') {
      console.log(`[WM] Activation Callback acknowledged by HICO.`);
    }
  } catch (error) {
    console.error(`[WM] Activation Notification failed: ${error.message}`);
    if (attempt < 4) {
      setTimeout(() => triggerActivationNotification(orderId, rcode, iccid, attempt + 1), 5000);
    }
  }
}

// 4. Query Usage and Status (With dynamic byte increments!)
app.post('/Api/UseageDetail/queryUsage', (req, res) => {
  const { merchantId, rcode, encStr } = req.body;

  if (!merchantId || !rcode || !encStr) {
    return res.json({ code: 400, msg: 'Parameters cannot be empty.' });
  }

  // Validate encStr = SHA1(merchantId + rcode + token)
  const expectedSignature = calculateSha1(merchantId + rcode + TOKEN);
  if (encStr !== expectedSignature) {
    return res.json({ code: 401, msg: 'Encryption verification failed.' });
  }

  const details = activeRedemptions.get(rcode);
  if (!details) {
    return res.json({ code: 411, msg: 'eSIM Card does not exist.' });
  }

  // Dynamic increment of usage for realistic demonstration!
  let currentUsage = esimUsageTracker.get(rcode) || 3844000000; // start at ~3.58GB
  const increment = Math.floor(100000000 + Math.random() * 200000000); // 100MB to 300MB
  currentUsage = Math.min(10000000000, currentUsage + increment); // cap at 10GB
  esimUsageTracker.set(rcode, currentUsage);

  const useSDate = Math.floor((Date.now() - 6 * 24 * 60 * 60 * 1000) / 1000).toString();
  const useEDate = Math.floor((Date.now() + 9 * 24 * 60 * 60 * 1000) / 1000).toString();

  res.json({
    code: 0,
    msg: 'Success',
    cid: details.iccid,
    useSDate,
    useEDate,
    totalUsage: currentUsage.toString(),
    esimStatus: 1, // Active
    simStatus: 1,
    productType: 0,
    itemList: [
      { usageDate: '20260525', mcc: '440', code: 'JP', zhtw: '日本', enus: 'Japan', usage: '1073741824' },
      { usageDate: '20260526', mcc: '440', code: 'JP', zhtw: '日本', enus: 'Japan', usage: (currentUsage - 1073741824).toString() },
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Worldmove Simulator running on http://localhost:${PORT}`);
});
