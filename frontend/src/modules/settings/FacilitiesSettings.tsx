import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'

interface FacilityData {
  id: string
  name: string
  npi: string | null
  place_of_service_code: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  is_active: boolean
}

interface FacilityFormValues {
  name: string
  npi: string
  place_of_service_code: string
  address_line1: string
  city: string
  state: string
  zip_code: string
}

const FACILITY_TYPE_OPTIONS = [
  { value: '21', label: '21 – Inpatient Hospital' },
  { value: '22', label: '22 – Outpatient Hospital' },
  { value: '23', label: '23 – Emergency Room – Hospital' },
  { value: '24', label: '24 – Ambulatory Surgical Center' },
  { value: '31', label: '31 – Skilled Nursing Facility' },
  { value: '32', label: '32 – Nursing Facility' },
  { value: '49', label: '49 – Independent Clinic' },
  { value: '11', label: '11 – Office' },
  { value: '65', label: '65 – End Stage Renal Disease Treatment Facility' },
  { value: '71', label: '71 – State or Local Public Health Clinic' },
  { value: '72', label: '72 – Rural Health Clinic' },
]

const EMPTY_FORM: FacilityFormValues = {
  name: '',
  npi: '',
  place_of_service_code: '21',
  address_line1: '',
  city: '',
  state: '',
  zip_code: '',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--bb-text-secondary)',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 36,
  border: '1px solid var(--bb-border)',
  borderRadius: 'var(--bb-radius)',
  fontSize: 13,
  padding: '0 10px',
  color: 'var(--bb-text-primary)',
  background: 'var(--bb-surface-card)',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const twoColGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  colSpan,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  colSpan?: boolean
}) {
  return (
    <div style={colSpan ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,16,189,0.12)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--bb-border)'; e.currentTarget.style.boxShadow = 'none' }}
      />
    </div>
  )
}

function formatAddress(f: FacilityData): string {
  const parts = [f.address_line1, f.city, f.state].filter(Boolean)
  return parts.join(', ') || '—'
}

function facilityTypeLabel(code: string | null): string {
  if (!code) return '—'
  const opt = FACILITY_TYPE_OPTIONS.find(o => o.value === code)
  return opt ? opt.label : code
}

export function FacilitiesSettings() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [facilities, setFacilities] = useState<FacilityData[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<FacilityData | null>(null)
  const [form, setForm] = useState<FacilityFormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const setField = useCallback(<K extends keyof FacilityFormValues>(k: K, v: FacilityFormValues[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
  }, [])

  const loadFacilities = useCallback(async () => {
    try {
      const res = await apiClient.get<FacilityData[]>('/facilities')
      setFacilities(res.data)
    } catch {
      addToast({ variant: 'error', message: 'Failed to load facilities.' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadFacilities() }, [loadFacilities])

  function openAdd() {
    setEditingFacility(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(facility: FacilityData) {
    setEditingFacility(facility)
    setForm({
      name: facility.name,
      npi: facility.npi ?? '',
      place_of_service_code: facility.place_of_service_code ?? '21',
      address_line1: facility.address_line1 ?? '',
      city: facility.city ?? '',
      state: facility.state ?? '',
      zip_code: facility.zip_code ?? '',
    })
    setModalOpen(true)
  }

  async function toggleActive(facility: FacilityData) {
    try {
      const res = await apiClient.patch<FacilityData>(`/facilities/${facility.id}`, {
        is_active: !facility.is_active,
      })
      setFacilities(prev => prev.map(f => f.id === facility.id ? res.data : f))
      addToast({
        variant: 'success',
        message: `Facility ${res.data.is_active ? 'activated' : 'deactivated'}.`,
      })
    } catch {
      addToast({ variant: 'error', message: 'Failed to update facility status.' })
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      addToast({ variant: 'error', message: 'Facility name is required.' })
      return
    }
    if (form.npi && !/^\d{10}$/.test(form.npi)) {
      addToast({ variant: 'error', message: 'NPI must be exactly 10 digits.' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        npi: form.npi || null,
        place_of_service_code: form.place_of_service_code || null,
        address_line1: form.address_line1 || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
      }

      if (editingFacility) {
        const res = await apiClient.patch<FacilityData>(`/facilities/${editingFacility.id}`, payload)
        setFacilities(prev => prev.map(f => f.id === editingFacility.id ? res.data : f))
        addToast({ variant: 'success', message: 'Facility updated.' })
      } else {
        const res = await apiClient.post<FacilityData>('/facilities', payload)
        setFacilities(prev => [...prev, res.data])
        addToast({ variant: 'success', message: 'Facility created.' })
      }
      setModalOpen(false)
    } catch {
      addToast({ variant: 'error', message: 'Failed to save facility.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--bb-text-primary)', margin: 0 }}>Facilities</h2>
          <p style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 4, marginBottom: 0 }}>
            Manage service facilities such as hospitals and surgical centers referenced on claims.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openAdd} leftIcon={<Plus size={14} />}>
          Add Facility
        </Button>
      </div>

      <div style={{
        background: 'var(--bb-surface-card)',
        border: '1px solid var(--bb-border)',
        borderRadius: 'var(--bb-radius)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={20} style={{ color: 'var(--bb-brand-blue)', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bb-surface-app)' }}>
              <tr>
                {['Facility Name', 'NPI', 'Address', 'Type', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--bb-text-secondary)',
                    borderBottom: '1px solid var(--bb-border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facilities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                    No facilities yet. Click "Add Facility" to create one.
                  </td>
                </tr>
              ) : (
                facilities.map(facility => (
                  <tr
                    key={facility.id}
                    style={{ borderBottom: '1px solid var(--bb-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)' }}>
                      {facility.name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'monospace', color: 'var(--bb-text-secondary)' }}>
                      {facility.npi ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                      {formatAddress(facility)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--bb-text-secondary)' }}>
                      {facilityTypeLabel(facility.place_of_service_code)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={facility.is_active ? 'active' : 'inactive'}>
                        {facility.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="xs" variant="secondary" onClick={() => openEdit(facility)}>
                          <Pencil size={11} />
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant={facility.is_active ? 'ghost' : 'secondary'}
                          onClick={() => toggleActive(facility)}
                        >
                          {facility.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFacility ? 'Edit Facility' : 'Add Facility'}
        maxWidth={540}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit}>
              {editingFacility ? 'Save Changes' : 'Create Facility'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={twoColGrid}>
            <FormField label="Facility Name" value={form.name} onChange={v => setField('name', v)} placeholder="Regional Medical Center" colSpan />
            <FormField label="NPI" value={form.npi} onChange={v => setField('npi', v)} placeholder="1234567890" />
            <div>
              <label style={labelStyle}>Facility Type</label>
              <select
                value={form.place_of_service_code}
                onChange={e => setField('place_of_service_code', e.target.value)}
                style={selectStyle}
              >
                {FACILITY_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <FormField label="Address" value={form.address_line1} onChange={v => setField('address_line1', v)} placeholder="456 Hospital Dr" colSpan />
            <FormField label="City" value={form.city} onChange={v => setField('city', v)} placeholder="Springfield" />
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setField('state', e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="IL"
                  maxLength={2}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,16,189,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--bb-border)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label style={labelStyle}>ZIP</label>
                <input
                  type="text"
                  value={form.zip_code}
                  onChange={e => setField('zip_code', e.target.value)}
                  placeholder="62701"
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,16,189,0.12)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--bb-border)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
