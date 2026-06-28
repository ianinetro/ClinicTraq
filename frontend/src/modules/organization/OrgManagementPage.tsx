import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient as api } from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ManagementGroup {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  is_active: boolean
}

interface BillingCompany {
  id: string
  name: string
  management_group_id: string | null
  npi: string | null
  tax_id: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  is_active: boolean
}

interface Clinic {
  id: string
  name: string
  management_group_id: string | null
  billing_company_id: string | null
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  fax?: string | null
  email?: string | null
  place_of_service_code: string
  is_active: boolean
}

interface StaffAssignment {
  id: string
  clinic_id: string
  user_id: string
  clinic_role: string
  is_primary: boolean
  is_active: boolean
}

interface BillingUserAssignment {
  id: string
  billing_company_id: string
  user_id: string
  billing_role: string
  clinic_ids: string[] | null
  is_active: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLINIC_ROLES = [
  'doctor', 'nurse', 'medical_assistant', 'front_desk',
  'scribe', 'billing', 'supervisor', 'admin',
]

const BILLING_ROLES = [
  'billing_admin', 'billing_manager', 'coder', 'charge_entry',
  'claim_submit', 'payment_poster', 'denial_specialist', 'ar_specialist', 'patient_billing',
]

const POS_CODES = [
  { code: '11', label: '11 – Office' },
  { code: '02', label: '02 – Telehealth (patient home)' },
  { code: '10', label: '10 – Telehealth (non-home)' },
  { code: '12', label: '12 – Home' },
  { code: '21', label: '21 – Inpatient Hospital' },
  { code: '22', label: '22 – On-Campus Outpatient Hospital' },
  { code: '23', label: '23 – Emergency Room' },
  { code: '24', label: '24 – Ambulatory Surgical Center' },
  { code: '31', label: '31 – Skilled Nursing Facility' },
  { code: '49', label: '49 – Independent Clinic' },
  { code: '65', label: '65 – End-Stage Renal Disease Facility' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

// ── Role badge colors ─────────────────────────────────────────────────────────

const clinicRoleColors: Record<string, string> = {
  admin: 'var(--bb-brand-blue)',
  doctor: 'var(--bb-status-success)',
  supervisor: '#7C3AED',
  nurse: '#0891B2',
  billing: '#D97706',
  front_desk: 'var(--bb-text-secondary)',
  medical_assistant: '#059669',
  scribe: '#6B7280',
}

const billingRoleColors: Record<string, string> = {
  billing_admin: 'var(--bb-brand-blue)',
  billing_manager: '#7C3AED',
  coder: '#059669',
  charge_entry: '#D97706',
  claim_submit: '#0891B2',
  payment_poster: 'var(--bb-status-success)',
  denial_specialist: 'var(--bb-status-danger)',
  ar_specialist: '#F59E0B',
  patient_billing: '#6B7280',
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--bb-brand-blue)',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px',
  background: 'var(--bb-surface-app)',
  color: 'var(--bb-text-primary)',
  border: '1px solid var(--bb-border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--bb-surface-app)',
  color: 'var(--bb-text-primary)',
  border: '1px solid var(--bb-border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnSmallPrimary: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--bb-brand-blue)',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--bb-border)',
  borderRadius: 8,
  fontSize: 14,
  color: 'var(--bb-text-primary)',
  background: 'var(--bb-surface-app)',
  boxSizing: 'border-box',
  outline: 'none',
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: active ? '#F0FDF4' : '#FEF2F2',
      color: active ? 'var(--bb-status-success)' : 'var(--bb-status-danger)',
      border: `1px solid ${active ? '#16A34A' : '#DC2626'}30`,
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RoleBadge({ role, colorMap }: { role: string; colorMap: Record<string, string> }) {
  const color = colorMap[role] ?? 'var(--bb-text-secondary)'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: color + '1A', color,
      border: `1px solid ${color}40`,
    }}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: 'var(--bb-status-danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Slide Panel ───────────────────────────────────────────────────────────────

interface SlidePanelProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

function SlidePanel({ title, onClose, children, footer }: SlidePanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(18,18,44,0.4)',
          backdropFilter: 'blur(2px)',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
        width: 480, background: 'var(--bb-surface-card)',
        boxShadow: '-8px 0 32px rgba(18,18,44,0.18)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
        {/* Header */}
        <div style={{
          padding: '18px 24px 16px',
          borderBottom: '1px solid var(--bb-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', fontSize: 22, lineHeight: 1, padding: '0 4px' }}>
            &times;
          </button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--bb-border)',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface TableProps {
  headers: string[]
  rows: React.ReactNode[][]
  compact?: boolean
}

