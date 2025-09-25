
'use client';
import { useEffect, useState } from 'react';

export default function ConnectionsPage() {
  const [status, setStatus] = useState<any>(null);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

  useEffect(() => {
    fetch(`${api}/api/connections`).then(r => r.json()).then(setStatus).catch(console.error);
  }, [api]);

  return (
    <main className="grid gap-6">
      <section className="card">
        <h2 className="text-xl font-semibold mb-4">Connect services</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <a className="btn" href={`${api}/oauth/xero/start`}>Connect Xero</a>
          <a className="btn" href={`${api}/oauth/qbo/start`}>Connect QuickBooks</a>
          <button className="btn" onClick={() => alert('CSV importer modal coming soon')}>Upload CSV</button>
        </div>
      </section>
      <section className="card">
        <h3 className="font-medium mb-2">Connection status</h3>
        <pre className="text-sm opacity-90">{JSON.stringify(status, null, 2)}</pre>
      </section>
    </main>
  );
}
