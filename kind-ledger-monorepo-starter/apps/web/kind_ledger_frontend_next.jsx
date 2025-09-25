// ================================
// apps/web – Kind Ledger Frontend
// Next.js 14 (App Router) + Tailwind + React Query
// Copy these files into your monorepo's apps/web folder.
// If a file already exists, replace it with this version.
// ================================

// ──────────────────────────────────────────────────────────────
// app/layout.tsx
// ──────────────────────────────────────────────────────────────
"use client";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/connections", label: "Connections" },
  { href: "/debtors", label: "Debtors" },
  { href: "/invoices", label: "Invoices" },
  { href: "/sequences", label: "Sequences" },
  { href: "/templates", label: "Templates" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <QueryProvider>
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
            <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
              <Link href="/debtors" className="font-semibold">Kind Ledger</Link>
              <nav className="flex items-center gap-2 text-sm">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`px-3 py-1.5 rounded-full border ${pathname?.startsWith(n.href) ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100"}`}
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Kind Ledger</p>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}

// ──────────────────────────────────────────────────────────────
// app/page.tsx – redirect to /debtors
// ──────────────────────────────────────────────────────────────
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/debtors");
}

// ──────────────────────────────────────────────────────────────
// app/connections/page.tsx – Xero/QBO status + connect buttons
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ConnectionsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api.get("/api/connections"),
  });

  if (isLoading) return <div>Loading…</div>;
  const x = data?.xero; const q = data?.qbo;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ProviderCard
        name="Xero"
        connected={!!x?.connected}
        displayName={x?.displayName}
        lastSyncedAt={x?.lastSyncedAt}
        onConnect={() => (window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/oauth/xero/start`)}
        onSync={() => api.post("/api/sync/initial", { provider: "xero" }).then(refetch)}
      />
      <ProviderCard
        name="QuickBooks"
        connected={!!q?.connected}
        displayName={q?.displayName}
        lastSyncedAt={q?.lastSyncedAt}
        onConnect={() => (window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/oauth/qbo/start`)}
        onSync={() => api.post("/api/sync/initial", { provider: "qbo" }).then(refetch)}
      />
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">CSV Upload</h3>
        <p className="text-sm text-slate-600 mb-3">Import aged receivables via CSV and map columns.</p>
        <input type="file" accept=".csv" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const body = new FormData(); body.set("file", f);
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/csv/upload`, { method: "POST", body });
          const json = await res.json();
          alert(json.message || "Uploaded. Go to Debtors after import completes.");
        }} />
      </div>
    </div>
  );
}

function ProviderCard({ name, connected, displayName, lastSyncedAt, onConnect, onSync }: any) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{name}</h3>
        <span className={`text-xs px-2 py-1 rounded-full border ${connected ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-slate-100 border-slate-300 text-slate-700"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {connected && (
        <div className="text-sm text-slate-600 mb-2">
          <div>Org: {displayName || "—"}</div>
          <div>Last sync: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "—"}</div>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onConnect} className="px-3 py-2 rounded-xl border hover:bg-slate-50">{connected ? "Reconnect" : "Connect"}</button>
        <button onClick={onSync} className="px-3 py-2 rounded-xl border hover:bg-slate-50">Sync now</button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// app/debtors/page.tsx – Unified debtor view
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function DebtorsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["debtors"], queryFn: () => api.get("/api/debtors") });

  const chase = useMutation({
    mutationFn: (invoiceIds: string[]) => api.post("/api/chase", { invoiceIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity"] }),
  });

  if (isLoading) return <div>Loading…</div>;
  const rows = data?.items || [];

  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold mb-3">Debtors</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            {["Contact", "Email", "Open invoices", "Outstanding", "Next action", "Actions"].map((h) => (
              <th key={h} className="px-2 py-2 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.contactId} className="border-b">
              <td className="px-2 py-2 font-medium">{r.name}</td>
              <td className="px-2 py-2 text-slate-600">{r.email || "—"}</td>
              <td className="px-2 py-2">{r.invoiceCount}</td>
              <td className="px-2 py-2">{new Intl.NumberFormat("en-GB", { style: "currency", currency: r.currency || "GBP" }).format(r.outstanding)}</td>
              <td className="px-2 py-2">{r.nextActionAt || "—"}</td>
              <td className="px-2 py-2">
                <button
                  className="px-3 py-1.5 rounded-full border hover:bg-slate-50"
                  onClick={() => chase.mutate(r.invoices.map((i: any) => i.id))}
                >
                  Add to sequence
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// app/invoices/page.tsx – list invoices (basic)
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export default function InvoicesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["invoices"], queryFn: () => api.get("/api/invoices?status=overdue") });
  if (isLoading) return <div>Loading…</div>;
  const rows = data?.items || [];
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold mb-3">Overdue invoices</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            {["Invoice", "Contact", "Due date", "Balance", "Currency"].map((h) => (
              <th key={h} className="px-2 py-2 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b">
              <td className="px-2 py-2">{r.number || r.external_id}</td>
              <td className="px-2 py-2">{r.contact?.name || "—"}</td>
              <td className="px-2 py-2">{r.due_date?.slice(0, 10) || "—"}</td>
              <td className="px-2 py-2">{new Intl.NumberFormat("en-GB", { style: "currency", currency: r.currency || "GBP" }).format(Number(r.balance))}</td>
              <td className="px-2 py-2">{r.currency || "GBP"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// app/templates/page.tsx – CRUD for templates
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => api.get("/api/templates") });
  const create = useMutation({ mutationFn: (form: any) => api.post("/api/templates", form), onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }) });

  if (isLoading) return <div>Loading…</div>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Existing</h3>
        <ul className="text-sm list-disc pl-5">
          {(data?.items || []).map((t: any) => (
            <li key={t.id}><span className="font-medium">{t.name}</span> — {t.subject}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Create new</h3>
        <TemplateForm onSubmit={(form) => create.mutate(form)} />
      </div>
    </div>
  );
}

function TemplateForm({ onSubmit }: { onSubmit: (f: any) => void }) {
  const [form, setForm] = React.useState({ name: "", subject: "", body: "Hello {{contact.name}}" });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="grid gap-2"
    >
      <input className="px-3 py-2 rounded-xl border" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="px-3 py-2 rounded-xl border" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      <textarea className="h-40 px-3 py-2 rounded-xl border font-mono text-xs" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      <button className="px-3 py-2 rounded-xl border hover:bg-slate-50">Save</button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────
// app/sequences/page.tsx – basic sequence editor
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function SequencesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sequences"], queryFn: () => api.get("/api/sequences") });
  const create = useMutation({ mutationFn: (form: any) => api.post("/api/sequences", form), onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }) });

  if (isLoading) return <div>Loading…</div>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Existing</h3>
        <ul className="text-sm list-disc pl-5">
          {(data?.items || []).map((s: any) => (
            <li key={s.id}><span className="font-medium">{s.name}</span> — {s.is_active ? "Active" : "Paused"}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Create new</h3>
        <SequenceForm onSubmit={(form) => create.mutate(form)} />
      </div>
    </div>
  );
}

function SequenceForm({ onSubmit }: { onSubmit: (f: any) => void }) {
  const [name, setName] = React.useState("");
  const [steps, setSteps] = React.useState([{ offsetDays: 0, templateId: "", channel: "email" }]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, steps }); }} className="grid gap-2">
      <input className="px-3 py-2 rounded-xl border" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="rounded-xl border p-3">
        <div className="text-xs text-slate-500 mb-2">Steps</div>
        {steps.map((s, i) => (
          <div key={i} className="grid sm:grid-cols-3 gap-2 mb-2">
            <input type="number" className="px-3 py-2 rounded-xl border" value={s.offsetDays} onChange={(e) => update(i, { offsetDays: Number(e.target.value) })} placeholder="Offset (days)" />
            <input className="px-3 py-2 rounded-xl border" value={s.templateId} onChange={(e) => update(i, { templateId: e.target.value })} placeholder="Template ID" />
            <select className="px-3 py-2 rounded-xl border" value={s.channel} onChange={(e) => update(i, { channel: e.target.value })}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        ))}
        <button type="button" className="px-2 py-1.5 rounded-full border text-xs" onClick={() => setSteps([...steps, { offsetDays: 3, templateId: "", channel: "email" }])}>+ Add step</button>
      </div>
      <button className="px-3 py-2 rounded-xl border hover:bg-slate-50">Save sequence</button>
    </form>
  );
  function update(i: number, patch: any) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
}

