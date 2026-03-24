import React, { useState, useMemo, useEffect, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const WMT_BLUE = '#0071CE';
const GREEN    = '#20c933';
const RED      = '#f82b60';
const AMBER    = '#fcb400';
const YELLOW   = '#FCB400';

// ─── Record shim — makes REST API records behave like Airtable SDK records ────
function wrapRecord(record) {
  return {
    id: record.id,
    getCellValue: (field) => record.fields[field] ?? null,
    getCellValueAsString: (field) => {
      const val = record.fields[field];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object' && !Array.isArray(val) && val.name) return val.name;
      if (Array.isArray(val)) return val.map(v => v?.name || v).join(', ');
      return String(val);
    },
  };
}

// Linked record fields may return [{id,name}] objects OR plain ["recXXX"] strings
// depending on how the record was written. This handles both.
function matchesId(linkedVal, id) {
  if (!linkedVal || !Array.isArray(linkedVal)) return false;
  return linkedVal.some(v => (v?.id ?? v) === id);
}

// ─── Data hook — fetches all tables, polls every 15s ─────────────────────────
function useData() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/data');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData({
        vendors:   json.vendors.map(wrapRecord),
        projects:  json.projects.map(wrapRecord),
        products:  json.products.map(wrapRecord),
        responses: json.responses.map(wrapRecord),
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  return { data, loading, error, refresh: load };
}

// ─── Onboarding overlay ───────────────────────────────────────────────────────
const ONBOARDING_KEY = 'vcp_onboarding_seen';
const ONBOARDING_STEPS = [
  {
    emoji: '🗂',
    title: 'What You\'re Looking At',
    body: 'A two-sided supplier compliance portal built on Airtable. Walmart Global Governance sees a live dashboard — risk by vendor, progress by project, every flagged item in one place. Vendors get a scoped login that shows only their products and deadlines. Same base, two completely different experiences.',
  },
  {
    emoji: '⚙️',
    title: 'How It\'s Built',
    body: 'One service account PAT lives server-side — never touches the client. Vendor login is a lookup against the Vendors table; in production that\'s a call to Azure AD / MSAL instead. This demo is hosted on Vercel. In a WMT deployment it\'d be Azure Functions — same pattern, different runtime. Airtable is the data layer and automation engine throughout.',
  },
  {
    emoji: '📐',
    title: 'Why the Pattern Scales',
    body: 'Walmart has 100k+ suppliers. One service account handles all external traffic — the constraint is API rate limits, not user count. No per-vendor provisioning, no seat math. Global Governance uses Airtable natively. Everyone else routes through the portal. The system gets more valuable as vendor count grows.',
  },
  {
    emoji: '💡',
    title: 'The Conversation to Have',
    body: 'Ask: who owns this spreadsheet today? That\'s your sponsor. This isn\'t a seats pitch — it\'s a solution pitch. "Replace the manual attestation process, own the audit trail, surface regulatory risk before it becomes a fine." Price the system. The seats follow.',
  },
];

