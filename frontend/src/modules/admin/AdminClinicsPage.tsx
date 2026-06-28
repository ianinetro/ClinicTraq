import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Plus, ChevronDown, ChevronRight, Users,
  MapPin, Phone, Edit2, Check, X as XIcon, Search,
} from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'

interface Clinic {
  id: string
  name: string
  npi: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  place_of_service_code: string
  is_active: boolean
}

interface StaffMember {
  id: string
  clinic_id: string
  user_id: string
  clinic_role: string
  is_primary: boolean
  is_active: boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', supervisor: 'Supervisor', doctor: 'Doctor',
  nurse: 'Nurse', medical_assistant: 'Med. Assistant',
  front_desk: 'Front Desk', biller: 'Biller', coder: 'Coder',
}

function authHeaders() {
  const token = localStorage.getItem('ct_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: authHeaders() })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

function useClinics() {
  return useQuery<Clinic[]>({ queryKey: ['admin-clinics'], queryFn: () => apiFetch('/api/v1/org/clinics') })
}
function useClinicStaff(id: string | null) {
  return useQuery<StaffMember[]>({
    queryKey: ['clinic-staff', id],
    queryFn: () => apiFetch(`/api/v1/org/clinics/${id}/staff`),
    enabled: !!id,
  })
}

// ── Add Clinic Modal ──────────────────────────────────────────────────────────
function AddClinicModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', npi: '', address: '', city: '', state: '', zip_code: '', phone: '', place_of_service_code: '11' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!form.name.trim()) { setErr('Clinic name is required'); return }
    setSaving(true)
    try {
      await apiPost('/api/v1/org/clinics', form)
      await qc.invalidateQueries({ queryKey: ['admin-clinics'] })
      onClose()
    } catch { setErr('Failed to create clinic.') }
    finally { setSaving(false) }
  }

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string; max?: number; col?: string }) => (
    <div style={{ gridColumn: opts?.col }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#676687', display: 'block', marginBottom: 4 }}>{label}</label>
      <input
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        maxLength={opts?.max}
        placeholder={opts?.placeholder}
        style={{ width: '100%', height: 36, border: '1px solid #BABACE', borderRadius: 8, padding: '0 10px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(18,18,44,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 12, width: 520, boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#12122C' }}>Add New Clinic</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#676687' }}><XIcon size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {err && <div style={{ gridColumn: '1/-1', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#DC2626' }}>{err}</div>}
          {field('Clinic Name *', 'name', { col: '1/-1', placeholder: 'Main Street Family Clinic' })}
          {field('NPI', 'npi', { placeholder: '10-digit NPI', max: 10 })}
          {field('Phone', 'phone', { placeholder: '(555) 000-0000' })}
          {field('Address', 'address', { col: '1/-1', placeholder: 'Street address' })}
          {field('City', 'city')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {field('State', 'state', { placeholder: 'TX', max: 2 })}
            {field('ZIP', 'zip_code', { placeholder: '78701' })}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#676687', display: 'block', marginBottom: 4 }}>Place of Service</label>
            <select value={form.place_of_service_code} onChange={e => setForm(f => ({ ...f, place_of_service_code: e.target.value }))}
              style={{ width: '100%', height: 36, border: '1px solid #BABACE', borderRadius: 8, padding: '0 10px', fontSize: 14, background: 'white', outline: 'none', boxSizing: 'border-box' }}>
              <option value="11">11 — Office</option>
              <option value="21">21 — Inpatient Hospital</option>
              <option value="22">22 — Outpatient Hospital</option>
              <option value="23">23 — Emergency Room</option>
              <option value="12">12 — Home</option>
              <option value="31">31 — Skilled Nursing Facility</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '14px 24px 20px', borderTop: '1px solid #E3E3F1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Creating…' : 'Create Clinic'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Clinic Card ───────────────────────────────────────────────────────────────
function ClinicCard({ clinic }: { clinic: Clinic }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: clinic.name, phone: clinic.phone ?? '', address: clinic.address ?? '', city: clinic.city ?? '', state: clinic.state ?? '' })
  const qc = useQueryClient()
  const { data: staff, isLoading: staffLoading } = useClinicStaff(expanded ? clinic.id : null)

  async function saveEdit() {
    await apiPatch(`/api/v1/org/clinics/${clinic.id}`, { ...form, place_of_service_code: clinic.place_of_service_code })
    await qc.invalidateQueries({ queryKey: ['admin-clinics'] })
    setEditing(false)
  }

  const grouped = (staff ?? []).reduce<Record<string, StaffMember[]>>((a, s) => {
    a[s.clinic_role] = [...(a[s.clinic_role] ?? []), s]
    return a
  }, {})
  const activeCount = (staff ?? []).filter(s => s.is_active).length

  return (
    <div style={{ border: '1px solid #E3E3F1', borderRadius: 10, background: 'white', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: clinic.is_active ? '#EFF0FF' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Building2 size={18} style={{ color: clinic.is_active ? '#0410BD' : '#9CA3AF' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing
            ? <input value={form.name} onClick={e => e.stopPropagation()} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                style={{ fontSize: 15, fontWeight: 600, color: '#12122C', border: '1px solid #3F4CFF', borderRadius: 6, padding: '2px 8px', outline: 'none' }} />
            : <div style={{ fontSize: 15, fontWeight: 600, color: '#12122C' }}>{clinic.name}</div>
          }
          <div style={{ fontSize: 12, color: '#676687', display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
            {clinic.npi && <span style={{ fontFamily: 'monospace' }}>NPI: {clinic.npi}</span>}
            {(clinic.city || clinic.state) && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} />{[clinic.city, clinic.state].filter(Boolean).join(', ')}</span>}
            {clinic.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} />{clinic.phone}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: clinic.is_active ? '#ECFDF5' : '#F3F4F6', color: clinic.is_active ? '#166534' : '#6B7280' }}>
            {clinic.is_active ? 'Active' : 'Inactive'}
          </span>
          {staff && <span style={{ fontSize: 12, color: '#676687', display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} />{activeCount}</span>}
          {editing ? (
            <>
              <button onClick={e => { e.stopPropagation(); void saveEdit() }} style={{ background: '#0410BD', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} /> Save
              </button>
              <button onClick={e => { e.stopPropagation(); setEditing(false) }} style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: '4px 10px', color: '#374151', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); setEditing(true) }} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#676687', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
              <Edit2 size={14} />
            </button>
          )}
          {expanded ? <ChevronDown size={16} style={{ color: '#9CA3AF' }} /> : <ChevronRight size={16} style={{ color: '#9CA3AF' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #E3E3F1', padding: 16, background: '#FAFAFA' }}>
          {staffLoading ? (
            <div style={{ fontSize: 13, color: '#676687' }}>Loading staff…</div>
          ) : (staff ?? []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 13 }}>
              <Users size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
              No staff assigned yet.
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                Staff — {activeCount} active
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {Object.entries(grouped).map(([role, members]) => (
                  <div key={role}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', marginBottom: 4 }}>
                      {ROLE_LABELS[role] ?? role} <span style={{ color: '#9CA3AF' }}>({members.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {members.map(m => (
                        <div key={m.id} style={{
                          fontSize: 12, padding: '3px 10px', borderRadius: 99,
                          background: m.is_active ? '#F3F4F6' : '#FEF2F2',
                          color: m.is_active ? '#374151' : '#9CA3AF',
                          border: '1px solid #E5E7EB',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.is_active ? '#16A34A' : '#D1D5DB', flexShrink: 0, display: 'inline-block' }} />
                          {m.user_id.slice(0, 8)}…
                          {m.is_primary && <span style={{ fontSize: 10, background: '#EFF0FF', color: '#0410BD', padding: '1px 5px', borderRadius: 4 }}>Primary</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function AdminClinicsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const { data: clinics, isLoading, error } = useClinics()

  const filtered = (clinics ?? []).filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.npi ?? '').includes(search)
  )
  const active = filtered.filter(c => c.is_active)
  const inactive = filtered.filter(c => !c.is_active)

  return (
    <div className="p-6 space-y-5" style={{ maxWidth: 900 }}>
      <PageHeader
        title="All Clinics"
        description={`${clinics?.length ?? 0} clinic${(clinics?.length ?? 0) === 1 ? '' : 's'} under BillerBay management`}
        primaryAction={{ label: 'Add Clinic', icon: <Plus size={15} />, onClick: () => setShowAdd(true) }}
      />

      {clinics && clinics.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Clinics', value: clinics.length, color: '#0410BD' },
            { label: 'Active', value: clinics.filter(c => c.is_active).length, color: '#16A34A' },
            { label: 'Inactive', value: clinics.filter(c => !c.is_active).length, color: '#9CA3AF' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#676687', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'relative', maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clinics…"
          style={{ width: '100%', height: 36, border: '1px solid #BABACE', borderRadius: 8, paddingLeft: 32, paddingRight: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: '#676687' }}>
          <Building2 size={32} style={{ margin: '0 auto 10px', color: '#BABACE', display: 'block' }} />
          Loading clinics…
        </div>
      )}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 16, color: '#DC2626', fontSize: 14 }}>
          Failed to load clinics. You may need the billing_admin or mgmt_admin role.
        </div>
      )}
      {!isLoading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Building2 size={40} style={{ margin: '0 auto 12px', color: '#BABACE', display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#12122C' }}>{search ? 'No clinics match your search' : 'No clinics yet'}</div>
          {!search && <div style={{ fontSize: 13, color: '#676687', marginTop: 4 }}>Add your first clinic to get started.</div>}
        </div>
      )}

      {active.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{active.map(c => <ClinicCard key={c.id} clinic={c} />)}</div>}

      {inactive.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Inactive</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{inactive.map(c => <ClinicCard key={c.id} clinic={c} />)}</div>
        </div>
      )}

      {showAdd && <AddClinicModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
