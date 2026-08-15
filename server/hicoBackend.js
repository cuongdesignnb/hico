import express from 'express';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { createCatalogRouter } from './catalog/catalogRouter.js';
import { createProviderRouter } from './providers/providerRouter.js';
import { createReconciliationRouter } from './catalog/reconciliation/reconciliationRouter.js';
import {
  createCatalogMigrationRouter,
} from './catalog/migration/catalogMigrationRouter.js';
import {
  createLegacyCatalogRouter,
} from './catalog/legacy/legacyCatalogRouter.js';
import {
  createCatalogWriteRouter,
} from './catalog/write/catalogWriteRouter.js';
import { createCatalogBulkRouter } from './catalog/bulk/catalogBulkRouter.js';
import { createCatalogQueueRouter } from './catalog/queues/catalogQueueRouter.js';
import { createCatalogPublishRouter } from './catalog/publish/catalogPublishRouter.js';
import { createCatalogSheetImportRouter } from './catalog/import/catalogSheetImportRouter.js';
import { createSheetSyncRouter } from './catalog/sheetSync/sheetSyncRouter.js';
import { createSheetSyncService } from './catalog/sheetSync/sheetSyncService.js';
import { createSheetSyncRepository } from './catalog/sheetSync/sheetSyncRepository.js';
import { createVariantAliasRepository } from './catalog/variantAliases/variantAliasRepository.js';
import { createVariantAliasService } from './catalog/variantAliases/variantAliasService.js';
import { createVariantAliasRouter } from './catalog/variantAliases/variantAliasRouter.js';
import { createFulfillmentBindingRepository } from './catalog/fulfillment/fulfillmentBindingRepository.js';
import { createFulfillmentBindingService } from './catalog/fulfillment/fulfillmentBindingService.js';
import { createFulfillmentBindingRouter } from './catalog/fulfillment/fulfillmentBindingRouter.js';
import { createFulfillmentProfileRepository } from './catalog/fulfillment/fulfillmentProfileRepository.js';
import { createFulfillmentProfileService } from './catalog/fulfillment/fulfillmentProfileService.js';
import { createFulfillmentProfileRouter } from './catalog/fulfillment/fulfillmentProfileRouter.js';
import { createProviderOfferRepository } from './providers/providerOfferRepository.js';
import { createGoogleSheetSettingsRepository, createUnavailableGoogleSheetSettingsRepository } from './integrations/googleSheets/googleSheetSettingsRepository.js';
import { createGoogleSheetCredentialRepository } from './integrations/googleSheets/googleSheetCredentialRepository.js';
import { createGoogleSheetClientFactory } from './integrations/googleSheets/googleSheetClientFactory.js';
import { createGoogleSheetConnectionService } from './integrations/googleSheets/googleSheetConnectionService.js';
import { createGoogleSheetSettingsRouter } from './integrations/googleSheets/googleSheetSettingsRouter.js';
import { createCatalogBulkService } from './catalog/bulk/catalogBulkService.js';
import { createCatalogQueueService } from './catalog/queues/catalogQueueService.js';
import { createCatalogPublishService } from './catalog/publish/catalogPublishService.js';
import { createCatalogCommandService } from './catalog/write/catalogCommandService.js';
import { createCatalogVersionCommitService } from './catalog/write/catalogVersionCommitService.js';
import { createCatalogWriteService } from './catalog/write/catalogWriteService.js';
import {
  createCanonicalCatalogGuard,
  createCatalogHealthRouter,
} from './catalog/health/catalogHealthRouter.js';
import { createCatalogHealthService } from './catalog/health/catalogHealthService.js';
import { createCanonicalCatalogReader } from './catalog/canonical/canonicalCatalogReader.js';
import { createCanonicalCatalogRepository } from './catalog/canonical/canonicalCatalogRepository.js';
import { createCheckoutRouter } from './checkout/checkoutRouter.js';
import { createCheckoutReadinessService } from './checkout/checkoutReadiness.js';
import { createCheckoutService } from './checkout/checkoutService.js';
import { createCheckoutIdempotencyRepository } from './checkout/checkoutIdempotencyRepository.js';
import { createCheckoutHealthRouter } from './checkout/health/checkoutHealthRouter.js';
import { createCheckoutHealthService } from './checkout/health/checkoutHealthService.js';
import { createFulfillmentRouter } from './fulfillment/fulfillmentRouter.js';
import { createFulfillmentService } from './fulfillment/fulfillmentService.js';
import { createFulfillmentRepository } from './fulfillment/fulfillmentRepository.js';
import { createFulfillmentIdempotencyRepository } from './fulfillment/fulfillmentIdempotencyRepository.js';
import { createManualQrRepository } from './fulfillment/manualQrRepository.js';
import { createInventoryRepository } from './fulfillment/inventoryRepository.js';
import { createOrderRepository } from './orders/orderRepository.js';
import { createPostgresOrderRepository } from './orders/postgresOrderRepository.js';
import { createOrderService } from './orders/orderService.js';
import { createWorldmoveClient } from './providers/worldmove/worldmoveClient.js';
import { createWorldmoveWebhookRouter } from './webhooks/worldmoveWebhookRouter.js';
import { createWebhookReplayRepository, createWebhookEventRepository } from './webhooks/webhookReplayRepository.js';
import { createSeoRouter } from './seo/seoRouter.js';
import { createPublicRouteResolver } from './seo/publicRouteResolver.js';
import { createAdminUserRepository } from './auth/users/adminUserRepository.js';
import { createSessionStore, sessionStoreDriver } from './auth/session/sessionStore.js';
import { createSessionCleanupService } from './auth/session/sessionCleanupService.js';
import { createSessionHealthService } from './auth/session/sessionHealthService.js';
import { createSessionService } from './auth/sessionService.js';
import { createAuthService } from './auth/authService.js';
import { createAuthCookies } from './auth/authCookies.js';
import { createAuthRouter } from './auth/authRouter.js';
import { createAdminSecurityRouter } from './auth/adminSecurityRouter.js';
import { createPostgresCustomerRepository } from './customer/customerRepository.js';
import { createPostgresCustomerSessionRepository } from './customer/customerSessionRepository.js';
import { createCustomerAuthService } from './customer/customerAuthService.js';
import { createCustomerAuthCookies } from './customer/customerAuthCookies.js';
import { createCustomerAuthReadiness } from './customer/customerAuthReadiness.js';
import { createCustomerAuthRouter } from './customer/customerAuthRouter.js';
import { createCustomerOrderRouter } from './customer/customerOrderRouter.js';
import { createCustomerOrderService } from './customer/customerOrderService.js';
import { createCustomerDashboardRepository } from './customer/customerDashboardRepository.js';
import { createCustomerDashboardService } from './customer/customerDashboardService.js';
import { createCustomerDashboardRouter } from './customer/customerDashboardRouter.js';
import { createCustomerAssetRepository } from './customer/customerAssetRepository.js';
import { createCustomerAssetRevealService } from './customer/customerAssetRevealService.js';
import { createCustomerAssetAuditRepository } from './customer/customerAssetAuditRepository.js';
import { createCustomerAssetRouter } from './customer/customerAssetRouter.js';
import { createCustomerTokenDelivery } from './customer/customerTokenDelivery.js';
import { createCustomerProfileRepository } from './customer/customerProfileRepository.js';
import { createCustomerProfileService } from './customer/customerProfileService.js';
import { createCustomerProfileRouter } from './customer/customerProfileRouter.js';
import { createCustomerNotificationRepository } from './customerNotifications/customerNotificationRepository.js';
import { createCustomerNotificationService } from './customerNotifications/customerNotificationService.js';
import { createNotificationEventProcessor } from './customerNotifications/notificationEventProcessor.js';
import { createCustomerNotificationHealthService } from './customerNotifications/notificationHealthService.js';
import { createCustomerNotificationRouter } from './customerNotifications/customerNotificationRouter.js';
import { createCustomerLoyaltyRouter } from './loyalty/loyaltyRouter.js';
import { createLoyaltyAdminRouter } from './loyalty/loyaltyAdminRouter.js';
import { createLoyaltyHealthRouter } from './loyalty/loyaltyHealthRouter.js';
import { createLoyaltyLedgerRepository } from './loyalty/loyaltyLedgerRepository.js';
import { createLoyaltyRuleService } from './loyalty/loyaltyRuleService.js';
import { createLoyaltyService } from './loyalty/loyaltyService.js';
import { createLoyaltyEventProcessor } from './loyalty/loyaltyEventProcessor.js';
import { createReferralRepository } from './referrals/referralRepository.js';
import { createReferralCodeService } from './referrals/referralCodeService.js';
import { createReferralService } from './referrals/referralService.js';
import { createReferralHealthService } from './referrals/referralHealthService.js';
import { createCustomerReferralRouter } from './referrals/referralRouter.js';
import { createReferralAdminRouter } from './referrals/referralAdminRouter.js';
import { createSupportRepository } from './support/supportRepository.js';
import { createSupportService } from './support/supportService.js';
import { createSupportRouter } from './support/supportRouter.js';
import { createSupportAdminRouter } from './support/supportAdminRouter.js';
import { createSupportAttachmentService } from './support/supportAttachmentService.js';
import { createSupportHealthService } from './support/supportHealthService.js';
import { createCustomerPlatformHealthService } from './customer/customerPlatformHealthService.js';
import { createRequestId } from './security/requestId.js';
import { createAdminRequestAudit, createSecurityAudit } from './security/securityAudit.js';
import { createCorsPolicy } from './security/corsPolicy.js';
import { createSecurityHeaders } from './security/securityHeaders.js';
import { createRateLimiter } from './security/rateLimits.js';
import { createAuthenticate, createAdminAuthorization, createCsrfProtection } from './security/authenticate.js';
import { parseImageUpload, safeUploadPath } from './security/uploadValidation.js';
import { createPostgresPool } from './database/postgresPool.js';
import { migrateDatabase } from './scripts/migrateDatabase.js';
import { createProductionReadinessChecks } from './production/productionReadinessChecks.js';
import { createProductionReadinessService } from './production/productionReadinessService.js';
import { createProductionWriteGuard } from './production/productionWriteGuard.js';
import { createProductionReadinessRouter } from './production/productionReadinessRouter.js';
import { createMediaAssetRepository } from './media/mediaAssetRepository.js';
import { createMediaReferenceService } from './media/mediaReferenceService.js';
import { createLogger } from './logging/logger.js';
import { createRequestContextLogger } from './logging/requestContext.js';
import { createMetrics } from './monitoring/metrics.js';
import { createAlertService } from './operations/alertService.js';
import { createSePaySettingsRepository, createUnavailableSePaySettingsRepository } from './payments/sepay/sepaySettingsRepository.js';
import { createSePayCredentialService } from './payments/sepay/sepayCredentialService.js';
import { createSePaySettingsService } from './payments/sepay/sepaySettingsService.js';
import { createSePayPaymentRepository } from './payments/sepay/sepayPaymentRepository.js';
import { createSePayWebhookService } from './payments/sepay/sepayWebhookService.js';
import { createSePayAdminRouter, createSePayWebhookRouter } from './payments/sepay/sepayRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = 5000;
const checkoutBodyLimitMb = Number(process.env.CHECKOUT_BODY_LIMIT_MB ?? 10);
const webhookBodyLimitKb = Number(process.env.WEBHOOK_BODY_LIMIT_KB ?? 256);
const checkoutRateLimitPerMinute = Number(process.env.CHECKOUT_RATE_LIMIT_PER_MINUTE ?? 120);
const catalogUploadsDirectory = path.join(__dirname, 'uploads');
const canonicalCatalogRepository = createCanonicalCatalogRepository({ uploadsDirectory: catalogUploadsDirectory });
const mediaReferenceService = createMediaReferenceService({
  uploadsDirectory: catalogUploadsDirectory,
  canonicalRepository: canonicalCatalogRepository,
});
const mediaAssetRepository = createMediaAssetRepository({
  uploadsDirectory: catalogUploadsDirectory,
  referenceProvider: (asset) => mediaReferenceService.findReferences(asset),
});
const providerOfferRepository = createProviderOfferRepository({
  offersFile: path.join(catalogUploadsDirectory, 'provider_offers.json'),
});
const resolvePublicMediaInput = async (input = {}) => {
  if (!Object.prototype.hasOwnProperty.call(input, 'imageMediaId')) return input;
  if (input.imageMediaId === null || input.imageMediaId === '') return { ...input, image: '' };
  const asset = await mediaAssetRepository.getById(input.imageMediaId);
  if (!asset) throw Object.assign(new Error('MediaAsset không tồn tại hoặc đã archive.'), { code: 'MEDIA_REFERENCE_INVALID', status: 400 });
  return { ...input, image: asset.publicUrl };
};
const catalogHealthService = createCatalogHealthService({
  env: process.env,
  uploadsDirectory: catalogUploadsDirectory,
});
const catalogGuard = createCanonicalCatalogGuard({ catalogHealthService });
const catalogCommitService = createCatalogVersionCommitService({
  uploadsDirectory: catalogUploadsDirectory,
  onCommit: () => catalogHealthService.invalidate(),
});
const catalogCommandService = createCatalogCommandService({ env: process.env });
const catalogWriteService = createCatalogWriteService({
  env: process.env,
  uploadsDirectory: catalogUploadsDirectory,
  mediaAssetRepository,
  commandService: catalogCommandService,
  commitService: catalogCommitService,
});
const catalogBulkService = createCatalogBulkService({
  env: process.env,
  uploadsDirectory: catalogUploadsDirectory,
  commandService: catalogCommandService,
  commitService: catalogCommitService,
});
const catalogQueueService = createCatalogQueueService({
  uploadsDirectory: catalogUploadsDirectory,
});
const catalogPublishService = createCatalogPublishService({ catalogBulkService });
const logger = createLogger();
const metrics = createMetrics();
const alerts = createAlertService({ env: process.env, logger });
const securityAudit = createSecurityAudit({ logger, onEvent: (event) => {
  metrics.increment(`security.${event.event ?? 'unknown'}`);
  if (event.event === 'rate_limited') void alerts.raise({ type: 'rate_limit_hit', message: 'Rate limit threshold reached.', requestId: event.requestId });
} });
const authStoreDriver = sessionStoreDriver(process.env);
const authPool = authStoreDriver === 'postgres' ? createPostgresPool({ env: process.env }) : null;
if (authPool && process.env.AUTH_RUN_MIGRATIONS_ON_START === 'true') await migrateDatabase({ pool: authPool });
const googleSheetSettingsRepository = authPool ? createGoogleSheetSettingsRepository({ pool: authPool }) : createUnavailableGoogleSheetSettingsRepository();
const sepaySettingsRepository = authPool ? createSePaySettingsRepository({ pool: authPool }) : createUnavailableSePaySettingsRepository();
const sepayCredentialService = createSePayCredentialService({ env: process.env });
const sepayPaymentRepository = createSePayPaymentRepository({ pool: authPool });
const sepaySettingsService = createSePaySettingsService({ settingsRepository: sepaySettingsRepository, credentialService: sepayCredentialService, env: process.env, audit: securityAudit });
const sepayWebhookService = createSePayWebhookService({ settingsRepository: sepaySettingsRepository, credentialService: sepayCredentialService, paymentRepository: sepayPaymentRepository, env: process.env, logger });
const googleSheetCredentialRepository = createGoogleSheetCredentialRepository({ settingsRepository: googleSheetSettingsRepository, env: process.env });
const googleSheetConnectionService = createGoogleSheetConnectionService({
  settingsRepository: googleSheetSettingsRepository,
  credentialRepository: googleSheetCredentialRepository,
  clientFactory: createGoogleSheetClientFactory(),
  env: process.env,
  audit: securityAudit,
});
const sheetSyncRepository = createSheetSyncRepository({ pool: authPool });
const variantAliasRepository = createVariantAliasRepository({ pool: authPool });
const fulfillmentBindingRepository = createFulfillmentBindingRepository({ pool: authPool });
const fulfillmentProfileRepository = createFulfillmentProfileRepository({ pool: authPool });
const variantAliasService = createVariantAliasService({
  aliasRepository: variantAliasRepository,
  sheetSyncRepository,
  canonicalRepository: canonicalCatalogRepository,
  providerRepository: providerOfferRepository,
  audit: securityAudit,
});
const fulfillmentBindingService = createFulfillmentBindingService({
  catalogReader: createCanonicalCatalogReader({
    env: process.env,
    canonicalRepository: canonicalCatalogRepository,
  }),
  providerRepository: providerOfferRepository,
  bindingRepository: fulfillmentBindingRepository,
  profileRepository: fulfillmentProfileRepository,
  audit: securityAudit,
});
const fulfillmentProfileService = createFulfillmentProfileService({
  catalogReader: createCanonicalCatalogReader({
    env: process.env,
    canonicalRepository: canonicalCatalogRepository,
  }),
  profileRepository: fulfillmentProfileRepository,
  audit: securityAudit,
});
const sheetSyncService = createSheetSyncService({
  repository: sheetSyncRepository,
  referenceClient: { readRows: () => googleSheetConnectionService.readRows() },
  canonicalRepository: canonicalCatalogRepository,
  providerRepository: providerOfferRepository,
  fulfillmentProfileRepository,
  commitService: catalogCommitService,
  variantAliasRepository,
});
const { repository: userRepository } = createAdminUserRepository({ env: process.env, uploadsDirectory: catalogUploadsDirectory, pool: authPool });
const { repository: sessionRepository, driver: sessionDriver, shared: sessionShared } = createSessionStore({ env: process.env, uploadsDirectory: catalogUploadsDirectory, pool: authPool });
const sessionCleanupService = createSessionCleanupService({ sessionRepository, env: process.env, logger });
const sessionHealthService = createSessionHealthService({ sessionRepository, driver: sessionDriver, shared: sessionShared, cleanupService: sessionCleanupService });
const sessionService = createSessionService({
  sessionRepository,
  sessionSecret: process.env.SESSION_SECRET ?? '',
  csrfSecret: process.env.CSRF_SECRET ?? '',
  env: process.env,
});
const authService = createAuthService({
  userRepository,
  sessionService,
  env: process.env,
  securityAudit,
});
await authService.ensureBootstrap();
const authCookies = createAuthCookies({ env: process.env });
const customerRepository = authPool ? createPostgresCustomerRepository({ pool: authPool }) : null;
const customerSessionRepository = authPool ? createPostgresCustomerSessionRepository({ pool: authPool }) : null;
const customerSessionService = customerSessionRepository ? createSessionService({
  sessionRepository: customerSessionRepository,
  sessionSecret: process.env.CUSTOMER_SESSION_SECRET ?? process.env.SESSION_SECRET ?? '',
  csrfSecret: process.env.CUSTOMER_CSRF_SECRET ?? process.env.CSRF_SECRET ?? '',
  env: {
    ...process.env,
    AUTH_SESSION_TTL_MINUTES: process.env.CUSTOMER_AUTH_SESSION_TTL_MINUTES ?? process.env.AUTH_SESSION_TTL_MINUTES,
    AUTH_ABSOLUTE_TTL_MINUTES: process.env.CUSTOMER_AUTH_ABSOLUTE_TTL_MINUTES ?? process.env.AUTH_ABSOLUTE_TTL_MINUTES,
  },
}) : null;
const customerSessionCleanupService = customerSessionRepository ? createSessionCleanupService({
  sessionRepository: customerSessionRepository,
  env: process.env,
  logger,
}) : null;
const customerTokenDelivery = createCustomerTokenDelivery({ env: process.env });
const customerProfileRepository = authPool ? createCustomerProfileRepository({ pool: authPool }) : null;
const customerProfileService = customerProfileRepository ? createCustomerProfileService({
  repository: customerProfileRepository,
  customerRepository,
  customerSessionRepository,
  tokenDelivery: customerTokenDelivery,
  env: process.env,
  securityAudit,
}) : null;
const customerAuthReadiness = createCustomerAuthReadiness({
  env: process.env,
  pool: authPool,
  customerRepository,
  customerSessionRepository,
  sessionService: customerSessionService,
  tokenDelivery: customerTokenDelivery,
});
const customerAuthService = customerRepository && customerSessionService ? createCustomerAuthService({
  customerRepository,
  customerSessionRepository,
  sessionService: customerSessionService,
  tokenDelivery: customerTokenDelivery,
  env: process.env,
  securityAudit,
}) : null;
const customerAuthCookies = createCustomerAuthCookies({ env: process.env });
const customerOrderRepository = authPool ? createPostgresOrderRepository({ pool: authPool }) : null;
const customerOrderService = customerOrderRepository && customerAuthService ? createCustomerOrderService({
  pool: authPool,
  orderRepository: customerOrderRepository,
  tokenDelivery: customerTokenDelivery,
  env: process.env,
}) : null;
const customerNotificationRepository = authPool ? createCustomerNotificationRepository({ pool: authPool }) : null;
const customerNotificationService = customerNotificationRepository ? createCustomerNotificationService({ repository: customerNotificationRepository, pool: authPool, env: process.env }) : null;
const notificationEventProcessor = customerNotificationService ? createNotificationEventProcessor({ notificationService: customerNotificationService, logger }) : null;
const supportStorageDirectory = path.join(__dirname, 'private', 'support_attachments');
const supportRepository = authPool ? createSupportRepository({ pool: authPool }) : null;
const supportAttachmentService = supportRepository ? createSupportAttachmentService({ repository: supportRepository, storageDirectory: supportStorageDirectory, env: process.env }) : null;
const customerDashboardRepository = customerOrderRepository ? createCustomerDashboardRepository({ orderRepository: customerOrderRepository }) : null;
const customerDashboardService = customerDashboardRepository && customerAuthService ? createCustomerDashboardService({
  repository: customerDashboardRepository,
  env: process.env,
}) : null;
const loyaltyRuleService = createLoyaltyRuleService({ pool: authPool, env: process.env });
const loyaltyLedgerRepository = authPool ? createLoyaltyLedgerRepository({ pool: authPool }) : null;
let loyaltyService = null;
let referralService = null;
let productionReadinessService;
const readinessDelegate = {
  evaluate: (...args) => productionReadinessService?.evaluate(...args) ?? Promise.resolve({ status: 'not_ready', adminWritesAllowed: false, writesEnabled: false, criticalChecksPassed: 0, criticalChecksTotal: 0, failedChecks: ['READINESS_INITIALIZING'], checkedAt: new Date().toISOString() }),
  assertWriteReady: (...args) => productionReadinessService?.assertWriteReady(...args) ?? Promise.resolve(null),
};

