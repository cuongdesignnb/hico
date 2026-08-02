import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(scriptDirectory, '..');
const workspaceDirectory = path.resolve(serverDirectory, '..');
const defaultUploadsDirectory = path.join(serverDirectory, 'uploads');

const datasetFiles = {
  orders: 'orders.json',
  customerProfiles: 'customers.json',
  esims: 'esims.json',
  manualQrs: 'manual_qrs.json',
  fulfillments: 'fulfillments.json',
  inventory: 'inventory.json',
  inventoryMovements: 'inventory_movements.json',
};

const sourceFiles = [
  'server/hicoBackend.js',
  'server/checkout/checkoutRouter.js',
  'server/fulfillment/fulfillmentRouter.js',
  'src/components/UserDashboard/UserDashboard.tsx',
  'src/context/AppContext.tsx',
  'src/routing/AppRouter.tsx',
  'src/pages/account/AccountLayout.tsx',
  'src/pages/account/AccountOverviewPage.tsx',
  'src/pages/account/AccountOrdersPage.tsx',
  'src/pages/account/AccountOrderDetailPage.tsx',
  'src/services/customerDashboardApi.ts',
  'src/services/customerOrdersApi.ts',
  'src/services/customerAssetsApi.ts',
  'src/services/customerLoyaltyApi.ts',
  'src/hooks/customer/useCustomerAssetQuery.ts',
  'src/hooks/customer/useCustomerAssetSummary.ts',
  'src/pages/account/AccountEsimsPage.tsx',
  'src/pages/account/AccountEsimDetailPage.tsx',
  'src/pages/account/AccountPhysicalSimsPage.tsx',
  'src/pages/account/AccountPhysicalSimDetailPage.tsx',
  'src/pages/account/AccountDeviceDetailPage.tsx',
  'src/pages/account/AccountTopupsPage.tsx',
  'src/pages/account/AccountTopupDetailPage.tsx',
  'src/components/Account/Assets/EsimRevealDialog.tsx',
  'server/customer/customerAssetProjection.js',
  'server/customer/customerAssetRevealService.js',
  'server/loyalty/loyaltyService.js',
  'server/loyalty/loyaltyRouter.js',
  'server/loyalty/loyaltyLedgerRepository.js',
];

const accountProductionFiles = sourceFiles.filter((relativePath) => relativePath.startsWith('src/pages/account/') || relativePath.startsWith('src/services/customer'));

const endpointFacts = [
  {
    code: 'LEGACY_USER_ORDERS_FULFILLMENT',
    method: 'GET',
    path: '/api/user/orders',
    source: 'server/fulfillment/fulfillmentRouter.js',
    marker: "router.get('/user/orders'",
    finding: 'Returns orders without a customer ownership predicate.',
  },
  {
    code: 'LEGACY_USER_ORDERS_DIRECT',
    method: 'GET',
    path: '/api/user/orders',
    source: 'server/hicoBackend.js',
    marker: "app.get('/api/user/orders'",
    finding: 'Legacy direct route is not customer-session scoped.',
  },
  {
    code: 'LEGACY_ESIM_BY_ICCID',
    method: 'GET',
    path: '/api/user/esim/:iccid',
    source: 'server/hicoBackend.js',
    marker: "app.get('/api/user/esim/:iccid'",
    finding: 'Client-provided ICCID is not ownership authorization.',
  },
  {
    code: 'LEGACY_TOPUP_BY_ICCID',
    method: 'POST',
    path: '/api/user/topup',
    source: 'server/hicoBackend.js',
    marker: "app.post('/api/user/topup'",
    finding: 'Mutation is not customer-session scoped.',
  },
  {
    code: 'PUBLIC_CHECKOUT_ORDER_LOOKUP',
    method: 'GET',
    path: '/api/checkout/orders/:orderId',
    source: 'server/checkout/checkoutRouter.js',
    marker: "router.get('/checkout/orders/:orderId'",
    finding: 'Public order lookup is outside the customer ownership boundary.',
  },
  {
    code: 'PUBLIC_CHECKOUT_FULFILLMENT_RETRY',
    method: 'POST',
    path: '/api/checkout/orders/:orderId/retry-fulfillment',
    source: 'server/checkout/checkoutRouter.js',
    marker: "router.post('/checkout/orders/:orderId/retry-fulfillment'",
    finding: 'Fulfillment retry is public rather than permissioned Admin work.',
  },
];

