'use client'
import { useState, useRef } from 'react'
import { ChevronRight, ChevronLeft, FileText, Printer, Copy, RotateCcw, Check } from 'lucide-react'

type DocType = 'onboarding' | 'mou' | 'moa'

const DOC_TYPES = [
  { id: 'onboarding' as DocType, label: 'Client Onboarding', color: 'bg-blue-600' },
  { id: 'mou'        as DocType, label: 'MOU',               color: 'bg-violet-600' },
  { id: 'moa'        as DocType, label: 'MOA',               color: 'bg-emerald-600' },
]

const STEPS: Record<DocType, string[]> = {
  onboarding: ['Client Info', 'Services & Pricing', 'Payment & Banking'],
  mou:        ['Party Details', 'Scope & Goals',    'Terms & Signing'],
  moa:        ['Party Details', 'Obligations',       'Duration & Signing'],
}

const SERVICES = [
  'Reels', 'Carousels', 'Stories', 'YouTube Shorts', 'YouTube Long',
  'LinkedIn Posts', 'Website Content', 'Paid Ads', 'Personal Branding',
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] font-semibold text-stone-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition"
const ta  = inp + " resize-none min-h-[72px]"

export default function DocumentsPage() {
  const [docType, setDocType] = useState<DocType>('onboarding')
  const [step, setStep]       = useState(0)
  const [data, setData]       = useState<Record<string, string>>({})
  const [services, setServices] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
  const [copied, setCopied]   = useState(false)
  const previewRef            = useRef<HTMLDivElement>(null)

  const steps  = STEPS[docType]
  const isLast = step === steps.length - 1
  const pct    = Math.round(((step) / steps.length) * 100)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData(d => ({ ...d, [k]: e.target.value }))
  const g   = (k: string) => data[k] ?? ''

  function reset() {
    setStep(0); setData({}); setServices([]); setPreview(false)
  }

  function switchType(t: DocType) {
    setDocType(t); setStep(0); setData({}); setServices([]); setPreview(false)
  }

  function toggleService(s: string) {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // ── Print ──────────────────────────────────────────────────────────────────
  function doPrint() {
    const html = buildDoc()
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;font-size:13px;line-height:1.8;color:#0f1512;padding:40px 50px;max-width:800px;margin:auto}
        h1{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-align:center}
        .sub{text-align:center;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#b8975a;margin-top:6px}
        .tag{text-align:center;font-style:italic;color:#7a8c82;margin-top:10px;font-family:'Cormorant Garamond',serif}
        hr{border:none;border-top:1px solid #e0d9cf;margin:18px 0}
        .sec-title{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2.5px;color:#b8975a;border-bottom:1px solid #e0d9cf;padding-bottom:6px;margin-bottom:12px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:5px 2rem}
        .row{display:flex;gap:10px;align-items:baseline;margin-bottom:4px}
        .lbl{min-width:130px;font-size:11px;color:#7a8c82}
        .val{font-size:13px}
        .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;margin-top:2rem}
        .sig-line{border-bottom:1.5px solid #0f1512;height:40px;margin-bottom:4px}
        ul{padding-left:1.2rem}li{margin-bottom:2px}
        @media print{body{padding:20px 30px}}
      </style></head><body>${html}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
  }

  async function doCopy() {
    const text = previewRef.current?.innerText ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Document builder ──────────────────────────────────────────────────────
  function buildDoc(): string {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    if (docType === 'onboarding') return buildOnboarding(today)
    if (docType === 'mou')        return buildMOU(today)
    return buildMOA(today)
  }

  function row(label: string, val: string) {
    return `<div class="row"><span class="lbl">${label}</span><span class="val">${val || '—'}</span></div>`
  }

  function buildOnboarding(today: string) {
    const svcHtml = services.length
      ? `<ul>${services.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '<p>—</p>'
    return `
      <h1>Taha Media</h1>
      <div class="sub">Client Onboarding Document</div>
      <div class="tag">"Building Digital Legacies — One Brand at a Time"</div>
      <hr/>
      <div class="row"><span class="lbl">Document Date</span><span class="val">${today}</span></div>
      <div class="row"><span class="lbl">Prepared By</span><span class="val">Taha Media Studio</span></div>
      <hr/>

      <div class="sec-title">Client Information</div>
      <div class="grid2">
        ${row('Client Name', g('cName'))}
        ${row('Phone', g('cPhone'))}
        ${row('WhatsApp', g('cWA'))}
        ${row('Email', g('cEmail'))}
        ${row('Instagram', g('cInsta'))}
        ${row('Location', g('cLoc'))}
        ${row('Start Date', g('cStart'))}
      </div>
      ${g('cStd') ? `<div class="row" style="margin-top:6px"><span class="lbl">Studio / Brand</span><span class="val">${g('cStd')}</span></div>` : ''}
      ${g('cTarget') ? `<div class="row"><span class="lbl">Target Audience</span><span class="val">${g('cTarget')}</span></div>` : ''}
      <hr/>

      <div class="sec-title">Services Agreed</div>
      ${svcHtml}
      <div class="grid2" style="margin-top:10px">
        ${row('Monthly Reels', g('cReels'))}
        ${row('Free Revisions', g('cRevFree'))}
        ${row('Paid Revisions', g('cRevCharge'))}
        ${row('Package/Offer', g('cOffer'))}
      </div>
      <hr/>

      <div class="sec-title">Workflow</div>
      <ul>
        <li><strong>Step 1 — Onboarding:</strong> Client fills this form, assets shared</li>
        <li><strong>Step 2 — Research:</strong> Niche, competitor & audience analysis</li>
        <li><strong>Step 3 — Scripting:</strong> Content scripts drafted & approved</li>
        <li><strong>Step 4 — Production:</strong> Filming, editing & design</li>
        <li><strong>Step 5 — Approval:</strong> Client reviews before posting</li>
        <li><strong>Step 6 — Reporting:</strong> Monthly performance summary</li>
      </ul>
      <hr/>

      <div class="sec-title">Payment & Banking</div>
      <div class="grid2">
        ${row('Bank Name', g('bankName'))}
        ${row('Account Name', g('bankAccName'))}
        ${row('Account No.', g('bankAccNo'))}
        ${row('IFSC Code', g('bankIFSC'))}
        ${row('UPI ID', g('bankUPI'))}
      </div>
      ${(g('cDashUser') || g('cDashPass')) ? `
      <hr/>
      <div class="sec-title">Dashboard Access</div>
      <div class="grid2">
        ${row('Username', g('cDashUser'))}
        ${row('Password', g('cDashPass'))}
      </div>` : ''}
      <hr/>

      <div class="sec-title">Signatures</div>
      <div class="sig-grid">
        <div><div class="sig-line"></div><strong>Client Signature</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">${g('cName') || 'Client'}</div></div>
        <div><div class="sig-line"></div><strong>Taha Media Authorized</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">Taha Media Studio</div></div>
      </div>`
  }

  function buildMOU(today: string) {
    return `
      <h1>Taha Media</h1>
      <div class="sub">Memorandum of Understanding</div>
      <div class="tag">${g('mouTitle') || 'Collaboration Agreement'}</div>
      <hr/>
      <div class="row"><span class="lbl">Date</span><span class="val">${g('mouDate') || today}</span></div>
      <hr/>

      <div class="sec-title">Parties</div>
      <div class="grid2">
        <div>
          <strong>Party A</strong>
          ${row('Name', g('pAName'))}
          ${row('Representative', g('pARep'))}
          ${row('Email', g('pAEmail'))}
          ${row('Location', g('pALoc'))}
        </div>
        <div>
          <strong>Party B</strong>
          ${row('Name', g('pBName'))}
          ${row('Representative', g('pBRep'))}
          ${row('Email', g('pBEmail'))}
          ${row('Location', g('pBLoc'))}
        </div>
      </div>
      <hr/>

      <div class="sec-title">1. Purpose</div>
      <p>${g('mouPurpose') || '—'}</p>
      <hr/>

      <div class="sec-title">2. Scope of Collaboration</div>
      <p>${g('mouScope') || '—'}</p>
      <hr/>

      <div class="sec-title">3. Responsibilities</div>
      ${g('mouRespA') ? `<p><strong>Party A:</strong> ${g('mouRespA')}</p>` : ''}
      ${g('mouRespB') ? `<p style="margin-top:6px"><strong>Party B:</strong> ${g('mouRespB')}</p>` : ''}
      <hr/>

      <div class="sec-title">4. Financial Terms</div>
      <div class="grid2">
        ${row('Monthly Retainer', g('mouRetainer'))}
        ${row('Payment Terms', g('mouPayTerms'))}
      </div>
      <hr/>

      <div class="sec-title">5. Duration & Termination</div>
      <div class="grid2">
        ${row('Duration', g('mouDuration'))}
        ${row('Notice Period', g('mouNotice'))}
        ${row('Confidentiality', g('mouConf') || 'Applicable')}
        ${row('Jurisdiction', g('mouJuris'))}
      </div>
      ${g('mouExtra') ? `<hr/><div class="sec-title">6. Additional Terms</div><p>${g('mouExtra')}</p>` : ''}
      <hr/>

      <div class="sec-title">Signatures</div>
      <div class="sig-grid">
        <div><div class="sig-line"></div><strong>${g('pARep') || 'Party A'}</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">${g('pAName') || ''}</div></div>
        <div><div class="sig-line"></div><strong>${g('pBRep') || 'Party B'}</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">${g('pBName') || ''}</div></div>
      </div>`
  }

  function buildMOA(today: string) {
    return `
      <h1>Taha Media</h1>
      <div class="sub">Memorandum of Agreement</div>
      <div class="tag">${g('moaTitle') || 'Formal Agreement'}</div>
      <hr/>
      <div class="row"><span class="lbl">Date</span><span class="val">${g('moaDate') || today}</span></div>
      <hr/>

      <div class="sec-title">Parties</div>
      <div class="grid2">
        <div>
          <strong>Party A</strong>
          ${row('Name', g('pAName'))}
          ${row('Representative', g('pARep'))}
          ${row('Email', g('pAEmail'))}
          ${row('Location', g('pALoc'))}
        </div>
        <div>
          <strong>Party B</strong>
          ${row('Name', g('pBName'))}
          ${row('Representative', g('pBRep'))}
          ${row('Email', g('pBEmail'))}
          ${row('Location', g('pBLoc'))}
        </div>
      </div>
      <hr/>

      <div class="sec-title">1. Purpose</div>
      <p>${g('moaPurpose') || '—'}</p>
      <hr/>

      <div class="sec-title">2. Obligations of Party A</div>
      <p>${g('moaOblA') || '—'}</p>
      <hr/>

      <div class="sec-title">3. Obligations of Party B</div>
      <p>${g('moaOblB') || '—'}</p>
      <hr/>

      <div class="sec-title">4. Financial Terms</div>
      <div class="grid2">
        ${row('Payment Amount', g('moaPayment'))}
        ${row('Payment Schedule', g('moaPaySched'))}
      </div>
      <hr/>

      <div class="sec-title">5. Duration & Termination</div>
      <div class="grid2">
        ${row('Start Date', g('moaStart'))}
        ${row('End Date', g('moaEnd'))}
        ${row('Notice Period', g('moaNotice'))}
        ${row('Governing Law', g('moaGovLaw'))}
        ${row('Jurisdiction', g('moaJuris'))}
      </div>
      ${g('moaBreach') ? `<hr/><div class="sec-title">6. Breach & Consequences</div><p>${g('moaBreach')}</p>` : ''}
      ${g('moaExtra') ? `<hr/><div class="sec-title">7. Additional Clauses</div><p>${g('moaExtra')}</p>` : ''}
      <hr/>

      <div class="sec-title">Signatures</div>
      <div class="sig-grid">
        <div><div class="sig-line"></div><strong>${g('pARep') || 'Party A'}</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">${g('pAName') || ''}</div></div>
        <div><div class="sig-line"></div><strong>${g('pBRep') || 'Party B'}</strong><div style="font-size:11px;color:#7a8c82;margin-top:3px">${g('pBName') || ''}</div></div>
      </div>`
  }

  // ── Step forms ─────────────────────────────────────────────────────────────
  function renderStep() {
    if (docType === 'onboarding') {
      if (step === 0) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Name *"><input className={inp} value={g('cName')} onChange={set('cName')} placeholder="Dr. Gayathri Nagenthran" /></Field>
            <Field label="Phone"><input className={inp} value={g('cPhone')} onChange={set('cPhone')} placeholder="+91 98765 43210" /></Field>
            <Field label="WhatsApp"><input className={inp} value={g('cWA')} onChange={set('cWA')} placeholder="+91 98765 43210" /></Field>
            <Field label="Email"><input className={inp} value={g('cEmail')} onChange={set('cEmail')} placeholder="client@email.com" /></Field>
            <Field label="Instagram Handle"><input className={inp} value={g('cInsta')} onChange={set('cInsta')} placeholder="@handle" /></Field>
            <Field label="Location"><input className={inp} value={g('cLoc')} onChange={set('cLoc')} placeholder="Chennai, Tamil Nadu" /></Field>
            <Field label="Start Date"><input className={inp} type="date" value={g('cStart')} onChange={set('cStart')} /></Field>
            <Field label="Studio / Brand Name"><input className={inp} value={g('cStd')} onChange={set('cStd')} placeholder="Hydra Dermatology" /></Field>
          </div>
          <Field label="Target Audience">
            <input className={inp} value={g('cTarget')} onChange={set('cTarget')} placeholder="Women 25–40, skincare enthusiasts, South India" />
          </Field>
        </div>
      )
      if (step === 1) return (
        <div className="space-y-4">
          <Field label="Services Included">
            <div className="flex flex-wrap gap-2 mt-1">
              {SERVICES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    services.includes(s)
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-stone-50 text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Package / Offer"><input className={inp} value={g('cOffer')} onChange={set('cOffer')} placeholder="₹45,000/month" /></Field>
            <Field label="Monthly Reels Count"><input className={inp} value={g('cReels')} onChange={set('cReels')} placeholder="8 reels/month" /></Field>
            <Field label="Free Revisions"><input className={inp} value={g('cRevFree')} onChange={set('cRevFree')} placeholder="2 per content" /></Field>
            <Field label="Paid Revision Charge"><input className={inp} value={g('cRevCharge')} onChange={set('cRevCharge')} placeholder="₹500 per revision" /></Field>
          </div>
        </div>
      )
      if (step === 2) return (
        <div className="space-y-4">
          <p className="text-xs text-stone-400 mb-2">Taha Media banking details for client records.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name"><input className={inp} value={g('bankName')} onChange={set('bankName')} placeholder="HDFC Bank" /></Field>
            <Field label="Account Holder"><input className={inp} value={g('bankAccName')} onChange={set('bankAccName')} placeholder="Taha Media" /></Field>
            <Field label="Account Number"><input className={inp} value={g('bankAccNo')} onChange={set('bankAccNo')} placeholder="XXXX XXXX XXXX" /></Field>
            <Field label="IFSC Code"><input className={inp} value={g('bankIFSC')} onChange={set('bankIFSC')} placeholder="HDFC0001234" /></Field>
            <Field label="UPI ID"><input className={inp} value={g('bankUPI')} onChange={set('bankUPI')} placeholder="tahamedia@upi" /></Field>
          </div>
          <div className="border-t border-stone-100 pt-4">
            <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-3">Client Dashboard Access (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Dashboard Username"><input className={inp} value={g('cDashUser')} onChange={set('cDashUser')} placeholder="client@tahamedia" /></Field>
              <Field label="Dashboard Password"><input className={inp} value={g('cDashPass')} onChange={set('cDashPass')} placeholder="Temporary password" /></Field>
            </div>
          </div>
        </div>
      )
    }

    if (docType === 'mou') {
      if (step === 0) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="MOU Title"><input className={inp} value={g('mouTitle')} onChange={set('mouTitle')} placeholder="Content Partnership Agreement" /></Field>
            <Field label="Date"><input className={inp} type="date" value={g('mouDate')} onChange={set('mouDate')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-2">
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">Party A (Taha Media)</p>
              <Field label="Organisation"><input className={inp} value={g('pAName')} onChange={set('pAName')} placeholder="Taha Media" /></Field>
              <Field label="Representative"><input className={inp} value={g('pARep')} onChange={set('pARep')} placeholder="Afzal, Founder" /></Field>
              <Field label="Email"><input className={inp} value={g('pAEmail')} onChange={set('pAEmail')} placeholder="info@tahamedia.in" /></Field>
              <Field label="Location"><input className={inp} value={g('pALoc')} onChange={set('pALoc')} placeholder="Chennai, Tamil Nadu" /></Field>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">Party B (Client)</p>
              <Field label="Organisation"><input className={inp} value={g('pBName')} onChange={set('pBName')} placeholder="Client Brand / Clinic" /></Field>
              <Field label="Representative"><input className={inp} value={g('pBRep')} onChange={set('pBRep')} placeholder="Dr. XYZ" /></Field>
              <Field label="Email"><input className={inp} value={g('pBEmail')} onChange={set('pBEmail')} placeholder="client@email.com" /></Field>
              <Field label="Location"><input className={inp} value={g('pBLoc')} onChange={set('pBLoc')} placeholder="Mumbai, Maharashtra" /></Field>
            </div>
          </div>
        </div>
      )
      if (step === 1) return (
        <div className="space-y-4">
          <Field label="Purpose of MOU"><textarea className={ta} rows={3} value={g('mouPurpose')} onChange={set('mouPurpose')} placeholder="This MOU outlines the intent to collaborate on personal branding and content creation services..." /></Field>
          <Field label="Scope of Collaboration"><textarea className={ta} rows={3} value={g('mouScope')} onChange={set('mouScope')} placeholder="Content creation, social media management, brand strategy for Instagram and YouTube..." /></Field>
          <Field label="Responsibilities — Party A"><textarea className={ta} rows={2} value={g('mouRespA')} onChange={set('mouRespA')} placeholder="Taha Media will provide scripting, editing, posting and monthly reporting..." /></Field>
          <Field label="Responsibilities — Party B"><textarea className={ta} rows={2} value={g('mouRespB')} onChange={set('mouRespB')} placeholder="Client will provide filming time, approvals within 48 hours, brand assets..." /></Field>
        </div>
      )
      if (step === 2) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Monthly Retainer"><input className={inp} value={g('mouRetainer')} onChange={set('mouRetainer')} placeholder="₹45,000/month" /></Field>
            <Field label="Payment Terms"><input className={inp} value={g('mouPayTerms')} onChange={set('mouPayTerms')} placeholder="Advance by 5th of each month" /></Field>
            <Field label="Duration"><input className={inp} value={g('mouDuration')} onChange={set('mouDuration')} placeholder="3 months, renewable" /></Field>
            <Field label="Notice Period"><input className={inp} value={g('mouNotice')} onChange={set('mouNotice')} placeholder="15 days written notice" /></Field>
            <Field label="Confidentiality">
              <select className={inp} value={g('mouConf')} onChange={set('mouConf')}>
                <option value="">Select...</option>
                <option>Confidentiality clause applies</option>
                <option>No confidentiality clause</option>
              </select>
            </Field>
            <Field label="Jurisdiction"><input className={inp} value={g('mouJuris')} onChange={set('mouJuris')} placeholder="Chennai, Tamil Nadu" /></Field>
          </div>
          <Field label="Additional Terms (optional)"><textarea className={ta} rows={2} value={g('mouExtra')} onChange={set('mouExtra')} placeholder="Any other clauses or notes..." /></Field>
        </div>
      )
    }

    if (docType === 'moa') {
      if (step === 0) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="MOA Title"><input className={inp} value={g('moaTitle')} onChange={set('moaTitle')} placeholder="Service Agreement" /></Field>
            <Field label="Date"><input className={inp} type="date" value={g('moaDate')} onChange={set('moaDate')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-6 mt-2">
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">Party A (Taha Media)</p>
              <Field label="Organisation"><input className={inp} value={g('pAName')} onChange={set('pAName')} placeholder="Taha Media" /></Field>
              <Field label="Representative"><input className={inp} value={g('pARep')} onChange={set('pARep')} placeholder="Afzal, Founder" /></Field>
              <Field label="Email"><input className={inp} value={g('pAEmail')} onChange={set('pAEmail')} placeholder="info@tahamedia.in" /></Field>
              <Field label="Location"><input className={inp} value={g('pALoc')} onChange={set('pALoc')} placeholder="Chennai, Tamil Nadu" /></Field>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-stone-600 uppercase tracking-wide">Party B (Client)</p>
              <Field label="Organisation"><input className={inp} value={g('pBName')} onChange={set('pBName')} placeholder="Client Brand / Clinic" /></Field>
              <Field label="Representative"><input className={inp} value={g('pBRep')} onChange={set('pBRep')} placeholder="Dr. XYZ" /></Field>
              <Field label="Email"><input className={inp} value={g('pBEmail')} onChange={set('pBEmail')} placeholder="client@email.com" /></Field>
              <Field label="Location"><input className={inp} value={g('pBLoc')} onChange={set('pBLoc')} placeholder="Mumbai, Maharashtra" /></Field>
            </div>
          </div>
        </div>
      )
      if (step === 1) return (
        <div className="space-y-4">
          <Field label="Purpose of Agreement"><textarea className={ta} rows={3} value={g('moaPurpose')} onChange={set('moaPurpose')} placeholder="This agreement formalizes the engagement between Taha Media and the client for..." /></Field>
          <Field label="Obligations — Party A"><textarea className={ta} rows={3} value={g('moaOblA')} onChange={set('moaOblA')} placeholder="Taha Media shall deliver X reels per month, provide monthly reports, maintain content quality standards..." /></Field>
          <Field label="Obligations — Party B"><textarea className={ta} rows={3} value={g('moaOblB')} onChange={set('moaOblB')} placeholder="Client shall provide timely approvals, filming access, and make payments as per schedule..." /></Field>
        </div>
      )
      if (step === 2) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Amount"><input className={inp} value={g('moaPayment')} onChange={set('moaPayment')} placeholder="₹45,000/month" /></Field>
            <Field label="Payment Schedule"><input className={inp} value={g('moaPaySched')} onChange={set('moaPaySched')} placeholder="Advance by 5th of each month" /></Field>
            <Field label="Start Date"><input className={inp} type="date" value={g('moaStart')} onChange={set('moaStart')} /></Field>
            <Field label="End Date"><input className={inp} type="date" value={g('moaEnd')} onChange={set('moaEnd')} /></Field>
            <Field label="Notice Period"><input className={inp} value={g('moaNotice')} onChange={set('moaNotice')} placeholder="30 days written notice" /></Field>
            <Field label="Governing Law"><input className={inp} value={g('moaGovLaw')} onChange={set('moaGovLaw')} placeholder="Laws of India" /></Field>
            <Field label="Jurisdiction"><input className={inp} value={g('moaJuris')} onChange={set('moaJuris')} placeholder="Chennai, Tamil Nadu" /></Field>
          </div>
          <Field label="Breach & Consequences (optional)"><textarea className={ta} rows={2} value={g('moaBreach')} onChange={set('moaBreach')} placeholder="In case of breach, the defaulting party shall..." /></Field>
          <Field label="Additional Clauses (optional)"><textarea className={ta} rows={2} value={g('moaExtra')} onChange={set('moaExtra')} placeholder="Any other terms..." /></Field>
        </div>
      )
    }
  }

  // ── Preview render ─────────────────────────────────────────────────────────
  if (preview) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-stone-50">
        {/* Preview toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-white border-b border-stone-100 flex-shrink-0">
          <button onClick={() => setPreview(false)} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors mr-2">
            <ChevronLeft size={14} /> Back
          </button>
          <div className="flex-1" />
          <button onClick={doCopy} className="flex items-center gap-1.5 text-xs border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors">
            {copied ? <><Check size={12} className="text-emerald-500" /> Copied</> : <><Copy size={12} /> Copy Text</>}
          </button>
          <button onClick={doPrint} className="flex items-center gap-1.5 text-xs bg-stone-800 text-white rounded-lg px-3 py-1.5 hover:bg-stone-900 transition-colors">
            <Printer size={12} /> Print / Save PDF
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors text-stone-500">
            <RotateCcw size={12} /> New Document
          </button>
        </div>

        {/* Document preview */}
        <div className="flex-1 overflow-y-auto p-8">
          <div
            ref={previewRef}
            className="bg-white max-w-2xl mx-auto rounded-xl border border-stone-200 shadow-sm p-12 text-[13px] leading-relaxed text-stone-800"
            dangerouslySetInnerHTML={{ __html: buildDoc() }}
          />
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-amber-500" />
          <p className="text-sm font-semibold text-stone-800">Document Generator</p>
        </div>
        <span className="text-[10px] text-stone-400 uppercase tracking-wide">Taha Media Studio</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Doc type selector */}
        <div className="flex gap-0 border border-stone-200 rounded-xl overflow-hidden bg-white">
          {DOC_TYPES.map((dt, i) => (
            <button
              key={dt.id}
              onClick={() => switchType(dt.id)}
              className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                i !== DOC_TYPES.length - 1 ? 'border-r border-stone-200' : ''
              } ${
                docType === dt.id
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              {dt.label}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div>
          <div className="w-full bg-stone-100 rounded-full h-1.5 mb-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-stone-700 to-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center flex-1 min-w-0">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 border transition-all ${
                  i < step  ? 'bg-stone-800 border-stone-800 text-white' :
                  i === step ? 'border-amber-500 text-amber-600 bg-white' :
                              'border-stone-200 text-stone-400 bg-white'
                }`}>{i < step ? '✓' : i + 1}</div>
                <span className={`ml-1.5 text-[11px] truncate ${i === step ? 'text-stone-800 font-semibold' : 'text-stone-400'}`}>{s}</span>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-stone-100 mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm">
          <div className="px-6 py-4 border-b border-stone-50">
            <h2 className="text-base font-semibold text-stone-800">{steps[step]}</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Step {step + 1} of {steps.length} — {DOC_TYPES.find(d => d.id === docType)?.label}
            </p>
          </div>
          <div className="px-6 py-5">
            {renderStep()}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t border-stone-50 flex items-center justify-between">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30 transition-colors border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={13} /> Back
            </button>
            {isLast ? (
              <button
                onClick={() => setPreview(true)}
                className="flex items-center gap-1.5 text-xs bg-stone-800 text-white rounded-lg px-4 py-2 hover:bg-stone-900 transition-colors font-medium"
              >
                Generate Document <FileText size={13} />
              </button>
            ) : (
              <button
                onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
                className="flex items-center gap-1.5 text-xs bg-stone-800 text-white rounded-lg px-4 py-2 hover:bg-stone-900 transition-colors font-medium"
              >
                Next <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
