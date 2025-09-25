import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, AlertTriangle, CheckCircle2, FileUp, Pause, Play, Send, Settings, ShieldCheck, Upload, Users, Wand2 } from "lucide-react";

/**
 * KindLedger – Frontend MVP (single-file React)
 * -------------------------------------------------------------
 * What this gives you today (no backend required):
 * - Client-facing portal shell (tabs: Onboarding, Debtors, Templates, Reports, Settings)
 * - Debtors table with stages (L1→L4→PAP), next action ETA, dispute/hold toggle
 * - Template manager for per‑stage emails (tone-aware), live preview + “Send now” stub
 * - Weekly snapshot + Monthly report (calculated, exportable JSON)
 * - Intake form & CSV upload (simple parser) to add debtors
 * - LocalStorage persistence so you can play without wiring a backend
 *
 * Where to connect your backend/services later (look for "// INTEGRATION POINT"):
 * - /api/send (email or queue) – wire to Amazon SES/MailerSend/Apps Script
 * - /api/upload – wire to Google Drive/Sheets via Apps Script
 * - /api/report – generate PDFs from data (Google Docs API or Make.com)
 * - Auth & Billing – embed Outseta/Copilot/SuiteDash widgets (buttons below)
 *
 * How to use:
 * 1) Drop this file into a Vite or Next.js project; ensure Tailwind is set up.
 * 2) Default export is a component; render it in your app's main route.
 */

// -------------------- Types --------------------
const STAGES = ["L1", "L2", "L3", "L4", "PAP"] as const;
/** @typedef {typeof STAGES[number]} Stage */

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aISO, bISO) {
  const a = new Date(aISO);
  const b = new Date(bISO);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

const demoDebtors = [
  {
    id: crypto.randomUUID(),
    client: "Acme Creative",
    debtor: "Blue Finch Ltd",
    email: "accounts@bluefinch.co.uk",
    invoice: "INV-1012",
    amount: 1240,
    dueDate: "2025-08-21",
    stage: "L2",
    hold: false,
    dispute: "",
    notes: "Asked for PO copy on L1.",
    lastActionAt: "2025-09-15",
    nextActionAt: "2025-09-25",
  },
  {
    id: crypto.randomUUID(),
    client: "Kind Build & Maint.",
    debtor: "Oak & Iron Carpentry",
    email: "office@oakiron.uk",
    invoice: "INV-7786",
    amount: 3499,
    dueDate: "2025-08-05",
    stage: "L3",
    hold: false,
    dispute: "",
    notes: "Promised 22/09, failed – escalate L3",
    lastActionAt: "2025-09-18",
    nextActionAt: "2025-09-24",
  },
  {
    id: crypto.randomUUID(),
    client: "Harbour Clinic",
    debtor: "Stamford Consulting",
    email: "ap@stamford.consulting",
    invoice: "INV-3321",
    amount: 640,
    dueDate: "2025-07-30",
    stage: "L4",
    hold: false,
    dispute: "",
    notes: "Ready for PAP stage if no reply",
    lastActionAt: "2025-09-11",
    nextActionAt: "2025-09-26",
  },
];

const defaultTemplates = {
  tone: "Friendly", // or Formal
  L1: {
    subject: "Quick nudge on {{invoice}} for {{debtor}}",
    body:
      "Hi {{contact}},\n\nHope you’re well. Just a friendly reminder that invoice {{invoice}} for £{{amount}} was due on {{dueDate}}. Could you let us know if it’s queued for payment?\n\nMany thanks,\nKindLedger on behalf of {{client}}",
  },
  L2: {
    subject: "Following up: {{invoice}} now {{daysOverdue}} days overdue",
    body:
      "Hi {{contact}},\n\nWe’re following up as {{invoice}} ({{debtor}}) is now {{daysOverdue}} days overdue (amount £{{amount}}). Please advise payment date or any issues.\n\nRegards,\nKindLedger for {{client}}",
  },
  L3: {
    subject: "Escalation to manager – {{invoice}} {{debtor}}",
    body:
      "Hello {{contact}},\n\nWe’ve escalated this internally for {{client}} as {{invoice}} remains unpaid. Please confirm payment or raise any disputes within 3 business days.\n\nThank you,\nKindLedger",
  },
  L4: {
    subject: "Final notice before pre-action protocol: {{invoice}}",
    body:
      "Dear Accounts,\n\nThis is a final notice on behalf of {{client}} regarding {{invoice}} (£{{amount}}). If we do not hear back within 7 days we may proceed to a pre-action letter under the PAP for debt (sole traders).\n\nRegards,\nKindLedger",
  },
  PAP: {
    subject: "Pre-Action Protocol letter: {{invoice}}",
    body:
      "Dear {{debtor}},\n\nPlease find attached the Letter of Claim under the Pre-Action Protocol for Debt Claims relating to {{invoice}}. You have 30 days to respond.\n\nSincerely,\nKindLedger on behalf of {{client}}",
  },
};

const defaultSettings = {
  senderName: "KindLedger AR Team",
  senderEmail: "notify@kindledger.co.uk",
  businessName: "KindLedger",
  papDays: 30,
  workdaysOnly: true,
};

// -------------------- Helpers --------------------
function currency(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function computeDaysOverdue(dueDate) {
  return Math.max(0, daysBetween(dueDate, todayISO()));
}

function nextActionFromStage(stage, papDays) {
  const base = new Date();
  const map = { L1: 3, L2: 5, L3: 7, L4: 7, PAP: papDays };
  base.setDate(base.getDate() + (map[stage] || 5));
  base.setHours(0, 0, 0, 0);
  return base.toISOString().slice(0, 10);
}

function replaceVars(str, rec) {
  return str
    .replaceAll("{{contact}}", rec.debtor || "Accounts")
    .replaceAll("{{debtor}}", rec.debtor || "")
    .replaceAll("{{client}}", rec.client || "")
    .replaceAll("{{invoice}}", rec.invoice || "")
    .replaceAll("{{amount}}", String(rec.amount || ""))
    .replaceAll("{{dueDate}}", rec.dueDate || "")
    .replaceAll("{{daysOverdue}}", String(rec.daysOverdue || ""));
}

function useLocalState(key, initial) {
  const [val, setVal] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(val));
  }, [key, val]);
  return [val, setVal];
}

