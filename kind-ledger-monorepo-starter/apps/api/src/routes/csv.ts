
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';

export const router = Router();

const rowSchema = z.object({
  contact_name: z.string(),
  email: z.string().email().optional(),
  invoice_number: z.string(),
  amount_outstanding: z.number(),
  due_date: z.string(),
  currency: z.string().optional()
});

router.post('/import', async (req, res) => {
  const { rows } = req.body as { rows: any[] };
  if (!Array.isArray(rows)) return res.status(400).json({ ok: false, error: 'rows must be array' });
  const parsed = rows.map(r => rowSchema.safeParse(r)).filter(p => p.success).map(p => p.data);
  await prisma.syncLog.create({ data: { provider: 'csv', action: 'import', details: `rows:${parsed.length}` }});
  res.json({ ok: true, imported: parsed.length });
});