// ──────────────────────────────────────────────────────────────
// app/activity/page.tsx – activity feed
// ──────────────────────────────────────────────────────────────
"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ActivityPage() {
  const { data, isLoading } = useQuery({ queryKey: ["activity"], queryFn: () => api.get("/api/activity") });
  if (isLoading) return <div>Loading…</div>;
  const rows = data?.items || [];
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h2 className="font-semibold mb-3">Activity</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            {["When", "Type", "Invoice", "Status", "Detail"].map((h) => (
              <th key={h} className="px-2 py-2 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b">
              <td className="px-2 py-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-2 py-2">{r.channel}</td>
              <td className="px-2 py-2">{r.invoice_id}</td>
              <td className="px-2 py-2">{r.status}</td>
              <td className="px-2 py-2 text-slate-600">{r.detail ? JSON.stringify(r.detail) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// app/settings/page.tsx – branding/channels/billing shortcuts
// ──────────────────────────────────────────────────────────────
"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [branding, setBranding] = useState < any > ({ fromName: "Kind Ledger", logoUrl: "" });
  const [channels, setChannels] = useState < any > ({ email: { provider: "resend", status: "not_configured" }, sms: { enabled: false } });

  useEffect(() => {
    (async () => {
      try { setBranding(await api.get("/api/settings/branding")); } catch { }
      try { setChannels(await api.get("/api/settings/channels")); } catch { }
    })();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Branding</h3>
        <input className="w-full px-3 py-2 rounded-xl border mb-2" placeholder="From name" value={branding.fromName}
          onChange={(e) => setBranding({ ...branding, fromName: e.target.value })} />
        <input className="w-full px-3 py-2 rounded-xl border mb-2" placeholder="Logo URL" value={branding.logoUrl}
          onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} />
        <button className="px-3 py-2 rounded-xl border hover:bg-slate-50" onClick={() => api.post("/api/settings/branding", branding).then(() => alert("Saved"))}>Save</button>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <h3 className="font-semibold mb-2">Channels</h3>
        <div className="text-sm text-slate-600 mb-2">Email provider: {channels.email?.provider} — {channels.email?.status}</div>
        <button className="px-3 py-2 rounded-xl border hover:bg-slate-50" onClick={() => api.post("/api/settings/channels", channels).then(() => alert("Saved"))}>Save</button>
        <div className="mt-4">
          <button className="px-3 py-2 rounded-xl border hover:bg-slate-50" onClick={() => (window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/billing/portal`)}>Open billing portal</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// lib/api.ts – super-simple API helper with base URL & JSON
// ──────────────────────────────────────────────────────────────
export const api = {
  async get(path: string) {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, { credentials: "include" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path: string, body?: any) {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
};

// ──────────────────────────────────────────────────────────────
// providers/QueryProvider.tsx – React Query setup
// ──────────────────────────────────────────────────────────────
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ──────────────────────────────────────────────────────────────
// app/globals.css – Tailwind base + light styling
// ──────────────────────────────────────────────────────────────
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color - scheme: light; }

// ──────────────────────────────────────────────────────────────
// tailwind.config.ts – minimal Tailwind config
// (place this at apps/web/tailwind.config.ts)
// ──────────────────────────────────────────────────────────────
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./providers/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;

// ──────────────────────────────────────────────────────────────
// postcss.config.js – required by Tailwind
// ──────────────────────────────────────────────────────────────
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

// ──────────────────────────────────────────────────────────────
// next.config.ts – allow env passthrough for API URL
// ──────────────────────────────────────────────────────────────
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
};
export default nextConfig;

// ──────────────────────────────────────────────────────────────
// package.json – dependencies you need (apps/web/package.json)
// If you already have these, keep your versions; just ensure the deps exist.
// ──────────────────────────────────────────────────────────────
{
  "name": "@kind-ledger/web",
    "private": true,
      "scripts": {
    "dev": "next dev -p 3000",
      "build": "next build",
        "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "14.2.10",
      "react": "18.3.1",
        "react-dom": "18.3.1",
          "@tanstack/react-query": "5.59.0",
            "tailwindcss": "3.4.10",
              "autoprefixer": "10.4.20",
                "postcss": "8.4.44"
  },
  "devDependencies": {
    "typescript": "5.6.2"
  }
}

// ──────────────────────────────────────────────────────────────
// .env.local – put this in apps/web/.env.local (example values)
// ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL = http://localhost:4001