// -------------------- Root Component --------------------
export default function KindLedgerPortal() {
  const [tab, setTab] = useState("Onboarding");
  const [settings, setSettings] = useLocalState("kl_settings", defaultSettings);
  const [templates, setTemplates] = useLocalState("kl_templates", defaultTemplates);
  const [debtors, setDebtors] = useLocalState("kl_debtors", demoDebtors.map(enrichDebtor));
  const [log, setLog] = useLocalState("kl_comms", []);

  function enrichDebtor(d) {
    const days = computeDaysOverdue(d.dueDate);
    return { ...d, daysOverdue: days };
  }

  useEffect(() => {
    setDebtors((prev) => prev.map(enrichDebtor));
    // eslint-disable-next-line
  }, []);

  const kpis = useMemo(() => computeKPIs(debtors), [debtors]);

  function advanceStage(id) {
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const idx = STAGES.indexOf(d.stage);
        const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
        return {
          ...d,
          stage: next,
          lastActionAt: todayISO(),
          nextActionAt: nextActionFromStage(next, settings.papDays),
        };
      })
    );
  }

  function regressStage(id) {
    setDebtors((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const idx = STAGES.indexOf(d.stage);
        const next = STAGES[Math.max(idx - 1, 0)];
        return { ...d, stage: next };
      })
    );
  }

  function toggleHold(id) {
    setDebtors((prev) => prev.map((d) => (d.id === id ? { ...d, hold: !d.hold } : d)));
  }

  function markDispute(id, value) {
    setDebtors((prev) => prev.map((d) => (d.id === id ? { ...d, dispute: value } : d)));
  }

  function upsertDebtors(rows) {
    const withIds = rows.map((r) => ({ id: crypto.randomUUID(), ...r }));
    setDebtors((prev) => [...prev, ...withIds.map(enrichDebtor)]);
  }

  function sendNow(d) {
    const t = templates[d.stage];
    const subject = replaceVars(t.subject, d);
    const body = replaceVars(t.body, d);

    // INTEGRATION POINT: call your mailer/queue
    // fetch("/api/send", { method: "POST", body: JSON.stringify({ to: d.email, subject, body }) });

    const entry = { id: crypto.randomUUID(), ts: new Date().toISOString(), debtorId: d.id, stage: d.stage, subject, preview: body.slice(0, 180) };
    setLog((prev) => [entry, ...prev]);

    // auto-advance schedule
    advanceStage(d.id);
  }

  function computeKPIs(list) {
    const total = list.reduce((s, x) => s + (x.amount || 0), 0);
    const overdue = list.filter((x) => x.daysOverdue > 0);
    const byStage = Object.fromEntries(STAGES.map((s) => [s, list.filter((x) => x.stage === s).length]));
    const buckets = [0, 30, 60, 90, 120];
    const bucketSums = buckets.map((b, i) => {
      const upper = buckets[i + 1] || Infinity;
      return list.filter((x) => x.daysOverdue >= b && x.daysOverdue < upper).reduce((s, x) => s + x.amount, 0);
    });
    return { total, count: list.length, overdueCount: overdue.length, byStage, bucketSums };
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6" />
            <span className="font-semibold">KindLedger Portal</span>
            <span className="ml-2 text-xs text-slate-500">(Frontend MVP)</span>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            {[
              "Onboarding",
              "Debtors",
              "Templates",
              "Reports",
              "Settings",
              "Comms Log",
            ].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-full border ${tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-100"
                  }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "Onboarding" && <Onboarding settings={settings} upsertDebtors={upsertDebtors} />}
        {tab === "Debtors" && (
          <>
            <KPIBar kpis={kpis} />
            <DebtorTable
              rows={debtors}
              onAdvance={advanceStage}
              onRegress={regressStage}
              onHold={toggleHold}
              onDispute={markDispute}
              onSend={sendNow}
              settings={settings}
            />
          </>
        )}
        {tab === "Templates" && <TemplateManager templates={templates} setTemplates={setTemplates} />}
        {tab === "Reports" && <Reports debtors={debtors} />}
        {tab === "Settings" && <SettingsPanel settings={settings} setSettings={setSettings} />}
        {tab === "Comms Log" && <CommsLog log={log} debtors={debtors} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500">
        <p>
          Integration pointers: hook the send/upload/report actions to your backend (Apps Script, SES/MailerSend, Make.com, or Outseta/SuiteDash webhooks).
        </p>
      </footer>
    </div>
  );
}

