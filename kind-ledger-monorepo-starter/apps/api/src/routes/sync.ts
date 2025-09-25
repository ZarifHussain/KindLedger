
import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const router = Router();

router.post('/initial', async (req, res) => {
  const { provider } = req.body || {};
  await prisma.syncLog.create({ data: { provider: provider || 'unknown', action: 'initial', details: 'stubbed run' } });
  res.json({ ok: true, message: 'Initial sync queued (stub).' });
});

router.post('/delta', async (req, res) => {
  const { provider } = req.body || {};
  await prisma.syncLog.create({ data: { provider: provider || 'unknown', action: 'delta', details: 'stubbed run' } });
  res.json({ ok: true, message: 'Delta sync queued (stub).' });
});
