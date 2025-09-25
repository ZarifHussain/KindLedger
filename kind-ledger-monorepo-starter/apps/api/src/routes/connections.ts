
import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const router = Router();

router.get('/', async (_req, res) => {
  const ledgers = await prisma.ledger.findMany({
    select: { id: true, provider: true, display_name: true, last_synced_at: true }
  });
  const byProvider: Record<string, any> = {};
  for (const l of ledgers) {
    byProvider[l.provider] = { connected: true, displayName: l.display_name, lastSyncedAt: l.last_synced_at };
  }
  res.json({
    xero: byProvider['xero'] || { connected: false },
    qbo: byProvider['qbo'] || { connected: false },
    csv: { enabled: true }
  });
});