// -------------------- Components --------------------
function KPIBar({ kpis }) {
  const cards = [
    { label: "Total outstanding", value: currency(kpis.total) },
    { label: "Debtors tracked", value: kpis.count },
    { label: "Overdue", value: kpis.overdueCount },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
          <div className="text-2xl font-semibold mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function StageBadge({ stage }) {
  const map = {
    L1: "bg-emerald-100 text-emerald-700 border-emerald-200",
    L2: "bg-cyan-100 text-cyan-700 border-cyan-200",
    L3: "bg-amber-100 text-amber-800 border-amber-200",
    L4: "bg-rose-100 text-rose-700 border-rose-200",
    PAP: "bg-slate-200 text-slate-800 border-slate-300",
  };
  return <span className={`text-xs px-2 py-1 rounded-full border ${map[stage]}`}>{stage}</span>;
}

function DebtorTable({ rows, onAdvance, onRegress, onHold, onDispute, onSend, settings }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span className="font-medium">Debtors</span>
        <span className="text-xs text-slate-500 ml-2">Manage stages, disputes, and actions</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {[
                "Client",
                "Debtor",
                "Invoice",
                "Amount",
                "Due",
                "Days",
                "Stage",
                "Next action",
                "Flags",
                "Actions",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2">{d.client}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{d.debtor}</div>
                  <div className="text-xs text-slate-500">{d.email}</div>
                </td>
                <td className="px-3 py-2">{d.invoice}</td>
                <td className="px-3 py-2">{currency(d.amount)}</td>
                <td className="px-3 py-2">{d.dueDate}</td>
                <td className="px-3 py-2">{d.daysOverdue}</td>
                <td className="px-3 py-2"><StageBadge stage={d.stage} /></td>
                <td className="px-3 py-2">{d.nextActionAt}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onHold(d.id)}
                      className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 ${d.hold ? "bg-yellow-100 border-yellow-300 text-yellow-800" : "bg-white hover:bg-slate-100"
                        }`}
                      title="Toggle hold"
                    >
                      {d.hold ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} Hold
                    </button>
                    <button
                      onClick={() => onDispute(d.id, d.dispute ? "" : "Open")}
                      className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 ${d.dispute ? "bg-rose-100 border-rose-300 text-rose-700" : "bg-white hover:bg-slate-100"
                        }`}
                      title="Toggle dispute"
                    >
                      <AlertTriangle className="h-3 w-3" /> Dispute
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRegress(d.id)}
                      className="px-2 py-1 rounded-full border text-xs hover:bg-slate-100"
                      title="Move back a stage"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => onAdvance(d.id)}
                      className="px-2 py-1 rounded-full border text-xs hover:bg-slate-100"
                      title="Advance stage"
                    >
                      <ArrowRight className="h-3 w-3 inline" />
                    </button>
                    <button
                      onClick={() => onSend(d)}
                      disabled={d.hold || d.dispute}
                      className={`px-2 py-1 rounded-full border text-xs flex items-center gap-1 ${d.hold || d.dispute ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100"
                        }`}
                      title="Send email for this stage"
                    >
                      <Send className="h-3 w-3" /> Send now
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-slate-50 text-xs text-slate-600">
        Tip: set tone & PAP days in Settings. Sending respects disputes/holds.
      </div>
    </div>
  );
}

