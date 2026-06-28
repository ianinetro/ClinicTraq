import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, PowerOff, ExternalLink, Search, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Drawer } from '../../components/ui/Drawer'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Payer {
  id: string
  tenant_id: string
  name: string
  payer_id: string
  payer_type: string
  billing_rules: Record<string, unknown> | null
  tfl_days: number
  is_active: boolean
  created_at: string
  // Extended fields stored in billing_rules or top-level from create
  npi?: string
  claim_type?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  fax?: string
  website?: string
  electronic_payer?: boolean
  accepts_era?: boolean
  secondary_tfl_days?: number
}

interface PayerFormData {
  name: string
  payer_id: string
  npi: string
  claim_type: 'professional' | 'institutional' | 'both'
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  phone: string
  fax: string
  website: string
  electronic_payer: boolean
  accepts_era: boolean
  tfl_days: number | string
  secondary_tfl_days: number | string
  is_active: boolean
}

const EMPTY_FORM: PayerFormData = {
  name: '',
  payer_id: '',
  npi: '',
  claim_type: 'professional',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  fax: '',
  website: '',
  electronic_payer: false,
  accepts_era: false,
  tfl_days: 365,
  secondary_tfl_days: 180,
  is_active: true,
}

const CLAIM_TYPE_LABELS: Record<string, string> = {
  professional: '837P',
  institutional: '837I',
  both: '837P/I',
  commercial: 'Commercial',
}