// Dynamic config store
const CONFIG_FILE = 'uploads/api_config.json';
let apiConfig = {
  merchantId: process.env.WORLDMOVE_MERCHANT_ID ?? '',
  deptId: process.env.WORLDMOVE_DEPT_ID ?? '',
  apiUrl: process.env.WORLDMOVE_API_URL ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: process.env.SMTP_PORT ?? '587',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'HICO eSIM <noreply@hico-esim.com>',
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const savedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    apiConfig = {
      ...apiConfig,
      ...(savedConfig.apiUrl ? { apiUrl: savedConfig.apiUrl } : {}),
      ...(savedConfig.smtpHost ? { smtpHost: savedConfig.smtpHost } : {}),
      ...(savedConfig.smtpPort ? { smtpPort: savedConfig.smtpPort } : {}),
      ...(savedConfig.smtpUser ? { smtpUser: savedConfig.smtpUser } : {}),
      ...(savedConfig.smtpFrom ? { smtpFrom: savedConfig.smtpFrom } : {}),
    };
  } catch (e) {
    console.error('Failed to load api_config.json, using defaults:', e.message);
  }
}

Object.defineProperties(apiConfig, {
  token: { enumerable: false, get: () => process.env.WORLDMOVE_TOKEN ?? '' },
  smtpPass: { enumerable: false, get: () => process.env.SMTP_PASSWORD ?? '' },
  openaiApiKey: { enumerable: false, get: () => process.env.OPENAI_API_KEY ?? '' },
});

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(apiConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save api_config.json:', e.message);
  }
}

app.use(createRequestId());
app.use(createRequestContextLogger({ logger }));
app.use(createSecurityHeaders({ env: process.env }));
app.use(createCorsPolicy({ env: process.env }));
app.use('/api/webhooks/worldmove', express.raw({ type: 'application/json', limit: `${webhookBodyLimitKb}kb` }));
app.use('/api/webhooks/sepay', express.raw({ type: 'application/json', limit: `${webhookBodyLimitKb}kb` }));
app.use('/api/webhooks/worldmove', (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Webhook payload quá lớn.', code: 'WEBHOOK_BODY_TOO_LARGE' });
  return next(error);
});
app.use(express.json({ limit: `${checkoutBodyLimitMb}mb` }));
app.use(express.urlencoded({ limit: `${checkoutBodyLimitMb}mb`, extended: true }));
app.use('/api/webhooks/sepay', createSePayWebhookRouter({ webhookService: sepayWebhookService }));
const publicUploadExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
app.use('/uploads', (req, res, next) => {
  if (!publicUploadExtensions.has(path.extname(req.path).toLowerCase())) return res.status(404).end();
  return next();
});
app.use('/uploads', express.static(catalogUploadsDirectory, { dotfiles: 'deny', index: false, fallthrough: false }));
app.use('/api/auth', createAuthRouter({ authService, sessionService, authCookies, env: process.env, securityAudit }));
app.use('/api/customer', createCustomerAuthRouter({
  customerAuthService,
  sessionService: customerSessionService,
  authCookies: customerAuthCookies,
  readiness: customerAuthReadiness,
  env: process.env,
  securityAudit,
}));
if (customerProfileService && customerAuthService && customerSessionService) app.use('/api/customer', createCustomerProfileRouter({
  customerAuthService,
  customerSessionService,
  readiness: customerAuthReadiness,
  profileService: customerProfileService,
  securityAudit,
}));
if (customerDashboardService) app.use('/api/customer', createCustomerDashboardRouter({
  customerAuthService,
  readiness: customerAuthReadiness,
  customerDashboardService,
}));
if (customerOrderService) app.use('/api/customer', createCustomerOrderRouter({
  customerAuthService,
  sessionService: customerSessionService,
  readiness: customerAuthReadiness,
  customerOrderService,
}));
app.get('/api/health/session-store', async (_req, res) => {
  const health = await sessionHealthService.getHealth();
  return res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
app.get('/api/health/customer-auth', async (_req, res) => {
  const health = await customerAuthReadiness.evaluate();
  return res.status(health.status === 'healthy' ? 200 : 503).json(health);
});
app.get('/api/health/customer-profile', async (_req, res) => {
  const auth = await customerAuthReadiness.evaluate();
  const profile = customerProfileService ? await customerProfileService.health() : { status: 'unavailable', persistence: 'none' };
  const healthy = auth.status === 'healthy' && (profile.status === 'healthy' || profile.status === 'disabled');
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'not_ready', auth: auth.status, profile });
});
app.get('/api/health/support', async (_req, res) => {
  const auth = await customerAuthReadiness.evaluate();
  const support = supportHealthService ? await supportHealthService.health() : { status: 'unavailable', enabled: false };
  const healthy = auth.status === 'healthy' && (support.status === 'healthy' || support.status === 'disabled');
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'not_ready', auth: auth.status, support });
});
app.get('/api/health/customer-platform', async (_req, res) => {
  const health = await customerPlatformHealthService.health();
  return res.status(health.status === 'healthy' ? 200 : 503).set('Cache-Control', 'no-store').json(health);
});
app.get('/api/health/customer-orders', async (_req, res) => {
  const auth = await customerAuthReadiness.evaluate();
  const orders = customerOrderRepository ? await customerOrderRepository.health() : { status: 'unavailable', persistence: 'none' };
  const healthy = auth.status === 'healthy' && orders.status === 'healthy';
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'not_ready', auth: auth.status, orders });
});
app.get('/api/health/customer-dashboard', async (_req, res) => {
  const auth = await customerAuthReadiness.evaluate();
  const dashboard = customerDashboardService ? await customerDashboardService.health() : { status: 'unavailable', persistence: 'none' };
  const healthy = auth.status === 'healthy' && dashboard.status === 'healthy';
  return res.status(healthy ? 200 : 503).json({ status: healthy ? 'healthy' : 'not_ready', auth: auth.status, dashboard });
});
app.get('/api/health/customer-assets', async (_req, res) => {
  const auth = await customerAuthReadiness.evaluate();
  const assets = customerAssetRepository ? await customerAssetRepository.health() : { status: 'unavailable', persistence: 'none' };
  const healthy = auth.status === 'healthy' && assets.status === 'healthy';
  const projectionReady = assets.status === 'healthy';
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'not_ready',
    auth: auth.status,
    assets,
    esimProjection: projectionReady,
    physicalSimProjection: projectionReady,
    deviceProjection: projectionReady,
    topupProjection: projectionReady,
    sensitiveReveal: projectionReady && Boolean(customerAssetRevealService),
    mockAssetsExposed: false,
  });
});
app.get('/api/health/loyalty', createLoyaltyHealthRouter({ loyaltyService: { health: () => loyaltyService?.health?.() ?? Promise.resolve({ status: 'disabled', enabled: false }) } }));
app.get('/api/health/referrals', async (_req, res) => {
  const health = await createReferralHealthService({ referralService }).health();
  return res.status(health.status === 'healthy' || health.status === 'disabled' ? 200 : 503).json(health);
});
app.get('/api/health/customer-notifications', async (_req, res) => {
  const health = await createCustomerNotificationHealthService({ notificationService: customerNotificationService }).health();
  return res.status(health.status === 'healthy' || health.status === 'disabled' ? 200 : 503).json(health);
});
app.get('/api/health/metrics', (_req, res) => res.json({ status: 'healthy', counters: metrics.snapshot() }));
app.get('/api/health/security', async (_req, res) => {
  const readiness = await readinessDelegate.evaluate();
  const ready = process.env.NODE_ENV !== 'production' || readiness.status === 'ready';
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'healthy' : 'not_ready',
    secureCookies: process.env.NODE_ENV === 'production',
    csrfConfigured: Boolean(process.env.CSRF_SECRET || process.env.NODE_ENV !== 'production'),
    corsAllowlistConfigured: Boolean(process.env.CORS_ALLOWED_ORIGINS || process.env.NODE_ENV !== 'production'),
    webhookSecretConfigured: Boolean(process.env.WORLDMOVE_WEBHOOK_SECRET || process.env.NODE_ENV !== 'production'),
    providerCredentialConfigured: Boolean(process.env.WORLDMOVE_TOKEN || process.env.NODE_ENV !== 'production'),
    dependencyGate: readiness.failedChecks?.includes('DEPENDENCY_GATE_PASS') ? 'fail' : 'pass',
  });
});
app.use('/api/admin',
  createAuthenticate({ authService, sessionService, securityAudit }),
  createCsrfProtection({ sessionService, securityAudit }),
  createRateLimiter({
    windowMs: Number.parseInt(process.env.RATE_LIMIT_ADMIN_WRITE_WINDOW_MS, 10) || 60_000,
    max: Number.parseInt(process.env.RATE_LIMIT_ADMIN_WRITE_MAX, 10) || 120,
    key: (req) => `${req.auth?.user.id ?? 'unknown'}:${req.ip || 'unknown'}`,
    audit: securityAudit,
  }),
  createAdminAuthorization({ securityReady: () => true, securityAudit }),
  createProductionWriteGuard({ readinessService: readinessDelegate, env: process.env }),
  createAdminRequestAudit({ securityAudit }),
);
app.use('/api/admin/auth', createAdminSecurityRouter({ sessionService, securityAudit }));
app.use('/api/admin', createGoogleSheetSettingsRouter({ settingsService: googleSheetConnectionService, sheetSyncService, securityAudit }));
app.use('/api/admin', createSePayAdminRouter({ settingsService: sepaySettingsService, paymentRepository: sepayPaymentRepository }));
app.use('/api/admin', createVariantAliasRouter({ service: variantAliasService }));
app.use('/api/admin', createFulfillmentProfileRouter({ service: fulfillmentProfileService }));
app.use('/api/admin', createFulfillmentBindingRouter({ service: fulfillmentBindingService }));
app.use('/api', createCatalogHealthRouter({ catalogHealthService }));
app.use('/api', createCatalogRouter({ catalogGuard, mediaAssetRepository, providerRepository: providerOfferRepository }));
app.use('/api', createSheetSyncRouter({ sheetSyncService, catalogGuard }));
app.use('/api', createProviderRouter());
app.use('/api', createReconciliationRouter());
app.use('/api', createCatalogMigrationRouter());
app.use('/api', createCatalogWriteRouter({ catalogWriteService, catalogGuard }));
app.use('/api', createCatalogBulkRouter({ catalogBulkService, catalogGuard }));
app.use('/api', createCatalogQueueRouter({ catalogQueueService, catalogGuard }));
app.use('/api', createCatalogPublishRouter({ catalogPublishService, catalogGuard }));
app.use('/api', createCatalogSheetImportRouter({ catalogGuard }));

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// In-memory data store
// Persistent Map Helper with auto-save Proxy
function createPersistentMap(filename, seedFn, { loadExisting = true } = {}) {
  const map = new Map();
  
  const save = () => {
    const filePath = path.join(__dirname, 'uploads', filename);
    try {
      fs.writeFileSync(filePath, JSON.stringify(Array.from(map.values()), null, 2), 'utf8');
    } catch (e) {
      console.error(`Failed to save persistent map to ${filename}:`, e);
    }
  };

  const load = () => {
    const filePath = path.join(__dirname, 'uploads', filename);
    if (loadExisting && fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach(item => {
            const key = item.id || item.code || item.email || item.iccid || item.qrId || item.ticketCode || item.orderId;
            if (key) map.set(key, item);
          });
          console.log(`Loaded ${map.size} items from persistent map: ${filename}`);
          return;
        }
      } catch (e) {
        console.error(`Failed to load persistent map from ${filename}:`, e);
      }
    }
    // Fallback to seed
    if (loadExisting && seedFn) {
      seedFn(map);
      save();
    }
  };

  load();

  return new Proxy(map, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        if (prop === 'set') {
          return function(key, val) {
            const result = value.apply(target, arguments);
            save();
            return result;
          };
        }
        if (prop === 'delete') {
          return function(key) {
            const result = value.apply(target, arguments);
            save();
            return result;
          };
        }
        if (prop === 'clear') {
          return function() {
            const result = value.apply(target, arguments);
            save();
            return result;
          };
        }
        return value.bind(target);
      }
      return value;
    }
  });
}

