import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Edit2,
  UserX,
  UserCheck,
  KeyRound,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Drawer } from '../../components/ui/Drawer'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { apiClient } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRecord {
  id: string
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_superuser: boolean
  last_login: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
  // enriched client-side
  displayRole?: string
  orgLabel?: string
}

interface OrgItem {
  id: string
  name: string
}

type StaffScope = 'clinic' | 'billing' | 'management'

const CLINIC_ROLES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'medical_assistant', label: 'Medical Assistant' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'scribe', label: 'Scribe' },
  { value: 'billing', label: 'Billing' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'admin', label: 'Admin' },
]

const BILLING_ROLES = [
  { value: 'charge_entry', label: 'Charge Entry' },
  { value: 'coder', label: 'Coder' },
  { value: 'claim_submit', label: 'Claim Submit' },
  { value: 'payment_poster', label: 'Payment Poster' },
  { value: 'denial_specialist', label: 'Denial Specialist' },
  { value: 'ar_specialist', label: 'AR Specialist' },
  { value: 'patient_billing', label: 'Patient Billing' },
  { value: 'billing_manager', label: 'Billing Manager' },
  { value: 'billing_admin', label: 'Billing Admin' },
]

const MGMT_ROLES = [
  { value: 'mgmt_viewer', label: 'Mgmt Viewer' },
  { value: 'mgmt_admin', label: 'Mgmt Admin' },
]

// ── Role badge colors ─────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  doctor:            { bg: '#EDE9FE', text: '#6D28D9' },
  nurse:             { bg: '#CCFBF1', text: '#0F766E' },
  medical_assistant: { bg: '#CCFBF1', text: '#0F766E' },
  front_desk:        { bg: '#FEF3C7', text: '#B45309' },
  scribe:            { bg: '#FEF3C7', text: '#B45309' },
  billing:           { bg: '#DBEAFE', text: '#1D4ED8' },
  supervisor:        { bg: '#FCE7F3', text: '#BE185D' },
  admin:             { bg: '#FEE2E2', text: '#B91C1C' },
  billing_admin:     { bg: '#DBEAFE', text: '#1D4ED8' },
  billing_manager:   { bg: '#DBEAFE', text: '#1D4ED8' },
  charge_entry:      { bg: '#DBEAFE', text: '#1D4ED8' },
  coder:             { bg: '#DBEAFE', text: '#1D4ED8' },
  claim_submit:      { bg: '#DBEAFE', text: '#1D4ED8' },
  payment_poster:    { bg: '#DBEAFE', text: '#1D4ED8' },
  denial_specialist: { bg: '#DBEAFE', text: '#1D4ED8' },
  ar_specialist:     { bg: '#DBEAFE', text: '#1D4ED8' },
  patient_billing:   { bg: '#DBEAFE', text: '#1D4ED8' },
  mgmt_admin:        { bg: '#FEE2E2', text: '#B91C1C' },
  mgmt_viewer:       { bg: '#F3F4F6', text: '#374151' },
  superuser:         { bg: '#FEE2E2', text: '#B91C1C' },
}

function getRoleColors(role?: string) {
  if (!role) return { bg: '#F3F4F6', text: '#6B7280' }
  return ROLE_COLORS[role] ?? { bg: '#EFF0FF', text: '#4338CA' }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, role }: { firstName: string; lastName: string; role?: string }) {
  const colors = getRoleColors(role)
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  return (
    <div
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: colors.bg, color: colors.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '0.03em',
      }}
    >
      {initials}
    </div>
  )
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span style={{ color: 'var(--bb-text-secondary)', fontSize: 12 }}>—</span>
  const colors = getRoleColors(role)
  const label = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: colors.bg, color: colors.text,
      fontSize: 11, fontWeight: 600, borderRadius: 4,
      padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: active ? 'var(--bb-status-success-bg)' : '#F3F4F6',
      color: active ? 'var(--bb-status-success)' : '#6B7280',
      fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: active ? 'var(--bb-status-success)' : '#9CA3AF',
        flexShrink: 0,
      }} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastLogin(dt: string | null): string {
  if (!dt) return 'Never'
  const d = new Date(dt)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const specials = '!@#$'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  pwd += specials[Math.floor(Math.random() * specials.length)]
  pwd += Math.floor(Math.random() * 9) + 1
  return pwd
}

