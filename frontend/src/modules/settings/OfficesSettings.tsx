import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'

interface OfficeData {
  id: string
  practice_id: string
  name: string
  npi: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  place_of_service_code: string | null
  is_active: boolean
}

interface PracticeData {
  id: string
  name: string
}

interface OfficeFormValues {
  name: string
  npi: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  phone: string
  place_of_service_code: string
  is_active: boolean
}

const POS_OPTIONS = [
  { value: '11', label: '11 – Office' },
  { value: '21', label: '21 – Inpatient Hospital' },
  { value: '22', label: '22 – Outpatient Hospital' },
  { value: '23', label: '23 – Emergency Room – Hospital' },
  { value: '24', label: '24 – Ambulatory Surgical Center' },
  { value: '31', label: '31 – Skilled Nursing Facility' },
  { value: '32', label: '32 – Nursing Facility' },
  { value: '49', label: '49 – Independent Clinic' },
  { value: '02', label: '02 – Telehealth (Patient Home)' },
  { value: '10', label: '10 – Telehealth (Non-Home)' },
]

const EMPTY_FORM: OfficeFormValues = {
  name: '',
  npi: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  place_of_service_code: '11',
  is_active: true,
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
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  colSpan?: boolean
  maxLength?: number
}) {
  return (
    <div style={colSpan ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={inputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,16,189,0.12)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--bb-border)'; e.currentTarget.style.boxShadow = 'none' }}
      />
    </div>
  )
}

function formatAddress(office: OfficeData): string {
  const parts = [office.address_line1, office.city, office.state].filter(Boolean)
  return parts.join(', ') || '—'
}

function posLabel(code: string | null): string {
  if (!code) return '—'
  const opt = POS_OPTIONS.find(o => o.value === code)
  return opt ? opt.label : code
}

export function OfficesSettings() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [offices, setOffices] = useState<OfficeData[]>([])
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOffice, setEditingOffice] = useState<OfficeData | null>(null)
  const [form, setForm] = useState<OfficeFormValues>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const setField = useCallback(<K extends keyof OfficeFormValues>(k: K, v: OfficeFormValues[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [practicesRes, officesRes] = await Promise.all([
        apiClient.get<PracticeData[]>('/practices'),
        apiClient.get<OfficeData[]>('/offices'),
      ])
      if (practicesRes.data.length > 0) {
        setPracticeId(practicesRes.data[0].id)
      }
      setOffices(officesRes.data)
    } catch {
      addToast({ variant: 'error', message: 'Failed to load offices.' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { loadData() }, [loadData])

  function openAdd() {
    setEditingOffice(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(office: OfficeData) {
    setEditingOffice(office)
    setForm({
      name: office.name,
      npi: office.npi ?? '',
      address_line1: office.address_line1 ?? '',
      address_line2: office.address_line2 ?? '',
      city: office.city ?? '',
      state: office.state ?? '',
      zip_code: office.zip_code ?? '',
      phone: office.phone ?? '',
      place_of_service_code: office.place_of_service_code ?? '11',
      is_active: office.is_active,
    })
    setModalOpen(true)
  }

  async function toggleActive(office: OfficeData) {
    try {
      const res = await apiClient.patch<OfficeData>(`/offices/${office.id}`, {
        is_active: !office.is_active,
      })
      setOffices(prev => prev.map(o => o.id === office.id ? res.data : o))
      addToast({
        variant: 'success',
        message: `Office ${res.data.is_active ? 'activated' : 'deactivated'}.`,
      })
    } catch {
      addToast({ variant: 'error', message: 'Failed to update office status.' })
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      addToast({ variant: 'error', message: 'Office name is required.' })
      return
    }
    if (!practiceId && !editingOffice) {
      addToast({ variant: 'error', message: 'No practice found. Create a practice first.' })
      return
    }

    setSubmitting(true)
    try {
      if (editingOffice) {
        const res = await apiClient.patch<OfficeData>(`/offices/${editingOffice.id}`, {
          name: form.name,
          npi: form.npi || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          phone: form.phone || null,
          place_of_service_code: form.place_of_service_code || null,
          is_active: form.is_active,
        })
        setOffices(prev => prev.map(o => o.id === editingOffice.id ? res.data : o))
        addToast({ variant: 'success', message: 'Office updated.' })
      } else {
        const res = await apiClient.post<OfficeData>('/offices', {
          practice_id: practiceId,
          name: form.name,
          npi: form.npi || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          phone: form.phone || null,
          place_of_service_code: form.place_of_service_code || null,
        })
        setOffices(prev => [...prev, res.data])
        addToast({ variant: 'success', message: 'Office created.' })
      }
      setModalOpen(false)
    } catch {
      addToast({ variant: 'error', message: 'Failed to save office.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--bb-text-primary)', margin: 0 }}>Offices</h2>
          <p style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 4, marginBottom: 0 }}>
            Manage office locations. Each office is linked to a place of service code used on claims.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openAdd} leftIcon={<Plus size={14} />}>
          Add Office
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
                {['Office Name', 'Address', 'Phone', 'POS Code', 'Status', 'Actions'].map(h => (
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
              {offices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                    No offices yet. Click "Add Office" to create one.
                  </td>
                </tr>
              ) : (
                offices.map(office => (
                  <tr
                    key={office.id}
                    style={{ borderBottom: '1px solid var(--bb-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)' }}>
                      {office.name}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                      {formatAddress(office)}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                      {office.phone ?? '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--bb-text-secondary)', fontFamily: 'monospace' }}>
                      {posLabel(office.place_of_service_code)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={office.is_active ? 'active' : 'inactive'}>
                        {office.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="xs" variant="secondary" onClick={() => openEdit(office)}>
                          <Pencil size={11} />
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant={office.is_active ? 'ghost' : 'secondary'}
                          onClick={() => toggleActive(office)}
                        >
                          {office.is_active ? 'Deactivate' : 'Activate'}
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
        title={editingOffice ? 'Edit Office' : 'Add Office'}
        maxWidth={560}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit}>
              {editingOffice ? 'Save Changes' : 'Create Office'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={twoColGrid}>
            <FormField label="Office Name" value={form.name} onChange={v => setField('name', v)} placeholder="Main Office" colSpan />
            <FormField label="Address Line 1" value={form.address_line1} onChange={v => setField('address_line1', v)} placeholder="123 Main St" colSpan />
            <FormField label="Address Line 2" value={form.address_line2} onChange={v => setField('address_line2', v)} placeholder="Suite 100" colSpan />
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
            <FormField label="Phone" value={form.phone} onChange={v => setField('phone', v)} placeholder="(555) 123-4567" />
            <FormField label="NPI" value={form.npi} onChange={v => setField('npi', v)} placeholder="1234567890" />
          </div>

          <div>
            <label style={labelStyle}>Place of Service Code</label>
            <select
              value={form.place_of_service_code}
              onChange={e => setField('place_of_service_code', e.target.value)}
              style={selectStyle}
            >
              {POS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {editingOffice && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setField('is_active', e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--bb-text-primary)' }}>Active</span>
            </label>
          )}
        </div>
      </Modal>
    </div>
  )
}
