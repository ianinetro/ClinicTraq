import { useState, useEffect, useCallback } from 'react'
import { Plus, X, CheckCircle, XCircle, AlertCircle, Pencil, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { apiClient } from '../../services/api'

// ── Types ────────────────────────────────────────────────────────────────────

type ProviderType = 'rendering' | 'billing' | 'referring'

interface Provider {
  id: string
  first_name: string
  last_name: string
  npi: string
  taxonomy_code: string | null
  specialty: string | null
  credential: string | null
  dea_numbers: Record<string, string> | null
  office_id: string | null
  is_active: boolean
  created_at: string
}

// Extended local form state (fields beyond what the backend schema holds
// are stored locally since the backend ProviderCreate is the canonical shape)
interface ProviderFormState {
  provider_type: ProviderType
  first_name: string
  last_name: string
  middle_initial: string
  suffix: string
  npi: string
  taxonomy_code: string
  specialty: string
  credential: string
  dea_number: string
  upin: string
  license_number: string
  license_state: string
  medicaid_provider_number: string
  medicare_ptan: string
  accepting_new_patients: boolean
  is_active: boolean
}

type NpiVerifyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'verified'; label: string }
  | { status: 'not_found' }
  | { status: 'error' }

const SUFFIX_OPTIONS = ['', 'MD', 'DO', 'NP', 'PA', 'RN', 'APRN', 'DPM', 'DC', 'OD', 'PhD', 'PsyD', 'LCSW', 'DDS']

const EMPTY_FORM: ProviderFormState = {
  provider_type: 'rendering',
  first_name: '',
  last_name: '',
  middle_initial: '',
  suffix: '',
  npi: '',
  taxonomy_code: '',
  specialty: '',
  credential: '',
  dea_number: '',
  upin: '',
  license_number: '',
  license_state: '',
  medicaid_provider_number: '',
  medicare_ptan: '',
  accepting_new_patients: true,
  is_active: true,
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function providerDisplayName(p: Provider): string {
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.join(' ') || '—'
}

function deaDisplay(dea: Record<string, string> | null): string {
  if (!dea) return '—'
  const vals = Object.values(dea)
  if (vals.length === 0) return '—'
  return vals[0]
}

// ── Label ─────────────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[#676687] mb-1">
      {children}
      {required && <span className="text-[#DC2626] ml-0.5">*</span>}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className="w-full h-8 border border-[#E0E0EF] rounded-[4px] px-2.5 text-sm text-[#12122C] placeholder:text-[#BABACE] outline-none focus:border-[#0410BD] focus:ring-2 focus:ring-[#0410BD]/15 transition disabled:bg-[#F2F2F8] disabled:text-[#BABACE]"
    />
  )
}

// ── NPI Verify badge ──────────────────────────────────────────────────────────

function NpiBadge({ state }: { state: NpiVerifyState }) {
  if (state.status === 'idle') return null
  if (state.status === 'loading')
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#676687]">
        <Loader2 size={12} className="animate-spin" /> Checking NPPES…
      </span>
    )
  if (state.status === 'verified')
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30">
        <CheckCircle size={11} /> Verified: {state.label}
      </span>
    )
  if (state.status === 'not_found')
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/30">
        <XCircle size={11} /> Not found in NPPES
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/30">
      <AlertCircle size={11} /> NPPES lookup unavailable
    </span>
  )
}

// ── Slide-in panel ────────────────────────────────────────────────────────────

interface PanelProps {
  providerType: ProviderType
  editTarget: Provider | null
  onClose: () => void
  onSaved: (provider: Provider) => void
}

