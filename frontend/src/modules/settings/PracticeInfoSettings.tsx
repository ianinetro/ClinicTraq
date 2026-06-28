import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'

interface PracticeData {
  id: string
  name: string
  npi: string | null
  tax_id: string | null
  taxonomy_code: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  fax: string | null
  is_active: boolean
}

interface FormValues {
  name: string
  npi: string
  tax_id: string
  taxonomy_code: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip_code: string
  phone: string
  fax: string
  email: string
  website: string
  medicaid_id: string
  medicare_ptan: string
}

const EMPTY_FORM: FormValues = {
  name: '',
  npi: '',
  tax_id: '',
  taxonomy_code: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  medicaid_id: '',
  medicare_ptan: '',
}

const sectionHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--bb-text-secondary)',
  marginBottom: 12,
  marginTop: 0,
}

const card: React.CSSProperties = {
  background: 'var(--bb-surface-card)',
  border: '1px solid var(--bb-border)',
  borderRadius: 'var(--bb-radius)',
  padding: 20,
  marginBottom: 16,
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

const twoColGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  hint,
  colSpan,
}: {
  label: string
  name: keyof FormValues
  value: string
  onChange: (name: keyof FormValues, val: string) => void
  placeholder?: string
  hint?: string
  colSpan?: boolean
}) {
  return (
    <div style={colSpan ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(4,16,189,0.12)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--bb-border)'; e.currentTarget.style.boxShadow = 'none' }}
      />
      {hint && <p style={{ fontSize: 11, color: 'var(--bb-text-secondary)', marginTop: 3 }}>{hint}</p>}
    </div>
  )
}

function validateForm(form: FormValues): string | null {
  if (!form.name.trim()) return 'Practice name is required.'
  if (form.npi && !/^\d{10}$/.test(form.npi)) return 'NPI must be exactly 10 digits.'
  if (form.tax_id && !/^\d{2}-\d{7}$/.test(form.tax_id)) return 'Tax ID must be in format XX-XXXXXXX.'
  if (form.state && form.state.length > 2) return 'State must be a 2-character code.'
  return null
}

export function PracticeInfoSettings() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [form, setForm] = useState<FormValues>(EMPTY_FORM)

  const setField = useCallback((name: keyof FormValues, val: string) => {
    setForm(prev => ({ ...prev, [name]: val }))
  }, [])

  useEffect(() => {
    setLoading(true)
    apiClient.get<PracticeData[]>('/practices')
      .then(res => {
        const practices = res.data
        if (practices.length > 0) {
          const p = practices[0]
          setPracticeId(p.id)
          setForm({
            name: p.name ?? '',
            npi: p.npi ?? '',
            tax_id: p.tax_id ?? '',
            taxonomy_code: p.taxonomy_code ?? '',
            address_line1: p.address_line1 ?? '',
            address_line2: p.address_line2 ?? '',
            city: p.city ?? '',
            state: p.state ?? '',
            zip_code: p.zip_code ?? '',
            phone: p.phone ?? '',
            fax: p.fax ?? '',
            // these fields aren't in the API yet — keep as empty
            email: '',
            website: '',
            medicaid_id: '',
            medicare_ptan: '',
          })
        }
      })
      .catch(() => {
        addToast({ variant: 'error', message: 'Failed to load practice information.' })
      })
      .finally(() => setLoading(false))
  }, [addToast])

  async function handleSave() {
    const err = validateForm(form)
    if (err) {
      addToast({ variant: 'error', message: err })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name,
        npi: form.npi || null,
        tax_id: form.tax_id || null,
        taxonomy_code: form.taxonomy_code || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        phone: form.phone || null,
        fax: form.fax || null,
      }

      if (practiceId) {
        await apiClient.patch(`/practices/${practiceId}`, payload)
        addToast({ variant: 'success', message: 'Practice information saved.' })
      } else {
        const res = await apiClient.post<PracticeData>('/practices', payload)
        setPracticeId(res.data.id)
        addToast({ variant: 'success', message: 'Practice created successfully.' })
      }
    } catch {
      addToast({ variant: 'error', message: 'Failed to save practice information.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={24} style={{ color: 'var(--bb-brand-blue)', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--bb-text-primary)', margin: 0 }}>
          Practice Information
        </h2>
        <p style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 4, marginBottom: 0 }}>
          Core practice details used on claims, remittances, and patient-facing documents.
        </p>
      </div>

      {/* Practice Identity */}
      <div style={card}>
        <p style={sectionHeader}>Practice Identity</p>
        <div style={twoColGrid}>
          <Field label="Practice Name" name="name" value={form.name} onChange={setField} placeholder="Acme Medical Group" colSpan />
          <Field label="NPI" name="npi" value={form.npi} onChange={setField} placeholder="1234567890" hint="10-digit National Provider Identifier" />
          <Field label="Tax ID / EIN" name="tax_id" value={form.tax_id} onChange={setField} placeholder="12-3456789" hint="Format: XX-XXXXXXX" />
          <Field label="Taxonomy Code" name="taxonomy_code" value={form.taxonomy_code} onChange={setField} placeholder="207Q00000X" />
        </div>
      </div>

      {/* Address */}
      <div style={card}>
        <p style={sectionHeader}>Address</p>
        <div style={twoColGrid}>
          <Field label="Address Line 1" name="address_line1" value={form.address_line1} onChange={setField} placeholder="123 Main St" colSpan />
          <Field label="Address Line 2" name="address_line2" value={form.address_line2} onChange={setField} placeholder="Suite 100" colSpan />
          <Field label="City" name="city" value={form.city} onChange={setField} placeholder="Springfield" />
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
              <label style={labelStyle}>ZIP Code</label>
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

      {/* Contact */}
      <div style={card}>
        <p style={sectionHeader}>Contact</p>
        <div style={twoColGrid}>
          <Field label="Phone" name="phone" value={form.phone} onChange={setField} placeholder="(555) 123-4567" hint="Format: (XXX) XXX-XXXX" />
          <Field label="Fax" name="fax" value={form.fax} onChange={setField} placeholder="(555) 123-4568" />
          <Field label="Email" name="email" value={form.email} onChange={setField} placeholder="billing@practice.com" />
          <Field label="Website" name="website" value={form.website} onChange={setField} placeholder="https://www.practice.com" />
        </div>
      </div>

      {/* Payer IDs */}
      <div style={card}>
        <p style={sectionHeader}>Payer IDs</p>
        <div style={twoColGrid}>
          <Field label="Medicaid ID" name="medicaid_id" value={form.medicaid_id} onChange={setField} placeholder="MED-123456" />
          <Field label="Medicare PTAN" name="medicare_ptan" value={form.medicare_ptan} onChange={setField} placeholder="P123456789" hint="Provider Transaction Access Number" />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
          <Save size={14} />
          Save Changes
        </Button>
      </div>
    </div>
  )
}
