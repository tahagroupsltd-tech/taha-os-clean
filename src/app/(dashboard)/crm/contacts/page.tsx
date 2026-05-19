'use client'
// src/app/(dashboard)/crm/contacts/page.tsx
import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Plus, Search, Building2, Mail, Phone, Briefcase, X, Loader2, Users } from 'lucide-react'

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
  position: string | null
  notes: string | null
  company: { id: string; name: string } | null
  leads: { id: string; title: string; stage: string }[]
}

interface Company {
  id: string
  name: string
  industry: string | null
  website: string | null
  _count: { contacts: number; leads: number; deals: number }
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'contacts' | 'companies'>('contacts')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', position: '', companyId: '', notes: '' })
  const [companyForm, setCompanyForm] = useState({ name: '', industry: '', website: '', address: '', notes: '' })

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [c, co] = await Promise.all([
      fetch('/api/crm/contacts').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/crm/companies').then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setContacts(c.data ?? [])
    setCompanies(co.data ?? [])
    setLoading(false)
  }

  async function createContact() {
    if (!contactForm.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          position: contactForm.position || null,
          companyId: contactForm.companyId || null,
          notes: contactForm.notes || null,
        }),
      })
      const data = await res.json()
      if (data.data) {
        setContacts(prev => [data.data, ...prev])
        setShowForm(false)
        setContactForm({ name: '', email: '', phone: '', position: '', companyId: '', notes: '' })
      }
    } finally { setSaving(false) }
  }

  async function createCompany() {
    if (!companyForm.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      })
      const data = await res.json()
      if (data.data) {
        setCompanies(prev => [{ ...data.data, _count: { contacts: 0, leads: 0, deals: 0 } }, ...prev])
        setShowCompanyForm(false)
        setCompanyForm({ name: '', industry: '', website: '', address: '', notes: '' })
      }
    } finally { setSaving(false) }
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="CRM — Contacts & Companies" />

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 bg-white flex-shrink-0">
        <div className="flex rounded-md border border-stone-200 overflow-hidden">
          {(['contacts', 'companies'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium transition-colors capitalize ${
                tab === t ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
        <button
          onClick={() => tab === 'contacts' ? setShowForm(true) : setShowCompanyForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded-md hover:bg-stone-700 transition-colors"
        >
          <Plus size={13} />
          Add {tab === 'contacts' ? 'Contact' : 'Company'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-stone-400" />
          </div>
        ) : tab === 'contacts' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredContacts.length === 0 ? (
              <div className="col-span-full text-center py-16 text-stone-400">
                <Users size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No contacts yet. Add your first contact.</p>
              </div>
            ) : filteredContacts.map(contact => (
              <div key={contact.id} className="bg-white rounded-xl border border-stone-100 p-4 hover:border-stone-300 hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-stone-600">{contact.name[0].toUpperCase()}</span>
                  </div>
                  <button
                    onClick={() => deleteContact(contact.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-sm font-semibold text-stone-900 mb-1">{contact.name}</p>
                {contact.position && (
                  <p className="text-xs text-stone-500 mb-2">{contact.position}</p>
                )}
                <div className="space-y-1">
                  {contact.company && (
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} className="text-stone-400 flex-shrink-0" />
                      <span className="text-xs text-stone-500 truncate">{contact.company.name}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail size={11} className="text-stone-400 flex-shrink-0" />
                      <a href={`mailto:${contact.email}`} className="text-xs text-blue-600 hover:underline truncate">{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={11} className="text-stone-400 flex-shrink-0" />
                      <a href={`tel:${contact.phone}`} className="text-xs text-stone-500">{contact.phone}</a>
                    </div>
                  )}
                </div>
                {contact.leads.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-50">
                    <p className="text-[10px] text-stone-400 mb-1">{contact.leads.length} lead{contact.leads.length > 1 ? 's' : ''}</p>
                    <div className="flex flex-wrap gap-1">
                      {contact.leads.slice(0, 2).map(l => (
                        <span key={l.id} className="text-[10px] bg-stone-50 text-stone-500 px-1.5 py-0.5 rounded">{l.stage}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCompanies.length === 0 ? (
              <div className="col-span-full text-center py-16 text-stone-400">
                <Building2 size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No companies yet. Add your first company.</p>
              </div>
            ) : filteredCompanies.map(company => (
              <div key={company.id} className="bg-white rounded-xl border border-stone-100 p-4 hover:border-stone-300 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Building2 size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{company.name}</p>
                    {company.industry && (
                      <p className="text-xs text-stone-500">{company.industry}</p>
                    )}
                  </div>
                </div>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mb-3 truncate">
                    {company.website}
                  </a>
                )}
                <div className="flex items-center gap-3 text-[11px] text-stone-500 border-t border-stone-50 pt-3">
                  <span>{company._count.contacts} contacts</span>
                  <span>{company._count.leads} leads</span>
                  <span>{company._count.deals} deals</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Contact modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Add Contact</h3>
              <button onClick={() => setShowForm(false)}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Name *</label>
                <input autoFocus value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Email</label>
                  <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Phone</label>
                  <input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 9999999999" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Position</label>
                  <input value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))}
                    placeholder="e.g. Marketing Head" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Company</label>
                  <select value={contactForm.companyId} onChange={e => setContactForm(f => ({ ...f, companyId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300">
                    <option value="">None</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Notes</label>
                <textarea value={contactForm.notes} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={createContact} disabled={saving || !contactForm.name.trim()}
                className="px-4 py-2 text-xs bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 size={12} className="animate-spin" />}
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Company modal */}
      {showCompanyForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Add Company</h3>
              <button onClick={() => setShowCompanyForm(false)}><X size={16} className="text-stone-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Company Name *</label>
                <input autoFocus value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Company name" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Industry</label>
                  <input value={companyForm.industry} onChange={e => setCompanyForm(f => ({ ...f, industry: e.target.value }))}
                    placeholder="e.g. E-commerce" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Website</label>
                  <input type="url" value={companyForm.website} onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Address</label>
                <input value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="City, State" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-300" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-100">
              <button onClick={() => setShowCompanyForm(false)} className="px-4 py-2 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50">Cancel</button>
              <button onClick={createCompany} disabled={saving || !companyForm.name.trim()}
                className="px-4 py-2 text-xs bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 size={12} className="animate-spin" />}
                Add Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
