import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/supabase.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'pos-inventory-api',
    timestamp: new Date().toISOString(),
    realtime: 'supabase-postgres-changes',
  });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('companies').select('id').limit(1);
    if (error) throw error;
    res.json({ success: true, database: 'connected' });
  } catch (error) {
    res.status(503).json({
      success: false,
      database: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
