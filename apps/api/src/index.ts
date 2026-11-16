import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { companiesRouter } from './routes/companies.js';
import { staffRouter } from './routes/staff.js';
import { healthRouter } from './routes/health.js';
import { salesRouter } from './routes/sales.js';
import { shopRouter } from './routes/shop.js';
import { marketplaceFeaturesRouter } from './routes/marketplaceFeatures.js';
import { customerNotificationsRouter } from './routes/customerNotifications.js';
import { paymentsRouter } from './routes/payments.js';
import { paystackWebhookHandler } from './routes/paystackWebhook.js';
import { paystackPayoutRouter } from './routes/paystackPayout.js';
import { productMediaRouter } from './routes/productMedia.js';
import { companySettingsRouter } from './routes/companySettings.js';
import { superAdminRouter, subscriptionRouter } from './routes/superAdmin.js';
import { loadPlatformSettings } from './lib/platformSettings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const frontendOrigin = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: frontendOrigin, credentials: true }));

app.post(
  '/api/shop/payments/webhook',
  express.raw({ type: 'application/json' }),
  paystackWebhookHandler,
);

app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/companies', companySettingsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/sales', salesRouter);
app.use('/api/shop', shopRouter);
app.use('/api/shop', marketplaceFeaturesRouter);
app.use('/api/shop', customerNotificationsRouter);
app.use('/api/shop/payments', paymentsRouter);
app.use('/api/companies/paystack', paystackPayoutRouter);
app.use('/api/companies', subscriptionRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/product-media', productMediaRouter);

void loadPlatformSettings().catch((err) => {
  console.warn('Could not load platform settings from DB, using env fallback:', err);
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(port, () => {
  console.log(`POS Inventory API running on http://localhost:${port}`);
});
