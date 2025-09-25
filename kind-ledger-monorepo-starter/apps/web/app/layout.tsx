
import './globals.css';
import React from 'react';

export const metadata = { title: 'Kind Ledger', description: 'Invoice chasing SaaS' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container py-8 space-y-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Kind Ledger</h1>
            <nav className="space-x-2">
              <a className="btn" href="/">Home</a>
              <a className="btn" href="/connections">Connections</a>
              <a className="btn" href="/debtors">Debtors</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
