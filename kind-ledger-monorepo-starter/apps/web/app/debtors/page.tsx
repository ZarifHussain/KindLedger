
'use client';
import { useEffect, useState } from 'react';

type Row = {
  contactId: string;
  name: string;
  email?: string;
  phone?: string;
  outstandingBalance: string;
  invoices: { id: string; number?: string | null; dueDate?: string | null; balance: string; status?: string | null; }[];
};

export default function DebtorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

  useEffect(() => {
    async function load() {
      const r = await fetch(`${api}/health`).then(res => res.json()).catch(() => ({ ok: false }));
      if (r.ok) {
        setRows([
          { contactId: 'demo-1', name: 'Acme Supplies Ltd', email: 'ap@acme.example', outstandingBalance: '£450.00',
            invoices: [{ id: 'INV-1001', number: 'INV-1001', dueDate: '14 days ago', balance: '£450.00', status: 'AUTHORISED' }] }
        ]);
      }
    }
    load();
  }, [api]);

  return (
    <main className="grid gap-6">
      <section className="card">
        <h2 className="text-xl font-semibold mb-4">Debtors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left opacity-70">
              <tr><th className="py-2">Name</th><th>Email</th><th>Outstanding</th><th>Invoices</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.contactId} className="border-t border-white/10">
                  <td className="py-2">{r.name}</td>
                  <td>{r.email || '—'}</td>
                  <td>{r.outstandingBalance}</td>
                  <td>
                    {r.invoices.map(inv => (
                      <span key={inv.id} className="inline-block mr-2 rounded bg-white/10 px-2 py-1">
                        {inv.number} ({inv.balance})
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