function OnboardingOverlay({ onDone }) {
  const [step, setStep] = useState(0);
  const current = ONBOARDING_STEPS[step];
  const isLast  = step === ONBOARDING_STEPS.length - 1;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '14px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ height: '3px', background: '#f3f4f6' }}>
          <div style={{ height: '100%', width: `${((step + 1) / ONBOARDING_STEPS.length) * 100}%`, background: WMT_BLUE, transition: 'width 0.3s' }} />
        </div>
        <div style={{ padding: '32px 32px 28px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>{current.emoji}</div>
            <h2 style={{ margin: '0 0 10px', fontSize: '19px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{current.title}</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: 1.7 }}>{current.body}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '24px' }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={{ width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px', background: i === step ? WMT_BLUE : '#e5e7eb', transition: 'all 0.2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onDone} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'white', color: '#9ca3af', border: '1px solid #e5e7eb', cursor: 'pointer' }}>Skip</button>
            <button onClick={() => isLast ? onDone() : setStep(s => s + 1)} style={{ flex: 2, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, background: WMT_BLUE, color: 'white', border: 'none', cursor: 'pointer' }}>
              {isLast ? 'Get started →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared badges ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = { Confirmed: { bg: '#d1f7c4', text: '#338a17' }, Flagged: { bg: '#ffdce5', text: '#ba1e45' }, Pending: { bg: '#ffeab6', text: '#b87503' } };
  const c = colors[status] || { bg: '#e5e7eb', text: '#6b7280' };
  return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: c.bg, color: c.text }}>{status}</span>;
}
function ProjectStatusBadge({ status }) {
  const colors = { Active: { bg: '#d1f7c4', text: '#338a17' }, Overdue: { bg: '#ffdce5', text: '#ba1e45' }, Draft: { bg: '#e5e9f0', text: '#6b7280' }, Completed: { bg: '#d1e2ff', text: '#1a6ce8' } };
  const c = colors[status] || { bg: '#e5e7eb', text: '#6b7280' };
  return <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: c.bg, color: c.text }}>{status}</span>;
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, vendors, onPreviewAs }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [previewId, setPreviewId] = useState('');

  const handleLogin = () => {
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');
    const match = vendors.find(v => {
      const s = v.getCellValue('Status');
      return v.getCellValueAsString('Email').toLowerCase() === email.toLowerCase()
        && v.getCellValueAsString('Password') === password
        && (s?.name || s) === 'Active';
    });
    setTimeout(() => {
      setLoading(false);
      if (match) onLogin(match);
      else setError('Invalid credentials or account inactive. Try: compliance@sunrisefoods.com / sunrise2026');
    }, 400);
  };

  const inp = { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f7', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '40px 36px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: WMT_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>🔒</div>
          <h1 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: '#111827' }}>Vendor Portal</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Walmart Supplier Compliance</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@company.com" style={inp} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
        </div>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: loading ? '#d1d5db' : WMT_BLUE, color: 'white', border: 'none', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>
        {onPreviewAs && vendors.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0 16px' }}>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' }}>ADMIN PREVIEW</span>
              <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={previewId}
                onChange={e => setPreviewId(e.target.value)}
                style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', color: previewId ? '#111827' : '#9ca3af', outline: 'none', fontFamily: 'inherit', background: 'white', cursor: 'pointer' }}
              >
                <option value="">Select a vendor…</option>
                {vendors.filter(v => (v.getCellValue('Status')?.name || v.getCellValue('Status')) === 'Active').map(v => (
                  <option key={v.id} value={v.id}>{v.getCellValueAsString('Vendor Name')}</option>
                ))}
              </select>
              <button
                onClick={() => { const v = vendors.find(r => r.id === previewId); if (v) onPreviewAs(v); }}
                disabled={!previewId}
                style={{ padding: '9px 16px', borderRadius: '8px', background: previewId ? '#1d4ed8' : '#e5e7eb', color: previewId ? 'white' : '#9ca3af', border: 'none', fontSize: '13px', fontWeight: 700, cursor: previewId ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
              >
                Preview →
              </button>
            </div>
          </>
        )}
        <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', margin: '16px 0 0' }}>Walmart Supplier Compliance Portal · Demo</p>
      </div>
    </div>
  );
}