function ProviderPanel({ providerType, editTarget, onClose, onSaved }: PanelProps) {
  const [form, setForm] = useState<ProviderFormState>({
    ...EMPTY_FORM,
    provider_type: providerType,
    ...(editTarget
      ? {
          first_name: editTarget.first_name,
          last_name: editTarget.last_name,
          npi: editTarget.npi,
          taxonomy_code: editTarget.taxonomy_code ?? '',
          specialty: editTarget.specialty ?? '',
          credential: editTarget.credential ?? '',
          dea_number: deaDisplay(editTarget.dea_numbers) === '—' ? '' : deaDisplay(editTarget.dea_numbers),
          is_active: editTarget.is_active,
        }
      : {}),
  })
  const [npiState, setNpiState] = useState<NpiVerifyState>({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof ProviderFormState, string>>>({})

  function set<K extends keyof ProviderFormState>(key: K, value: ProviderFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  async function verifyNpi() {
    const npi = form.npi.trim()
    if (!npi) return
    setNpiState({ status: 'loading' })
    try {
      const resp = await apiClient.get<{
        valid: boolean
        first_name?: string
        last_name?: string
        organization_name?: string
        taxonomy_description?: string
        message: string
      }>('/npi/lookup', { params: { number: npi } })
      const d = resp.data
      if (!d.valid) {
        setNpiState({ status: 'not_found' })
        return
      }
      const name = d.organization_name
        ? d.organization_name
        : [d.first_name, d.last_name].filter(Boolean).join(' ')
      const label = [name, d.taxonomy_description].filter(Boolean).join(' — ')
      setNpiState({ status: 'verified', label: label || npi })
      if (d.taxonomy_description && !form.taxonomy_code) {
        set('taxonomy_code', d.taxonomy_description)
      }
    } catch {
      setNpiState({ status: 'error' })
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ProviderFormState, string>> = {}
    if (!form.first_name.trim()) newErrors.first_name = 'Required'
    if (!form.last_name.trim()) newErrors.last_name = 'Required'
    if (!form.npi.trim()) newErrors.npi = 'Required'
    else if (!/^\d{10}$/.test(form.npi.trim())) newErrors.npi = 'Must be exactly 10 digits'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        npi: form.npi.trim(),
        taxonomy_code: form.taxonomy_code || null,
        specialty: form.specialty || null,
        credential: form.credential || null,
        dea_numbers: form.dea_number ? { default: form.dea_number } : null,
        is_active: form.is_active,
      }

      let resp: { data: Provider }
      if (editTarget) {
        resp = await apiClient.patch<Provider>(`/providers/${editTarget.id}`, payload)
      } else {
        resp = await apiClient.post<Provider>('/providers', payload)
      }
      onSaved(resp.data)
    } catch {
      // surface nothing — parent handles
    } finally {
      setSaving(false)
    }
  }

  const title = editTarget
    ? `Edit ${providerType.charAt(0).toUpperCase() + providerType.slice(1)} Provider`
    : `Add ${providerType.charAt(0).toUpperCase() + providerType.slice(1)} Provider`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[199] bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-[200] w-[400px] bg-white shadow-[var(--bb-shadow-md)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0EF] flex-shrink-0">
          <h3 className="text-base font-semibold text-[#12122C]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#676687] hover:text-[#12122C] transition rounded p-1 hover:bg-[#F2F2F8]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Name section */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE] mb-3">Name</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <FieldLabel required>First Name</FieldLabel>
                <TextInput value={form.first_name} onChange={v => set('first_name', v)} placeholder="Jane" />
                {errors.first_name && <p className="text-xs text-[#DC2626] mt-0.5">{errors.first_name}</p>}
              </div>
              <div>
                <FieldLabel required>Last Name</FieldLabel>
                <TextInput value={form.last_name} onChange={v => set('last_name', v)} placeholder="Smith" />
                {errors.last_name && <p className="text-xs text-[#DC2626] mt-0.5">{errors.last_name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Middle Initial</FieldLabel>
                <TextInput value={form.middle_initial} onChange={v => set('middle_initial', v)} placeholder="A" maxLength={1} />
              </div>
              <div>
                <FieldLabel>Suffix</FieldLabel>
                <select
                  value={form.suffix}
                  onChange={e => set('suffix', e.target.value)}
                  className="w-full h-8 border border-[#E0E0EF] rounded-[4px] px-2 text-sm text-[#12122C] outline-none focus:border-[#0410BD] focus:ring-2 focus:ring-[#0410BD]/15 transition bg-white"
                >
                  {SUFFIX_OPTIONS.map(s => (
                    <option key={s} value={s}>{s || '(none)'}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <hr className="border-[#E0E0EF]" />

          {/* NPI section */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE] mb-3">NPI</p>
            <FieldLabel required>NPI Number</FieldLabel>
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput
                  value={form.npi}
                  onChange={v => {
                    set('npi', v.replace(/\D/g, '').slice(0, 10))
                    setNpiState({ status: 'idle' })
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                />
              </div>
              <button
                type="button"
                onClick={verifyNpi}
                disabled={form.npi.length !== 10 || npiState.status === 'loading'}
                className="h-8 px-3 text-xs font-medium rounded-[4px] border border-[#0410BD] text-[#0410BD] hover:bg-[#EFF0FF] transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                Verify NPI
              </button>
            </div>
            {errors.npi && <p className="text-xs text-[#DC2626] mt-0.5">{errors.npi}</p>}
            {npiState.status !== 'idle' && (
              <div className="mt-2">
                <NpiBadge state={npiState} />
              </div>
            )}
          </div>

          <hr className="border-[#E0E0EF]" />

          {/* Credentials & specialty */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE] mb-3">Credentials</p>
            <div className="space-y-3">
              <div>
                <FieldLabel>Taxonomy Code</FieldLabel>
                <TextInput value={form.taxonomy_code} onChange={v => set('taxonomy_code', v)} placeholder="207Q00000X" />
              </div>
              <div>
                <FieldLabel>Specialty</FieldLabel>
                <TextInput value={form.specialty} onChange={v => set('specialty', v)} placeholder="Family Medicine" />
              </div>
              <div>
                <FieldLabel>Credentials</FieldLabel>
                <TextInput value={form.credential} onChange={v => set('credential', v)} placeholder="MD, FACP" />
              </div>
            </div>
          </div>

          <hr className="border-[#E0E0EF]" />

          {/* Identifiers */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE] mb-3">Identifiers</p>
            <div className="space-y-3">
              <div>
                <FieldLabel>DEA Number</FieldLabel>
                <TextInput value={form.dea_number} onChange={v => set('dea_number', v)} placeholder="AB1234563 (optional)" />
              </div>
              <div>
                <FieldLabel>UPIN</FieldLabel>
                <TextInput value={form.upin} onChange={v => set('upin', v)} placeholder="A12345 (optional)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>State License #</FieldLabel>
                  <TextInput value={form.license_number} onChange={v => set('license_number', v)} placeholder="ME12345" />
                </div>
                <div>
                  <FieldLabel>State</FieldLabel>
                  <TextInput value={form.license_state} onChange={v => set('license_state', v.toUpperCase().slice(0, 2))} placeholder="CA" maxLength={2} />
                </div>
              </div>
              <div>
                <FieldLabel>Medicaid Provider #</FieldLabel>
                <TextInput value={form.medicaid_provider_number} onChange={v => set('medicaid_provider_number', v)} placeholder="(optional)" />
              </div>
              <div>
                <FieldLabel>Medicare PTAN</FieldLabel>
                <TextInput value={form.medicare_ptan} onChange={v => set('medicare_ptan', v)} placeholder="(optional)" />
              </div>
            </div>
          </div>

          <hr className="border-[#E0E0EF]" />

          {/* Flags */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#BABACE] mb-3">Settings</p>
            <div className="space-y-3">
              {providerType === 'rendering' && (
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-[#12122C]">Accepting New Patients</span>
                  <button
                    type="button"
                    onClick={() => set('accepting_new_patients', !form.accepting_new_patients)}
                    className="text-[#0410BD] transition"
                  >
                    {form.accepting_new_patients
                      ? <ToggleRight size={24} />
                      : <ToggleLeft size={24} className="text-[#BABACE]" />}
                  </button>
                </label>
              )}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-[#12122C]">Active</span>
                <button
                  type="button"
                  onClick={() => set('is_active', !form.is_active)}
                  className="transition"
                >
                  {form.is_active
                    ? <ToggleRight size={24} className="text-[#0410BD]" />
                    : <ToggleLeft size={24} className="text-[#BABACE]" />}
                </button>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#E0E0EF] flex-shrink-0 bg-white">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
            {editTarget ? 'Save Changes' : 'Add Provider'}
          </Button>
        </div>
      </div>
    </>
  )
}

// ── Provider Table ────────────────────────────────────────────────────────────

interface TableProps {
  providers: Provider[]
  loading: boolean
  onEdit: (p: Provider) => void
  onToggleActive: (p: Provider) => void
}

function ProviderTable({ providers, loading, onEdit, onToggleActive }: TableProps) {
  const COLS = ['Name', 'NPI', 'Specialty / Taxonomy', 'Credentials', 'DEA', 'UPIN', 'State License', 'Active', 'Actions']

  if (loading) {
    return (
      <div className="bg-white border border-[#E0E0EF] rounded-lg flex items-center justify-center py-16 text-sm text-[#676687]">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading providers…
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E0E0EF] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-[#F2F2F8]">
            <tr>
              {COLS.map(col => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0EF]">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-12 text-center text-sm text-[#BABACE]">
                  No providers added yet. Click "Add Provider" to get started.
                </td>
              </tr>
            ) : (
              providers.map((p, idx) => (
                <tr
                  key={p.id}
                  className={idx % 2 === 0 ? 'bg-white hover:bg-[#F2F2F8]' : 'bg-[#FAFAFA] hover:bg-[#F2F2F8]'}
                >
                  <td className="px-4 py-2.5 text-sm font-medium text-[#12122C] whitespace-nowrap">
                    {providerDisplayName(p)}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-[#676687]">{p.npi}</td>
                  <td className="px-4 py-2.5 text-sm text-[#676687] max-w-[160px] truncate">
                    {[p.specialty, p.taxonomy_code].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-[#676687]">{p.credential || '—'}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-[#676687]">{deaDisplay(p.dea_numbers)}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-[#676687]">—</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-[#676687]">—</td>
                  <td className="px-4 py-2.5">
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16A34A] bg-[#F0FDF4] border border-[#16A34A]/20 rounded-full px-2 py-0.5">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#676687] bg-[#F2F2F8] border border-[#E0E0EF] rounded-full px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEdit(p)}
                        className="inline-flex items-center gap-1 h-6 px-2 text-xs rounded border border-[#E0E0EF] text-[#676687] hover:bg-[#EFF0FF] hover:text-[#0410BD] hover:border-[#0410BD]/30 transition"
                        title="Edit provider"
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <button
                        onClick={() => onToggleActive(p)}
                        className="inline-flex items-center gap-1 h-6 px-2 text-xs rounded border border-[#E0E0EF] text-[#676687] hover:bg-[#FEF2F2] hover:text-[#DC2626] hover:border-[#DC2626]/30 transition"
                        title={p.is_active ? 'Deactivate' : 'Reactivate'}
                      >
                        {p.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS: { key: ProviderType; label: string }[] = [
  { key: 'rendering', label: 'Rendering' },
  { key: 'billing', label: 'Billing' },
  { key: 'referring', label: 'Referring' },
]

export function ProvidersSettings() {
  const [activeTab, setActiveTab] = useState<ProviderType>('rendering')
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Provider | null>(null)

  const fetchProviders = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await apiClient.get<Provider[]>('/providers')
      setProviders(resp.data)
    } catch {
      // silently fail — table shows empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProviders()
  }, [fetchProviders])

  function openAdd() {
    setEditTarget(null)
    setPanelOpen(true)
  }

  function openEdit(p: Provider) {
    setEditTarget(p)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelOpen(false)
    setEditTarget(null)
  }

  function handleSaved(provider: Provider) {
    setProviders(prev => {
      const idx = prev.findIndex(p => p.id === provider.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = provider
        return next
      }
      return [...prev, provider]
    })
    closePanel()
  }

  async function handleToggleActive(p: Provider) {
    try {
      const resp = await apiClient.patch<Provider>(`/providers/${p.id}`, { is_active: !p.is_active })
      setProviders(prev => prev.map(x => (x.id === p.id ? resp.data : x)))
    } catch {
      // silently fail
    }
  }

  const tabLabel = TABS.find(t => t.key === activeTab)?.label ?? 'Providers'

  return (
    <div className="p-6 space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-[#12122C]">Providers</h2>
        <p className="text-sm text-[#676687] mt-1">
          Manage rendering, billing, and referring providers for your practice.
        </p>
        <div className="mt-2 bg-[#D9FCFF] border border-[#94F2FA] rounded-lg px-3 py-2 text-xs text-[#007998]">
          Provider information flows into claim generation (Box 31), remittance, and clearinghouse submissions.
        </div>
      </div>

      {/* Tabs + Add button row */}
      <div className="flex items-center justify-between border-b border-[#E0E0EF]">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'text-[#0410BD] border-b-2 border-[#0410BD] -mb-px'
                  : 'text-[#676687] hover:text-[#12122C]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pb-1">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={openAdd}
          >
            Add {tabLabel} Provider
          </Button>
        </div>
      </div>

      {/* Table */}
      <ProviderTable
        providers={providers}
        loading={loading}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
      />

      {/* Slide panel */}
      {panelOpen && (
        <ProviderPanel
          providerType={activeTab}
          editTarget={editTarget}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