const demoFacts = [
  {
    code: 'MOCK_DASHBOARD_SENSITIVE_ASSET',
    source: 'src/components/UserDashboard/UserDashboard.tsx',
    marker: 'qrcodeContent',
    finding: 'Dashboard source embeds a mock sensitive fulfillment asset.',
  },
  {
    code: 'MOCK_DASHBOARD_CART_COUNT',
    source: 'src/components/UserDashboard/UserDashboard.tsx',
    marker: 'Math.max(2, cartItemCount)',
    finding: 'Dashboard source forces a demo cart count.',
  },
  {
    code: 'MOCK_ESIM_SEED',
    source: 'server/hicoBackend.js',
    marker: 'RC_JAPAN_MOCK',
    finding: 'Legacy server seed contains a mock eSIM fixture.',
  },
];

const ownershipStates = new Set([
  'OWNED',
  'GUEST_UNCLAIMED',
  'MANUAL_REVIEW',
  'LEGACY_UNRESOLVED',
]);

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

const classifyOwnership = (order) => {
  if (hasValue(order?.customerId)) {
    return 'OWNED';
  }

  if (ownershipStates.has(order?.ownershipClassification)) {
    return order.ownershipClassification;
  }

  if (order?.guestClaimStatus === 'UNCLAIMED') {
    return 'GUEST_UNCLAIMED';
  }

  if (order?.requiresOwnershipReview === true) {
    return 'MANUAL_REVIEW';
  }

  return 'LEGACY_UNRESOLVED';
};

const readDataset = async (uploadsDirectory, fileName) => {
  try {
    const raw = await fs.readFile(path.join(uploadsDirectory, fileName), 'utf8');
    const parsed = JSON.parse(raw);

    return {
      count: Array.isArray(parsed) ? parsed.length : 0,
      state: Array.isArray(parsed) ? 'present' : 'invalid_shape',
      records: Array.isArray(parsed) ? parsed : [],
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { count: 0, state: 'missing', records: [] };
    }

    return { count: 0, state: 'unreadable', records: [] };
  }
};

const readSources = async (sourceContents) => {
  const sources = {};
  const bomFiles = [];
  const unreadableFiles = [];

  await Promise.all(sourceFiles.map(async (relativePath) => {
    if (Object.hasOwn(sourceContents ?? {}, relativePath)) {
      sources[relativePath] = String(sourceContents[relativePath]);
      return;
    }

    try {
      const raw = await fs.readFile(path.join(workspaceDirectory, relativePath));
      if (raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
        bomFiles.push(relativePath);
      }
      sources[relativePath] = raw.toString('utf8');
    } catch {
      sources[relativePath] = '';
      unreadableFiles.push(relativePath);
    }
  }));

  return { sources, bomFiles, unreadableFiles };
};

const detectFacts = (facts, sources) => facts
  .filter((fact) => sources[fact.source]?.includes(fact.marker))
  .map(({ marker, ...fact }) => fact);

