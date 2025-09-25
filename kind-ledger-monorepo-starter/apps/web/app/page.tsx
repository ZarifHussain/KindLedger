
export default function Page() {
  return (
    <main className="grid gap-6">
      <section className="card">
        <h2 className="text-xl font-semibold mb-2">Welcome</h2>
        <p>This is your Kind Ledger starter. Connect a provider and import data to begin chasing invoices.</p>
      </section>
      <section className="card">
        <h3 className="font-medium mb-2">Quick links</h3>
        <ul className="list-disc list-inside">
          <li><a href="/connections">Connect Xero/QBO</a></li>
          <li><a href="/debtors">View debtors</a></li>
        </ul>
      </section>
    </main>
  );
}