const COMMON_PAYER_IDS = [
  { name: 'Medicare Part B', id: '00803' },
  { name: 'Medicare Advantage (Humana)', id: '61101' },
  { name: 'Aetna', id: '60054' },
  { name: 'Cigna', id: '62308' },
  { name: 'UnitedHealthcare', id: '87726' },
  { name: 'BlueCross BlueShield Federal', id: '00010' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function payerFromApiResponse(raw: Payer): Payer {
  // Merge extra fields from billing_rules if stored there
  const rules = (raw.billing_rules ?? {}) as Record<string, unknown>
  return {
    ...raw,
    npi: (rules.npi as string | undefined) ?? raw.npi ?? '',
    claim_type: (rules.claim_type as string | undefined) ?? raw.claim_type ?? raw.payer_type,
    address_line1: (rules.address_line1 as string | undefined) ?? raw.address_line1 ?? '',
    address_line2: (rules.address_line2 as string | undefined) ?? raw.address_line2 ?? '',
    city: (rules.city as string | undefined) ?? raw.city ?? '',
    state: (rules.state as string | undefined) ?? raw.state ?? '',
    zip_code: (rules.zip_code as string | undefined) ?? raw.zip_code ?? '',
    phone: (rules.phone as string | undefined) ?? raw.phone ?? '',
    fax: (rules.fax as string | undefined) ?? raw.fax ?? '',
    website: (rules.website as string | undefined) ?? raw.website ?? '',
    electronic_payer: (rules.electronic_payer as boolean | undefined) ?? raw.electronic_payer ?? false,
    accepts_era: (rules.accepts_era as boolean | undefined) ?? raw.accepts_era ?? false,
    secondary_tfl_days: (rules.secondary_tfl_days as number | undefined) ?? raw.secondary_tfl_days ?? 180,
  }
}

function formToApiPayload(form: PayerFormData) {
  return {
    name: form.name,
    payer_id: form.payer_id,
    payer_type: form.claim_type,
    tfl_days: Number(form.tfl_days) || 365,
    is_active: form.is_active,
    billing_rules: {
      npi: form.npi,
      claim_type: form.claim_type,
      address_line1: form.address_line1,
      address_line2: form.address_line2,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      phone: form.phone,
      fax: form.fax,
      website: form.website,
      electronic_payer: form.electronic_payer,
      accepts_era: form.accepts_era,
      secondary_tfl_days: Number(form.secondary_tfl_days) || 180,
    },
  }
}

function payerToForm(p: Payer): PayerFormData {
  return {
    name: p.name,
    payer_id: p.payer_id,
    npi: p.npi ?? '',
    claim_type: (p.claim_type as PayerFormData['claim_type']) ?? 'professional',
    address_line1: p.address_line1 ?? '',
    address_line2: p.address_line2 ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    zip_code: p.zip_code ?? '',
    phone: p.phone ?? '',
    fax: p.fax ?? '',
    website: p.website ?? '',
    electronic_payer: p.electronic_payer ?? false,
    accepts_era: p.accepts_era ?? false,
    tfl_days: p.tfl_days,
    secondary_tfl_days: p.secondary_tfl_days ?? 180,
    is_active: p.is_active,
  }
}

// ─── Form Component ───────────────────────────────────────────────────────────

interface PayerFormProps {
  form: PayerFormData
  errors: Partial<Record<keyof PayerFormData, string>>
  onChange: (updates: Partial<PayerFormData>) => void
}

function PayerForm({ form, errors, onChange }: PayerFormProps) {
  function field(name: keyof PayerFormData, label: string, opts?: {
    required?: boolean
    type?: string
    placeholder?: string
    helperText?: string
  }) {
    return (
      <Input
        label={label}
        required={opts?.required}
        type={opts?.type ?? 'text'}
        placeholder={opts?.placeholder}
        helperText={opts?.helperText}
        value={String(form[name])}
        error={errors[name]}
        onChange={e => onChange({ [name]: opts?.type === 'number' ? e.target.value : e.target.value } as Partial<PayerFormData>)}
      />
    )
  }

  function checkbox(name: keyof PayerFormData, label: string) {
    return (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(form[name])}
          onChange={e => onChange({ [name]: e.target.checked } as Partial<PayerFormData>)}
          className="w-4 h-4 rounded border-[#BABACE] accent-[#0410BD]"
        />
        <span className="text-sm text-[#12122C]">{label}</span>
      </label>
    )
  }

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Basic Information</p>
        {field('name', 'Payer Name', { required: true, placeholder: 'e.g. Aetna' })}
        {field('payer_id', 'Payer ID / EDI Payer ID', { required: true, placeholder: 'e.g. 60054' })}
        {field('npi', 'Payer NPI', { placeholder: '10-digit NPI', helperText: '10-digit NPI number' })}
      </div>

      {/* Claim type */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Claim Type</p>
        <div className="flex gap-4">
          {(['professional', 'institutional', 'both'] as const).map(ct => (
            <label key={ct} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="claim_type"
                value={ct}
                checked={form.claim_type === ct}
                onChange={() => onChange({ claim_type: ct })}
                className="accent-[#0410BD]"
              />
              <span className="text-sm text-[#12122C]">
                {ct === 'professional' ? 'Professional (837P)' : ct === 'institutional' ? 'Institutional (837I)' : 'Both'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Address</p>
        {field('address_line1', 'Address Line 1')}
        {field('address_line2', 'Address Line 2')}
        <div className="grid grid-cols-2 gap-3">
          {field('city', 'City')}
          {field('state', 'State')}
        </div>
        {field('zip_code', 'ZIP Code')}
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Contact</p>
        {field('phone', 'Phone')}
        {field('fax', 'Fax')}
        {field('website', 'Website')}
      </div>

      {/* Electronic */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Electronic Billing</p>
        {checkbox('electronic_payer', 'Electronic payer')}
        {checkbox('accepts_era', 'Accepts electronic remittance advice (ERA)')}
      </div>

      {/* Filing limits */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Filing Limits</p>
        <Input
          label="Timely Filing Limit (days)"
          type="number"
          value={String(form.tfl_days)}
          error={errors.tfl_days}
          onChange={e => onChange({ tfl_days: e.target.value })}
        />
        <Input
          label="Secondary Claim Filing Limit (days)"
          type="number"
          value={String(form.secondary_tfl_days)}
          error={errors.secondary_tfl_days}
          onChange={e => onChange({ secondary_tfl_days: e.target.value })}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE]">Status</p>
        {checkbox('is_active', 'Is active')}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PayersSettings() {
  const { addToast } = useToast()
  const [payers, setPayers] = useState<Payer[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [claimTypeFilter, setClaimTypeFilter] = useState('all')

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null)
  const [form, setForm] = useState<PayerFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof PayerFormData, string>>>({})

  // Load payers on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<Payer[]>('/payers')
        setPayers(res.data.map(payerFromApiResponse))
      } catch {
        addToast({ variant: 'error', message: 'Failed to load payers.' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filtered list
  const filtered = useMemo(() => {
    return payers.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.payer_id.toLowerCase().includes(search.toLowerCase())
      const matchType =
        claimTypeFilter === 'all' ||
        (p.claim_type ?? p.payer_type) === claimTypeFilter
      return matchSearch && matchType
    })
  }, [payers, search, claimTypeFilter])

  function openAddPanel() {
    setEditingPayer(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setPanelOpen(true)
  }

  function openEditPanel(payer: Payer) {
    setEditingPayer(payer)
    setForm(payerToForm(payer))
    setErrors({})
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditingPayer(null)
  }

  function validate(): boolean {
    const e: Partial<Record<keyof PayerFormData, string>> = {}
    if (!form.name.trim()) e.name = 'Payer name is required.'
    if (!form.payer_id.trim()) e.payer_id = 'Payer ID is required.'
    if (form.npi && !/^\d{10}$/.test(form.npi)) e.npi = 'NPI must be exactly 10 digits.'
    const tfl = Number(form.tfl_days)
    if (isNaN(tfl) || tfl < 1) e.tfl_days = 'Enter a positive number of days.'
    const stfl = Number(form.secondary_tfl_days)
    if (isNaN(stfl) || stfl < 1) e.secondary_tfl_days = 'Enter a positive number of days.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = formToApiPayload(form)
      if (editingPayer) {
        const res = await apiClient.patch<Payer>(`/payers/${editingPayer.id}`, payload)
        const updated = payerFromApiResponse(res.data)
        setPayers(prev => prev.map(p => p.id === updated.id ? updated : p))
        addToast({ variant: 'success', message: `${updated.name} updated.` })
      } else {
        const res = await apiClient.post<Payer>('/payers', payload)
        const created = payerFromApiResponse(res.data)
        setPayers(prev => [...prev, created])
        addToast({ variant: 'success', message: `${created.name} added.` })
      }
      closePanel()
    } catch {
      addToast({ variant: 'error', message: 'Failed to save payer. Check the form and try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(payer: Payer) {
    try {
      const res = await apiClient.patch<Payer>(`/payers/${payer.id}`, { is_active: !payer.is_active })
      const updated = payerFromApiResponse(res.data)
      setPayers(prev => prev.map(p => p.id === updated.id ? updated : p))
      addToast({
        variant: 'success',
        message: `${updated.name} ${updated.is_active ? 'activated' : 'deactivated'}.`,
      })
    } catch {
      addToast({ variant: 'error', message: 'Failed to update payer status.' })
    }
  }

  function updateForm(updates: Partial<PayerFormData>) {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const claimTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'professional', label: 'Professional (837P)' },
    { value: 'institutional', label: 'Institutional (837I)' },
    { value: 'both', label: 'Both' },
    { value: 'commercial', label: 'Commercial' },
  ]

  function addressDisplay(p: Payer) {
    const parts = [p.city, p.state].filter(Boolean)
    if (!parts.length && !p.address_line1) return <span className="text-[#BABACE]">—</span>
    return (
      <span className="text-xs">
        {p.address_line1 ? <span className="block">{p.address_line1}</span> : null}
        {parts.length ? <span className="block text-[#6B6B8A]">{parts.join(', ')} {p.zip_code}</span> : null}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-[#12122C]">Payers &amp; Insurance</h2>
        <p className="text-sm text-[#6B6B8A] mt-1">
          Configure insurance payer records used for claim submission and remittance.
        </p>
        <div className="mt-2 bg-[#D9FCFF] border border-[#94F2FA] rounded-lg px-3 py-2 text-xs text-[#007998]">
          Payer settings affect claim generation, EDI routing, ERA matching, and timely filing alerts.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BABACE] pointer-events-none" />
          <input
            type="search"
            placeholder="Search payers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 border border-[#E0E0EF] rounded-md text-sm bg-white text-[#12122C] placeholder-[#BABACE] outline-none focus:border-[#0410BD] focus:shadow-[0_0_0_3px_rgba(4,16,189,0.12)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#BABACE] hover:text-[#6B6B8A]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <select
          value={claimTypeFilter}
          onChange={e => setClaimTypeFilter(e.target.value)}
          className="h-9 px-3 border border-[#E0E0EF] rounded-md text-sm bg-white text-[#12122C] outline-none focus:border-[#0410BD] cursor-pointer"
        >
          {claimTypeOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={openAddPanel}>
          Add Payer
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#F2F2F8]">
              <tr>
                {[
                  'Payer Name',
                  'Payer ID (EDI)',
                  'NPI',
                  'Claim Type',
                  'Filing Limit',
                  'Address',
                  'Phone',
                  'Status',
                  'Actions',
                ].map(h => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E3F1]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#6B6B8A]">
                    Loading payers…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#6B6B8A]">
                    {payers.length === 0 ? 'No payers configured yet.' : 'No payers match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map(payer => {
                  const ct = payer.claim_type ?? payer.payer_type
                  return (
                    <tr key={payer.id} className="hover:bg-[#F2F2F8] transition-colors">
                      <td className="px-3 py-2.5 text-sm font-medium text-[#12122C] whitespace-nowrap">
                        {payer.name}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-[#6B6B8A]">
                        {payer.payer_id}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-[#6B6B8A]">
                        {payer.npi || <span className="text-[#BABACE]">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        <Badge variant="info">
                          {CLAIM_TYPE_LABELS[ct] ?? ct}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-sm tabular-nums text-[#12122C]">
                        {payer.tfl_days} days
                      </td>
                      <td className="px-3 py-2.5">
                        {addressDisplay(payer)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-[#6B6B8A] whitespace-nowrap">
                        {payer.phone || <span className="text-[#BABACE]">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={payer.is_active ? 'active' : 'inactive'}>
                          {payer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditPanel(payer)}
                            title="Edit payer"
                            className="p-1.5 rounded text-[#6B6B8A] hover:bg-[#EFF0FF] hover:text-[#0410BD] transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeactivate(payer)}
                            title={payer.is_active ? 'Deactivate' : 'Activate'}
                            className="p-1.5 rounded text-[#6B6B8A] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition-colors"
                          >
                            <PowerOff size={13} />
                          </button>
                          <a
                            href={`/settings/billing/tfl`}
                            title="View TFL settings"
                            className="p-1.5 rounded text-[#6B6B8A] hover:bg-[#EFF0FF] hover:text-[#0410BD] transition-colors inline-flex items-center"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-[#E3E3F1] bg-[#F2F2F8] text-xs text-[#6B6B8A]">
            {filtered.length} of {payers.length} payer{payers.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Common Payer IDs reference card */}
      <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E3E3F1] flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#12122C]">Common Payer IDs</h3>
          <span className="text-xs text-[#6B6B8A] font-normal">Read-only reference</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F2F2F8]">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A]">
                  Payer
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B6B8A]">
                  EDI Payer ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E3F1]">
              {COMMON_PAYER_IDS.map(item => (
                <tr key={item.id} className="hover:bg-[#F2F2F8]">
                  <td className="px-4 py-2.5 text-sm text-[#12122C]">{item.name}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-[#6B6B8A]">{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Drawer */}
      <Drawer
        open={panelOpen}
        onClose={closePanel}
        title={editingPayer ? `Edit Payer — ${editingPayer.name}` : 'Add Payer'}
        width={480}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closePanel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editingPayer ? 'Save Changes' : 'Add Payer'}
            </Button>
          </>
        }
      >
        <PayerForm form={form} errors={errors} onChange={updateForm} />
      </Drawer>
    </div>
  )
}