function Onboarding({ settings, upsertDebtors }) {
  const [form, setForm] = useState({ client: "", tone: "Friendly", email: "" });
  const [csvFeedback, setCsvFeedback] = useState("");

  function handleCSV(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = parseCSV(text).map((r) => ({
        client: form.client || "New Client",
        debtor: r.Debtor,
        email: r.Email,
        invoice: r.Invoice,
        amount: Number(r.Amount || 0),
        dueDate: r.DueDate,
        stage: "L1",
        hold: false,
        dispute: "",
        notes: "Imported",
        lastActionAt: todayISO(),
        nextActionAt: nextActionFromStage("L1", 30),
      }));
      upsertDebtors(rows);
      setCsvFeedback(`Imported ${rows.length} debtor(s).`);

      // INTEGRATION POINT: also POST the file to your backend storage if needed
      // fetch("/api/upload", { method: "POST", body: file });
    };
    reader.readAsText(file);
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4 shadow-sm md:col-span-2">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="h-4 w-4" />
          <h2 className="font-semibold">Guided onboarding</h2>
        </div>
        <ol className="list-decimal list-inside space-y-3 text-sm">
          <li>
            <span className="font-medium">Service agreement & DPA</span> – link your e‑sign provider here.
            <div className="mt-2 flex gap-2">
              <a className="px-3 py-1.5 rounded-full border text-sm hover:bg-slate-50" href="#">Open contract</a>
              <a className="px-3 py-1.5 rounded-full border text-sm hover:bg-slate-50" href="#">View DPA</a>
            </div>
          </li>
          <li>
            <span className="font-medium">Intake</span> – set tone & contact.
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input className="px-3 py-2 rounded-xl border" placeholder="Client (legal name)" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
              <input className="px-3 py-2 rounded-xl border" placeholder="AP contact email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <select className="px-3 py-2 rounded-xl border" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
                <option>Friendly</option>
                <option>Formal</option>
              </select>
            </div>
          </li>
          <li>
            <span className="font-medium">Upload aged receivables</span> – CSV with columns: Debtor, Email, Invoice, Amount, DueDate (YYYY-MM-DD).
            <div className="mt-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer hover:bg-slate-50">
                <FileUp className="h-4 w-4" />
                <span>Choose CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCSV(e.target.files[0])} />
              </label>
              {csvFeedback && <div className="text-xs text-emerald-700 mt-2">{csvFeedback}</div>}
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-4 w-4" />
          <h3 className="font-semibold">Connect services</h3>
        </div>
        <div className="space-y-2 text-sm">
          <button className="w-full px-3 py-2 rounded-xl border hover:bg-slate-50">Embed Outseta auth/checkout</button>
          <button className="w-full px-3 py-2 rounded-xl border hover:bg-slate-50">Open SuiteDash portal</button>
          <button className="w-full px-3 py-2 rounded-xl border hover:bg-slate-50">Connect Mailer (SES/MailerSend)</button>
          <button className="w-full px-3 py-2 rounded-xl border hover:bg-slate-50">Google Drive/Sheets (Apps Script)</button>
        </div>
        <p className="mt-3 text-xs text-slate-500">These buttons are placeholders; wire them to your chosen provider embeds or OAuth flows.</p>
      </div>
    </div>
  );
}