// In-memory data store with auto-persistence
const customerAccountMode = String(process.env.CUSTOMER_ACCOUNT_MODE ?? 'demo').toLowerCase();
const customerDemoFixturesEnabled = customerAccountMode === 'demo' && process.env.NODE_ENV !== 'production';
const manualQrsDb = createPersistentMap('manual_qrs.json', (m) => {
  m.set('qr-mock-1', {
    id: 'qr-mock-1',
    variantId: 'var-jp-15d-15gb',
    qrcode: 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg',
    assignedOrderId: null,
    createdAt: '01/06/2026 12:00'
  });
  m.set('qr-mock-2', {
    id: 'qr-mock-2',
    variantId: 'var-jp-15d-15gb',
    qrcode: 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg',
    assignedOrderId: null,
    createdAt: '01/06/2026 12:01'
  });
}, { loadExisting: customerDemoFixturesEnabled });

const esimsDb = createPersistentMap('esims.json', (m) => {
  const defaultIccid = '898520400001234567';
  m.set(defaultIccid, {
    iccid: defaultIccid,
    rcode: 'RC_JAPAN_MOCK',
    status: 'Đang hoạt động',
    productName: 'Japan eSIM 10GB - 15 Day',
    network: 'NTT Docomo',
    usedData: 3.58,
    totalData: 10,
    expiry: '24/05/2024',
    device: 'iPhone 14 Pro',
    qrcode: 'https://tfmshippingsys.fastmove.com.tw/tApi/images/redeem_sample.jpg',
    qrcodeContent: 'LPA:1$rsp.worldmove.com$RC_JAPAN_MOCK8985204000',
    pin1: '1111',
    puk1: '33334444',
    apnExplain: 'Carrier NTT Docomo APN: spmode.ne.jp'
  });
}, { loadExisting: customerDemoFixturesEnabled });

const ordersDb = createPersistentMap('orders.json', (m) => {
  m.set('#HICO-240512-0123', {
    orderId: '#HICO-240512-0123',
    email: 'son.nguyen@gmail.com',
    wmproductId: 'WM-e-JP-10GB',
    qty: 1,
    status: 'PROVISIONED',
    createdAt: '12/05/2024 10:15',
    items: [{ iccid: '898520400001234567', productName: 'Japan eSIM 10GB - 15 Day', redemptionCode: 'RC_JAPAN_MOCK' }]
  });
  m.set('#HICO-240428-0098', {
    orderId: '#HICO-240428-0098',
    email: 'son.nguyen@gmail.com',
    wmproductId: 'WM-e-KR-10GB',
    qty: 1,
    status: 'PROVISIONED',
    createdAt: '28/04/2024 16:40',
    items: [{ iccid: '898520400001234777', productName: 'eSIM Hàn Quốc 5GB - 10 Ngày', redemptionCode: 'RC_KOREA_MOCK' }]
  });
  m.set('#HICO-240415-0076', {
    orderId: '#HICO-240415-0076',
    email: 'son.nguyen@gmail.com',
    wmproductId: 'WM-e-TH-10GB',
    qty: 1,
    status: 'PROVISIONED',
    createdAt: '15/04/2024 09:20',
    items: [{ iccid: '898520400001234888', productName: 'eSIM Thái Lan 10GB - 15 Ngày', redemptionCode: 'RC_THAI_MOCK' }]
  });
  m.set('#HICO-240331-0055', {
    orderId: '#HICO-240331-0055',
    email: 'son.nguyen@gmail.com',
    wmproductId: 'WM-e-VN-3GB',
    qty: 1,
    status: 'CANCELLED',
    createdAt: '31/03/2024 14:10',
    items: []
  });
  m.set('#ESM-2024-0515-1268', {
    orderId: '#ESM-2024-0515-1268',
    email: 'minhanh@gmail.com',
    wmproductId: 'WM-e-EU-10GB',
    qty: 1,
    status: 'PROVISIONED',
    createdAt: '15/05/2024 09:44',
    items: [{ iccid: '898520400001234999', productName: 'eSIM Châu Âu 10GB - 15 Ngày', redemptionCode: 'RC_EU_MOCK' }]
  });
}, { loadExisting: customerDemoFixturesEnabled });

const legacyOrderRepository = customerAccountMode === 'real' && customerOrderRepository
  ? null
  : createOrderRepository({ filePath: path.join(__dirname, 'uploads', 'orders.json') });
const canonicalOrderRepository = customerOrderRepository ?? legacyOrderRepository;
const canonicalFulfillmentRepository = createFulfillmentRepository();
const canonicalFulfillmentIdempotencyRepository = createFulfillmentIdempotencyRepository();
const canonicalQrRepository = createManualQrRepository();
const canonicalInventoryRepository = createInventoryRepository();
const canonicalWebhookEventRepository = createWebhookEventRepository();
const customerAssetRepository = customerOrderRepository ? createCustomerAssetRepository({
  orderRepository: customerOrderRepository,
  fulfillmentRepository: canonicalFulfillmentRepository,
  env: process.env,
}) : null;
const customerAssetAuditRepository = customerRepository ? createCustomerAssetAuditRepository({
  customerRepository,
  securityAudit,
}) : null;
const customerAssetRevealService = customerAssetRepository ? createCustomerAssetRevealService({
  assetRepository: customerAssetRepository,
  auditRepository: customerAssetAuditRepository,
  env: process.env,
}) : null;
const supportService = supportRepository ? createSupportService({
  repository: supportRepository,
  orderRepository: customerOrderRepository,
  assetRepository: customerAssetRepository,
  attachmentService: supportAttachmentService,
  notificationEventProcessor,
  env: process.env,
  securityAudit,
}) : null;
const supportHealthService = supportService ? createSupportHealthService({ supportService, attachmentService: supportAttachmentService, env: process.env }) : null;
if (supportService && customerAuthService && customerSessionService) app.use('/api/customer', createSupportRouter({
  customerAuthService,
  customerSessionService,
  readiness: customerAuthReadiness,
  supportService,
  securityAudit,
}));
if (customerDashboardService && customerAssetRepository) customerDashboardService.setAssetSummaryService(customerAssetRepository);
loyaltyService = loyaltyLedgerRepository && customerOrderRepository ? createLoyaltyService({
  repository: loyaltyLedgerRepository,
  ruleService: loyaltyRuleService,
  orderRepository: customerOrderRepository,
  env: process.env,
  audit: securityAudit,
}) : null;
if (customerDashboardService && loyaltyService) customerDashboardService.setLoyaltyService(loyaltyService);
const referralRepository = authPool ? createReferralRepository({ pool: authPool }) : null;
const referralCodeService = referralRepository ? createReferralCodeService({ repository: referralRepository }) : null;
referralService = referralRepository && referralCodeService && loyaltyLedgerRepository && customerOrderRepository ? createReferralService({
  repository: referralRepository,
  codeService: referralCodeService,
  loyaltyRepository: loyaltyLedgerRepository,
  ruleService: loyaltyRuleService,
  orderRepository: customerOrderRepository,
  notificationEventProcessor,
  env: process.env,
  audit: securityAudit,
  logger,
}) : null;
if (customerDashboardService && customerNotificationService) customerDashboardService.setNotificationService(customerNotificationService);
if (customerDashboardService && referralService) customerDashboardService.setReferralService(referralService);
const customerPlatformHealthService = createCustomerPlatformHealthService({
  env: process.env,
  pool: authPool,
  customerAuthReadiness,
  customerOrderRepository,
  customerDashboardService,
  customerAssetRepository,
  loyaltyService,
  referralService,
  customerNotificationService,
  customerProfileService,
  supportHealthService,
});
const loyaltyEventProcessor = loyaltyService || referralService || notificationEventProcessor
  ? createLoyaltyEventProcessor({ loyaltyService, referralService, notificationEventProcessor, logger })
  : null;
const canonicalCatalogReader = createCanonicalCatalogReader({ env: process.env });
const canonicalFulfillmentService = createFulfillmentService({
  repository: canonicalFulfillmentRepository,
  idempotencyRepository: canonicalFulfillmentIdempotencyRepository,
  orderRepository: canonicalOrderRepository,
  qrRepository: canonicalQrRepository,
  inventoryRepository: canonicalInventoryRepository,
  eventRepository: canonicalWebhookEventRepository,
  providerClient: createWorldmoveClient({
    merchantId: process.env.WORLDMOVE_MERCHANT_ID || apiConfig.merchantId,
    deptId: process.env.WORLDMOVE_DEPT_ID || apiConfig.deptId,
    token: process.env.WORLDMOVE_TOKEN || apiConfig.token,
    apiUrl: process.env.WORLDMOVE_API_URL || apiConfig.apiUrl,
    timeoutMs: Number(process.env.PROVIDER_REQUEST_TIMEOUT_MS ?? 15000),
  }),
  loyaltyEventProcessor,
});
const canonicalOrderService = createOrderService({
  repository: canonicalOrderRepository,
  fulfillmentService: canonicalFulfillmentService,
});
const canonicalCheckoutService = createCheckoutService({
  env: process.env,
  catalogReader: canonicalCatalogReader,
  orderService: canonicalOrderService,
  idempotencyRepository: createCheckoutIdempotencyRepository(),
  fulfillmentBindingRepository,
  fulfillmentProfileRepository,
});
const canonicalCheckoutReadinessService = createCheckoutReadinessService({
  env: process.env,
  catalogReader: canonicalCatalogReader,
  fulfillmentBindingRepository,
  fulfillmentProfileRepository,
  inventoryRepository: canonicalInventoryRepository,
  manualQrRepository: canonicalQrRepository,
  providerOffersFile: path.join(catalogUploadsDirectory, 'provider_offers.json'),
  logger,
});
const canonicalCheckoutHealthService = createCheckoutHealthService({
  env: process.env,
  validatorDependencies: {
    catalogHealthService,
    catalogReader: canonicalCatalogReader,
    registry: canonicalFulfillmentService.registry,
    orderRepository: canonicalOrderRepository,
    fulfillmentRepository: canonicalFulfillmentRepository,
    checkoutIdempotencyRepository: createCheckoutIdempotencyRepository(),
    fulfillmentIdempotencyRepository: canonicalFulfillmentIdempotencyRepository,
    webhookReplayRepository: createWebhookReplayRepository(),
    webhookEventRepository: canonicalWebhookEventRepository,
    manualQrRepository: canonicalQrRepository,
    inventoryRepository: canonicalInventoryRepository,
    providerOffersFile: path.join(catalogUploadsDirectory, 'provider_offers.json'),
    bodyLimitConfigured: checkoutBodyLimitMb > 0 && webhookBodyLimitKb > 0,
    rateLimitConfigured: checkoutRateLimitPerMinute > 0,
  },
});
productionReadinessService = createProductionReadinessService({
  checks: createProductionReadinessChecks({
    env: process.env,
    sessionHealthService,
    userRepository,
    catalogHealthService,
    checkoutHealthService: canonicalCheckoutHealthService,
    customerAuthReadiness,
    customerProfileHealthService: customerProfileService,
    supportHealthService,
    loyaltyHealthService: loyaltyService,
    referralHealthService: createReferralHealthService({ referralService }),
    notificationHealthService: createCustomerNotificationHealthService({ notificationService: customerNotificationService }),
    customerPlatformHealthService,
    pool: authPool,
  }),
});
app.use('/api', createProductionReadinessRouter({ readinessService: productionReadinessService }));
app.use('/api/webhooks/worldmove', createWorldmoveWebhookRouter({
  fulfillmentService: canonicalFulfillmentService,
  replayRepository: createWebhookReplayRepository(),
  env: process.env,
  rateLimitPerMinute: checkoutRateLimitPerMinute,
}));
app.use('/api', createCheckoutHealthRouter({ checkoutHealthService: canonicalCheckoutHealthService }));
app.use('/api', createCheckoutRouter({
  checkoutService: canonicalCheckoutService,
  fulfillmentService: canonicalFulfillmentService,
  orderRepository: canonicalOrderRepository,
  catalogHealthService,
  canonicalRepository: createCanonicalCatalogRepository({ uploadsDirectory: catalogUploadsDirectory }),
  checkoutHealthService: canonicalCheckoutHealthService,
  checkoutReadinessService: canonicalCheckoutReadinessService,
  customerAuthService,
  env: process.env,
}));
if (customerAssetRepository && customerAssetRevealService && customerAuthService && customerSessionService) app.use('/api/customer', createCustomerAssetRouter({
  customerAuthService,
  sessionService: customerSessionService,
  readiness: customerAuthReadiness,
  assetRepository: customerAssetRepository,
  revealService: customerAssetRevealService,
  env: process.env,
  securityAudit,
}));
if (loyaltyService && customerAuthService) app.use('/api/customer', createCustomerLoyaltyRouter({
  customerAuthService,
  readiness: customerAuthReadiness,
  loyaltyService,
}));
if (referralService && customerAuthService && customerSessionService) app.use('/api/customer', createCustomerReferralRouter({
  customerAuthService,
  sessionService: customerSessionService,
  readiness: customerAuthReadiness,
  referralService,
  env: process.env,
  securityAudit,
}));
if (customerNotificationService && customerAuthService && customerSessionService) app.use('/api/customer', createCustomerNotificationRouter({
  customerAuthService,
  sessionService: customerSessionService,
  readiness: customerAuthReadiness,
  notificationService: customerNotificationService,
  securityAudit,
}));
if (loyaltyService) app.use('/api/admin', createLoyaltyAdminRouter({ loyaltyService }));
if (referralService) app.use('/api/admin', createReferralAdminRouter({ referralService }));
if (supportService) app.use('/api/admin', createSupportAdminRouter({ supportService }));
app.use('/api', createFulfillmentRouter({ orderRepository: canonicalOrderRepository }));
app.use('/api/user', (_req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT');
  return res.status(410).json({ error: 'API cũ đã ngừng hỗ trợ.', code: 'LEGACY_CUSTOMER_API_DISABLED' });
});

