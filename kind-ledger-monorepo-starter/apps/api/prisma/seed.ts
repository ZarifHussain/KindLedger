
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: 'demo-tenant' }, update: {},
    create: { id: 'demo-tenant', name: 'Demo Tenant' }
  });
  await prisma.user.upsert({
    where: { email: 'owner@demo.local' },
    update: {},
    create: { tenant_id: tenant.id, email: 'owner@demo.local', name: 'Demo Owner', role: 'owner' }
  });
  const ledger = await prisma.ledger.upsert({
    where: { provider_external_tenant_id: 'csv-demo' },
    update: {},
    create: { tenant_id: tenant.id, provider: 'csv', display_name: 'CSV Demo', provider_external_tenant_id: 'csv-demo' }
  });
  const c1 = await prisma.contact.create({
    data: { tenant_id: tenant.id, ledger_id: ledger.id, external_id: 'CUST-001', name: 'Acme Supplies Ltd', email: 'ap@acme.example' }
  });
  const inv1 = await prisma.invoice.create({
    data: {
      tenant_id: tenant.id, ledger_id: ledger.id, external_id: 'INV-1001', contact_id: c1.id,
      number: 'INV-1001', currency: 'GBP', total: 1200.00, balance: 450.00,
      due_date: new Date(Date.now() - 1000*60*60*24*14), status: 'AUTHORISED'
    }
  });
  await prisma.payment.create({
    data: { tenant_id: tenant.id, ledger_id: ledger.id, external_id: 'PAY-555', invoice_id: inv1.id, amount: 750.00, paid_at: new Date(Date.now() - 1000*60*60*24*30) }
  });
  await prisma.contact.create({
    data: { tenant_id: tenant.id, ledger_id: ledger.id, external_id: 'CUST-002', name: 'Brighton Tech Co', email: 'finance@brightontech.example' }
  });
  console.log('Seed complete.');
}
main().finally(() => prisma.$disconnect());