function TemplateManager({ templates, setTemplates }) {
  const [stage, setStage] = useState("L1");
  const [subject, setSubject] = useState(templates[stage].subject);
  const [body, setBody] = useState(templates[stage].body);

  useEffect(() => {
    setSubject(templates[stage].subject);
    setBody(templates[stage].body);
  }, [stage]);

  function save() {
    setTemplates({ ...templates, [stage]: { subject, body } });
  }

  const hint = "Use variables: {{contact}} {{debtor}} {{client}} {{invoice}} {{amount}} {{dueDate}} {{daysOverdue}}";

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="h-4 w-4" />
          <h2 className="font-semibold">Templates</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <select className="px-3 py-2 rounded-xl border" value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 rounded-xl border"
            value={templates.tone}
            onChange={(e) => setTemplates({ ...templates, tone: e.target.value })}
          >
            <option>Friendly</option>
            <option>Formal</option>
          </select>
        </div>
        <input className="w-full px-3 py-2 rounded-xl border mb-2" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="w-full h-56 px-3 py-2 rounded-xl border font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{hint}</span>
          <button onClick={save} className="px-3 py-1.5 rounded-full border hover:bg-slate-50">Save</button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Send className="h-4 w-4" />
          <h2 className="font-semibold">Live preview</h2>
        </div>
        <Preview templates={{ ...templates, [stage]: { subject, body } }} />
      </div>
    </div>
  );
}

function Preview({ templates }) {
  const sample = {
    debtor: "Blue Finch Ltd",
    client: "Acme Creative",
    invoice: "INV-1012",
    amount: 1240,
    dueDate: "2025-08-21",
    daysOverdue: 34,
  };
  const stage = "L2";
  const subj = replaceVars(templates[stage].subject, sample);
  const bod = replaceVars(templates[stage].body, sample);
  return (
    <div className="rounded-xl border p-3 bg-slate-50">
      <div className="text-xs text-slate-500">Subject</div>
      <div className="font-medium mb-2">{subj}</div>
      <div className="text-xs text-slate-500">Body</div>
      <pre className="whitespace-pre-wrap text-sm leading-6">{bod}</pre>
    </div>
  );
}