function Table({ headers, rows, compact }: TableProps) {
  const py = compact ? '7px' : '11px'
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 13 : 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: `${py} 12px`,
                textAlign: 'left', fontSize: 11, fontWeight: 700,
                color: 'var(--bb-text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 13 }}>
                No records found
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: '1px solid var(--bb-border)', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: `${py} 12px`, color: 'var(--bb-text-primary)', verticalAlign: 'middle' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Expandable Row Wrapper ────────────────────────────────────────────────────

function ExpandPanel({ open, children }: { open: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    if (open) {
      setHeight(ref.current.scrollHeight)
    } else {
      setHeight(0)
    }
  }, [open, children])

  return (
    <div style={{
      overflow: 'hidden',
      height,
      transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div ref={ref} style={{ borderTop: open ? '1px solid var(--bb-border)' : 'none', padding: open ? '16px' : 0, background: 'var(--bb-surface-app)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{title}</h2>
      </div>
      <button onClick={onAdd} style={btnPrimary}>{addLabel}</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: CLINICS
// ─────────────────────────────────────────────────────────────────────────────

type ClinicFormState = {
  name: string
  npi: string
  tax_id: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string
  fax: string
  email: string
  place_of_service_code: string
  management_group_id: string
  billing_company_id: string
  is_active: boolean
}

const defaultClinicForm = (): ClinicFormState => ({
  name: '', npi: '', tax_id: '', address: '', city: '', state: '', zip_code: '',
  phone: '', fax: '', email: '', place_of_service_code: '11',
  management_group_id: '', billing_company_id: '', is_active: true,
})

// Staff sub-panel for a clinic

type StaffFormState = {
  user_id: string
  email: string
  first_name: string
  last_name: string
  clinic_role: string
  is_primary: boolean
  create_new: boolean
}

const defaultStaffForm = (): StaffFormState => ({
  user_id: '', email: '', first_name: '', last_name: '',
  clinic_role: 'front_desk', is_primary: false, create_new: false,
})

interface ClinicStaffPanelProps {
  clinic: Clinic
}

function ClinicStaffPanel({ clinic }: ClinicStaffPanelProps) {
  const [staff, setStaff] = useState<StaffAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [form, setForm] = useState<StaffFormState>(defaultStaffForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/org/clinics/${clinic.id}/staff`)
      .then(r => setStaff(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clinic.id])

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        clinic_id: clinic.id,
        clinic_role: form.clinic_role,
        is_primary: form.is_primary,
      }
      if (form.create_new) {
        payload.email = form.email
        payload.first_name = form.first_name
        payload.last_name = form.last_name
      } else {
        payload.user_id = form.user_id
      }
      const r = await api.post(`/org/clinics/${clinic.id}/staff`, payload)
      setStaff(prev => [...prev, r.data])
      setShowPanel(false)
      setForm(defaultStaffForm())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-secondary)' }}>
          Staff — {clinic.name}
        </span>
        <button onClick={() => setShowPanel(true)} style={btnSmallPrimary}>+ Add Staff</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--bb-text-secondary)', fontSize: 13, padding: '8px 0' }}>Loading…</div>
      ) : (
        <Table
          compact
          headers={['Name / User', 'Role', 'Primary', 'Status']}
          rows={staff.map(s => [
            <code style={{ fontSize: 11, color: 'var(--bb-text-secondary)' }}>{s.user_id.slice(0, 8)}…</code>,
            <RoleBadge role={s.clinic_role} colorMap={clinicRoleColors} />,
            s.is_primary ? <span style={{ color: 'var(--bb-status-success)', fontWeight: 600, fontSize: 12 }}>Yes</span> : <span style={{ color: 'var(--bb-text-secondary)', fontSize: 12 }}>—</span>,
            <StatusBadge active={s.is_active} />,
          ])}
        />
      )}

      {showPanel && (
        <SlidePanel
          title={`Add Staff — ${clinic.name}`}
          onClose={() => { setShowPanel(false); setForm(defaultStaffForm()) }}
          footer={
            <>
              <button onClick={() => { setShowPanel(false); setForm(defaultStaffForm()) }} style={btnSecondary}>Cancel</button>
              <button
                onClick={save}
                disabled={saving || (!form.create_new && !form.user_id) || (form.create_new && !form.email)}
                style={{ ...btnPrimary, opacity: (saving || (!form.create_new && !form.user_id) || (form.create_new && !form.email)) ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Add Staff'}
              </button>
            </>
          }
        >
          <Field label="Mode">
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setForm(f => ({ ...f, create_new: false }))}
                style={{ ...btnSecondary, flex: 1, background: !form.create_new ? 'var(--bb-brand-blue)' : undefined, color: !form.create_new ? 'white' : undefined, border: !form.create_new ? 'none' : undefined }}
              >
                Existing User
              </button>
              <button
                onClick={() => setForm(f => ({ ...f, create_new: true }))}
                style={{ ...btnSecondary, flex: 1, background: form.create_new ? 'var(--bb-brand-blue)' : undefined, color: form.create_new ? 'white' : undefined, border: form.create_new ? 'none' : undefined }}
              >
                Create New User
              </button>
            </div>
          </Field>

          {form.create_new ? (
            <>
              <Field label="Email" required><input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="First Name" required><input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></Field>
                <Field label="Last Name" required><input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></Field>
              </div>
            </>
          ) : (
            <Field label="User ID" required>
              <input style={inputStyle} placeholder="Paste user UUID" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} />
            </Field>
          )}

          <Field label="Clinic Role" required>
            <select style={inputStyle} value={form.clinic_role} onChange={e => setForm(f => ({ ...f, clinic_role: e.target.value }))}>
              {CLINIC_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input type="checkbox" id="is_primary_staff" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} style={{ accentColor: 'var(--bb-brand-blue)', width: 16, height: 16 }} />
            <label htmlFor="is_primary_staff" style={{ fontSize: 14, color: 'var(--bb-text-primary)' }}>Primary assignment at this clinic</label>
          </div>
        </SlidePanel>
      )}
    </div>
  )
}

// Main Clinics Tab

function ClinicsTab() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [mgmtGroups, setMgmtGroups] = useState<ManagementGroup[]>([])
  const [billingCos, setBillingCos] = useState<BillingCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editClinic, setEditClinic] = useState<Clinic | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<ClinicFormState>(defaultClinicForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/org/clinics'),
      api.get('/org/management-groups'),
      api.get('/org/billing-companies'),
    ]).then(([c, m, b]) => {
      setClinics(c.data)
      setMgmtGroups(m.data)
      setBillingCos(b.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditClinic(null)
    setForm(defaultClinicForm())
    setSlideOpen(true)
  }

  const openEdit = (clinic: Clinic) => {
    setEditClinic(clinic)
    setForm({
      name: clinic.name,
      npi: clinic.npi ?? '',
      tax_id: '',
      address: clinic.address ?? '',
      city: clinic.city ?? '',
      state: clinic.state ?? '',
      zip_code: clinic.zip_code ?? '',
      phone: clinic.phone ?? '',
      fax: clinic.fax ?? '',
      email: clinic.email ?? '',
      place_of_service_code: clinic.place_of_service_code,
      management_group_id: clinic.management_group_id ?? '',
      billing_company_id: clinic.billing_company_id ?? '',
      is_active: clinic.is_active,
    })
    setSlideOpen(true)
  }

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!payload.management_group_id) delete payload.management_group_id
      if (!payload.billing_company_id) delete payload.billing_company_id

      if (editClinic) {
        const r = await api.patch(`/org/clinics/${editClinic.id}`, payload)
        setClinics(prev => prev.map(c => c.id === editClinic.id ? r.data : c))
      } else {
        const r = await api.post('/org/clinics', payload)
        setClinics(prev => [...prev, r.data])
      }
      setSlideOpen(false)
      setEditClinic(null)
      setForm(defaultClinicForm())
    } finally {
      setSaving(false)
    }
  }

  const mgmtName = (id: string | null) => mgmtGroups.find(m => m.id === id)?.name ?? '—'
  const billingName = (id: string | null) => billingCos.find(b => b.id === id)?.name ?? '—'

  return (
    <>
      <SectionHeader title="Clinics" addLabel="+ Add Clinic" onAdd={openAdd} />

      {loading ? (
        <div style={{ color: 'var(--bb-text-secondary)', padding: '24px 0', textAlign: 'center' }}>Loading clinics…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
                {['Clinic Name', 'NPI', 'Address', 'Phone', 'Mgmt Group', 'Billing Co', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clinics.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 13 }}>No clinics found</td></tr>
              )}
              {clinics.map(clinic => (
                <React.Fragment key={clinic.id}>
                  <tr
                    key={clinic.id}
                    style={{ borderBottom: expandedRows.has(clinic.id) ? 'none' : '1px solid var(--bb-border)', transition: 'background 0.1s', background: expandedRows.has(clinic.id) ? 'var(--bb-surface-app)' : 'transparent' }}
                    onMouseEnter={e => { if (!expandedRows.has(clinic.id)) e.currentTarget.style.background = 'var(--bb-surface-app)' }}
                    onMouseLeave={e => { if (!expandedRows.has(clinic.id)) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--bb-text-primary)' }}>{clinic.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{clinic.npi ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {clinic.city && clinic.state ? `${clinic.city}, ${clinic.state}` : clinic.address ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12 }}>{clinic.phone ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mgmtName(clinic.management_group_id)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{billingName(clinic.billing_company_id)}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge active={clinic.is_active} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleExpand(clinic.id)} style={{ ...btnSmall, background: expandedRows.has(clinic.id) ? 'var(--bb-brand-blue)' : undefined, color: expandedRows.has(clinic.id) ? 'white' : undefined, border: expandedRows.has(clinic.id) ? 'none' : undefined }}>
                          {expandedRows.has(clinic.id) ? 'Hide Staff' : 'View Staff'}
                        </button>
                        <button onClick={() => openEdit(clinic)} style={btnSmall}>Edit</button>
                        <a href={`/admin/clinics/${clinic.id}`} style={{ ...btnSmall, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Manage</a>
                      </div>
                    </td>
                  </tr>
                  {/* Expandable staff row */}
                  <tr key={`${clinic.id}-staff`} style={{ borderBottom: expandedRows.has(clinic.id) ? '1px solid var(--bb-border)' : 'none' }}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <ExpandPanel open={expandedRows.has(clinic.id)}>
                        <ClinicStaffPanel clinic={clinic} />
                      </ExpandPanel>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Clinic Slide Panel */}
      {slideOpen && (
        <SlidePanel
          title={editClinic ? `Edit Clinic — ${editClinic.name}` : 'Add Clinic'}
          onClose={() => { setSlideOpen(false); setEditClinic(null); setForm(defaultClinicForm()) }}
          footer={
            <>
              <button onClick={() => { setSlideOpen(false); setEditClinic(null); setForm(defaultClinicForm()) }} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name} style={{ ...btnPrimary, opacity: (saving || !form.name) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editClinic ? 'Save Changes' : 'Add Clinic'}
              </button>
            </>
          }
        >
          <Field label="Clinic Name" required>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Clinic name" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="NPI (10-digit)">
              <input style={inputStyle} value={form.npi} maxLength={10} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} placeholder="1234567890" />
            </Field>
            <Field label="Tax ID">
              <input style={inputStyle} value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="XX-XXXXXXX" />
            </Field>
          </div>
          <Field label="Address Line 1">
            <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px', gap: 10 }}>
            <Field label="City">
              <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label="State">
              <select style={inputStyle} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                <option value="">—</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ZIP">
              <input style={inputStyle} value={form.zip_code} maxLength={10} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone">
              <input style={inputStyle} value={form.phone} type="tel" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Fax">
              <input style={inputStyle} value={form.fax} type="tel" onChange={e => setForm(f => ({ ...f, fax: e.target.value }))} />
            </Field>
          </div>
          <Field label="Email">
            <input style={inputStyle} value={form.email} type="email" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Place of Service">
            <select style={inputStyle} value={form.place_of_service_code} onChange={e => setForm(f => ({ ...f, place_of_service_code: e.target.value }))}>
              {POS_CODES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Management Group">
            <select style={inputStyle} value={form.management_group_id} onChange={e => setForm(f => ({ ...f, management_group_id: e.target.value }))}>
              <option value="">— None —</option>
              {mgmtGroups.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Billing Company">
            <select style={inputStyle} value={form.billing_company_id} onChange={e => setForm(f => ({ ...f, billing_company_id: e.target.value }))}>
              <option value="">— None —</option>
              {billingCos.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input type="checkbox" id="clinic_is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: 'var(--bb-brand-blue)', width: 16, height: 16 }} />
            <label htmlFor="clinic_is_active" style={{ fontSize: 14, color: 'var(--bb-text-primary)' }}>Clinic is active</label>
          </div>
        </SlidePanel>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: BILLING COMPANIES
// ─────────────────────────────────────────────────────────────────────────────

type BillingCoFormState = {
  name: string
  management_group_id: string
  npi: string
  tax_id: string
  contact_email: string
  contact_phone: string
  address: string
  is_active: boolean
}

const defaultBillingCoForm = (): BillingCoFormState => ({
  name: '', management_group_id: '', npi: '', tax_id: '',
  contact_email: '', contact_phone: '', address: '', is_active: true,
})

type BillingUserFormState = {
  user_id: string
  billing_role: string
  clinic_ids: string[]
}

const defaultBillingUserForm = (): BillingUserFormState => ({
  user_id: '', billing_role: 'billing_admin', clinic_ids: [],
})

interface BillingUsersPanelProps {
  company: BillingCompany
  allClinics: Clinic[]
}

function BillingUsersPanel({ company, allClinics }: BillingUsersPanelProps) {
  const [users, setUsers] = useState<BillingUserAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPanel, setShowPanel] = useState(false)
  const [form, setForm] = useState<BillingUserFormState>(defaultBillingUserForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/org/billing-companies/${company.id}/users`)
      .then(r => setUsers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [company.id])

  const toggleClinic = (id: string) => {
    setForm(f => ({
      ...f,
      clinic_ids: f.clinic_ids.includes(id)
        ? f.clinic_ids.filter(c => c !== id)
        : [...f.clinic_ids, id],
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        billing_company_id: company.id,
        user_id: form.user_id,
        billing_role: form.billing_role,
        clinic_ids: form.clinic_ids.length > 0 ? form.clinic_ids : null,
      }
      const r = await api.post(`/org/billing-companies/${company.id}/users`, payload)
      setUsers(prev => [...prev, r.data])
      setShowPanel(false)
      setForm(defaultBillingUserForm())
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-secondary)' }}>
          Users — {company.name}
        </span>
        <button onClick={() => setShowPanel(true)} style={btnSmallPrimary}>+ Add User</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--bb-text-secondary)', fontSize: 13 }}>Loading…</div>
      ) : (
        <Table
          compact
          headers={['User', 'Billing Role', 'Clinic Access', 'Status']}
          rows={users.map(u => [
            <code style={{ fontSize: 11, color: 'var(--bb-text-secondary)' }}>{u.user_id.slice(0, 8)}…</code>,
            <RoleBadge role={u.billing_role} colorMap={billingRoleColors} />,
            u.clinic_ids ? `${u.clinic_ids.length} clinic(s)` : 'All clinics',
            <StatusBadge active={u.is_active} />,
          ])}
        />
      )}

      {showPanel && (
        <SlidePanel
          title={`Add User — ${company.name}`}
          onClose={() => { setShowPanel(false); setForm(defaultBillingUserForm()) }}
          footer={
            <>
              <button onClick={() => { setShowPanel(false); setForm(defaultBillingUserForm()) }} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving || !form.user_id} style={{ ...btnPrimary, opacity: (saving || !form.user_id) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Add User'}
              </button>
            </>
          }
        >
          <Field label="User ID" required>
            <input style={inputStyle} placeholder="Paste user UUID" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} />
          </Field>
          <Field label="Billing Role" required>
            <select style={inputStyle} value={form.billing_role} onChange={e => setForm(f => ({ ...f, billing_role: e.target.value }))}>
              {BILLING_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Clinic Access (blank = all clinics)">
            <div style={{ border: '1px solid var(--bb-border)', borderRadius: 8, padding: 10, maxHeight: 180, overflowY: 'auto', background: 'var(--bb-surface-app)' }}>
              {allClinics.length === 0 && <div style={{ color: 'var(--bb-text-secondary)', fontSize: 13 }}>No clinics available</div>}
              {allClinics.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.clinic_ids.includes(c.id)}
                    onChange={() => toggleClinic(c.id)}
                    style={{ accentColor: 'var(--bb-brand-blue)' }}
                  />
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                </label>
              ))}
            </div>
          </Field>
        </SlidePanel>
      )}
    </div>
  )
}

function BillingCompaniesTab() {
  const [companies, setCompanies] = useState<BillingCompany[]>([])
  const [mgmtGroups, setMgmtGroups] = useState<ManagementGroup[]>([])
  const [allClinics, setAllClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<BillingCompany | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<BillingCoFormState>(defaultBillingCoForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/org/billing-companies'),
      api.get('/org/management-groups'),
      api.get('/org/clinics'),
    ]).then(([b, m, c]) => {
      setCompanies(b.data)
      setMgmtGroups(m.data)
      setAllClinics(c.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditCompany(null)
    setForm(defaultBillingCoForm())
    setSlideOpen(true)
  }

  const openEdit = (company: BillingCompany) => {
    setEditCompany(company)
    setForm({
      name: company.name,
      management_group_id: company.management_group_id ?? '',
      npi: company.npi ?? '',
      tax_id: company.tax_id ?? '',
      contact_email: company.contact_email ?? '',
      contact_phone: company.contact_phone ?? '',
      address: company.address ?? '',
      is_active: company.is_active,
    })
    setSlideOpen(true)
  }

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      if (!payload.management_group_id) delete payload.management_group_id

      if (editCompany) {
        const r = await api.patch(`/org/billing-companies/${editCompany.id}`, payload)
        setCompanies(prev => prev.map(c => c.id === editCompany.id ? r.data : c))
      } else {
        const r = await api.post('/org/billing-companies', payload)
        setCompanies(prev => [...prev, r.data])
      }
      setSlideOpen(false)
      setEditCompany(null)
      setForm(defaultBillingCoForm())
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (company: BillingCompany) => {
    if (!confirm(`Deactivate ${company.name}?`)) return
    try {
      const r = await api.patch(`/org/billing-companies/${company.id}`, { is_active: false })
      setCompanies(prev => prev.map(c => c.id === company.id ? r.data : c))
    } catch { /* ignore */ }
  }

  const mgmtName = (id: string | null) => mgmtGroups.find(m => m.id === id)?.name ?? '—'
  const clinicCount = (id: string) => allClinics.filter(c => c.billing_company_id === id).length

  return (
    <>
      <SectionHeader title="Billing Companies" addLabel="+ Add Billing Company" onAdd={openAdd} />

      {loading ? (
        <div style={{ color: 'var(--bb-text-secondary)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
                {['Company Name', 'Mgmt Group', 'NPI', 'Clinics', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--bb-text-secondary)' }}>No billing companies found</td></tr>
              )}
              {companies.map(company => (
                <React.Fragment key={company.id}>
                  <tr
                    key={company.id}
                    style={{ borderBottom: expandedRows.has(company.id) ? 'none' : '1px solid var(--bb-border)', background: expandedRows.has(company.id) ? 'var(--bb-surface-app)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!expandedRows.has(company.id)) e.currentTarget.style.background = 'var(--bb-surface-app)' }}
                    onMouseLeave={e => { if (!expandedRows.has(company.id)) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{company.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12 }}>{mgmtName(company.management_group_id)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{company.npi ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12 }}>
                      <span style={{ background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{clinicCount(company.id)}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge active={company.is_active} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleExpand(company.id)} style={{ ...btnSmall, background: expandedRows.has(company.id) ? 'var(--bb-brand-blue)' : undefined, color: expandedRows.has(company.id) ? 'white' : undefined, border: expandedRows.has(company.id) ? 'none' : undefined }}>
                          {expandedRows.has(company.id) ? 'Hide Users' : 'View Users'}
                        </button>
                        <button onClick={() => openEdit(company)} style={btnSmall}>Edit</button>
                        {company.is_active && <button onClick={() => deactivate(company)} style={{ ...btnSmall, color: 'var(--bb-status-danger)', borderColor: 'var(--bb-status-danger)30' }}>Deactivate</button>}
                      </div>
                    </td>
                  </tr>
                  <tr key={`${company.id}-users`} style={{ borderBottom: expandedRows.has(company.id) ? '1px solid var(--bb-border)' : 'none' }}>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <ExpandPanel open={expandedRows.has(company.id)}>
                        <BillingUsersPanel company={company} allClinics={allClinics} />
                      </ExpandPanel>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {slideOpen && (
        <SlidePanel
          title={editCompany ? `Edit — ${editCompany.name}` : 'Add Billing Company'}
          onClose={() => { setSlideOpen(false); setEditCompany(null); setForm(defaultBillingCoForm()) }}
          footer={
            <>
              <button onClick={() => { setSlideOpen(false); setEditCompany(null); setForm(defaultBillingCoForm()) }} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name} style={{ ...btnPrimary, opacity: (saving || !form.name) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editCompany ? 'Save Changes' : 'Add Company'}
              </button>
            </>
          }
        >
          <Field label="Company Name" required>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Management Group">
            <select style={inputStyle} value={form.management_group_id} onChange={e => setForm(f => ({ ...f, management_group_id: e.target.value }))}>
              <option value="">— None —</option>
              {mgmtGroups.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="NPI"><input style={inputStyle} value={form.npi} maxLength={10} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} /></Field>
            <Field label="Tax ID"><input style={inputStyle} value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></Field>
          </div>
          <Field label="Contact Email"><input style={inputStyle} type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></Field>
          <Field label="Contact Phone"><input style={inputStyle} type="tel" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></Field>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="bc_is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: 'var(--bb-brand-blue)', width: 16, height: 16 }} />
            <label htmlFor="bc_is_active" style={{ fontSize: 14, color: 'var(--bb-text-primary)' }}>Company is active</label>
          </div>
        </SlidePanel>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: MANAGEMENT GROUPS
// ─────────────────────────────────────────────────────────────────────────────

type MgmtGroupFormState = {
  name: string
  contact_email: string
  contact_phone: string
  address: string
  is_active: boolean
}

const defaultMgmtGroupForm = (): MgmtGroupFormState => ({
  name: '', contact_email: '', contact_phone: '', address: '', is_active: true,
})

interface MgmtGroupDetailsPanelProps {
  group: ManagementGroup
  billingCos: BillingCompany[]
  clinics: Clinic[]
}

function MgmtGroupDetailsPanel({ group, billingCos, clinics }: MgmtGroupDetailsPanelProps) {
  const groupBillingCos = billingCos.filter(b => b.management_group_id === group.id)
  const groupClinics = clinics.filter(c => c.management_group_id === group.id)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Billing Companies */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Billing Companies ({groupBillingCos.length})
          </div>
          {groupBillingCos.length === 0 ? (
            <div style={{ color: 'var(--bb-text-secondary)', fontSize: 13 }}>None assigned</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groupBillingCos.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--bb-border)', borderRadius: 8, padding: '8px 12px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{b.name}</span>
                  <StatusBadge active={b.is_active} />
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Clinics */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Clinics ({groupClinics.length})
          </div>
          {groupClinics.length === 0 ? (
            <div style={{ color: 'var(--bb-text-secondary)', fontSize: 13 }}>None assigned</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {groupClinics.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--bb-border)', borderRadius: 8, padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    {c.city && <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)' }}>{c.city}, {c.state}</div>}
                  </div>
                  <StatusBadge active={c.is_active} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MgmtGroupsTab() {
  const [groups, setGroups] = useState<ManagementGroup[]>([])
  const [billingCos, setBillingCos] = useState<BillingCompany[]>([])
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [slideOpen, setSlideOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ManagementGroup | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<MgmtGroupFormState>(defaultMgmtGroupForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/org/management-groups'),
      api.get('/org/billing-companies'),
      api.get('/org/clinics'),
    ]).then(([g, b, c]) => {
      setGroups(g.data)
      setBillingCos(b.data)
      setClinics(c.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditGroup(null)
    setForm(defaultMgmtGroupForm())
    setSlideOpen(true)
  }

  const openEdit = (group: ManagementGroup) => {
    setEditGroup(group)
    setForm({
      name: group.name,
      contact_email: group.contact_email ?? '',
      contact_phone: group.contact_phone ?? '',
      address: group.address ?? '',
      is_active: group.is_active,
    })
    setSlideOpen(true)
  }

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form }

      if (editGroup) {
        const r = await api.patch(`/org/management-groups/${editGroup.id}`, payload)
        setGroups(prev => prev.map(g => g.id === editGroup.id ? r.data : g))
      } else {
        const r = await api.post('/org/management-groups', payload)
        setGroups(prev => [...prev, r.data])
      }
      setSlideOpen(false)
      setEditGroup(null)
      setForm(defaultMgmtGroupForm())
    } finally {
      setSaving(false)
    }
  }

  const groupBillingCount = (id: string) => billingCos.filter(b => b.management_group_id === id).length
  const groupClinicCount = (id: string) => clinics.filter(c => c.management_group_id === id).length

  return (
    <>
      <SectionHeader title="Management Groups" addLabel="+ Add Management Group" onAdd={openAdd} />

      {loading ? (
        <div style={{ color: 'var(--bb-text-secondary)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
                {['Group Name', 'Contact Email', 'Phone', 'Billing Cos', 'Clinics', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--bb-text-secondary)' }}>No management groups found</td></tr>
              )}
              {groups.map(group => (
                <React.Fragment key={group.id}>
                  <tr
                    key={group.id}
                    style={{ borderBottom: expandedRows.has(group.id) ? 'none' : '1px solid var(--bb-border)', background: expandedRows.has(group.id) ? 'var(--bb-surface-app)' : 'transparent', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!expandedRows.has(group.id)) e.currentTarget.style.background = 'var(--bb-surface-app)' }}
                    onMouseLeave={e => { if (!expandedRows.has(group.id)) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{group.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12 }}>{group.contact_email ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--bb-text-secondary)', fontSize: 12 }}>{group.contact_phone ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{groupBillingCount(group.id)}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{groupClinicCount(group.id)}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge active={group.is_active} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleExpand(group.id)} style={{ ...btnSmall, background: expandedRows.has(group.id) ? 'var(--bb-brand-blue)' : undefined, color: expandedRows.has(group.id) ? 'white' : undefined, border: expandedRows.has(group.id) ? 'none' : undefined }}>
                          {expandedRows.has(group.id) ? 'Hide Details' : 'View Details'}
                        </button>
                        <button onClick={() => openEdit(group)} style={btnSmall}>Edit</button>
                      </div>
                    </td>
                  </tr>
                  <tr key={`${group.id}-details`} style={{ borderBottom: expandedRows.has(group.id) ? '1px solid var(--bb-border)' : 'none' }}>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <ExpandPanel open={expandedRows.has(group.id)}>
                        <MgmtGroupDetailsPanel group={group} billingCos={billingCos} clinics={clinics} />
                      </ExpandPanel>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {slideOpen && (
        <SlidePanel
          title={editGroup ? `Edit — ${editGroup.name}` : 'Add Management Group'}
          onClose={() => { setSlideOpen(false); setEditGroup(null); setForm(defaultMgmtGroupForm()) }}
          footer={
            <>
              <button onClick={() => { setSlideOpen(false); setEditGroup(null); setForm(defaultMgmtGroupForm()) }} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving || !form.name} style={{ ...btnPrimary, opacity: (saving || !form.name) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editGroup ? 'Save Changes' : 'Add Group'}
              </button>
            </>
          }
        >
          <Field label="Group Name" required>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Group name" />
          </Field>
          <Field label="Contact Email">
            <input style={inputStyle} type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </Field>
          <Field label="Contact Phone">
            <input style={inputStyle} type="tel" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </Field>
          <Field label="Address">
            <input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="mg_is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: 'var(--bb-brand-blue)', width: 16, height: 16 }} />
            <label htmlFor="mg_is_active" style={{ fontSize: 14, color: 'var(--bb-text-primary)' }}>Group is active</label>
          </div>
        </SlidePanel>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'clinics', label: 'Clinics' },
  { id: 'billing', label: 'Billing Companies' },
  { id: 'mgmt', label: 'Management Groups' },
]

export function OrgManagementPage() {
  const [activeTab, setActiveTab] = useState('clinics')

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)' }}>
          Organization Management
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--bb-text-secondary)', fontSize: 13 }}>
          Manage the org hierarchy: Management Groups &rarr; Billing Companies &rarr; Clinics &rarr; Staff
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--bb-border)',
        marginBottom: 20,
        gap: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 12,
        border: '1px solid var(--bb-border)',
        padding: 20,
      }}>
        {activeTab === 'clinics' && <ClinicsTab />}
        {activeTab === 'billing' && <BillingCompaniesTab />}
        {activeTab === 'mgmt' && <MgmtGroupsTab />}
      </div>
    </div>
  )
}