// ── Form state ────────────────────────────────────────────────────────────────

interface InviteFormState {
  firstName: string
  lastName: string
  email: string
  tempPassword: string
  scope: StaffScope
  // Clinic staff
  clinicId: string
  clinicRole: string
  isPrimary: boolean
  // Billing staff
  billingCompanyId: string
  billingRole: string
  clinicAccess: 'all' | 'specific'
  specificClinicIds: string[]
  // Mgmt staff
  managementGroupId: string
  mgmtRole: string
}

const EMPTY_FORM: InviteFormState = {
  firstName: '', lastName: '', email: '', tempPassword: '',
  scope: 'clinic',
  clinicId: '', clinicRole: '',
  isPrimary: true,
  billingCompanyId: '', billingRole: '',
  clinicAccess: 'all', specificClinicIds: [],
  managementGroupId: '', mgmtRole: '',
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function UsersSettings() {
  const { addToast } = useToast()
  const currentUser = useAuthStore(s => s.user)

  // Data
  const [users, setUsers] = useState<UserRecord[]>([])
  const [clinics, setClinics] = useState<OrgItem[]>([])
  const [billingCompanies, setBillingCompanies] = useState<OrgItem[]>([])
  const [managementGroups, setManagementGroups] = useState<OrgItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  // Panel & modal state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [form, setForm] = useState<InviteFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Activate confirm
  const [activateTarget, setActivateTarget] = useState<UserRecord | null>(null)
  const [activating, setActivating] = useState(false)

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/users')
      setUsers(res.data)
    } catch {
      addToast({ variant: 'error', message: 'Failed to load users.' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const fetchOrgData = useCallback(async () => {
    try {
      const [c, bc, mg] = await Promise.allSettled([
        apiClient.get('/org/clinics'),
        apiClient.get('/org/billing-companies'),
        apiClient.get('/org/management-groups'),
      ])
      if (c.status === 'fulfilled') setClinics(c.value.data ?? [])
      if (bc.status === 'fulfilled') setBillingCompanies(bc.value.data ?? [])
      if (mg.status === 'fulfilled') setManagementGroups(mg.value.data ?? [])
    } catch {
      // org endpoints may not be set up yet — silent fail
    }
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchOrgData()
  }, [fetchUsers, fetchOrgData])

  // ── Derived filtered list ──────────────────────────────────────────────────

  const filtered = users.filter(u => {
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase()
    const searchLower = search.toLowerCase()
    if (search && !fullName.includes(searchLower) && !u.email.toLowerCase().includes(searchLower)) return false
    if (filterStatus === 'active' && !u.is_active) return false
    if (filterStatus === 'inactive' && u.is_active) return false
    if (filterRole && (u.displayRole ?? '') !== filterRole) return false
    return true
  })

  // ── Panel helpers ──────────────────────────────────────────────────────────

  function openInvite() {
    setEditingUser(null)
    setForm({ ...EMPTY_FORM, tempPassword: generatePassword() })
    setDrawerOpen(true)
  }

  function openEdit(user: UserRecord) {
    setEditingUser(user)
    setForm({
      ...EMPTY_FORM,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      tempPassword: '',
    })
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditingUser(null)
    setForm(EMPTY_FORM)
  }

  function patchForm<K extends keyof InviteFormState>(key: K, value: InviteFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      addToast({ variant: 'error', message: 'First name, last name, and email are required.' })
      return
    }
    if (!editingUser && !form.tempPassword.trim()) {
      addToast({ variant: 'error', message: 'Temporary password is required.' })
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        // Edit existing user
        await apiClient.patch(`/users/${editingUser.id}`, {
          first_name: form.firstName,
          last_name: form.lastName,
        })

        // Update org assignment based on scope
        await postOrgAssignment(editingUser.id)

        addToast({ variant: 'success', message: `${form.firstName} ${form.lastName} updated.` })
      } else {
        // Create user
        const res = await apiClient.post('/users', {
          email: form.email,
          password: form.tempPassword,
          first_name: form.firstName,
          last_name: form.lastName,
        })
        const newUserId: string = res.data.id

        // Post org assignment
        await postOrgAssignment(newUserId)

        addToast({ variant: 'success', message: `${form.firstName} ${form.lastName} invited successfully.` })
      }

      await fetchUsers()
      closeDrawer()
    } catch (err: unknown) {
      const msg = extractApiError(err) ?? 'Failed to save user.'
      addToast({ variant: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  async function postOrgAssignment(userId: string) {
    if (form.scope === 'clinic' && form.clinicId && form.clinicRole) {
      await apiClient.post(`/org/clinics/${form.clinicId}/staff`, {
        user_id: userId,
        clinic_role: form.clinicRole,
        is_primary: form.isPrimary,
      })
    } else if (form.scope === 'billing' && form.billingCompanyId && form.billingRole) {
      await apiClient.post(`/org/billing-companies/${form.billingCompanyId}/users`, {
        user_id: userId,
        billing_role: form.billingRole,
        clinic_ids: form.clinicAccess === 'specific' ? form.specificClinicIds : null,
      })
    } else if (form.scope === 'management' && form.managementGroupId && form.mgmtRole) {
      await apiClient.post(`/org/management-groups/${form.managementGroupId}/users`, {
        user_id: userId,
        mgmt_role: form.mgmtRole,
      })
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await apiClient.post(`/users/${deactivateTarget.id}/disable`)
      addToast({ variant: 'success', message: `${deactivateTarget.first_name} ${deactivateTarget.last_name} deactivated.` })
      setUsers(prev => prev.map(u => u.id === deactivateTarget.id ? { ...u, is_active: false } : u))
      setDeactivateTarget(null)
    } catch {
      addToast({ variant: 'error', message: 'Failed to deactivate user.' })
    } finally {
      setDeactivating(false)
    }
  }

  // ── Activate ───────────────────────────────────────────────────────────────

  async function handleActivate() {
    if (!activateTarget) return
    setActivating(true)
    try {
      await apiClient.patch(`/users/${activateTarget.id}`, { is_active: true })
      addToast({ variant: 'success', message: `${activateTarget.first_name} ${activateTarget.last_name} reactivated.` })
      setUsers(prev => prev.map(u => u.id === activateTarget.id ? { ...u, is_active: true } : u))
      setActivateTarget(null)
    } catch {
      addToast({ variant: 'error', message: 'Failed to activate user.' })
    } finally {
      setActivating(false)
    }
  }

  // ── Reset Password ─────────────────────────────────────────────────────────

  async function handleResetPassword() {
    if (!resetTarget) return
    if (newPassword.length < 8) {
      addToast({ variant: 'error', message: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      addToast({ variant: 'error', message: 'Passwords do not match.' })
      return
    }
    setResetting(true)
    try {
      await apiClient.post(`/users/${resetTarget.id}/reset-password`, { new_password: newPassword })
      addToast({ variant: 'success', message: `Password reset for ${resetTarget.first_name} ${resetTarget.last_name}.` })
      setResetTarget(null)
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      addToast({ variant: 'error', message: 'Failed to reset password.' })
    } finally {
      setResetting(false)
    }
  }

  // ── All unique roles for filter dropdown ───────────────────────────────────

  const uniqueRoles = Array.from(new Set(users.map(u => u.displayRole).filter(Boolean))) as string[]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[--bb-text-primary]">Users &amp; Roles</h2>
          <p className="text-sm text-[--bb-text-secondary] mt-1">
            Manage user accounts, role assignments, and access levels across your organization.
          </p>
        </div>
        <Button size="sm" variant="primary" leftIcon={<Plus size={14} />} onClick={openInvite}>
          Invite User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full h-8 pl-8 pr-3 text-sm border border-[--bb-border] rounded-md bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary] focus:outline-none focus:border-[--bb-brand-blue] focus:ring-1 focus:ring-[--bb-brand-blue]"
          />
        </div>

        <div className="relative">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="h-8 pl-3 pr-7 text-sm border border-[--bb-border] rounded-md bg-white text-[--bb-text-primary] focus:outline-none focus:border-[--bb-brand-blue] appearance-none cursor-pointer"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="h-8 pl-3 pr-7 text-sm border border-[--bb-border] rounded-md bg-white text-[--bb-text-primary] focus:outline-none focus:border-[--bb-brand-blue] appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none" />
        </div>

        <span className="text-xs text-[--bb-text-secondary] ml-auto">
          {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-[--bb-text-secondary]">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[--bb-text-secondary]">
              {users.length === 0 ? 'No users found. Invite your first team member.' : 'No users match your filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#F2F2F8]">
              <tr>
                {['User', 'Email', 'Role', 'Org Assignment', 'Last Login', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E3F1]">
              {filtered.map(user => {
                const isCurrentUser = user.email === currentUser?.email
                return (
                  <tr key={user.id} className="hover:bg-[#F9F9FC] transition-colors">
                    {/* Avatar + Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={user.first_name} lastName={user.last_name} role={user.displayRole} />
                        <div>
                          <p className="text-sm font-medium text-[--bb-text-primary] leading-tight">
                            {user.first_name} {user.last_name}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-[10px] text-[--bb-brand-blue] font-semibold">(you)</span>
                            )}
                          </p>
                          {user.phone && (
                            <p className="text-[11px] text-[--bb-text-secondary]">{user.phone}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-[--bb-text-secondary] max-w-[200px] truncate">
                      {user.email}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {user.is_superuser ? (
                        <RoleBadge role="superuser" />
                      ) : (
                        <RoleBadge role={user.displayRole} />
                      )}
                    </td>

                    {/* Org Assignment */}
                    <td className="px-4 py-3 text-sm text-[--bb-text-secondary] max-w-[160px] truncate">
                      {user.orgLabel ?? '—'}
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-sm text-[--bb-text-secondary] tabular-nums whitespace-nowrap">
                      {formatLastLogin(user.last_login)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge active={user.is_active} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="secondary"
                          leftIcon={<Edit2 size={11} />}
                          onClick={() => openEdit(user)}
                          title="Edit user"
                        >
                          Edit
                        </Button>

                        <Button
                          size="xs"
                          variant="secondary"
                          leftIcon={<KeyRound size={11} />}
                          onClick={() => { setResetTarget(user); setNewPassword(''); setConfirmPassword('') }}
                          title="Reset password"
                        >
                          Reset PW
                        </Button>

                        {user.is_active ? (
                          <Button
                            size="xs"
                            variant="secondary"
                            leftIcon={<UserX size={11} />}
                            onClick={() => setDeactivateTarget(user)}
                            disabled={isCurrentUser}
                            title={isCurrentUser ? 'Cannot deactivate yourself' : 'Deactivate user'}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="secondary"
                            leftIcon={<UserCheck size={11} />}
                            onClick={() => setActivateTarget(user)}
                            title="Activate user"
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Invite / Edit Drawer ─────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editingUser ? `Edit User — ${editingUser.first_name} ${editingUser.last_name}` : 'Invite User'}
        width={480}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={closeDrawer}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
              {editingUser ? 'Save Changes' : 'Send Invite'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Section 1 — Identity */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[--bb-text-secondary] mb-3">
              Identity
            </h4>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="First Name" required>
                  <input
                    value={form.firstName}
                    onChange={e => patchForm('firstName', e.target.value)}
                    placeholder="Jane"
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Last Name" required>
                  <input
                    value={form.lastName}
                    onChange={e => patchForm('lastName', e.target.value)}
                    placeholder="Smith"
                    className={inputCls}
                  />
                </FormField>
              </div>

              <FormField label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => patchForm('email', e.target.value)}
                  placeholder="jane.smith@clinic.com"
                  disabled={editingUser?.email === currentUser?.email}
                  className={inputCls}
                />
                {editingUser?.email === currentUser?.email && (
                  <p className="text-[11px] text-[--bb-text-secondary] mt-1">
                    Cannot change email for the currently logged-in account.
                  </p>
                )}
              </FormField>

              {!editingUser && (
                <FormField label="Temporary Password" required>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.tempPassword}
                      onChange={e => patchForm('tempPassword', e.target.value)}
                      placeholder="Min 8 characters"
                      className={`${inputCls} flex-1`}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => patchForm('tempPassword', generatePassword())}
                      title="Generate a random password"
                    >
                      Generate
                    </Button>
                  </div>
                </FormField>
              )}
            </div>
          </section>

          {/* Section 2 — Role Assignment */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-[--bb-text-secondary] mb-3">
              Role Assignment
            </h4>

            {/* Scope radio */}
            <div className="flex gap-4 mb-4">
              {([
                ['clinic', 'Clinic Staff'],
                ['billing', 'Billing Company Staff'],
                ['management', 'Management Group Staff'],
              ] as const).map(([val, lbl]) => (
                <label key={val} className="flex items-center gap-1.5 cursor-pointer text-sm text-[--bb-text-primary]">
                  <input
                    type="radio"
                    name="scope"
                    value={val}
                    checked={form.scope === val}
                    onChange={() => patchForm('scope', val)}
                    className="accent-[#0410BD]"
                  />
                  {lbl}
                </label>
              ))}
            </div>

            {/* Clinic staff fields */}
            {form.scope === 'clinic' && (
              <div className="space-y-3">
                <FormField label="Clinic">
                  <select
                    value={form.clinicId}
                    onChange={e => patchForm('clinicId', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select clinic…</option>
                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Role">
                  <select
                    value={form.clinicRole}
                    onChange={e => patchForm('clinicRole', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select role…</option>
                    {CLINIC_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </FormField>
                <label className="flex items-center gap-2 text-sm text-[--bb-text-primary] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={e => patchForm('isPrimary', e.target.checked)}
                    className="accent-[#0410BD]"
                  />
                  Primary assignment
                </label>
              </div>
            )}

            {/* Billing company fields */}
            {form.scope === 'billing' && (
              <div className="space-y-3">
                <FormField label="Billing Company">
                  <select
                    value={form.billingCompanyId}
                    onChange={e => patchForm('billingCompanyId', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select billing company…</option>
                    {billingCompanies.map(bc => <option key={bc.id} value={bc.id}>{bc.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Role">
                  <select
                    value={form.billingRole}
                    onChange={e => patchForm('billingRole', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select role…</option>
                    {BILLING_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Clinic Access">
                  <div className="flex gap-4">
                    {([['all', 'All Clinics'], ['specific', 'Specific Clinics']] as const).map(([v, l]) => (
                      <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm text-[--bb-text-primary]">
                        <input
                          type="radio"
                          name="clinicAccess"
                          value={v}
                          checked={form.clinicAccess === v}
                          onChange={() => patchForm('clinicAccess', v)}
                          className="accent-[#0410BD]"
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </FormField>
                {form.clinicAccess === 'specific' && (
                  <FormField label="Select Clinics">
                    <div className="border border-[--bb-border] rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                      {clinics.length === 0 ? (
                        <p className="text-xs text-[--bb-text-secondary] py-2 text-center">No clinics available</p>
                      ) : clinics.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm text-[--bb-text-primary] cursor-pointer hover:bg-[#F2F2F8] px-1.5 py-1 rounded">
                          <input
                            type="checkbox"
                            checked={form.specificClinicIds.includes(c.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                patchForm('specificClinicIds', [...form.specificClinicIds, c.id])
                              } else {
                                patchForm('specificClinicIds', form.specificClinicIds.filter(id => id !== c.id))
                              }
                            }}
                            className="accent-[#0410BD]"
                          />
                          {c.name}
                        </label>
                      ))}
                    </div>
                  </FormField>
                )}
              </div>
            )}

            {/* Management group fields */}
            {form.scope === 'management' && (
              <div className="space-y-3">
                <FormField label="Management Group">
                  <select
                    value={form.managementGroupId}
                    onChange={e => patchForm('managementGroupId', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select management group…</option>
                    {managementGroups.map(mg => <option key={mg.id} value={mg.id}>{mg.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Role">
                  <select
                    value={form.mgmtRole}
                    onChange={e => patchForm('mgmtRole', e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select role…</option>
                    {MGMT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </FormField>
              </div>
            )}
          </section>
        </div>
      </Drawer>

      {/* ── Deactivate Confirm Modal ─────────────────────────────────────── */}
      <ConfirmModal
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message={
          deactivateTarget
            ? `This will prevent ${deactivateTarget.first_name} ${deactivateTarget.last_name} from logging in. Continue?`
            : ''
        }
        confirmLabel="Deactivate"
        loading={deactivating}
      />

      {/* ── Activate Confirm Modal ───────────────────────────────────────── */}
      <ConfirmModal
        open={!!activateTarget}
        onClose={() => setActivateTarget(null)}
        onConfirm={handleActivate}
        title="Activate User"
        message={
          activateTarget
            ? `Reactivate ${activateTarget.first_name} ${activateTarget.last_name}? They will be able to log in again.`
            : ''
        }
        confirmLabel="Activate"
        loading={activating}
      />

      {/* ── Reset Password Modal ─────────────────────────────────────────── */}
      <Modal
        open={!!resetTarget}
        onClose={() => { setResetTarget(null); setNewPassword(''); setConfirmPassword('') }}
        title={`Reset Password — ${resetTarget ? `${resetTarget.first_name} ${resetTarget.last_name}` : ''}`}
        maxWidth={420}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setResetTarget(null); setNewPassword(''); setConfirmPassword('') }}
              style={{ padding: '8px 16px', borderRadius: 'var(--bb-radius-sm)', border: '1px solid var(--bb-border)', background: 'none', cursor: 'pointer', fontSize: 14 }}
            >
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={resetting}
              style={{ padding: '8px 16px', borderRadius: 'var(--bb-radius-sm)', border: 'none', background: 'var(--bb-brand-blue)', color: '#fff', cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1, fontSize: 14 }}
            >
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 4 }}>
              New Password <span style={{ color: 'var(--bb-status-danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                style={inlineInputStyle}
              />
              <button
                onClick={() => { const p = generatePassword(); setNewPassword(p); setConfirmPassword(p) }}
                style={{ padding: '0 12px', height: 34, borderRadius: 'var(--bb-radius-sm)', border: '1px solid var(--bb-border)', background: 'white', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', color: 'var(--bb-text-primary)' }}
              >
                Generate
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 4 }}>
              Confirm Password <span style={{ color: 'var(--bb-status-danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              style={inlineInputStyle}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p style={{ fontSize: 11, color: 'var(--bb-status-danger)', marginTop: 4 }}>Passwords do not match.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const inputCls =
  'w-full h-8 px-3 text-sm border border-[--bb-border] rounded-md bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary] focus:outline-none focus:border-[--bb-brand-blue] focus:ring-1 focus:ring-[--bb-brand-blue] disabled:bg-[#F9F9FC] disabled:text-[--bb-text-secondary]'

const selectCls =
  'w-full h-8 pl-3 pr-7 text-sm border border-[--bb-border] rounded-md bg-white text-[--bb-text-primary] focus:outline-none focus:border-[--bb-brand-blue] focus:ring-1 focus:ring-[--bb-brand-blue] appearance-none cursor-pointer'

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  height: 34,
  padding: '0 10px',
  fontSize: 14,
  border: '1px solid var(--bb-border)',
  borderRadius: 'var(--bb-radius-sm)',
  outline: 'none',
  color: 'var(--bb-text-primary)',
  background: 'white',
}

// ── FormField helper ──────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[--bb-text-secondary] mb-1">
        {label}
        {required && <span className="ml-0.5 text-[--bb-status-danger]">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Error helper ──────────────────────────────────────────────────────────────

function extractApiError(err: unknown): string | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { data?: { detail?: string } } }).response
    return res?.data?.detail ?? null
  }
  return null
}