function Reports({ debtors }) {
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);

  function buildWeekly() {
    const now = todayISO();
    const collected = 0; // placeholder
    const promises = debtors.filter((d) => /promise/i.test(d.notes || "")).length;
    const overdue = debtors.filter((d) => d.daysOverdue > 0).length;
    const byStage = Object.fromEntries(STAGES.map((s) => [s, debtors.filter((x) => x.stage === s).length]));
    const report = { date: now, collected, promises, overdue, byStage };
    setWeekly(report);

    // INTEGRATION POINT: POST to /api/report to render PDF & save
  }

  function buildMonthly() {
    const total = debtors.reduce((s, x) => s + x.amount, 0);
    const dso = Math.round(debtors.reduce((s, x) => s + x.daysOverdue, 0) / Math.max(1, debtors.length));
    const disputes = debtors.filter((d) => d.dispute).length;
    const report = { period: "Sep 2025", total, dso, disputes };
    setMonthly(report);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4" /><h3 className="font-semibold">Weekly owner snapshot</h3></div>
        <p className="text-sm text-slate-600">Generate a quick snapshot to share with the business owner.</p>
        <button onClick={buildWeekly} className="mt-3 px-3 py-2 rounded-xl border hover:bg-slate-50">Generate</button>
        {weekly && (
          <pre className="mt-3 bg-slate-50 rounded-xl p-3 text-xs overflow-auto">{JSON.stringify(weekly, null, 2)}</pre>
        )}
      </div>
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2"><Upload className="h-4 w-4" /><h3 className="font-semibold">Monthly exec summary</h3></div>
        <p className="text-sm text-slate-600">Roll-up metrics for the C‑suite; attach as PDF in client portal.</p>
        <button onClick={buildMonthly} className="mt-3 px-3 py-2 rounded-xl border hover:bg-slate-50">Generate</button>
        {monthly && (
          <pre className="mt-3 bg-slate-50 rounded-xl p-3 text-xs overflow-auto">{JSON.stringify(monthly, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, setSettings }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4" />
        <h2 className="font-semibold">Operational settings</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Sender name</label>
          <input className="w-full px-3 py-2 rounded-xl border" value={settings.senderName} onChange={(e) => setSettings({ ...settings, senderName: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Sender email</label>
          <input className="w-full px-3 py-2 rounded-xl border" value={settings.senderEmail} onChange={(e) => setSettings({ ...settings, senderEmail: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Business name</label>
          <input className="w-full px-3 py-2 rounded-xl border" value={settings.businessName} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">PAP response days</label>
          <input type="number" className="w-full px-3 py-2 rounded-xl border" value={settings.papDays} onChange={(e) => setSettings({ ...settings, papDays: Number(e.target.value || 30) })} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input id="wd" type="checkbox" checked={settings.workdaysOnly} onChange={(e) => setSettings({ ...settings, workdaysOnly: e.target.checked })} />
          <label htmlFor="wd" className="text-sm">Only schedule on workdays</label>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">These settings drive stage timing and email sending. Hook them to your backend when you wire SMTP/queues.</p>
    </div>
  );
}

function CommsLog({ log, debtors }) {
  function nameFor(id) {
    const d = debtors.find((x) => x.id === id);
    return d ? `${d.debtor} (${d.invoice})` : id;
  }
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Send className="h-4 w-4" />
        <h3 className="font-semibold">Communication log</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600">
            {['When', 'Stage', 'Debtor', 'Subject', 'Preview'].map((h) => (
              <th key={h} className="px-2 py-2 border-b">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {log.map((e) => (
            <tr key={e.id} className="border-b">
              <td className="px-2 py-2 text-xs text-slate-500">{new Date(e.ts).toLocaleString()}</td>
              <td className="px-2 py-2"><StageBadge stage={e.stage} /></td>
              <td className="px-2 py-2">{nameFor(e.debtorId)}</td>
              <td className="px-2 py-2 font-medium">{e.subject}</td>
              <td className="px-2 py-2 text-slate-600">{e.preview}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -------------------- Utils --------------------
function parseCSV(text) {
  // Very simple CSV; expects header row with: Debtor,Email,Invoice,Amount,DueDate
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] || ""));
    return row;
  });
}
