import { useState, useEffect } from 'react'
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

function RoleBadge({ role, colorMap }: { role: string; colorMap: Record<string, string> }) {
  const color = colorMap[role] ?? 'var(--bb-text-secondary)'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: color + '1A',
      color: color,
      border: `1px solid ${color}40`,
    }}>
      {role.replace(/_/g, ' ')}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(18,18,44,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 12,
        width: 480,
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--bb-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', fontSize: 20, lineHeight: 1 }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Form field helper ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
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
}

// ── Table ─────────────────────────────────────────────────────────────────────

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--bb-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--bb-border)', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '12px 14px', color: 'var(--bb-text-primary)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--bb-text-secondary)' }}>
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Management Groups ────────────────────────────────────────────────────

function MgmtGroupsTab() {
  const [items, setItems] = useState<ManagementGroup[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', contact_email: '', contact_phone: '', address: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/v1/org/management-groups').then(r => setItems(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.post('/api/v1/org/management-groups', form)
      setItems(prev => [...prev, r.data])
      setShowModal(false)
      setForm({ name: '', contact_email: '', contact_phone: '', address: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Add Management Group</button>
      </div>
      <Table
        headers={['Name', 'Contact Email', 'Phone', 'Status']}
        rows={items.map(i => [
          <strong>{i.name}</strong>,
          i.contact_email ?? '—',
          i.contact_phone ?? '—',
          <StatusBadge active={i.is_active} />,
        ])}
      />
      {showModal && (
        <Modal title="New Management Group" onClose={() => setShowModal(false)}>
          <Field label="Name *"><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Contact Email"><input style={inputStyle} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></Field>
          <Field label="Phone"><input style={inputStyle} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></Field>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !form.name} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Billing Companies ────────────────────────────────────────────────────

function BillingCompaniesTab() {
  const [items, setItems] = useState<BillingCompany[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', npi: '', tax_id: '', contact_email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/v1/org/billing-companies').then(r => setItems(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.post('/api/v1/org/billing-companies', form)
      setItems(prev => [...prev, r.data])
      setShowModal(false)
      setForm({ name: '', npi: '', tax_id: '', contact_email: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Add Billing Company</button>
      </div>
      <Table
        headers={['Name', 'NPI', 'Tax ID', 'Contact Email', 'Status']}
        rows={items.map(i => [
          <strong>{i.name}</strong>,
          i.npi ?? '—',
          i.tax_id ?? '—',
          i.contact_email ?? '—',
          <StatusBadge active={i.is_active} />,
        ])}
      />
      {showModal && (
        <Modal title="New Billing Company" onClose={() => setShowModal(false)}>
          <Field label="Name *"><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="NPI"><input style={inputStyle} value={form.npi} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} /></Field>
          <Field label="Tax ID"><input style={inputStyle} value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} /></Field>
          <Field label="Contact Email"><input style={inputStyle} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !form.name} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Clinics ──────────────────────────────────────────────────────────────

function ClinicsTab() {
  const [items, setItems] = useState<Clinic[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', npi: '', address: '', city: '', state: '', zip_code: '', phone: '', place_of_service_code: '11' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/v1/org/clinics').then(r => setItems(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await api.post('/api/v1/org/clinics', form)
      setItems(prev => [...prev, r.data])
      setShowModal(false)
      setForm({ name: '', npi: '', address: '', city: '', state: '', zip_code: '', phone: '', place_of_service_code: '11' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Add Clinic</button>
      </div>
      <Table
        headers={['Name', 'NPI', 'City', 'State', 'Phone', 'POS', 'Status']}
        rows={items.map(i => [
          <strong>{i.name}</strong>,
          i.npi ?? '—',
          i.city ?? '—',
          i.state ?? '—',
          i.phone ?? '—',
          i.place_of_service_code,
          <StatusBadge active={i.is_active} />,
        ])}
      />
      {showModal && (
        <Modal title="New Clinic" onClose={() => setShowModal(false)}>
          <Field label="Name *"><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="NPI"><input style={inputStyle} value={form.npi} onChange={e => setForm(f => ({ ...f, npi: e.target.value }))} /></Field>
          <Field label="Address"><input style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 12 }}>
            <Field label="City"><input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></Field>
            <Field label="State"><input style={inputStyle} value={form.state} maxLength={2} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></Field>
            <Field label="ZIP"><input style={inputStyle} value={form.zip_code} onChange={e => setForm(f => ({ ...f, zip_code: e.target.value }))} /></Field>
          </div>
          <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !form.name} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Staff Assignments ────────────────────────────────────────────────────

const CLINIC_ROLES = ['front_desk', 'medical_assistant', 'nurse', 'scribe', 'doctor', 'billing', 'supervisor', 'admin']

function StaffAssignmentsTab() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [staff, setStaff] = useState<StaffAssignment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ user_id: '', clinic_role: 'front_desk', is_primary: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/v1/org/clinics').then(r => setClinics(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedClinic) return
    api.get(`/api/v1/org/clinics/${selectedClinic}/staff`).then(r => setStaff(r.data)).catch(() => {})
  }, [selectedClinic])

  const save = async () => {
    if (!selectedClinic) return
    setSaving(true)
    try {
      const r = await api.post(`/api/v1/org/clinics/${selectedClinic}/staff`, { ...form, clinic_id: selectedClinic })
      setStaff(prev => [...prev, r.data])
      setShowModal(false)
      setForm({ user_id: '', clinic_role: 'front_desk', is_primary: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <select
          value={selectedClinic}
          onChange={e => setSelectedClinic(e.target.value)}
          style={{ ...inputStyle, width: 280 }}
        >
          <option value="">— Select a clinic —</option>
          {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedClinic && (
          <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Assign Staff</button>
        )}
      </div>
      {selectedClinic && (
        <Table
          headers={['User ID', 'Role', 'Primary', 'Status']}
          rows={staff.map(s => [
            <code style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{s.user_id.slice(0, 8)}…</code>,
            <RoleBadge role={s.clinic_role} colorMap={clinicRoleColors} />,
            s.is_primary ? <span style={{ color: 'var(--bb-status-success)', fontWeight: 600 }}>Yes</span> : '—',
            <StatusBadge active={s.is_active} />,
          ])}
        />
      )}
      {showModal && (
        <Modal title="Assign Staff" onClose={() => setShowModal(false)}>
          <Field label="User ID *"><input style={inputStyle} value={form.user_id} placeholder="UUID of the user" onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} /></Field>
          <Field label="Role *">
            <select style={inputStyle} value={form.clinic_role} onChange={e => setForm(f => ({ ...f, clinic_role: e.target.value }))}>
              {CLINIC_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !form.user_id} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Tab: Billing Users ────────────────────────────────────────────────────────

const BILLING_ROLES = ['billing_admin', 'billing_manager', 'coder', 'charge_entry', 'claim_submit', 'payment_poster', 'denial_specialist', 'ar_specialist', 'patient_billing']

function BillingUsersTab() {
  const [companies, setCompanies] = useState<BillingCompany[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [users, setUsers] = useState<BillingUserAssignment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ user_id: '', billing_role: 'billing_admin' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/v1/org/billing-companies').then(r => setCompanies(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCompany) return
    api.get(`/api/v1/org/billing-companies/${selectedCompany}/users`).then(r => setUsers(r.data)).catch(() => {})
  }, [selectedCompany])

  const save = async () => {
    if (!selectedCompany) return
    setSaving(true)
    try {
      const r = await api.post(`/api/v1/org/billing-companies/${selectedCompany}/users`, { ...form, billing_company_id: selectedCompany })
      setUsers(prev => [...prev, r.data])
      setShowModal(false)
      setForm({ user_id: '', billing_role: 'billing_admin' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          style={{ ...inputStyle, width: 280 }}
        >
          <option value="">— Select a billing company —</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedCompany && (
          <button onClick={() => setShowModal(true)} style={btnPrimary}>+ Assign User</button>
        )}
      </div>
      {selectedCompany && (
        <Table
          headers={['User ID', 'Role', 'Clinic Access', 'Status']}
          rows={users.map(u => [
            <code style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{u.user_id.slice(0, 8)}…</code>,
            <RoleBadge role={u.billing_role} colorMap={billingRoleColors} />,
            u.clinic_ids ? `${u.clinic_ids.length} clinic(s)` : 'All clinics',
            <StatusBadge active={u.is_active} />,
          ])}
        />
      )}
      {showModal && (
        <Modal title="Assign Billing User" onClose={() => setShowModal(false)}>
          <Field label="User ID *"><input style={inputStyle} value={form.user_id} placeholder="UUID of the user" onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} /></Field>
          <Field label="Billing Role *">
            <select style={inputStyle} value={form.billing_role} onChange={e => setForm(f => ({ ...f, billing_role: e.target.value }))}>
              {BILLING_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !form.user_id} style={btnPrimary}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--bb-brand-blue)',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--bb-surface-app)',
  color: 'var(--bb-text-primary)',
  border: '1px solid var(--bb-border)',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: active ? 'var(--bb-status-success)1A' : 'var(--bb-status-danger)1A',
      color: active ? 'var(--bb-status-success)' : 'var(--bb-status-danger)',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'mgmt', label: 'Management Groups' },
  { id: 'billing', label: 'Billing Companies' },
  { id: 'clinics', label: 'Clinics' },
  { id: 'staff', label: 'Staff Assignments' },
  { id: 'billingusers', label: 'Billing Users' },
]

export function OrgManagementPage() {
  const [activeTab, setActiveTab] = useState('mgmt')

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--bb-text-primary)' }}>
          Organization Management
        </h1>
        <p style={{ margin: '4px 0 0', color: 'var(--bb-text-secondary)', fontSize: 14 }}>
          Manage the hierarchy: Management Groups → Billing Companies → Clinics → Staff
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2,
        borderBottom: '1px solid var(--bb-border)',
        marginBottom: 24,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
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

      {/* Tab content card */}
      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 12,
        border: '1px solid var(--bb-border)',
        padding: 24,
      }}>
        {activeTab === 'mgmt' && <MgmtGroupsTab />}
        {activeTab === 'billing' && <BillingCompaniesTab />}
        {activeTab === 'clinics' && <ClinicsTab />}
        {activeTab === 'staff' && <StaffAssignmentsTab />}
        {activeTab === 'billingusers' && <BillingUsersTab />}
      </div>
    </div>
  )
}