const devicesDb = createPersistentMap('devices.json', (m) => {
  m.set('device-wifi-mini', {
    id: 'device-wifi-mini',
    sku: 'HW-WIFI-MINI',
    name: 'Bộ phát WiFi 4G mini HICO',
    category: 'pocket',
    specs: ['Dung lượng Pin 3000mAh', 'Kết nối cùng lúc 10 thiết bị', 'Tốc độ ổn định lên tới 150Mbps'],
    price: 890000,
    compareAtPrice: 1200000,
    stock: 12,
    description: '<h2>Bộ phát WiFi di động mini HICO</h2><p>Thiết bị nhỏ gọn, dễ dàng mang đi du lịch hoặc công tác. Phù hợp cho nhóm bạn hoặc cá nhân sử dụng liên tục.</p>',
    badge: 'Bán chạy',
    bestSeller: true,
    image: '/images/device_wifi_mini.png'
  });
  m.set('device-wifi-home', {
    id: 'device-wifi-home',
    sku: 'HW-WIFI-HOME',
    name: 'Bộ phát WiFi 4G chuyên dụng HICO LTE',
    category: 'home',
    specs: ['Không giới hạn thời gian cắm điện', 'Kết nối cùng lúc 32 thiết bị', 'Tốc độ cực cao lên tới 300Mbps'],
    price: 1490000,
    compareAtPrice: 1800000,
    stock: 25,
    description: '<h2>Bộ phát WiFi cố định chuyên dụng HICO</h2><p>Phù hợp cho gia đình, xe khách, văn phòng nhỏ cần mạng internet tốc độ cao và hoạt động bền bỉ 24/7.</p>',
    badge: 'Khuyên dùng',
    bestSeller: false,
    image: '/images/device_wifi_home.png'
  });
  m.set('device-wifi-5g', {
    id: 'device-wifi-5g',
    sku: 'HW-WIFI-5G',
    name: 'Cục phát WiFi 5G Nighthawk Pro',
    category: 'pocket',
    specs: ['Công nghệ 5G thế hệ mới', 'Pin siêu khủng 5000mAh', 'Tốc độ download lên tới 1Gbps'],
    price: 3890000,
    compareAtPrice: 4500000,
    stock: 0,
    description: '<h2>Bộ phát WiFi di động 5G cao cấp</h2><p>Thiết bị đỉnh cao cho những ai yêu cầu tốc độ internet di động nhanh nhất hiện nay. Thích hợp đi du lịch các nước phát triển sóng 5G.</p>',
    badge: 'Cao cấp',
    bestSeller: false,
    image: '/images/device_wifi_5g.png'
  });
  m.set('device-usb-4g', {
    id: 'device-usb-4g',
    sku: 'HW-USB-4G',
    name: 'USB WiFi 4G cắm tẩu xe hơi HICO',
    category: 'pocket',
    specs: ['Cắm nguồn USB tiện lợi', 'Kết nối cùng lúc 8 thiết bị', 'Tốc độ 150Mbps nhỏ gọn như USB'],
    price: 490000,
    compareAtPrice: 650000,
    stock: 45,
    description: '<h2>USB phát WiFi 4G cắm nguồn tẩu xe hơi</h2><p>Giải pháp phát mạng cực kỳ tiện lợi cho xe hơi, taxi, chỉ cần cắm vào cổng USB hoặc tẩu sạc xe hơi là có WiFi dùng ngay.</p>',
    badge: 'Giá rẻ',
    bestSeller: false,
    image: '/images/device_usb_4g.png'
  });
});

const packagesDb = createPersistentMap('packages.json', (m) => {
  m.set('asia-pacific-esim', {
    id: 'asia-pacific-esim',
    sku: 'PKG-ASIA-PACIFIC',
    name: 'Gói Châu Á - Thái Bình Dương',
    coverage: '12 Quốc gia',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 990000,
    compareAtPrice: 1240000,
    wmproductId: 'WM-e-ASIA-20GB',
    network: 'Singtel / SoftBank / AIS',
    description: '<h2>eSIM Châu Á - Thái Bình Dương cao cấp</h2><p>Kết nối ổn định tại 12 quốc gia phổ biến châu Á. Phù hợp cho các chuyến du lịch liên tuyến tiện lợi.</p>',
    featured: true,
    iconType: 'region',
    variants: [
      { id: 'var-asia-7d-5gb', sku: 'PKG-ASIA-7D-5GB', dataLimit: '5 GB', duration: '7 Ngày', price: 370000, compareAtPrice: 490000, wmproductId: 'WM-e-ASIA-5GB' },
      { id: 'var-asia-15d-10gb', sku: 'PKG-ASIA-15D-10GB', dataLimit: '10 GB', duration: '15 Ngày', price: 620000, compareAtPrice: 740000, wmproductId: 'WM-e-ASIA-10GB' },
      { id: 'var-asia-30d-20gb', sku: 'PKG-ASIA-30D-20GB', dataLimit: '20 GB', duration: '30 Ngày', price: 990000, compareAtPrice: 1240000, wmproductId: 'WM-e-ASIA-20GB' },
    ]
  });
  m.set('global-esim', {
    id: 'global-esim',
    sku: 'PKG-GLOBAL',
    name: 'Gói Toàn Cầu Multi-Region',
    coverage: '85 Quốc gia',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 1890000,
    compareAtPrice: 2450000,
    wmproductId: 'WM-e-GLOBAL-20GB',
    network: 'T-Mobile / Vodafone / Orange',
    description: '<h2>eSIM Toàn cầu không giới hạn ranh giới</h2><p>Sự lựa chọn hoàn hảo cho các chuyến công tác hoặc du lịch dài ngày xuyên lục địa qua Mỹ, Âu, Á, Úc.</p>',
    featured: true,
    iconType: 'global',
    variants: [
      { id: 'var-global-15d-10gb', sku: 'PKG-GLOBAL-15D-10GB', dataLimit: '10 GB', duration: '15 Ngày', price: 1240000, compareAtPrice: 1650000, wmproductId: 'WM-e-GLOBAL-10GB' },
      { id: 'var-global-30d-20gb', sku: 'PKG-GLOBAL-30D-20GB', dataLimit: '20 GB', duration: '30 Ngày', price: 1890000, compareAtPrice: 2450000, wmproductId: 'WM-e-GLOBAL-20GB' },
    ]
  });
});

const destinationsDb = createPersistentMap('destinations.json', (m) => {
  m.set('jp-esim', {
    id: 'jp-esim',
    sku: 'DEST-JAPAN',
    name: 'Nhật Bản',
    flag: '🇯🇵',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 490000,
    compareAtPrice: 620000,
    wmproductId: 'WM-e-JP-10GB',
    image: '/images/dest_japan.png',
    network: 'NTT Docomo / SoftBank',
    featured: true,
    guide: '<h2>Cẩm nang du lịch Nhật Bản & Hướng dẫn kích hoạt</h2><p>eSIM Nhật Bản của HICO sử dụng hạ tầng mạng NTT Docomo và Softbank chất lượng cao nhất, tự động chuyển sóng tại vùng hẻo lánh. Quét mã QR trước khi bay và bật Roaming dữ liệu khi đáp xuống sân bay.</p>',
    variants: [
      { id: 'var-jp-5d-5gb', sku: 'DEST-JP-5D-5GB', dataLimit: '5 GB', duration: '5 Ngày', price: 240000, compareAtPrice: 320000, wmproductId: 'WM-e-JP-5GB', simType: 'leSIM' },
      { id: 'var-jp-7d-10gb', sku: 'DEST-JP-7D-10GB', dataLimit: '10 GB', duration: '7 Ngày', price: 370000, compareAtPrice: 490000, wmproductId: 'WM-e-JP-10GB', simType: 'eSIM' },
      { id: 'var-jp-15d-15gb', sku: 'DEST-JP-15D-15GB', dataLimit: '15 GB', duration: '15 Ngày', price: 490000, compareAtPrice: 620000, wmproductId: 'WM-e-JP-15GB', simType: 'manual' },
      { id: 'var-jp-30d-20gb', sku: 'DEST-JP-30D-20GB', dataLimit: '20 GB', duration: '30 Ngày', price: 740000, compareAtPrice: 990000, wmproductId: 'WM-e-JP-20GB', simType: 'physical' },
    ]
  });
  m.set('us-esim', {
    id: 'us-esim',
    sku: 'DEST-USA',
    name: 'Mỹ (Hoa Kỳ)',
    flag: '🇺🇸',
    dataLimit: '15 GB',
    duration: '30 Ngày',
    price: 890000,
    compareAtPrice: 1100000,
    wmproductId: 'WM-e-US-15GB',
    image: '/images/dest_usa.png',
    network: 'T-Mobile / AT&T',
    featured: true,
    guide: '<h2>Kích hoạt eSIM Mỹ dễ dàng</h2><p>Tương thích mạng 4G LTE tốc độ cao của T-Mobile và AT&T, mang lại độ phủ sóng rộng khắp các tiểu bang.</p>'
  });
  m.set('th-esim', {
    id: 'th-esim',
    sku: 'DEST-THAILAND',
    name: 'Thái Lan',
    flag: '🇹🇭',
    dataLimit: '15 GB',
    duration: '10 Ngày',
    price: 180000,
    compareAtPrice: 240000,
    wmproductId: 'WM-e-TH-15GB',
    image: '/images/dest_thailand.png',
    network: 'AIS / TrueMove H',
    featured: true,
    guide: '<h2>Vi vu Thái Lan cùng HICO eSIM</h2><p>Sử dụng mạng AIS tốt nhất Thái Lan. Nhận ngay 15GB tốc độ cao trong 10 ngày.</p>',
    variants: [
      { id: 'var-th-10d-15gb', sku: 'DEST-TH-10D-15GB', dataLimit: '15 GB', duration: '10 Ngày', price: 180000, compareAtPrice: 240000, wmproductId: 'WM-e-TH-15GB', simType: 'leSIM' },
      { id: 'var-th-5d-3gb', sku: 'DEST-TH-5D-3GB', dataLimit: '3 GB', duration: '5 Ngày', price: 110000, compareAtPrice: 150000, wmproductId: 'WM-e-TH-3GB', simType: 'eSIM' }
    ]
  });
  m.set('uk-esim', {
    id: 'uk-esim',
    sku: 'DEST-UK',
    name: 'Vương Quốc Anh',
    flag: '🇬🇧',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 650000,
    compareAtPrice: 850000,
    wmproductId: 'WM-e-UK-20GB',
    image: '/images/dest_uk.png',
    network: 'EE / Vodafone / O2',
    featured: false,
    guide: '<h2>Du lịch Anh Quốc thả ga</h2><p>Mạng EE tốc độ cao nhất xứ sương mù, thoải mái sử dụng bản đồ, gọi điện OTT.</p>'
  });
  m.set('sg-esim', {
    id: 'sg-esim',
    sku: 'DEST-SINGAPORE',
    name: 'Singapore',
    flag: '🇸🇬',
    dataLimit: '5 GB',
    duration: '7 Ngày',
    price: 220000,
    compareAtPrice: 290000,
    wmproductId: 'WM-e-SG-5GB',
    image: '/images/dest_singapore.png',
    network: 'Singtel / StarHub',
    featured: false,
    guide: '<h2>eSIM du lịch Singapore</h2><p>Kết nối nhà mạng số 1 đảo quốc sư tử Singtel.</p>'
  });
  m.set('kr-esim', {
    id: 'kr-esim',
    sku: 'DEST-KOREA',
    name: 'Hàn Quốc',
    flag: '🇰🇷',
    dataLimit: '10 GB',
    duration: '10 Ngày',
    price: 390000,
    compareAtPrice: 520000,
    wmproductId: 'WM-e-KR-10GB',
    image: '/images/dest_korea.png',
    network: 'SK Telecom / KT',
    featured: false,
    guide: '<h2>eSIM Hàn Quốc chất lượng cao</h2><p>Mạng SK Telecom cho sóng căng đét khắp Seoul, Busan.</p>'
  });
  m.set('fr-esim', {
    id: 'fr-esim',
    sku: 'DEST-FRANCE',
    name: 'Pháp',
    flag: '🇫🇷',
    dataLimit: '10 GB',
    duration: '15 Ngày',
    price: 520000,
    compareAtPrice: 690000,
    wmproductId: 'WM-e-FR-10GB',
    image: '/images/dest_france.png',
    network: 'Orange / SFR',
    featured: false,
    guide: '<h2>Khám phá nước Pháp thơ mộng</h2><p>Kết nối mạng Orange phủ sóng rộng nhất nước Pháp.</p>'
  });
  m.set('au-esim', {
    id: 'au-esim',
    sku: 'DEST-AUSTRALIA',
    name: 'Úc (Australia)',
    flag: '🇦🇺',
    dataLimit: '20 GB',
    duration: '30 Ngày',
    price: 790000,
    compareAtPrice: 990000,
    wmproductId: 'WM-e-AU-20GB',
    image: '/images/dest_australia.png',
    network: 'Telstra / Optus',
    featured: false,
    guide: '<h2>Khám phá xứ sở Kangaroo</h2><p>Sử dụng hạ tầng mạng Telstra phủ rộng nhất nước Úc.</p>'
  });
});