export const inventoryCustomerPlatform = async ({
  uploadsDirectory = defaultUploadsDirectory,
  sourceContents,
  now = () => new Date(),
} = {}) => {
  const datasetEntries = await Promise.all(Object.entries(datasetFiles).map(
    async ([name, fileName]) => [name, await readDataset(uploadsDirectory, fileName)],
  ));
  const datasetsWithRecords = Object.fromEntries(datasetEntries);
  const { sources, bomFiles, unreadableFiles } = await readSources(sourceContents);

  const ownership = {
    OWNED: 0,
    GUEST_UNCLAIMED: 0,
    MANUAL_REVIEW: 0,
    LEGACY_UNRESOLVED: 0,
    autoLinkedByEmail: 0,
  };

  for (const order of datasetsWithRecords.orders.records) {
    ownership[classifyOwnership(order)] += 1;
  }

  const datasets = Object.fromEntries(Object.entries(datasetsWithRecords).map(
    ([name, { count, state }]) => [name, { count, state }],
  ));
  const accountSource = accountProductionFiles.map((relativePath) => sources[relativePath] ?? '').join('\n');
  const assetSource = sourceFiles.filter((relativePath) => relativePath.includes('customerAsset') || relativePath.includes('CustomerAsset') || relativePath.includes('EsimReveal')).map((relativePath) => sources[relativePath] ?? '').join('\n');
  const loyaltySource = sourceFiles.filter((relativePath) => relativePath.includes('Loyalty') || relativePath.includes('loyalty')).map((relativePath) => sources[relativePath] ?? '').join('\n');
  const appRouterSource = sources['src/routing/AppRouter.tsx'] ?? '';

  return {
    reportType: 'customer-platform-inventory',
    generatedAt: now().toISOString(),
    datasets,
    persistence: {
      canonicalOrders: 'postgres_canonical',
      customerProfiles: 'legacy_json_demo',
      fulfillmentProjection: datasets.fulfillments.state === 'missing' ? 'not_persisted' : 'present',
      inventoryProjection: datasets.inventory.state === 'missing' ? 'not_persisted' : 'present',
    },
    ownership,
    unscopedEndpoints: detectFacts(endpointFacts, sources),
    demoFindings: detectFacts(demoFacts, sources),
    productionSurface: {
      userDashboardRouteCount: appRouterSource.includes('UserDashboard') ? 1 : 0,
      accountApiUserReferenceCount: (accountSource.match(/\/api\/user/g) ?? []).length,
      hardCodedSensitiveDataCount: (accountSource.match(/qrcodeContent|redemptionCode|pin1|pin2|puk1|puk2|iccid/g) ?? []).length,
      legacyMockFiles: sources['src/components/UserDashboard/UserDashboard.tsx'] ? 1 : 0,
      assetApiUserReferenceCount: (assetSource.match(/\/api\/user/g) ?? []).length,
      hardCodedAssetValueCount: (assetSource.match(/(?:LPA:|RC_[A-Z0-9_]+|\b\d{16,22}\b)/g) ?? []).length,
      productionLoyaltySourceCount: sourceFiles.filter((relativePath) => relativePath.includes('Loyalty') || relativePath.includes('loyalty')).filter((relativePath) => sources[relativePath]).length,
      hardCodedPointsCount: (accountSource.match(/\b(?:points?|diem)\s*[:=]\s*\d+/gi) ?? []).length,
      fakeCashEquivalentCount: (accountSource.match(/(?:points?|diem).{0,30}(?:VND|cash|money|amount)/gi) ?? []).length,
      walletWordingCount: (accountSource.match(/wallet|vi dien tu|vi tien/gi) ?? []).length,
      localPointsBalanceCount: (accountSource.match(/localStorage[^\n]*(?:points?|diem|balance)/gi) ?? []).length,
      legacyPointsApiReferenceCount: (accountSource.match(/\/api\/(?:user|wallet|points)(?:\/|['"`])/gi) ?? []).length,
      directBalanceMutationCount: (accountSource.match(/\bbalance\s*[+\-*/]?=/gi) ?? []).length,
    },
    browserStorage: {
      keys: sources['src/context/AppContext.tsx']?.includes('hico_cart') ? ['hico_cart'] : [],
      authenticationKeys: [],
    },
    sensitiveDataPolicy: {
      rawValuesIncluded: false,
      note: 'The report contains aggregate counts and finding codes only.',
    },
    sourceEncoding: {
      encoding: 'utf8',
      filesChecked: sourceFiles.length,
      bomFiles,
      unreadableFiles,
    },
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await inventoryCustomerPlatform();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