// ─── Attestation row ──────────────────────────────────────────────────────────
function AttestationRow({ product, existingResponse, onSubmit, submitting }) {
  const name     = product.getCellValueAsString('Product Name');
  const sku      = product.getCellValueAsString('SKU');
  const category = product.getCellValueAsString('Category');
  const flagged  = product.getCellValueAsString('Flagged Ingredient');

  const existingType  = existingResponse ? (existingResponse.getCellValue('Response Type')?.name || existingResponse.getCellValue('Response Type') || null) : null;
  const existingNotes = existingResponse ? existingResponse.getCellValueAsString('Notes') : '';

  const [responseType, setResponseType] = useState(existingType || '');
  const [notes, setNotes]               = useState(existingNotes);
  const [expanded, setExpanded]         = useState(false);
  const isDone = !!existingType;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', borderLeft: isDone ? `3px solid ${existingType === 'Confirmed' ? GREEN : existingType === 'Flagged' ? RED : AMBER}` : '3px solid #e5e7eb' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: expanded ? '#f9fafb' : 'white', userSelect: 'none' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{name}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{sku}</span>
            <span style={{ fontSize: '11px', color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: '4px' }}>{category}</span>
          </div>
          <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#ef4444' }}>⚠ {flagged}</span>
            {isDone && <StatusBadge status={existingType} />}
          </div>
        </div>
        <span style={{ color: '#9ca3af', marginLeft: '12px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '16px', borderTop: '1px solid #f3f4f6' }}>
          {isDone ? (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>RESPONSE SUBMITTED</p>
              <StatusBadge status={existingType} />
              {existingNotes && <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#374151' }}>{existingNotes}</p>}
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>FLAGGED INGREDIENT: <span style={{ color: '#ef4444' }}>{flagged}</span></p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {['Confirmed', 'Flagged', 'Pending'].map(opt => (
                  <button key={opt} onClick={() => setResponseType(opt)} style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${responseType === opt ? (opt === 'Confirmed' ? GREEN : opt === 'Flagged' ? RED : AMBER) : '#e5e7eb'}`, background: responseType === opt ? (opt === 'Confirmed' ? '#d1f7c4' : opt === 'Flagged' ? '#ffdce5' : '#ffeab6') : 'white', color: responseType === opt ? (opt === 'Confirmed' ? '#338a17' : opt === 'Flagged' ? '#ba1e45' : '#b87503') : '#6b7280', cursor: 'pointer' }}>{opt}</button>
                ))}
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={responseType === 'Flagged' ? 'Required: explain the issue and remediation plan' : 'Optional notes'} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => onSubmit(product.id, responseType, notes)} disabled={!responseType || submitting} style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, background: responseType && !submitting ? WMT_BLUE : '#d1d5db', color: 'white', border: 'none', cursor: responseType && !submitting ? 'pointer' : 'not-allowed' }}>
                  {submitting ? 'Saving…' : 'Submit →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vendor project card ──────────────────────────────────────────────────────
function ProjectCard({ project, products, responses, vendorRecord, onRefresh, onExpand, expanded }) {
  const name        = project.getCellValueAsString('Project Name');
  const typeName    = project.getCellValueAsString('Type');
  const statusName  = project.getCellValueAsString('Status');
  const dueDate     = project.getCellValueAsString('Due Date');
  const instructions = project.getCellValueAsString('Instructions');

  const myProducts = products.filter(p => {
    return matchesId(p.getCellValue('Vendor'), vendorRecord.id);
  });
  const myResponses = responses.filter(r =>
    matchesId(r.getCellValue('Project'), project.id) && matchesId(r.getCellValue('Vendor'), vendorRecord.id)
  );
  const responseByProduct = {};
  for (const r of myResponses) {
    const prods = r.getCellValue('Product');
    if (prods && Array.isArray(prods)) prods.filter(Boolean).forEach(p => { responseByProduct[p?.id ?? p] = r; });
  }

  const totalItems = myProducts.length;
  const doneItems  = myProducts.filter(p => responseByProduct[p.id]).length;
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (productId, responseType, notes) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const vendorName = vendorRecord.getCellValueAsString('Vendor Name');
      await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            'Response ID':   `${vendorName.split(' ')[0].toUpperCase()}-${Date.now()}`,
            'Project':       [project.id],
            'Vendor':        [vendorRecord.id],
            'Product':       [productId],
            'Response Type': responseType,
            'Notes':         notes,
            'Submitted By':  vendorName,
            'Submitted At':  new Date().toISOString(),
          },
        }),
      });
      await onRefresh();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: 'white', borderRadius: '10px', marginBottom: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div onClick={onExpand} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', userSelect: 'none' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{name}</span>
            <ProjectStatusBadge status={statusName} />
            {typeName && <span style={{ fontSize: '11px', color: WMT_BLUE, background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{typeName}</span>}
          </div>
          {dueDate && <p style={{ margin: 0, fontSize: '12px', color: statusName === 'Overdue' ? '#ef4444' : '#6b7280' }}>{statusName === 'Overdue' ? '⚠ Overdue · ' : ''}Due {dueDate}</p>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {totalItems > 0 && <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 700, color: doneItems === totalItems ? GREEN : '#374151' }}>{doneItems}/{totalItems} items</p>}
          <span style={{ color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
          {instructions && (
            <div style={{ background: '#f9fafb', borderRadius: '6px', padding: '12px 14px', marginTop: '16px', marginBottom: '16px', borderLeft: `3px solid ${YELLOW}` }}>
              <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructions</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>{instructions}</p>
            </div>
          )}
          {myProducts.length > 0 ? (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Products ({myProducts.length})</p>
              {myProducts.map(p => <AttestationRow key={p.id} product={p} existingResponse={responseByProduct[p.id] || null} onSubmit={handleSubmit} submitting={submitting} />)}
            </div>
          ) : (
            <p style={{ margin: '16px 0 0', fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No products linked to your account for this project.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Vendor dashboard ─────────────────────────────────────────────────────────
function VendorDashboard({ vendorRecord, projects, products, responses, onLogout, onRefresh }) {
  const vendorName    = vendorRecord.getCellValueAsString('Vendor Name');
  const [expandedId, setExpandedId] = useState(null);

  const myProjects   = projects.filter(proj => {
    return matchesId(proj.getCellValue('Assigned Vendors'), vendorRecord.id);
  });
  const activeCount  = myProjects.filter(p => p.getCellValueAsString('Status') === 'Active').length;
  const overdueCount = myProjects.filter(p => p.getCellValueAsString('Status') === 'Overdue').length;

  return (
    <div style={{ minHeight: '100vh', background: '#f2f4f7' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: WMT_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🏢</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#111827' }}>Vendor Portal</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>Walmart Supplier Compliance</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>{vendorName}</span>
            <button onClick={onLogout} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Assigned Projects', value: myProjects.length, color: '#111827' },
            { label: 'Active', value: activeCount, color: GREEN },
            { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? RED : '#9ca3af' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '8px', padding: '16px 20px', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Compliance Projects</p>
        {myProjects.length === 0
          ? <div style={{ background: 'white', borderRadius: '10px', padding: '40px', textAlign: 'center', border: '1px solid #e5e7eb' }}><p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>No projects assigned to your account.</p></div>
          : myProjects.map(proj => <ProjectCard key={proj.id} project={proj} products={products} responses={responses} vendorRecord={vendorRecord} onRefresh={onRefresh} expanded={expandedId === proj.id} onExpand={() => setExpandedId(id => id === proj.id ? null : proj.id)} />)
        }
      </div>
    </div>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────
function AdminPanel({ vendors, projects, products, responses, onPreviewAs }) {
  const [activeTab,      setActiveTab]      = useState('overview');
  const [expandedVendor, setExpandedVendor] = useState(null);

  const RISK_COLORS = { High: { bg: '#ffdce5', text: '#ba1e45' }, Medium: { bg: '#ffeab6', text: '#b87503' }, Low: { bg: '#d1e2ff', text: '#1a6ce8' }, Clear: { bg: '#d1f7c4', text: '#338a17' } };

  const activeVendors     = vendors.filter(v => v.getCellValueAsString('Status') === 'Active');
  const totalResponses    = responses.length;
  const flaggedResponses  = responses.filter(r => r.getCellValueAsString('Response Type') === 'Flagged').length;
  const confirmedResponses = responses.filter(r => r.getCellValueAsString('Response Type') === 'Confirmed').length;
  const pendingResponses  = responses.filter(r => r.getCellValueAsString('Response Type') === 'Pending').length;
  const activeProjects    = projects.filter(p => p.getCellValueAsString('Status') === 'Active').length;
  const overdueProjects   = projects.filter(p => p.getCellValueAsString('Status') === 'Overdue').length;

  const vendorSummaries = useMemo(() => activeVendors.map(v => {
    const myProducts  = products.filter(p    => matchesId(p.getCellValue('Vendor'), v.id));
    const myResponses = responses.filter(r   => matchesId(r.getCellValue('Vendor'), v.id));
    const myProjects  = projects.filter(proj => matchesId(proj.getCellValue('Assigned Vendors'), v.id));
    const confirmed   = myResponses.filter(r => r.getCellValueAsString('Response Type') === 'Confirmed').length;
    const flagged     = myResponses.filter(r => r.getCellValueAsString('Response Type') === 'Flagged').length;
    const pending     = myResponses.filter(r => r.getCellValueAsString('Response Type') === 'Pending').length;
    const total       = myProducts.length;
    const submitted   = myResponses.length;
    const pct         = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const hasOverdue  = myProjects.some(p => p.getCellValueAsString('Status') === 'Overdue');
    const riskLevel   = flagged > 0 ? 'High' : hasOverdue ? 'Medium' : pending > 0 ? 'Low' : 'Clear';
    return { id: v.id, name: v.getCellValueAsString('Vendor Name'), email: v.getCellValueAsString('Email'), total, submitted, confirmed, flagged, pending, pct, riskLevel, myProjects };
  }), [activeVendors, products, responses, projects]);

  const projectSummaries = useMemo(() => projects.map(proj => {
    const projResponses = responses.filter(r => matchesId(r.getCellValue('Project'), proj.id));
    const assigned      = proj.getCellValue('Assigned Vendors') || [];
    const totalV        = assigned.filter(Boolean).length;
    const responded     = new Set(projResponses.map(r => { const l = r.getCellValue('Vendor'); return l && (l[0]?.id ?? l[0]); }).filter(Boolean)).size;
    const flaggedCount  = projResponses.filter(r => r.getCellValueAsString('Response Type') === 'Flagged').length;
    return { id: proj.id, name: proj.getCellValueAsString('Project Name'), status: proj.getCellValueAsString('Status'), type: proj.getCellValueAsString('Type'), dueDate: proj.getCellValueAsString('Due Date'), totalVendors: totalV, responded, flaggedCount, pct: totalV > 0 ? Math.round((responded / totalV) * 100) : 0 };
  }), [projects, responses]);

  const flaggedItems = useMemo(() => responses.filter(r => r.getCellValueAsString('Response Type') === 'Flagged').map(r => {
    const projId = r.getCellValue('Project')?.[0]?.id;
    const vendId = r.getCellValue('Vendor')?.[0]?.id;
    const prodId = r.getCellValue('Product')?.[0]?.id;
    return { id: r.id, project: projects.find(p => p.id === projId)?.getCellValueAsString('Project Name') || '—', vendor: vendors.find(v => v.id === vendId)?.getCellValueAsString('Vendor Name') || '—', product: products.find(p => p.id === prodId)?.getCellValueAsString('Product Name') || '—', notes: r.getCellValueAsString('Notes'), submittedAt: r.getCellValueAsString('Submitted At') };
  }), [responses, projects, vendors, products]);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'vendors',  label: `Vendors (${vendorSummaries.length})` },
    { key: 'projects', label: `Projects (${projects.length})` },
    { key: 'flagged',  label: `Flagged Items${flaggedItems.length > 0 ? ` (${flaggedItems.length})` : ''}` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f2f4f7' }}>
      <div style={{ background: WMT_BLUE, padding: '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🏛</span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'white' }}>Global Governance Dashboard</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Walmart Supplier Compliance · Admin View</p>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: '20px', fontWeight: 600 }}>ADMIN</span>
        </div>
      </div>
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex' }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === tab.key ? WMT_BLUE : '#6b7280', borderBottom: activeTab === tab.key ? `2px solid ${WMT_BLUE}` : '2px solid transparent', marginBottom: '-1px', whiteSpace: 'nowrap' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Active Vendors',        value: activeVendors.length, color: '#111827' },
                { label: 'Active Projects',        value: activeProjects,       color: WMT_BLUE },
                { label: 'Overdue',                value: overdueProjects,      color: overdueProjects > 0 ? RED : '#9ca3af' },
                { label: 'Flagged Items',          value: flaggedResponses,     color: flaggedResponses > 0 ? RED : '#9ca3af' },
                { label: 'Responses Submitted',    value: totalResponses,       color: GREEN },
              ].map(s => (
                <div key={s.label} style={{ background: 'white', borderRadius: '8px', padding: '16px 20px', border: '1px solid #e5e7eb' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '10px', padding: '20px', border: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>Response Breakdown</p>
                {[
                  { label: 'Confirmed', value: confirmedResponses, color: GREEN },
                  { label: 'Flagged',   value: flaggedResponses,   color: RED },
                  { label: 'Pending',   value: pendingResponses,   color: AMBER },
                ].map(item => {
                  const pct = totalResponses > 0 ? Math.round((item.value / totalResponses) * 100) : 0;
                  return (
                    <div key={item.label} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{item.label}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.value} · {pct}%</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: '#f3f4f6' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: 'white', borderRadius: '10px', padding: '20px', border: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>Risk Summary by Vendor</p>
                {vendorSummaries.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', background: '#f9fafb', marginBottom: '6px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>{v.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{v.submitted}/{v.total} items submitted</p>
                    </div>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: RISK_COLORS[v.riskLevel].bg, color: RISK_COLORS[v.riskLevel].text }}>{v.riskLevel}</span>
                  </div>
                ))}
              </div>
            </div>
            {flaggedItems.length > 0 && (
              <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #fecaca', borderLeft: `3px solid ${RED}`, padding: '20px' }}>
                <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#ba1e45' }}>⚠ Flagged Items Requiring Attention ({flaggedItems.length})</p>
                {flaggedItems.map(item => (
                  <div key={item.id} style={{ padding: '10px 0', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{item.product}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{item.vendor} · {item.project}</p>
                      {item.notes && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>{item.notes}</p>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{item.submittedAt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'vendors' && (
          <div>
            {vendorSummaries.map(v => (
              <div key={v.id} style={{ background: 'white', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div onClick={() => setExpandedVendor(id => id === v.id ? null : v.id)} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', userSelect: 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{v.name}</span>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: RISK_COLORS[v.riskLevel].bg, color: RISK_COLORS[v.riskLevel].text }}>{v.riskLevel} Risk</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{v.email} · {v.myProjects.length} projects · {v.submitted}/{v.total} items submitted</p>
                  </div>
                  <div style={{ width: '120px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>Completion</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: v.pct === 100 ? GREEN : '#374151' }}>{v.pct}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: '#f3f4f6' }}>
                      <div style={{ height: '100%', width: `${v.pct}%`, background: v.pct === 100 ? GREEN : v.flagged > 0 ? RED : WMT_BLUE, borderRadius: '3px' }} />
                    </div>
                  </div>
                  <span style={{ color: '#9ca3af' }}>{expandedVendor === v.id ? '▲' : '▼'}</span>
                </div>
                {expandedVendor === v.id && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                      <button onClick={() => onPreviewAs(vendors.find(vr => vr.id === v.id))} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 700, background: WMT_BLUE, color: 'white', border: 'none', cursor: 'pointer' }}>
                        👁 Preview as {v.name}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                      {[
                        { label: 'Confirmed',   value: v.confirmed,                color: GREEN },
                        { label: 'Flagged',     value: v.flagged,                  color: RED },
                        { label: 'Pending',     value: v.pending,                  color: AMBER },
                        { label: 'No Response', value: v.total - v.submitted,      color: '#9ca3af' },
                      ].map(s => (
                        <div key={s.label} style={{ background: '#f9fafb', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{s.label}</p>
                          <p style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Projects</p>
                    {v.myProjects.map(proj => (
                      <div key={proj.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: '#f9fafb', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#374151' }}>{proj.getCellValueAsString('Project Name')}</span>
                        <ProjectStatusBadge status={proj.getCellValueAsString('Status')} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'projects' && (
          <div>
            {projectSummaries.map(proj => (
              <div key={proj.id} style={{ background: 'white', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{proj.name}</span>
                      <ProjectStatusBadge status={proj.status} />
                      {proj.type && <span style={{ fontSize: '11px', color: WMT_BLUE, background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{proj.type}</span>}
                    </div>
                    {proj.dueDate && <p style={{ margin: 0, fontSize: '12px', color: proj.status === 'Overdue' ? '#ef4444' : '#6b7280' }}>Due {proj.dueDate}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 700, color: proj.responded === proj.totalVendors && proj.totalVendors > 0 ? GREEN : '#374151' }}>{proj.responded}/{proj.totalVendors} vendors responded</p>
                    {proj.flaggedCount > 0 && <p style={{ margin: 0, fontSize: '12px', color: RED, fontWeight: 600 }}>⚠ {proj.flaggedCount} flagged</p>}
                  </div>
                </div>
                {proj.totalVendors > 0 && (
                  <div>
                    <div style={{ height: '6px', borderRadius: '3px', background: '#f3f4f6' }}>
                      <div style={{ height: '100%', width: `${proj.pct}%`, background: proj.flaggedCount > 0 ? RED : proj.pct === 100 ? GREEN : WMT_BLUE, borderRadius: '3px' }} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>{proj.pct}% vendor response rate</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'flagged' && (
          <div>
            {flaggedItems.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '10px', padding: '48px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
                <p style={{ fontSize: '32px', margin: '0 0 8px' }}>✅</p>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>No flagged items</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9ca3af' }}>All submitted responses are confirmed or pending.</p>
              </div>
            ) : (
              <div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#ba1e45', fontWeight: 600 }}>⚠ {flaggedItems.length} item{flaggedItems.length > 1 ? 's' : ''} flagged — review vendor notes and determine remediation path</p>
                </div>
                {flaggedItems.map(item => (
                  <div key={item.id} style={{ background: 'white', borderRadius: '10px', marginBottom: '8px', border: '1px solid #fecaca', borderLeft: `3px solid ${RED}`, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#111827' }}>{item.product}</p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: item.notes ? '8px' : 0 }}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>🏢 {item.vendor}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>📋 {item.project}</span>
                        </div>
                        {item.notes && (
                          <div style={{ background: '#fef2f2', borderRadius: '6px', padding: '8px 12px', marginTop: '4px' }}>
                            <p style={{ margin: '0 0 2px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Vendor Notes</p>
                            <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>{item.notes}</p>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{item.submittedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { data, loading, error, refresh } = useData();

  const [mode,          setMode]          = useState('vendor');
  const [vendorRecord,  setVendorRecord]  = useState(null);
  const [previewVendor, setPreviewVendor] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    try { if (!sessionStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true); } catch (_) {}
  }, []);

  const handleOnboardingDone = () => {
    try { sessionStorage.setItem(ONBOARDING_KEY, '1'); } catch (_) {}
    setShowOnboarding(false);
  };

  const handlePreviewAs = (vendorRec) => { setPreviewVendor(vendorRec); setVendorRecord(vendorRec); setMode('vendor'); };
  const handleExitPreview = () => { setPreviewVendor(null); setVendorRecord(null); setMode('admin'); };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f7' }}>
      <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading compliance data…</p>
    </div>
  );
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f4f7' }}>
      <p style={{ color: '#ef4444', fontSize: '14px' }}>Error: {error}</p>
    </div>
  );

  const { vendors, projects, products, responses } = data;

  const previewBanner = previewVendor && (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1500, background: '#1d4ed8', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>👁 Previewing as: {previewVendor.getCellValueAsString('Vendor Name')}</span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>— this is exactly what they see</span>
      </div>
      <button onClick={handleExitPreview} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
        ← Back to Admin
      </button>
    </div>
  );

  const toolbar = !previewVendor && (
    <div style={{ position: 'fixed', top: '10px', right: '12px', zIndex: 999, display: 'flex', alignItems: 'center', gap: '6px' }}>
      <button onClick={() => setShowOnboarding(true)} style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>▶ Walkthrough</button>
      <div style={{ width: '1px', height: '20px', background: '#e5e7eb' }} />
      {['vendor', 'admin'].map(m => (
        <button key={m} onClick={() => { setMode(m); if (m === 'vendor') setVendorRecord(null); }} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: mode === m ? WMT_BLUE : 'white', color: mode === m ? 'white' : '#6b7280', border: `1.5px solid ${mode === m ? WMT_BLUE : '#e5e7eb'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
          {m === 'vendor' ? '👤 Vendor' : '🏛 Admin'}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {mode === 'admin'
        ? <AdminPanel vendors={vendors} projects={projects} products={products} responses={responses} onPreviewAs={handlePreviewAs} />
        : (
          <div style={previewVendor ? { paddingTop: '40px' } : {}}>
            {previewBanner}
            {!vendorRecord
              ? <LoginScreen vendors={vendors} onLogin={setVendorRecord} onPreviewAs={handlePreviewAs} />
              : <VendorDashboard vendorRecord={vendorRecord} projects={projects} products={products} responses={responses} onLogout={() => { setVendorRecord(null); setPreviewVendor(null); }} onRefresh={refresh} />
            }
          </div>
        )
      }
      {toolbar}
      {showOnboarding && <OnboardingOverlay onDone={handleOnboardingDone} />}
    </>
  );
}