const articlesDb = createPersistentMap('articles.json', (m) => {
  m.set('art-1', {
    id: 'art-1',
    title: 'Kinh nghiệm du lịch Nhật Bản tự túc',
    image: '/images/art_travel_tips.png',
    date: '15/05/2024',
    content: '<h2>Cẩm nang vi vu xứ sở hoa anh đào tự túc</h2><p>Du lịch Nhật Bản tự túc là một trải nghiệm tuyệt vời. Để chuyến đi trọn vẹn, bạn nên chuẩn bị kỹ càng các vấn đề sau:</p><ul><li><b>Thủ tục visa:</b> Hãy xin visa sớm ít nhất 1 tháng trước khi đi.</li><li><b>Di chuyển:</b> Mua vé tàu JR Pass nếu đi liên tỉnh và sử dụng thẻ IC Card (Suica/Pasmo) cho tàu điện ngầm nội đô.</li><li><b>Mạng di động:</b> Mua ngay một eSIM du lịch Nhật Bản từ HICO để kết nối tức thì không cần tháo lắp SIM vật lý.</li></ul><p>Chúc bạn có một chuyến đi đáng nhớ!</p>'
  });
  m.set('art-2', {
    id: 'art-2',
    title: 'Hướng dẫn sử dụng eSIM HICO',
    image: '/images/art_esim_intro.png',
    date: '14/05/2024',
    content: '<h2>Các bước cài đặt và kích hoạt eSIM HICO nhanh chóng</h2><p>Cài đặt eSIM chỉ mất chưa đầy 3 phút với 3 bước đơn giản:</p><ol><li><b>Quét mã QR:</b> Vào Cài đặt di động trên điện thoại, chọn Thêm gói cước và quét mã QR do HICO cung cấp qua email.</li><li><b>Đặt tên cho gói:</b> Đặt tên nhãn eSIM là "HICO Du lịch" để dễ dàng quản lý.</li><li><b>Bật Roaming:</b> Khi hạ cánh tại quốc gia điểm đến, hãy chọn eSIM HICO làm đường truyền dữ liệu chính và bật tính năng Chuyển vùng dữ liệu (Data Roaming).</li></ol><p><i>Lưu ý:</i> Hãy kết nối Wi-Fi ổn định trong suốt quá trình quét mã QR.</p>'
  });
  m.set('art-3', {
    id: 'art-3',
    title: 'Top 10 điểm đến Châu Âu nên đi',
    image: '/images/art_sim_compare.png',
    date: '13/05/2024',
    content: '<h2>Khám phá những thành phố quyến rũ nhất Châu Âu mùa hè này</h2><p>Châu Âu luôn thu hút du khách nhờ bề dày lịch sử và phong cảnh lãng mạn. Dưới đây là những địa điểm bạn không thể bỏ qua:</p><p><b>1. Paris, Pháp:</b> Kinh đô ánh sáng với tháp Eiffel kỳ vĩ và những quán cà phê vỉa hè đầy chất thơ.</p><p><b>2. Rome, Ý:</b> Nơi lưu giữ những công trình kiến trúc cổ đại như Đấu trường La Mã Colosseum.</p><p><b>3. Santorini, Hy Lạp:</b> Hòn đảo thiên đường với những ngôi nhà mái vòm xanh đặc trưng bên bờ biển Địa Trung Hải.</p><p>Để kết nối mượt mà qua các nước khu vực Schengen, gói cước <b>eSIM Châu Âu</b> của HICO sẽ là sự lựa chọn tối ưu, hỗ trợ tự động chuyển nhà mạng khi di chuyển qua các biên giới quốc gia.</p>'
  });
});

const ticketsDb = createPersistentMap('tickets.json', (m) => {
  m.set('TK-240512-0456', {
    ticketCode: '#TK-240512-0456',
    title: 'Không quét được mã QR',
    customer: 'son.nguyen@gmail.com',
    status: 'Đang xử lý',
    updateTime: '12/05/2024 14:30',
    messages: [
      { sender: 'customer', text: 'Tôi quét mã QR trên iPhone 14 Pro nhưng máy báo lỗi không thể kích hoạt di động.', time: '12/05/2024 14:20' }
    ]
  });
}, { loadExisting: customerDemoFixturesEnabled });

const usersDb = createPersistentMap('users.json', (m) => {
  m.set('admin@hico.vn', { email: 'admin@hico.vn', role: 'Admin', status: 'Online', lastLogin: '15/05/2024 09:44', avatar: '/images/avatar_admin.png' });
  m.set('cskh@hico.vn', { email: 'cskh@hico.vn', role: 'CSKH', status: 'Online', lastLogin: '15/05/2024 09:22', avatar: '/images/avatar_thu_huong.png' });
  m.set('sales@hico.vn', { email: 'sales@hico.vn', role: 'Sales', status: 'Online', lastLogin: '15/05/2024 08:57', avatar: '/images/avatar_quoc_bao.png' });
  m.set('content@hico.vn', { email: 'content@hico.vn', role: 'Content', status: 'Offline', lastLogin: '14/05/2024 17:33', avatar: '/images/avatar_minh_anh.png' });
  m.set('kho@hico.vn', { email: 'kho@hico.vn', role: 'Warehouse', status: 'Online', lastLogin: '15/05/2024 08:31', avatar: '/images/avatar_admin.png' });
});

const customersDb = createPersistentMap('customers.json', (m) => {
  m.set('son.nguyen@gmail.com', { name: 'Nguyễn Sơn', phone: '+84 912 345 678', email: 'son.nguyen@gmail.com', status: 'Hoạt động', createdAt: '10/05/2026' });
  m.set('minhanh@gmail.com', { name: 'Nguyễn Minh Anh', phone: '+84 987 654 321', email: 'minhanh@gmail.com', status: 'Hoạt động', createdAt: '11/05/2026' });
}, { loadExisting: customerDemoFixturesEnabled });

const promosDb = createPersistentMap('promos.json', (m) => {
  m.set('HICO50', { code: 'HICO50', discount: 50, description: 'Giảm giá 50% cho toàn bộ sản phẩm', expiry: '31/12/2026', status: 'Hoạt động' });
  m.set('HICONEW', { code: 'HICONEW', discount: 10, description: 'Giảm giá 10% cho thành viên mới', expiry: '31/12/2026', status: 'Hoạt động' });
  m.set('SUMMER20', { code: 'SUMMER20', discount: 20, description: 'Khuyến mãi hè rực rỡ giảm 20%', expiry: '31/08/2026', status: 'Hoạt động' });
});

const reviewsDb = createPersistentMap('reviews.json', (m) => {
  m.set('rev-1', { id: 'rev-1', productId: 'jp-esim', productName: 'Nhật Bản', rating: 5, userName: 'Quốc Anh', userPhone: '0987654321', userEmail: 'quocanh@gmail.com', content: 'Sóng rất khỏe ở Tokyo và Kyoto, kết nối mượt mà. Kích hoạt QR code nhanh chóng trước khi bay.', images: ['/images/japan_fuji.png'], status: 'approved', createdAt: '28/05/2026' });
  m.set('rev-2', { id: 'rev-2', productId: 'jp-esim', productName: 'Nhật Bản', rating: 4, userName: 'Thu Trang', userPhone: '0912345678', userEmail: 'thutrang@gmail.com', content: 'Dùng tốt, kích hoạt nhanh. Khi lên vùng núi cao gần Phú Sĩ đôi lúc hơi chập chờn nhưng ở phố rất ổn định.', images: [], status: 'approved', createdAt: '25/05/2026' });
  m.set('rev-3', { id: 'rev-3', productId: 'th-esim', productName: 'Thái Lan', rating: 5, userName: 'Hương Giang', userPhone: '0966778899', userEmail: 'giang.huong@gmail.com', content: 'eSIM Thái Lan dùng cực ổn định ở Bangkok. Rẻ hơn và tiện hơn nhiều so với xếp hàng mua sim vật lý ở sân bay.', images: [], status: 'approved', createdAt: '20/05/2026' });
  m.set('rev-4', { id: 'rev-4', productId: 'us-esim', productName: 'Hoa Kỳ', rating: 5, userName: 'Minh Tuấn', userPhone: '0905556677', userEmail: 'tuanminh@gmail.com', content: 'Mạng T-Mobile chạy vù vù ở New York và San Francisco. Cực kỳ hài lòng.', images: [], status: 'approved', createdAt: '18/05/2026' });
  m.set('rev-5', { id: 'rev-5', productId: 'jp-esim', productName: 'Nhật Bản', rating: 5, userName: 'Sơn Nguyễn', userPhone: '0912345678', userEmail: 'son.nguyen@gmail.com', content: 'Rất tiện lợi, quét mã là dùng ngay. Đã test ở Osaka sóng căng đét.', images: [], status: 'approved', createdAt: '29/05/2026' });
  m.set('rev-6', { id: 'rev-6', productId: 'jp-esim', productName: 'Nhật Bản', rating: 5, userName: 'Khánh Vy', userPhone: '0977889900', userEmail: 'khanhvy@gmail.com', content: 'Đánh giá thử nghiệm chờ duyệt: eSIM dùng cực kỳ tốt, hỗ trợ kỹ thuật nhanh!', images: [], status: 'pending', createdAt: '01/06/2026' });
});

// SHA1 encryption helper
function calculateSha1(content) {
  return CryptoJS.SHA1(content).toString(CryptoJS.enc.Hex).toUpperCase();
}

console.log('=== HICO BACKEND SERVER ACTIVE ===');
console.log('Listening on Port:', PORT);

// === CRUD REST ENDPOINTS FOR ADMIN ===

// 1. Orders
app.get('/api/admin/orders', (req, res) => {
  res.json(Array.from(ordersDb.values()));
});

app.put('/api/admin/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = ordersDb.get(id);
  if (order) {
    Object.assign(order, req.body);
    ordersDb.set(id, order);
    return res.json(order);
  }
  res.status(404).json({ error: 'Order not found' });
});

app.post('/api/admin/orders/trigger-activation', async (req, res) => {
  const { orderId } = req.body;
  const order = ordersDb.get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  console.log(`[HICO ADMIN] Manually triggering activation flow for order ${orderId}`);
  
  // Call Worldmove buy eSIM endpoint on simulator directly
  const email = order.email;
  const wmproductId = order.wmproductId || 'WM-e-JP-10GB';
  const qty = order.qty || 1;
  const prodSum = wmproductId + qty;
  const encStr = calculateSha1(apiConfig.merchantId + apiConfig.deptId + email + prodSum + apiConfig.token);

  try {
    const payload = {
      merchantId: apiConfig.merchantId,
      deptId: apiConfig.deptId,
      email,
      prodList: [{ wmproductId, qty }],
      systemMail: false,
      encStr
    };
    const wmResponse = await axios.post(`${apiConfig.apiUrl}/Api/SOrder/mybuyesim`, payload);
    res.json({ success: true, originalResponse: wmResponse.data });
  } catch (error) {
    res.status(500).json({ error: `Connection failed: ${error.message}` });
  }
});

// 2. Devices (Hardware)
app.get('/api/admin/devices', (req, res) => {
  res.json(Array.from(devicesDb.values()));
});

app.post('/api/admin/devices', async (req, res) => {
  try {
    const { id, sku, name, category, specs, price, compareAtPrice, stock, description, image, imageMediaId, badge, bestSeller } = await resolvePublicMediaInput(req.body);
    const newId = id || 'device-' + Date.now();
    const device = {
      id: newId,
      sku: sku || 'HW-' + newId.toUpperCase(),
      name,
      category,
      specs: Array.isArray(specs) ? specs : (specs ? specs.split('\n') : []),
      price: parseInt(price),
      compareAtPrice: compareAtPrice ? parseInt(compareAtPrice) : null,
      stock: stock !== undefined ? parseInt(stock) : 50,
      description: description || '',
      badge,
      bestSeller: !!bestSeller,
      image,
      imageMediaId: imageMediaId || null,
    };
    devicesDb.set(newId, device);
    return res.json(device);
  } catch (error) {
    return res.status(error.status ?? 500).json({ error: error.status === 400 ? error.message : 'Không thể lưu hình ảnh thiết bị.', code: error.code ?? 'DEVICE_WRITE_FAILED' });
  }
});

app.put('/api/admin/devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const dev = devicesDb.get(id);
    if (dev) {
      const resolvedInput = await resolvePublicMediaInput(req.body);
      const specsInput = resolvedInput.specs;
      const updatedDev = {
        ...dev,
        ...resolvedInput,
        price: resolvedInput.price ? parseInt(resolvedInput.price) : dev.price,
        compareAtPrice: resolvedInput.compareAtPrice !== undefined ? (resolvedInput.compareAtPrice ? parseInt(resolvedInput.compareAtPrice) : null) : dev.compareAtPrice,
        stock: resolvedInput.stock !== undefined ? parseInt(resolvedInput.stock) : dev.stock,
        specs: Array.isArray(specsInput) ? specsInput : (specsInput ? specsInput.split('\n') : dev.specs)
      };
      devicesDb.set(id, updatedDev);
      return res.json(updatedDev);
    }
    return res.status(404).json({ error: 'Device not found', code: 'DEVICE_NOT_FOUND' });
  } catch (error) {
    return res.status(error.status ?? 500).json({ error: error.status === 400 ? error.message : 'Không thể lưu hình ảnh thiết bị.', code: error.code ?? 'DEVICE_WRITE_FAILED' });
  }
});

app.delete('/api/admin/devices/:id', (req, res) => {
  devicesDb.delete(req.params.id);
  res.json({ success: true });
});

// 3-4. Legacy packages and destinations compatibility adapter
app.use('/api', createLegacyCatalogRouter({
  destinationsStore: destinationsDb,
  packagesStore: packagesDb,
  catalogGuard,
  mediaAssetRepository,
}));

// 5. Articles
// Public endpoint for articles (filtered by status & scheduled date)
app.get('/api/articles', (req, res) => {
  try {
    const now = new Date();
    const allArticles = Array.from(articlesDb.values());
    const publishedArticles = allArticles.filter(art => {
      // Default to published if status is not defined
      if (!art.status || art.status === 'published') return true;
      if (art.status === 'draft') return false;
      if (art.status === 'scheduled') {
        return art.scheduledDate && new Date(art.scheduledDate) <= now;
      }
      return false;
    });
    res.json(publishedArticles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/articles', (req, res) => {
  res.json(Array.from(articlesDb.values()));
});

// AI generation endpoint
app.post('/api/admin/articles/generate-ai', async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tiêu đề bài viết!' });
  }

  if (!apiConfig.openaiApiKey) {
    return res.status(400).json({ error: 'Chưa cấu hình OpenAI API Key trong Cài đặt hệ thống!' });
  }

  try {
    const systemPrompt = `You are a professional SEO copywriter for HICO, a premium eSIM provider.
Generate a comprehensive, engaging, and highly SEO-optimized travel or technology article in Vietnamese based on the user's title/keyword.
The response must be a valid JSON object with the following structure:
{
  "content": "Detailed HTML content of the article (use headings <h2>/<h3>, clean paragraphs, bullet points, no <html>/<body> tags, only clean content HTML tags)",
  "seoTitle": "A catchy, SEO-optimized title (50-60 characters)",
  "seoDescription": "A compelling meta description (150-160 characters)",
  "seoKeywords": "Comma-separated SEO keywords",
  "imagePrompt": "A highly descriptive, English prompt for DALL-E to generate a beautiful, realistic travel or technology banner image matching the article topic."
}`;

    let responseJson = null;
    try {
      const chatRes = await axios.post(`${apiConfig.openaiApiUrl}/chat/completions`, {
        model: apiConfig.openaiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Viết bài với tiêu đề: "${title}"` }
        ],
        response_format: { type: "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      const text = chatRes.data.choices[0].message.content;
      responseJson = JSON.parse(text);
    } catch (e) {
      console.log("JSON mode failed or unsupported, trying fallback...", e.message);
      const chatRes = await axios.post(`${apiConfig.openaiApiUrl}/chat/completions`, {
        model: apiConfig.openaiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Viết bài với tiêu đề: "${title}"` }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      const text = chatRes.data.choices[0].message.content;
      let cleanText = text.trim();
      if (cleanText.includes('```json')) {
        cleanText = cleanText.split('```json')[1].split('```')[0].trim();
      } else if (cleanText.includes('```')) {
        cleanText = cleanText.split('```')[1].split('```')[0].trim();
      }
      responseJson = JSON.parse(cleanText);
    }

    if (!responseJson || !responseJson.content) {
      throw new Error("Không thể tạo nội dung từ AI.");
    }

    // 2. Generate Image via OpenAI DALL-E / image API
    let imageUrl = '';
    try {
      const imageRes = await axios.post(`${apiConfig.openaiApiUrl}/images/generations`, {
        model: apiConfig.openaiImageModel,
        prompt: responseJson.imagePrompt || `A beautiful travel photo representing: ${title}`,
        n: 1,
        size: "1024x1024"
      }, {
        headers: {
          'Authorization': `Bearer ${apiConfig.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      imageUrl = imageRes.data.data[0].url;
    } catch (e) {
      console.error("Image generation failed:", e.message);
    }

    // 3. Download image locally
    let localImagePath = '/images/art_esim_intro.png';
    let generatedImageMediaId = null;
    if (imageUrl) {
      try {
        const downloadRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const asset = await mediaAssetRepository.createFromUpload({
          upload: { buffer: Buffer.from(downloadRes.data), filename: `ai_image_${Date.now()}.png`, type: 'image/png' },
          originalName: `${title.slice(0, 180)}.png`,
          createdBy: req.auth?.user?.id,
        });
        generatedImageMediaId = asset.id;
        localImagePath = asset.publicUrl;
      } catch (e) {
        console.error("Failed to download generated image:", e.message);
      }
    }

    res.json({
      content: responseJson.content,
      image: localImagePath,
      imageMediaId: generatedImageMediaId,
      seoTitle: responseJson.seoTitle || '',
      seoDescription: responseJson.seoDescription || '',
      seoKeywords: responseJson.seoKeywords || ''
    });

  } catch (e) {
    console.error("AI Generation endpoint error:", e.message);
    res.status(500).json({ error: `Lỗi kết nối OpenAI: ${e.message}` });
  }
});

app.post('/api/admin/articles', async (req, res) => {
  try {
    const { title, category, image, imageMediaId, date, content, seoTitle, seoDescription, seoKeywords, status, scheduledDate } = await resolvePublicMediaInput(req.body);
    const id = 'art-' + Date.now();
    const art = {
      id,
      title,
      category: typeof category === 'string' ? category.trim() : '',
      image: image || '/images/art_esim_intro.png',
      imageMediaId: imageMediaId || null,
      date: date || new Date().toLocaleDateString('vi-VN'),
      content: content || '',
      seoTitle: seoTitle || '',
      seoDescription: seoDescription || '',
      seoKeywords: seoKeywords || '',
      status: status || 'published',
      scheduledDate: scheduledDate || ''
    };
    articlesDb.set(id, art);
    return res.json(art);
  } catch (error) {
    return res.status(error.status ?? 500).json({ error: error.status === 400 ? error.message : 'Không thể lưu hình ảnh bài viết.', code: error.code ?? 'ARTICLE_WRITE_FAILED' });
  }
});

app.delete('/api/admin/articles/:id', (req, res) => {
  articlesDb.delete(req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const art = articlesDb.get(id);
    if (art) {
      const updated = {
        ...art,
        ...(await resolvePublicMediaInput(req.body)),
      };
      articlesDb.set(id, updated);
      return res.json(updated);
    }
    return res.status(404).json({ error: 'Article not found', code: 'ARTICLE_NOT_FOUND' });
  } catch (error) {
    return res.status(error.status ?? 500).json({ error: error.status === 400 ? error.message : 'Không thể lưu hình ảnh bài viết.', code: error.code ?? 'ARTICLE_WRITE_FAILED' });
  }
});

// 6. Support Tickets
app.get('/api/admin/tickets', (req, res) => {
  res.json(Array.from(ticketsDb.values()));
});

app.put('/api/admin/tickets/:id', (req, res) => {
  const { id } = req.params;
  const { status, reply } = req.body;
  const ticket = ticketsDb.get(id);
  if (ticket) {
    if (status) ticket.status = status;
    if (reply) {
      ticket.messages.push({
        sender: 'admin',
        text: reply,
        time: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN')
      });
    }
    ticket.updateTime = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN');
    ticketsDb.set(id, ticket);
    return res.json(ticket);
  }
  res.status(404).json({ error: 'Ticket not found' });
});

// 7. System Personnel
app.get('/api/admin/users', (req, res) => {
  res.json(Array.from(usersDb.values()));
});

app.post('/api/admin/users', (req, res) => {
  const { email, role, status } = req.body;
  const user = {
    email,
    role,
    status: status || 'Offline',
    lastLogin: 'Chưa đăng nhập',
    avatar: '/images/avatar_admin.png'
  };
  usersDb.set(email, user);
  res.json(user);
});

app.delete('/api/admin/users/:email', (req, res) => {
  usersDb.delete(req.params.email);
  res.json({ success: true });
});

// Registered Customers APIs
app.get('/api/admin/customers', (req, res) => {
  res.json(Array.from(customersDb.values()));
});

app.post('/api/admin/customers', (req, res) => {
  const { name, phone, email, status } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Missing name or email' });
  }
  const customer = {
    name,
    phone: phone || '',
    email,
    status: status || 'Hoạt động',
    createdAt: new Date().toLocaleDateString('vi-VN')
  };
  customersDb.set(email, customer);
  res.json(customer);
});

app.put('/api/admin/customers/:email', (req, res) => {
  const { email } = req.params;
  const customer = customersDb.get(email);
  if (customer) {
    const { name, phone, status } = req.body;
    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (status) customer.status = status;
    customersDb.set(email, customer);
    return res.json(customer);
  }
  res.status(404).json({ error: 'Customer not found' });
});

app.delete('/api/admin/customers/:email', (req, res) => {
  const { email } = req.params;
  if (customersDb.has(email)) {
    customersDb.delete(email);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Customer not found' });
});

// Promotions (Promos) APIs
app.get('/api/admin/promos', (req, res) => {
  res.json(Array.from(promosDb.values()));
});

app.post('/api/admin/promos', (req, res) => {
  const { code, discount, description, expiry, status } = req.body;
  if (!code || !discount) {
    return res.status(400).json({ error: 'Missing code or discount' });
  }
  const cleanCode = code.toUpperCase();
  const newPromo = {
    code: cleanCode,
    discount: parseFloat(discount) || 0,
    description: description || '',
    expiry: expiry || 'Vô thời hạn',
    status: status || 'Hoạt động'
  };
  promosDb.set(cleanCode, newPromo);
  res.json(newPromo);
});

app.put('/api/admin/promos/:code', (req, res) => {
  const { code } = req.params;
  const promo = promosDb.get(code.toUpperCase());
  if (promo) {
    const { discount, description, expiry, status } = req.body;
    if (discount !== undefined) promo.discount = parseFloat(discount);
    if (description !== undefined) promo.description = description;
    if (expiry !== undefined) promo.expiry = expiry;
    if (status !== undefined) promo.status = status;
    promosDb.set(code.toUpperCase(), promo);
    return res.json(promo);
  }
  res.status(404).json({ error: 'Promo not found' });
});

app.delete('/api/admin/promos/:code', (req, res) => {
  const { code } = req.params;
  if (promosDb.has(code.toUpperCase())) {
    promosDb.delete(code.toUpperCase());
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Promo not found' });
});

app.get('/api/promos/validate/:code', (req, res) => {
  const { code } = req.params;
  const promo = promosDb.get(code.toUpperCase());
  if (promo && promo.status === 'Hoạt động') {
    return res.json({ success: true, discount: promo.discount / 100 });
  }
  res.status(404).json({ success: false, error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
});

// 8. API Configuration Settings
const MASKED_SECRET = '********';
const getSafeApiConfig = () => ({
  ...apiConfig,
  worldmoveConfigured: Boolean(process.env.WORLDMOVE_MERCHANT_ID && process.env.WORLDMOVE_DEPT_ID && process.env.WORLDMOVE_TOKEN),
  smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  token: process.env.WORLDMOVE_TOKEN ? MASKED_SECRET : '',
  smtpPass: process.env.SMTP_PASSWORD ? MASKED_SECRET : '',
});
const publicRouteResolver = createPublicRouteResolver({
  env: process.env,
  articleProvider: async () => Array.from(articlesDb.values()),
});
const seoRouter = createSeoRouter({ resolver: publicRouteResolver, env: process.env });
app.use('/api', seoRouter);
app.use('/', seoRouter);

app.get('/api/admin/config', (req, res) => {
  res.json(getSafeApiConfig());
});

app.put('/api/admin/config', (req, res) => {
  const { apiUrl, smtpHost, smtpPort, smtpUser, smtpFrom } = req.body;
  if (apiUrl !== undefined) apiConfig.apiUrl = apiUrl;
  if (smtpHost !== undefined) apiConfig.smtpHost = smtpHost;
  if (smtpPort !== undefined) apiConfig.smtpPort = smtpPort;
  if (smtpUser !== undefined) apiConfig.smtpUser = smtpUser;
  if (smtpFrom !== undefined) apiConfig.smtpFrom = smtpFrom;
  
  saveConfig();
  console.log('[HICO] API configuration updated dynamically.');
  res.json({ success: true, config: getSafeApiConfig() });
});

// === EMAIL AND MANUAL QR SERVICES ===

async function sendEmailHelper(to, subject, htmlContent) {
  console.log('[EMAIL SERVICE] Delivery requested.');
  
  const logEntry = `[${new Date().toISOString()}] Email delivery requested; content is not persisted.\n`;
  try {
    fs.appendFileSync('uploads/emails_sent_log.txt', logEntry, 'utf-8');
  } catch (e) {
    console.error('Failed to write to emails_sent_log.txt:', e.message);
  }

  if (!apiConfig.smtpHost || !apiConfig.smtpUser || !process.env.SMTP_PASSWORD) {
    console.log('[EMAIL SERVICE] SMTP not fully configured. Delivery request was recorded without content.');
    return { success: true, logged: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: apiConfig.smtpHost,
      port: parseInt(apiConfig.smtpPort) || 587,
      secure: parseInt(apiConfig.smtpPort) === 465,
      auth: {
        user: apiConfig.smtpUser,
        pass: process.env.SMTP_PASSWORD
      }
    });

    const info = await transporter.sendMail({
      from: apiConfig.smtpFrom || apiConfig.smtpUser,
      to,
      subject,
      html: htmlContent
    });

    console.log('[EMAIL SERVICE] Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL SERVICE] SMTP send failed:', error.message);
    return { success: false, error: error.message };
  }
}

function constructEsimEmailHtml(orderId, productName, qrUrl, qrContent) {
  const finalQrUrl = qrUrl ? (qrUrl.startsWith('http') ? qrUrl : 'http://localhost:5000' + qrUrl) : null;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #edf2f7; padding-bottom: 20px;">
        <h1 style="color: #2b6cb0; font-size: 28px; margin: 0 0 10px 0; font-weight: 800; letter-spacing: -0.5px;">HICO eSIM</h1>
        <p style="color: #4a5568; font-size: 16px; margin: 0; font-weight: 500;">Cảm ơn bạn đã lựa chọn dịch vụ của chúng tôi!</p>
      </div>
      
      <div style="margin-bottom: 24px; background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); padding: 18px; border-radius: 8px; border-left: 4px solid #2b6cb0;">
        <p style="margin: 0 0 8px 0; font-size: 15px;"><strong>Mã đơn hàng:</strong> <span style="font-family: monospace; color: #2d3748; font-size: 16px;">${orderId}</span></p>
        <p style="margin: 0; font-size: 15px;"><strong>Gói cước của bạn:</strong> <span style="color: #2d3748; font-weight: 600;">${productName}</span></p>
      </div>
      
      ${finalQrUrl ? `
      <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f7fafc; border-radius: 8px; border: 1px dashed #cbd5e0;">
        <p style="margin-top: 0; font-size: 16px; font-weight: 600; color: #2d3748;">MÃ QR KÍCH HOẠT eSIM</p>
        <img src="${finalQrUrl}" alt="eSIM QR Code" style="max-width: 220px; height: auto; border: 4px solid #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-radius: 8px;" />
        ${qrContent ? `<p style="margin: 15px 0 0 0; font-family: monospace; font-size: 12px; color: #718096; word-break: break-all; background: #edf2f7; padding: 8px 12px; border-radius: 4px;">LPA: ${qrContent}</p>` : ''}
      </div>
      ` : `
      <div style="text-align: center; margin: 30px 0; padding: 25px; background: #fffaf0; border-radius: 8px; border: 1px solid #feebc8;">
        <p style="margin: 0; font-size: 15px; color: #dd6b20; font-weight: 600;">Đơn hàng của bạn đang được cấp phát hoặc vận chuyển.</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #7b341e;">Thông tin chi tiết sẽ được gửi tiếp trong email sau.</p>
      </div>
      `}
      
      <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        <h3 style="color: #2d3748; font-size: 16px; margin: 0 0 12px 0; font-weight: 700;">HƯỚNG DẪN CÀI ĐẶT NHANH:</h3>
        <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #4a5568; line-height: 1.6;">
          <li style="margin-bottom: 8px;">Mở <strong>Cài đặt</strong> di động trên thiết bị của bạn.</li>
          <li style="margin-bottom: 8px;">Chọn <strong>Di động (Cellular)</strong> > ấn <strong>Thêm eSIM (Add Cellular Plan)</strong>.</li>
          <li style="margin-bottom: 8px;">Chọn <strong>Sử dụng mã QR (Use QR Code)</strong> và quét mã hình ảnh ở trên.</li>
          <li style="margin-bottom: 8px;">Thiết lập tên nhãn eSIM và bật <strong>Chuyển vùng dữ liệu (Data Roaming)</strong> khi tới điểm đến để kích hoạt kết nối internet.</li>
        </ol>
      </div>
      
      <div style="margin-top: 30px; background-color: #ebf8ff; border-radius: 8px; padding: 15px; border: 1px solid #bee3f8;">
        <p style="margin: 0; font-size: 13px; color: #2b6cb0; line-height: 1.5; text-align: center;">
          <strong>Cần hỗ trợ?</strong> Liên hệ hotline CSKH của chúng tôi tại <span style="font-weight: 700;">cskh@hico.vn</span> hoặc truy cập Dashboard của bạn để theo dõi tình trạng gói cước trực tiếp.
        </p>
      </div>
      
      <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 15px;">
        <p style="margin: 0 0 5px 0;">HICO eSIM - Kết nối không giới hạn toàn cầu</p>
        <p style="margin: 0;">© 2026 HICO. All rights reserved.</p>
      </div>
    </div>
  `;
}

// REST Endpoints for Manual QR Code Pool
app.get('/api/admin/manual-qrs', (req, res) => {
  res.json(Array.from(manualQrsDb.values()));
});

app.post('/api/admin/manual-qrs/upload', (req, res) => {
  try {
    const { variantId, base64Data } = req.body;
    if (!variantId || !base64Data) {
      return res.status(400).json({ error: 'Missing variantId or image data', code: 'UPLOAD_INVALID' });
    }
    const upload = parseImageUpload({ base64Data, maxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024) });
    const uniqueName = `qr_${upload.filename}`;
    const destPath = safeUploadPath(path.join(__dirname, 'uploads'), uniqueName);
    fs.writeFileSync(destPath, upload.buffer, { flag: 'wx', mode: 0o640 });
    const url = `/uploads/${uniqueName}`;
    
    const id = 'qr-' + Date.now();
    const newQr = {
      id,
      variantId,
      qrcode: url,
      assignedOrderId: null,
      createdAt: new Date().toLocaleString('vi-VN')
    };
    manualQrsDb.set(id, newQr);
    console.log(`[HICO MANUAL QR] QR code loaded to pool for variant ${variantId}: ${uniqueName}`);
    res.json(newQr);
  } catch (e) {
    console.error('[upload] Manual QR rejected');
    res.status(e.code?.startsWith('UPLOAD_') ? 400 : 500).json({ error: 'Unable to upload image.', code: e.code ?? 'UPLOAD_FAILED' });
  }
});

app.delete('/api/admin/manual-qrs/:id', (req, res) => {
  const { id } = req.params;
  const qr = manualQrsDb.get(id);
  if (qr) {
    try {
      const filePath = path.join('uploads', path.basename(qr.qrcode));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Failed to delete QR file:', e);
    }
    manualQrsDb.delete(id);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'QR not found' });
});

// Shipping and QR assign APIs
app.put('/api/admin/orders/:id/ship', (req, res) => {
  const { id } = req.params;
  const { trackingCode } = req.body;
  const order = ordersDb.get(id);
  if (order) {
    order.status = 'SHIPPED';
    order.trackingCode = trackingCode || '';
    ordersDb.set(id, order);
    console.log(`[HICO SHIP] Order ${id} shipped with tracking code ${trackingCode}`);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">Đơn hàng của bạn đang được giao!</h2>
        <p>Mã đơn hàng: <strong>${id}</strong></p>
        <p>HICO xin thông báo SIM vật lý của quý khách đã được bàn giao cho đơn vị vận chuyển.</p>
        <p>Mã vận đơn của bạn: <strong style="font-family: monospace; font-size: 16px; background-color: #f7fafc; padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e0;">${trackingCode}</strong></p>
        <p>Quý khách có thể sử dụng mã vận đơn này để kiểm tra hành trình đơn hàng trực tiếp tại trang web của đơn vị vận chuyển.</p>
        <p>Trân trọng cảm ơn quý khách!</p>
      </div>
    `;
    sendEmailHelper(order.email, `[HICO] Đơn hàng ${id} đã được giao`, emailHtml);
    
    return res.json(order);
  }
  res.status(404).json({ error: 'Order not found' });
});

app.post('/api/admin/orders/:id/assign-qr', (req, res) => {
  const { id } = req.params;
  const order = ordersDb.get(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let baseProductId = order.productId;
  let variantId = '';
  if (order.productId && order.productId.includes('-var-')) {
    const parts = order.productId.split('-var-');
    baseProductId = parts[0];
    variantId = 'var-' + parts[1];
  }
  const targetVarId = variantId || baseProductId;

  const availableQr = Array.from(manualQrsDb.values()).find(
    q => q.variantId === targetVarId && !q.assignedOrderId
  );

  if (!availableQr) {
    return res.status(400).json({ error: 'Không còn mã QR trống trong kho cho gói cước này' });
  }

  availableQr.assignedOrderId = id;
  manualQrsDb.set(availableQr.id, availableQr);

  const iccid = '898520manual' + Math.floor(10000000000 + Math.random() * 90000000000).toString();
  const rcode = 'MANUAL_' + id;

  esimsDb.set(iccid, {
    iccid,
    rcode,
    status: 'Chờ kích hoạt',
    productName: order.productId,
    network: 'HICO Network (Static QR)',
    usedData: 0,
    totalData: 10,
    expiry: 'Chưa kích hoạt',
    device: 'Đang chờ',
    qrcode: availableQr.qrcode,
    qrcodeContent: 'LPA:1$rsp.hico-esim.com$' + iccid,
    pin1: '1111',
    puk1: '33334444',
    apnExplain: 'APN: hico-internet (Roaming On)'
  });

  order.status = 'PROVISIONED';
  order.items = [{ iccid, productName: 'eSIM Thủ Công Cấp Phát', redemptionCode: rcode, qrcode: availableQr.qrcode }];
  ordersDb.set(id, order);

  const emailHtml = constructEsimEmailHtml(id, 'eSIM Thủ Công Cấp Phát', availableQr.qrcode, 'LPA:1$rsp.hico-esim.com$' + iccid);
  sendEmailHelper(order.email, `[HICO] Hướng dẫn kích hoạt eSIM đơn hàng ${id}`, emailHtml);

  res.json({ success: true, order });
});

app.post('/api/payment/webhook', async (req, res) => {
  const { productId, qty, email, shippingAddress } = req.body;
  
  // Dynamic product lookup from destinations or packages database
  let wmproductId = 'WM-e-JP-10GB'; // fallback default
  
  // Parse productId if it contains variant ID
  let baseProductId = productId;
  let variantId = '';
  if (productId && productId.includes('-var-')) {
    const parts = productId.split('-var-');
    baseProductId = parts[0];
    variantId = 'var-' + parts[1];
  }
  
  let productName = 'eSIM Gói cước';
  let selectedVariant = null;
  let itemSource = null;

  const destItem = destinationsDb.get(baseProductId);
  if (destItem) {
    productName = destItem.name;
    itemSource = destItem;
    if (variantId && Array.isArray(destItem.variants)) {
      selectedVariant = destItem.variants.find(v => v.id === variantId);
    }
  } else {
    const pkgItem = packagesDb.get(baseProductId);
    if (pkgItem) {
      productName = pkgItem.name;
      itemSource = pkgItem;
      if (variantId && Array.isArray(pkgItem.variants)) {
        selectedVariant = pkgItem.variants.find(v => v.id === variantId);
      }
    }
  }

  let simType = 'eSIM';
  if (selectedVariant) {
    simType = selectedVariant.simType || 'eSIM';
    wmproductId = selectedVariant.wmproductId || '';
    productName = `${productName} (${selectedVariant.dataLimit} - ${selectedVariant.duration})`;
  } else if (itemSource) {
    wmproductId = itemSource.wmproductId || '';
    productName = `${productName} (${itemSource.dataLimit} - ${itemSource.duration})`;
  }

  console.log(`[HICO Webhook] Processing Payment. Product: ${productName}, Type: ${simType}, User: ${email}`);

  // 1. Physical SIM Type
  if (simType === 'physical') {
    const orderId = '#HICO-PHYS-' + Math.floor(100000 + Math.random() * 900000);
    const orderRecord = {
      orderId,
      email,
      productId,
      wmproductId: '',
      qty,
      status: 'PENDING_SHIP',
      simType: 'physical',
      shippingAddress: shippingAddress || {},
      createdAt: new Date().toLocaleString('vi-VN'),
      items: [{ iccid: 'PHYSICAL_SIM_' + orderId, productName, redemptionCode: 'SHIPPING' }]
    };
    ordersDb.set(orderId, orderRecord);
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">Xác nhận đặt hàng SIM Vật Lý</h2>
        <p>Mã đơn hàng: <strong>${orderId}</strong></p>
        <p>Cảm ơn bạn đã đặt mua sản phẩm SIM Vật lý tại HICO. Đơn hàng của bạn đang được chuẩn bị để vận chuyển.</p>
        <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h4 style="margin-top: 0;">Thông tin nhận hàng:</h4>
          <p style="margin: 5px 0;">Họ tên: <strong>${shippingAddress?.name || 'Khách hàng'}</strong></p>
          <p style="margin: 5px 0;">Số điện thoại: <strong>${shippingAddress?.phone || ''}</strong></p>
          <p style="margin: 5px 0;">Địa chỉ: <strong>${shippingAddress?.address || ''}, ${shippingAddress?.ward || ''}, ${shippingAddress?.district || ''}, ${shippingAddress?.city || ''}</strong></p>
        </div>
        <p>Chúng tôi sẽ gửi email thông báo mã vận đơn ngay khi bàn giao cho bên vận chuyển.</p>
      </div>
    `;
    sendEmailHelper(email, `[HICO] Xác nhận đơn hàng SIM vật lý ${orderId}`, emailHtml);

    return res.json({ code: 0, orderId });
  }

  // 2. Manual eSIM Type
  if (simType === 'manual') {
    const orderId = '#HICO-MAN-' + Math.floor(100000 + Math.random() * 900000);
    const targetVarId = variantId || baseProductId;
    
    const availableQr = Array.from(manualQrsDb.values()).find(
      q => q.variantId === targetVarId && !q.assignedOrderId
    );

    if (availableQr) {
      availableQr.assignedOrderId = orderId;
      manualQrsDb.set(availableQr.id, availableQr);

      const iccid = '898520manual' + Math.floor(10000000000 + Math.random() * 90000000000).toString();
      const rcode = 'MANUAL_' + orderId;

      esimsDb.set(iccid, {
        iccid,
        rcode,
        status: 'Chờ kích hoạt',
        productName,
        network: 'HICO Network (Static QR)',
        usedData: 0,
        totalData: 10,
        expiry: 'Chưa kích hoạt',
        device: 'Đang chờ',
        qrcode: availableQr.qrcode,
        qrcodeContent: 'LPA:1$rsp.hico-esim.com$' + iccid,
        pin1: '1111',
        puk1: '33334444',
        apnExplain: 'APN: hico-internet (Roaming On)'
      });

      const orderRecord = {
        orderId,
        email,
        productId,
        wmproductId: '',
        qty,
        status: 'PROVISIONED',
        simType: 'manual',
        createdAt: new Date().toLocaleString('vi-VN'),
        items: [{ iccid, productName, redemptionCode: rcode, qrcode: availableQr.qrcode }]
      };
      ordersDb.set(orderId, orderRecord);

      const emailHtml = constructEsimEmailHtml(orderId, productName, availableQr.qrcode, 'LPA:1$rsp.hico-esim.com$' + iccid);
      sendEmailHelper(email, `[HICO] Hướng dẫn kích hoạt eSIM đơn hàng ${orderId}`, emailHtml);

      return res.json({ code: 0, orderId });
    } else {
      const orderRecord = {
        orderId,
        email,
        productId,
        wmproductId: '',
        qty,
        status: 'PENDING_QR_ASSIGN',
        simType: 'manual',
        createdAt: new Date().toLocaleString('vi-VN'),
        items: []
      };
      ordersDb.set(orderId, orderRecord);

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #dd6b20;">Đơn hàng đang chờ cấp phát eSIM</h2>
          <p>Mã đơn hàng: <strong>${orderId}</strong></p>
          <p>Cảm ơn bạn đã mua eSIM tại HICO. Do số lượng mã eSIM trong kho hiện đang hết, hệ thống kỹ thuật đang cấp phát thêm mã QR mới riêng cho bạn.</p>
          <p>Mã QR code và hướng dẫn sử dụng sẽ được gửi tới email này ngay khi hoàn tất trong vòng vài phút. Trân trọng cảm ơn!</p>
        </div>
      `;
      sendEmailHelper(email, `[HICO] Đơn hàng eSIM ${orderId} đang xử lý`, emailHtml);

      return res.json({ code: 0, orderId, msg: 'Hết mã QR trong kho. Admin đang cấp thêm.' });
    }
  }

  // 3. API eSIM / leSIM
  const isLeSim = simType === 'leSIM';
  const apiEmail = isLeSim ? '0' : email;
  const apiEndpoint = isLeSim ? '/Api/SOrder/mybuyesimRedemption' : '/Api/SOrder/mybuyesim';

  const prodSum = wmproductId + qty;
  const encStr = calculateSha1(apiConfig.merchantId + apiConfig.deptId + apiEmail + prodSum + apiConfig.token);

  const payload = {
    merchantId: apiConfig.merchantId,
    deptId: apiConfig.deptId,
    prodList: [{ wmproductId, qty }],
    systemMail: false,
    encStr
  };
  if (!isLeSim) {
    payload.email = email;
  }

  try {
    const wmResponse = await axios.post(`${apiConfig.apiUrl}${apiEndpoint}`, payload);
    const { code, msg, orderId } = wmResponse.data;

    if (code === 0) {
      console.log(`[HICO] Order successfully created on Worldmove via API (${simType}): ${orderId}`);
      ordersDb.set(orderId, {
        orderId,
        email,
        wmproductId,
        qty,
        status: 'PENDING_CALLBACK',
        simType,
        createdAt: new Date().toLocaleString('vi-VN'),
        items: []
      });
      return res.json({ code: 0, orderId });
    } else {
      console.error(`[HICO] Worldmove buy order failed: ${msg}`);
      return res.json({ code: 500, msg });
    }
  } catch (error) {
    console.error(`[HICO] Failed to connect to Worldmove: ${error.message}`);
    return res.json({ code: 500, msg: 'Could not connect to Worldmove carrier.' });
  }
});

// === WORLDMOVE WEBHOOK CALLBACK ENDPOINTS ===

// 1. eSIM Order Callback (Section 2.2)
const handleEsimOrderCallback = async (req, res) => {
  const { orderId, orderSN, orderTime, code, msg, itemList, encStr } = req.body;
  console.log(`[HICO] eSIM Order Callback received for order: ${orderId}`);

  // Validate encStr signature
  let itemSum = '';
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      itemSum += (item.iccid + item.productName + item.redemptionCode);
    });
  }
  const expectedSignature = calculateSha1(apiConfig.merchantId + orderId + orderSN + orderTime + itemSum + apiConfig.token);
  if (encStr !== expectedSignature) {
    console.warn('[HICO] Signature validation failed for eSIM Order Callback.');
    return res.status(401).send('Invalid signature');
  }

  // Update order in memory
  const order = ordersDb.get(orderId);
  if (order) {
    order.status = 'PROVISIONED';
    order.items = itemList;
    ordersDb.set(orderId, order);
  }

  // Save eSIM details with status Chờ kích hoạt
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      esimsDb.set(item.iccid, {
        iccid: item.iccid,
        rcode: item.redemptionCode,
        status: 'Chờ kích hoạt',
        productName: item.productName,
        network: item.productName.includes('Japan') ? 'NTT Docomo' : 'T-Mobile',
        usedData: 0,
        totalData: item.productName.includes('10GB') ? 10 : 20,
        expiry: 'Chưa kích hoạt',
        device: 'Đang chờ',
        qrcode: null,
        qrcodeContent: null
      });

      // Fire asynchronous redemption immediately
      triggerRedemption(item.redemptionCode);
    });
  }

  // Acknowledge callback with "1" as per specs
  res.send('1');
};

app.post('/api/wm/order-callback', handleEsimOrderCallback);
app.post('/api/webhooks/worldmove/esim-order', handleEsimOrderCallback);

// Helper for Redemption
async function triggerRedemption(rcode) {
  console.log(`[HICO] Automatically trigger redemption for code ${rcode}...`);
  const qrcodeType = 2; // LPA + QR Code
  const encStr = calculateSha1(apiConfig.merchantId + rcode + qrcodeType + apiConfig.token);

  const payload = {
    merchantId: apiConfig.merchantId,
    rcode,
    qrcodeType,
    encStr
  };

  try {
    const wmResponse = await axios.post(`${apiConfig.apiUrl}/Api/OrderRedemption/redemption`, payload);
    if (wmResponse.data.code === 0) {
      console.log(`[HICO] Redemption registered for ${rcode}. Waiting for redeem callback...`);
    }
  } catch (error) {
    console.error(`[HICO] Failed to request redemption for code ${rcode}: ${error.message}`);
  }
}

// 2. eSIM Order and Redeem Callback (Section 2.5)
const handleEsimOrderRedeemCallback = (req, res) => {
  const { orderId, itemList, encStr } = req.body;
  console.log(`[HICO] eSIM Order and Redeem Callback received for order ${orderId}`);

  // Validate encStr signature
  let itemSum = '';
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      itemSum += (item.iccid + item.productName + item.rcode + item.qrcodeType + item.qrcode);
    });
  }
  const expectedSignature = calculateSha1(apiConfig.merchantId + orderId + itemSum + apiConfig.token);
  if (encStr !== expectedSignature) {
    console.warn('[HICO] Signature validation failed for eSIM Order and Redeem Callback.');
    return res.status(401).send('Invalid signature');
  }

  // Update eSIM with QR details
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      const esim = esimsDb.get(item.iccid);
      if (esim) {
        esim.qrcode = item.qrcode;
        esim.qrcodeContent = item.qrcodeContent;
        esim.pin1 = item.pin1;
        esim.puk1 = item.puk1;
        esim.apnExplain = item.apnExplain;
        esimsDb.set(item.iccid, esim);
        console.log(`[HICO] eSIM ${item.iccid} updated with QR & APN info.`);
      } else {
        // If not found in memory, create a new one
        esimsDb.set(item.iccid, {
          iccid: item.iccid,
          rcode: item.rcode,
          status: item.resultcode === '000' || item.code === 0 ? 'Chờ kích hoạt' : 'Lỗi',
          productName: item.productName,
          network: item.productName.includes('Japan') ? 'NTT Docomo' : 'T-Mobile',
          usedData: 0,
          totalData: item.productName.includes('10GB') ? 10 : 20,
          expiry: 'Chưa kích hoạt',
          device: 'Đang chờ',
          qrcode: item.qrcode,
          qrcodeContent: item.qrcodeContent,
          pin1: item.pin1,
          puk1: item.puk1,
          apnExplain: item.apnExplain
        });
        console.log(`[HICO] New eSIM ${item.iccid} created from eSIM Order and Redeem Callback.`);
      }

      // Update HICO order status and send email
      const order = ordersDb.get(orderId);
      if (order) {
        order.status = 'PROVISIONED';
        order.items = [{ iccid: item.iccid, productName: item.productName, redemptionCode: item.rcode, qrcode: item.qrcode }];
        ordersDb.set(orderId, order);
        
        const emailHtml = constructEsimEmailHtml(orderId, item.productName, item.qrcode, item.qrcodeContent);
        sendEmailHelper(order.email, `[HICO] Hướng dẫn kích hoạt eSIM đơn hàng ${orderId}`, emailHtml);
      }
    });
  }

  // Acknowledge callback with "1" as per specs
  res.send('1');
};

app.post('/api/wm/redeem-callback', handleEsimOrderRedeemCallback);
app.post('/api/esim-order-redeem', handleEsimOrderRedeemCallback);

// 3. Redeem Redemption Code Callback (Section 3.2)
const handleRedeemCodeCallback = (req, res) => {
  const { qrcode, rcode, qrcodeType, encStr, resultcode, resultmsg, iccid, qrcodeContent, salePlanDays, pin1, pin2, puk1, puk2, cfCode, apnExplain } = req.body;
  console.log(`[HICO] Redeem Code Callback received for rcode: ${rcode}, iccid: ${iccid}`);

  const expectedSignature = calculateSha1(apiConfig.merchantId + qrcode + rcode + qrcodeType + apiConfig.token);
  if (encStr !== expectedSignature) {
    console.warn('[HICO] Signature validation failed for Redeem Code Callback.');
    return res.status(401).send('Invalid signature');
  }

  // Update eSIM in database
  const esim = Array.from(esimsDb.values()).find(e => e.rcode === rcode) || esimsDb.get(iccid);
  if (esim) {
    esim.iccid = iccid || esim.iccid;
    esim.qrcode = qrcode;
    esim.qrcodeContent = qrcodeContent;
    esim.pin1 = pin1;
    esim.puk1 = puk1;
    esim.apnExplain = apnExplain;
    if (resultcode === '000') {
      esim.status = 'Chờ kích hoạt';
    } else {
      console.warn(`[HICO] Redeem failed with code ${resultcode}: ${resultmsg}`);
    }
    esimsDb.set(esim.iccid, esim);
    console.log(`[HICO] eSIM ${esim.iccid} updated from Redeem Code Callback.`);
  } else {
    // If not found in memory, create a new one
    esimsDb.set(iccid, {
      iccid,
      rcode,
      status: resultcode === '000' ? 'Chờ kích hoạt' : 'Lỗi kích hoạt',
      productName: 'eSIM Worldmove',
      network: 'Worldmove Partner',
      usedData: 0,
      totalData: 10,
      expiry: 'Chưa kích hoạt',
      device: 'Đang chờ',
      qrcode,
      qrcodeContent,
      pin1,
      puk1,
      apnExplain
    });
    console.log(`[HICO] New eSIM ${iccid} created from Redeem Code Callback.`);
  }

  // Update HICO order status and trigger email sending when QR becomes available
  if (resultcode === '000') {
    const finalIccid = iccid || (esim ? esim.iccid : '');
    const finalProductName = esim ? esim.productName : 'eSIM Gói cước';
    
    const order = Array.from(ordersDb.values()).find(o => 
      o.items && o.items.some(i => i.redemptionCode === rcode || i.iccid === finalIccid)
    );
    
    if (order) {
      order.status = 'PROVISIONED';
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          if (item.iccid === finalIccid || item.redemptionCode === rcode) {
            item.qrcode = qrcode;
          }
        });
      }
      ordersDb.set(order.orderId, order);
      
      const emailHtml = constructEsimEmailHtml(order.orderId, finalProductName, qrcode, qrcodeContent);
      sendEmailHelper(order.email, `[HICO] Hướng dẫn kích hoạt eSIM đơn hàng ${order.orderId}`, emailHtml);
    }
  }

  res.send('1');
};

app.post('/api/webhooks/worldmove/redeem', handleRedeemCodeCallback);
app.post('/api/wm/redeem-code-callback', handleRedeemCodeCallback);

// 4. Top-up Callback (Section 5.2)
const handleTopupCallback = (req, res) => {
  const { orderId, itemList, encStr } = req.body;
  console.log(`[HICO] Top-up Callback received for order ${orderId}`);

  // Validate signature
  let itemSum = '';
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      itemSum += (item.wmproductId + item.day + item.simNum);
    });
  }
  const expectedSignature = calculateSha1(apiConfig.merchantId + orderId + itemSum + apiConfig.token);
  if (encStr !== expectedSignature) {
    console.warn('[HICO] Signature validation failed for Top-up Callback.');
    return res.status(401).send('Invalid signature');
  }

  // Process top-up
  if (Array.isArray(itemList)) {
    itemList.forEach(item => {
      if (item.code === 1) { // 1 = Success
        const esim = esimsDb.get(item.simNum);
        if (esim) {
          esim.totalData += 5; // e.g. add 5GB per topup
          esim.usedData = 0; // reset data usage
          esimsDb.set(item.simNum, esim);
          console.log(`[HICO] eSIM ${item.simNum} topped up successfully (+5GB data, reset usage).`);
        } else {
          console.warn(`[HICO] Top-up target eSIM ${item.simNum} not found in database.`);
        }
      } else {
        console.warn(`[HICO] Top-up item failed: ${item.msg}`);
      }
    });
  }

  res.send('1');
};

app.post('/api/esim-topup', handleTopupCallback);
app.post('/api/webhooks/worldmove/topup', handleTopupCallback);

// 5. eSIM Activation Notification (Section 2.7)
const handleActivationNotification = (req, res) => {
  const { orderId, rcode, iccid, useSDate, useEDate } = req.body;
  console.log(`[HICO] eSIM Activation Notification received for ICCID: ${iccid}`);

  const esim = esimsDb.get(iccid);
  if (esim) {
    esim.status = 'Đang hoạt động';
    // Format timestamp
    esim.expiry = new Date(parseInt(useEDate) * 1000).toLocaleDateString('vi-VN');
    esimsDb.set(iccid, esim);
    console.log(`[HICO] eSIM ${iccid} marked ACTIVE in database.`);
  } else {
    // create eSIM if not found
    esimsDb.set(iccid, {
      iccid,
      rcode,
      status: 'Đang hoạt động',
      productName: 'eSIM Worldmove',
      network: 'Worldmove Partner',
      usedData: 0,
      totalData: 10,
      expiry: new Date(parseInt(useEDate) * 1000).toLocaleDateString('vi-VN'),
      device: 'Thiết bị',
      qrcode: null,
      qrcodeContent: null
    });
    console.log(`[HICO] eSIM ${iccid} created and marked ACTIVE from Activation Notification.`);
  }

  res.send('1');
};

app.post('/api/wm/activation-notification', handleActivationNotification);
app.post('/api/esim-activation-notify', handleActivationNotification);
app.post('/api/webhooks/worldmove/esim-activation-notify', handleActivationNotification);

// 5. Query usage stats (Fetches data directly from Worldmove using rcode)
app.get('/api/legacy-customer/esim/:iccid', async (req, res) => {
  const { iccid } = req.params;
  const esim = esimsDb.get(iccid);

  if (!esim) {
    return res.status(404).json({ error: 'eSIM not found' });
  }

  // Only call Worldmove usage details if eSIM is active
  if (esim.status === 'Đang hoạt động') {
    const encStr = calculateSha1(apiConfig.merchantId + esim.rcode + apiConfig.token);
    
    try {
      console.log(`[HICO] Querying live data usage from Worldmove for rcode: ${esim.rcode}`);
      const wmResponse = await axios.post(`${apiConfig.apiUrl}/Api/UseageDetail/queryUsage`, {
        merchantId: apiConfig.merchantId,
        rcode: esim.rcode,
        encStr
      });

      const { code, totalUsage } = wmResponse.data;
      if (code === 0 && totalUsage) {
        // Convert bytes to GB with 2 decimal points
        const gigabytesUsed = (parseInt(totalUsage) / (1024 * 1024 * 1024)).toFixed(2);
        esim.usedData = parseFloat(gigabytesUsed);
        esimsDb.set(iccid, esim);
        console.log(`[HICO] Synced live data usage for ${iccid}: ${gigabytesUsed} GB`);
      }
    } catch (error) {
      console.warn(`[HICO] Failed to fetch live usage from Worldmove: ${error.message}`);
    }
  }

  res.json(esim);
});

// 6. Query User orders list
app.get('/api/legacy-customer/orders', (req, res) => {
  const orders = Array.from(ordersDb.values());
  res.json(orders);
});

// 7. Simulates User Top-up
app.post('/api/legacy-customer/topup', (req, res) => {
  const { iccid, days } = req.body;
  const esim = esimsDb.get(iccid);
  
  if (!esim) {
    return res.status(404).json({ error: 'eSIM not found' });
  }

  console.log(`[HICO] Topup of ${days} days requested for eSIM ${iccid}`);
  
  // Update status or package dates
  esim.totalData += 5; // Add 5GB data
  esim.usedData = 0; // Reset usage
  esimsDb.set(iccid, esim);

  triggerNotificationSimulated(`Nạp thành công +5GB dữ liệu vào eSIM ${iccid}!`);

  res.json({ success: true, esim });
});

function triggerNotificationSimulated(message) {
  console.log(`[NOTIFICATION]: ${message}`);
}

// === MEDIA LIBRARY API ENDPOINTS ===

// Media Library canonical endpoints. Legacy filename/url aliases remain read-compatible.
app.get('/api/admin/media', async (req, res) => {
  try {
    const assets = await mediaAssetRepository.list({
      search: typeof req.query.search === 'string' ? req.query.search : '',
      mimeType: typeof req.query.mimeType === 'string' ? req.query.mimeType : undefined,
    });
    res.json(assets.map((asset) => ({ ...asset, filename: path.basename(asset.storagePath), url: asset.publicUrl, date: asset.updatedAt })));
  } catch (error) {
    console.error('[media] list failed');
    res.status(500).json({ error: 'KhÃ´ng thá»ƒ táº£i Media Library.', code: 'MEDIA_LIST_FAILED' });
  }
});

app.post('/api/admin/media/upload', async (req, res) => {
  try {
    const { base64Data, filename } = req.body ?? {};
    if (!base64Data) return res.status(400).json({ error: 'Thiáº¿u dá»¯ liá»‡u áº£nh.', code: 'UPLOAD_INVALID' });
    const upload = parseImageUpload({ base64Data, maxBytes: Number(process.env.UPLOAD_MAX_BYTES ?? 5 * 1024 * 1024) });
    const asset = await mediaAssetRepository.createFromUpload({ upload, originalName: typeof filename === 'string' ? filename.slice(0, 240) : upload.filename, createdBy: req.auth?.user?.id });
    res.status(201).json({ ...asset, filename: path.basename(asset.storagePath), url: asset.publicUrl, date: asset.updatedAt });
  } catch (error) {
    console.error('[upload] Media rejected');
    res.status(error.code?.startsWith('UPLOAD_') || error.message === 'MEDIA_UNSUPPORTED_TYPE' ? 400 : 500).json({ error: 'Không thể tải ảnh lên Media Library.', code: error.code ?? 'UPLOAD_FAILED' });
  }
});

app.patch('/api/admin/media/:id', async (req, res) => {
  try {
    const changes = {};
    if (req.body?.altText !== undefined) changes.altText = String(req.body.altText).slice(0, 500);
    if (req.body?.title !== undefined) changes.title = String(req.body.title).slice(0, 240);
    const asset = await mediaAssetRepository.update(req.params.id, changes);
    if (!asset) return res.status(404).json({ error: 'Không tìm thấy MediaAsset.', code: 'MEDIA_NOT_FOUND' });
    res.json(asset);
  } catch {
    res.status(500).json({ error: 'Không thể cập nhật MediaAsset.', code: 'MEDIA_UPDATE_FAILED' });
  }
});

app.delete('/api/admin/media/:id', async (req, res) => {
  try {
    const result = await mediaAssetRepository.archiveOrDelete(req.params.id);
    if (result.status === 404) return res.status(404).json({ error: 'Không tìm thấy MediaAsset.', code: 'MEDIA_NOT_FOUND' });
    if (result.status === 409) return res.status(409).json({ error: 'MediaAsset đang được tham chiếu và không thể xóa.', code: 'MEDIA_REFERENCED', references: result.references });
    return res.json({ success: true, id: result.asset.id });
  } catch {
    return res.status(500).json({ error: 'Không thể xóa MediaAsset.', code: 'MEDIA_DELETE_FAILED' });
  }
});

// === PRODUCT REVIEWS ENDPOINTS ===

// 1. Get approved reviews for a specific product
app.get('/api/products/:productId/reviews', (req, res) => {
  const { productId } = req.params;
  const approvedReviews = Array.from(reviewsDb.values()).filter(
    r => r.productId === productId && r.status === 'approved'
  );
  // Default sort by newest first
  approvedReviews.sort((a, b) => {
    const parseDate = (dStr) => {
      const parts = dStr.split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    };
    return parseDate(b.createdAt) - parseDate(a.createdAt);
  });
  res.json(approvedReviews);
});

// 2. Post a new review for a product
app.post('/api/products/:productId/reviews', (req, res) => {
  const { productId } = req.params;
  const { rating, userName, userPhone, userEmail, content, images } = req.body;

  // Resolve product name
  let productName = 'eSIM';
  const destItem = destinationsDb.get(productId);
  if (destItem) {
    productName = destItem.name;
  } else {
    const pkgItem = packagesDb.get(productId);
    if (pkgItem) {
      productName = pkgItem.name;
    }
  }

  const id = 'rev-' + Date.now();
  const newReview = {
    id,
    productId,
    productName,
    rating: parseInt(rating) || 5,
    userName: userName || 'Khách hàng',
    userPhone: userPhone || '',
    userEmail: userEmail || '',
    content: content || '',
    images: Array.isArray(images) ? images : [],
    status: 'pending', // wait for admin approval
    createdAt: new Date().toLocaleDateString('vi-VN')
  };

  reviewsDb.set(id, newReview);
  console.log(`[HICO REVIEWS] New pending review submitted for product ${productId}:`, newReview);
  res.json({ success: true, review: newReview });
});

// 3. Get all reviews (Admin view)
app.get('/api/admin/reviews', (req, res) => {
  res.json(Array.from(reviewsDb.values()));
});

// 4. Update review approval status (Admin action)
app.put('/api/admin/reviews/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  const review = reviewsDb.get(id);
  if (review) {
    review.status = status;
    reviewsDb.set(id, review);
    console.log(`[HICO REVIEWS] Admin updated review ${id} status to ${status}`);
    return res.json(review);
  }
  res.status(404).json({ error: 'Review not found' });
});

// 5. Delete review (Admin action)
app.delete('/api/admin/reviews/:id', (req, res) => {
  const { id } = req.params;
  if (reviewsDb.has(id)) {
    reviewsDb.delete(id);
    console.log(`[HICO REVIEWS] Admin deleted review ${id}`);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Review not found' });
});

if (catalogHealthService.shouldValidateAtStartup) {
  void catalogHealthService.validate({ force: true });
}
if (canonicalCheckoutHealthService.shouldValidateAtStartup) {
  void canonicalCheckoutHealthService.validate({ force: true });
}
if (sessionDriver === 'postgres') {
  void sessionCleanupService.run({ force: true });
  const cleanupTimer = setInterval(() => { void sessionCleanupService.run(); }, Number.parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS, 10) || 3_600_000);
  cleanupTimer.unref();
}
if (customerSessionCleanupService) {
  void customerSessionCleanupService.run({ force: true });
  const customerCleanupTimer = setInterval(() => { void customerSessionCleanupService.run(); }, Number(process.env.SESSION_CLEANUP_INTERVAL_MS, 10) || 3_600_000);
  customerCleanupTimer.unref();
}

app.listen(PORT, () => {
  console.log(`HICO Backend Server running on http://localhost:${PORT}`);
});
