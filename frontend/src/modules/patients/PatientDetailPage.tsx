import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit3, ShieldCheck, FileText,
  Plus, CheckCircle, Clock, ChevronRight, Activity,
  CreditCard, User, Shield, DollarSign, Stethoscope,
  MessageSquare,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { Badge } from '../../components/ui/Badge'
// Input and Select are available but not currently used in this view
// import { Input } from '../../components/ui/Input'
// import { Select } from '../../components/ui/Select'
import { BodyMap } from './BodyMap'
import { TeethMap } from './TeethMap'
import { usePatient } from '../../services/queries'
import type { Patient, Visit, Claim, Payment } from '../../types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PatientInsuranceFull {
  id: string
  patient_id: string
  priority: 'primary' | 'secondary' | 'tertiary'
  payer_id?: string
  subscriber_id?: string
  group_number?: string
  plan_name?: string
  copay?: number
  deductible?: number
  relationship_to_insured?: string
  release_of_info: boolean
  signature_on_file: boolean
  auth_number?: string
  auth_visits?: number
  auth_effective_from?: string
  auth_effective_to?: string
  auth_visits_used: number
  is_active: boolean
  created_at: string
  updated_at: string
  // enriched
  payer_name?: string
  effective_date?: string
  termination_date?: string
  out_of_pocket_max?: number
  deductible_met?: number
  insured_name?: string
  insured_dob?: string
}

interface ActivityEvent {
  id: string
  event_type: string
  description: string
  user_name?: string
  created_at: string
  metadata?: Record<string, string>
}

// ─── Data fetching helpers ───────────────────────────────────────────────────

import { apiClient } from '../../services/api'

function stripBase(url: string) { return url.replace(/^\/api\/v1/, '') }

async function apiFetch<T>(url: string): Promise<T> {
  return (await apiClient.get<T>(stripBase(url))).data
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  return (await apiClient.patch<T>(stripBase(url), body)).data
}

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return (await apiClient.post<T>(stripBase(url), body)).data
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function calcAge(dob?: string | null): string {
  if (!dob) return '—'
  const d = new Date(dob)
  const now = new Date()
  const age = now.getFullYear() - d.getFullYear() -
    (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0)
  return String(age)
}

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtCurrency(n?: number | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function ageDays(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  return `${days}d`
}

function priorityLabel(p: string): string {
  const m: Record<string, string> = { primary: 'PRIMARY', secondary: 'SECONDARY', tertiary: 'TERTIARY' }
  return m[p] ?? p.toUpperCase()
}

function priorityVariant(p: string): 'info' | 'warning' | 'default' {
  if (p === 'primary') return 'info'
  if (p === 'secondary') return 'warning'
  return 'default'
}

// ─── Dense table styles ───────────────────────────────────────────────────────

const TH = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => (
  <th
    className={className}
    style={{
      padding: '6px 10px',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--bb-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      textAlign: 'left',
      borderBottom: '1px solid var(--bb-border)',
      background: 'var(--bb-surface-app)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
)

const TD = ({ children, className = '', style = {}, colSpan }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties; colSpan?: number }) => (
  <td
    className={className}
    colSpan={colSpan}
    style={{
      padding: '6px 10px',
      fontSize: 12,
      color: 'var(--bb-text-primary)',
      borderBottom: '1px solid var(--bb-border)',
      verticalAlign: 'middle',
      ...style,
    }}
  >
    {children}
  </td>
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, color: 'var(--bb-text-secondary)',
    }}>
      <Icon size={32} strokeWidth={1.2} />
      <p style={{ fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  )
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bb-surface-card)',
        border: '1px solid var(--bb-border)',
        borderRadius: 'var(--bb-radius)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: '1px solid var(--bb-border)',
      background: 'var(--bb-surface-app)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </span>
      {action}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, minHeight: 22 }}>
      <span style={{
        width: 120, flexShrink: 0, fontSize: 11, fontWeight: 600,
        color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      <span style={{ color: 'var(--bb-text-primary)', flex: 1 }}>{children}</span>
    </div>
  )
}

function visitAgeDays(dateStr?: string | null): number {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function visitDotColor(days: number): string {
  if (days <= 7) return 'var(--bb-status-danger)'
  if (days <= 30) return 'var(--bb-status-warning)'
  return 'var(--bb-status-success)'
}

function visitRowBg(days: number): string {
  if (days <= 7) return 'rgba(220,38,38,0.06)'
  if (days <= 30) return 'rgba(217,119,6,0.06)'
  return 'rgba(22,163,74,0.06)'
}

function OverviewTab({ patient, visits, claims, insurance, onEditPatient, onNewVisit, isDental = false }: {
  patient: Patient
  visits: Visit[]
  claims: Claim[]
  insurance: PatientInsuranceFull[]
  onEditPatient: () => void
  onNewVisit: () => void
  isDental?: boolean
}) {
  const navigate = useNavigate()
  const p = patient as PatientFull
  const primaryIns = insurance.find(i => i.priority === 'primary' && i.is_active)
  const recentVisits = visits.slice(0, 6)

  const sexLabel = (s?: string | null) => {
    if (s === 'M' || s === 'male') return 'Male'
    if (s === 'F' || s === 'female') return 'Female'
    return s ?? '—'
  }

  const address = [
    p.address_line1 ?? patient.address?.line1,
    p.address_line2 ?? patient.address?.line2,
    [p.city ?? patient.address?.city, p.state ?? patient.address?.state].filter(Boolean).join(', '),
    p.zip ?? patient.address?.zip,
  ].filter(Boolean).join(' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── DENTAL CHART — full-width, top of page ─── */}
      {isDental && (
        <SectionCard>
          <SectionHeader title="Dental Chart" />
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'center' }}>
            <TeethMap patientId={patient.id} />
          </div>
        </SectionCard>
      )}

    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
      {/* ─── LEFT COLUMN ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Patient info read-only */}
        <SectionCard>
          <SectionHeader
            title="Patient Information"
            action={
              <button
                onClick={onEditPatient}
                style={{
                  fontSize: 11, color: 'var(--bb-brand-blue)', background: 'none',
                  border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px',
                  borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Edit3 size={11} /> Edit Patient
              </button>
            }
          />
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <ReadRow label="Full Name">{`${p.first_name ?? p.firstName ?? ''} ${p.middle_name ? p.middle_name + ' ' : ''}${p.last_name ?? p.lastName ?? ''}`.trim() || '—'}</ReadRow>
            <ReadRow label="Date of Birth">{fmtDate(p.dob ?? patient.dateOfBirth)}</ReadRow>
            <ReadRow label="Age">{calcAge(p.dob ?? patient.dateOfBirth)}</ReadRow>
            <ReadRow label="Sex">{sexLabel(p.sex ?? p.gender)}</ReadRow>
            <ReadRow label="SSN"><PHIField value={patient.ssn ?? (p as PatientFull).ssn_last_four ?? '***-**-****'} fieldName="SSN" patientId={patient.id} fieldType="ssn" inline /></ReadRow>
            <ReadRow label="MRN">{p.account_number ?? p.accountNumber ?? '—'}</ReadRow>
            <ReadRow label="Status"><StatusBadge status={patient.status} size="sm" /></ReadRow>
            {(p.marital_status) && <ReadRow label="Marital">{p.marital_status}</ReadRow>}
            {(p.preferred_language) && <ReadRow label="Language">{p.preferred_language}</ReadRow>}
            <div style={{ borderTop: '1px solid var(--bb-border)', margin: '4px 0' }} />
            {(p.phone_home ?? p.phone_cell ?? patient.phone) && (
              <ReadRow label="Phone">
                <PHIField value={p.phone_home ?? p.phone_cell ?? patient.phone ?? ''} fieldName="Phone" patientId={patient.id} fieldType="phone" inline />
              </ReadRow>
            )}
            {patient.email && (
              <ReadRow label="Email">
                <PHIField value={patient.email} fieldName="Email" patientId={patient.id} fieldType="email" inline />
              </ReadRow>
            )}
            {address && (
              <ReadRow label="Address">
                <PHIField value={address} fieldName="Address" patientId={patient.id} fieldType="address" inline />
              </ReadRow>
            )}
          </div>
        </SectionCard>

        {/* Primary Insurance */}
        <SectionCard>
          <SectionHeader title="Primary Insurance" />
          {primaryIns ? (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <ReadRow label="Payer">
                <span style={{ fontWeight: 600 }}>{primaryIns.payer_name ?? `Payer ID: ${primaryIns.payer_id ?? '—'}`}</span>
              </ReadRow>
              {primaryIns.plan_name && <ReadRow label="Plan">{primaryIns.plan_name}</ReadRow>}
              <ReadRow label="Member ID"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{primaryIns.subscriber_id ?? '—'}</span></ReadRow>
              <ReadRow label="Group #"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{primaryIns.group_number ?? '—'}</span></ReadRow>
              <ReadRow label="Copay">{primaryIns.copay != null ? fmtCurrency(primaryIns.copay) : '—'}</ReadRow>
              <ReadRow label="Deductible">{primaryIns.deductible != null ? fmtCurrency(primaryIns.deductible) : '—'}</ReadRow>
              <ReadRow label="Relationship">{primaryIns.relationship_to_insured ?? 'Self'}</ReadRow>
            </div>
          ) : (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 13 }}>
              No active primary insurance
            </div>
          )}
        </SectionCard>

        {/* Billing summary */}
        {claims.length > 0 && (
          <SectionCard>
            <SectionHeader title="Billing Summary" />
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <ReadRow label="Total Charges">{fmtCurrency(claims.reduce((s, c) => s + (c.totalCharges ?? 0), 0))}</ReadRow>
              <ReadRow label="Total Paid">{fmtCurrency(claims.reduce((s, c) => s + (c.totalPaid ?? 0), 0))}</ReadRow>
              <ReadRow label="Balance Due">
                <span style={{ fontWeight: 600, color: claims.reduce((s, c) => s + (c.balance ?? 0), 0) > 0 ? 'var(--bb-status-danger)' : 'var(--bb-text-primary)' }}>
                  {fmtCurrency(claims.reduce((s, c) => s + (c.balance ?? 0), 0))}
                </span>
              </ReadRow>
              <ReadRow label="Open Claims">{String(claims.filter(c => !['paid', 'void', 'denied'].includes(c.status)).length)}</ReadRow>
            </div>
          </SectionCard>
        )}
      </div>

      {/* ─── RIGHT COLUMN ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Body Map — only for non-dental clinics */}
        {!isDental && (
          <SectionCard>
            <SectionHeader title="Body Map" />
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'center' }}>
              <BodyMap patientId={patient.id} sex={p.sex ?? p.gender ?? undefined} visits={recentVisits} compact />
            </div>
          </SectionCard>
        )}

        {/* Recent Visits */}
        <SectionCard>
          <SectionHeader
            title="Recent Visits"
            action={
              <Button size="xs" variant="primary" leftIcon={<Plus size={11} />} onClick={onNewVisit}>
                New Visit
              </Button>
            }
          />
          {recentVisits.length === 0 ? (
            <EmptyState icon={Stethoscope} message="No visits on record" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentVisits.map(v => {
                const days = visitAgeDays(v.visitDate)
                return (
                  <div
                    key={v.id}
                    onClick={() => navigate(`/visits/${v.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: '1px solid var(--bb-border)', cursor: 'pointer',
                      background: visitRowBg(days), transition: 'filter 0.1s',
                    }}
                  >
                    {/* Color dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: visitDotColor(days),
                    }} />
                    {/* Date */}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-primary)', whiteSpace: 'nowrap', width: 80 }}>
                      {fmtDate(v.visitDate)}
                    </span>
                    {/* Provider */}
                    <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)', width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.provider ? `${v.provider.firstName} ${v.provider.lastName}` : '—'}
                    </span>
                    {/* Diagnoses */}
                    <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                      {v.diagnoses?.slice(0, 3).map(d => (
                        <span key={d.id} style={{
                          fontSize: 10, background: 'var(--bb-surface-app)',
                          border: '1px solid var(--bb-border)', borderRadius: 3, padding: '1px 5px',
                          fontFamily: 'monospace',
                        }}>{d.code}</span>
                      ))}
                    </div>
                    {/* Status */}
                    <StatusBadge status={v.status} size="sm" />
                    <ChevronRight size={13} color="var(--bb-text-secondary)" />
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
    </div>
  )
}


// ─── Demographics Tab ─────────────────────────────────────────────────────────

function DemographicsTab({ patient, startEditing }: { patient: Patient; startEditing?: boolean }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  useEffect(() => { if (startEditing) setIsEditing(true) }, [startEditing])
  const [form, setForm] = useState({
    first_name: (patient as PatientFull).first_name ?? patient.firstName ?? '',
    middle_name: (patient as PatientFull).middle_name ?? '',
    last_name: (patient as PatientFull).last_name ?? patient.lastName ?? '',
    suffix: '',
    dob: (patient as PatientFull).dob ?? patient.dateOfBirth ?? '',
    sex: (patient as PatientFull).sex ?? patient.gender ?? '',
    ssn: '',
    marital_status: (patient as PatientFull).marital_status ?? '',
    race: (patient as PatientFull).race ?? '',
    ethnicity: (patient as PatientFull).ethnicity ?? '',
    preferred_language: (patient as PatientFull).preferred_language ?? '',
    gender_identity: (patient as PatientFull).gender_identity ?? '',
    account_type: (patient as PatientFull).account_type ?? 'patient',
    status: patient.status ?? 'active',
    email: patient.email ?? '',
    phone_home: (patient as PatientFull).phone_home ?? '',
    phone_cell: (patient as PatientFull).phone_cell ?? '',
    phone_work: (patient as PatientFull).phone_work ?? '',
    address_line1: (patient as PatientFull).address_line1 ?? patient.address?.line1 ?? '',
    address_line2: (patient as PatientFull).address_line2 ?? patient.address?.line2 ?? '',
    city: (patient as PatientFull).city ?? patient.address?.city ?? '',
    state: (patient as PatientFull).state ?? patient.address?.state ?? '',
    zip: (patient as PatientFull).zip ?? patient.address?.zip ?? '',
    employer_name: '',
    occupation: '',
    // Identity extras
    mothers_maiden_last: '',
    mothers_maiden_first: '',
    professional_title: '',
    religion: '',
    sexual_orientation: '',
    // Advance Directive
    advance_directive_type: '',
    advance_directive_reviewed: '',
    // Smoking / Tobacco
    smoking_status: '',
    smoking_frequency: '',
    smoking_start_date: '',
    smoking_end_date: '',
    other_tobacco: '',
    other_tobacco_frequency: '',
    tobacco_start_date: '',
    tobacco_end_date: '',
    tobacco_review_date: '',
    smoking_comments: '',
    // Emergency Contact
    ec_name: '',
    ec_relationship: '',
    ec_address_line1: '',
    ec_address_line2: '',
    ec_city: '',
    ec_state: '',
    ec_zip: '',
    ec_phone_home: '',
    ec_phone_cell: '',
    ec_phone_work: '',
    // Next of Kin
    nok_name: '',
    nok_relationship: '',
    nok_address_line1: '',
    nok_address_line2: '',
    nok_city: '',
    nok_state: '',
    nok_zip: '',
    nok_phone_home: '',
    nok_phone_cell: '',
    nok_phone_work: '',
    // User-Defined Fields
    user_field_1: '',
    user_field_2: '',
    user_field_3: '',
    user_field_4: '',
    user_field_5: '',
    user_field_6: '',
    // Account Status
    patient_start_date: '',
    patient_end_date: '',
    exempt_from_reporting: false as boolean,
    confidential_health_info: false as boolean,
  })
  const [saved, setSaved] = useState(false)

  // ── Live validation ───────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

  function validateDemographicsField(key: string, value: string) {
    let msg: string | undefined
    if (key === 'first_name' && !value.trim()) msg = 'First name is required'
    else if (key === 'last_name' && !value.trim()) msg = 'Last name is required'
    else if (key === 'dob') {
      if (!value) {
        msg = 'Date of birth is required'
      } else {
        const d = new Date(value)
        if (isNaN(d.getTime())) msg = 'Invalid date'
        else if (d > new Date()) msg = 'Date of birth cannot be in the future'
      }
    } else if (key === 'phone_home' || key === 'phone_cell' || key === 'phone_work') {
      if (value && !/^\d{10}$/.test(value.replace(/\D/g, ''))) msg = 'Phone must be 10 digits'
    } else if (key === 'email') {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) msg = 'Invalid email format'
    }
    setFieldErrors(prev => {
      const next = { ...prev }
      if (msg) next[key] = msg
      else delete next[key]
      return next
    })
  }

  function touchField(key: string) {
    setTouchedFields(prev => new Set(prev).add(key))
  }

  const hasDemographicsErrors = Object.keys(fieldErrors).length > 0
  const requiredDemographics = ['first_name', 'last_name', 'dob']
  const requiredMissing = requiredDemographics.some(k => !String(form[k as keyof typeof form] ?? '').trim())

  const mutation = useMutation({
    mutationFn: (data: Partial<typeof form>) => {
      // Strip empty strings so the backend doesn't reject them as invalid dates/enums
      const payload = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      )
      return apiPatch<Patient>(`/api/v1/patients/${patient.id}`, payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', patient.id] })
      setSaved(true)
      setIsEditing(false)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const age = calcAge(form.dob)

  const VALIDATED_KEYS = new Set(['first_name', 'last_name', 'dob', 'email', 'phone_home', 'phone_cell', 'phone_work'])

  function field(label: string, key: keyof typeof form, opts?: { readOnly?: boolean; type?: string }) {
    const ro = opts?.readOnly || !isEditing
    const keyStr = String(key)
    const hasError = touchedFields.has(keyStr) && !!fieldErrors[keyStr]
    return (
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {label}
        </label>
        <input
          type={opts?.type ?? 'text'}
          value={String(form[key] ?? '')}
          readOnly={ro}
          onChange={e => {
            setForm(p => ({ ...p, [key]: e.target.value }))
            if (!ro && VALIDATED_KEYS.has(keyStr)) validateDemographicsField(keyStr, e.target.value)
          }}
          onBlur={e => {
            if (!ro && VALIDATED_KEYS.has(keyStr)) {
              touchField(keyStr)
              validateDemographicsField(keyStr, e.target.value)
            }
          }}
          style={{
            height: 32, width: '100%', padding: '0 10px', fontSize: 13,
            border: `1px solid ${ro ? 'transparent' : hasError ? 'var(--bb-status-danger)' : 'var(--bb-border)'}`, borderRadius: 6,
            background: ro ? 'transparent' : 'var(--bb-surface-card)',
            color: 'var(--bb-text-primary)', outline: 'none',
          }}
        />
        {hasError && (
          <span style={{ color: 'var(--bb-status-danger)', fontSize: 12, marginTop: 2, display: 'block' }}>{fieldErrors[keyStr]}</span>
        )}
      </div>
    )
  }

  function selectField(label: string, key: keyof typeof form, options: { value: string; label: string }[]) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {label}
        </label>
        <select
          value={String(form[key] ?? '')}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          style={{
            height: 32, width: '100%', padding: '0 10px', fontSize: 13,
            border: '1px solid var(--bb-border)', borderRadius: 6,
            background: 'var(--bb-surface-card)', color: 'var(--bb-text-primary)', outline: 'none',
          }}
        >
          <option value="">—</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
      {/* Name section */}
      <SectionCard>
        <SectionHeader title="Name" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 120px', gap: 12 }}>
          {field('First Name', 'first_name')}
          {field('Middle Name', 'middle_name')}
          {field('Last Name', 'last_name')}
          {field('Suffix', 'suffix')}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Account #</label>
            <input
              readOnly value={(patient as PatientFull).account_number ?? ''}
              style={{ height: 32, width: '100%', padding: '0 10px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, background: 'var(--bb-surface-app)', color: 'var(--bb-text-secondary)', outline: 'none' }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Identity */}
      <SectionCard>
        <SectionHeader title="Identity & Demographics" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {field('Date of Birth', 'dob', { type: 'date' })}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Age</label>
            <input readOnly value={age} style={{ height: 32, width: '100%', padding: '0 10px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, background: 'var(--bb-surface-app)', color: 'var(--bb-text-secondary)', outline: 'none' }} />
          </div>
          {selectField('Sex', 'sex', [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }, { value: 'U', label: 'Unknown' }])}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>SSN (masked)</label>
            <PHIField value={patient.ssn ?? (patient as PatientFull).ssn_last_four ?? '***-**-****'} fieldName="SSN" patientId={patient.id} fieldType="ssn" />
          </div>
          {selectField('Marital Status', 'marital_status', [
            { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' },
            { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' },
            { value: 'separated', label: 'Separated' }, { value: 'other', label: 'Other' },
          ])}
          {selectField('Race', 'race', [
            { value: 'white', label: 'White' }, { value: 'black', label: 'Black / African American' },
            { value: 'asian', label: 'Asian' }, { value: 'aian', label: 'American Indian / Alaska Native' },
            { value: 'nhopi', label: 'Native Hawaiian / Pacific Islander' },
            { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown' },
          ])}
          {selectField('Ethnicity', 'ethnicity', [
            { value: 'hispanic', label: 'Hispanic or Latino' },
            { value: 'not_hispanic', label: 'Not Hispanic or Latino' },
            { value: 'unknown', label: 'Unknown' },
          ])}
          {selectField('Language', 'preferred_language', [
            { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' }, { value: 'zh', label: 'Chinese' },
            { value: 'vi', label: 'Vietnamese' }, { value: 'other', label: 'Other' },
          ])}
          {selectField('Gender Identity', 'gender_identity', [
            { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
            { value: 'nonbinary', label: 'Non-binary' }, { value: 'transgender_male', label: 'Transgender Male' },
            { value: 'transgender_female', label: 'Transgender Female' },
            { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown / Prefer not to say' },
          ])}
          {selectField('Account Type', 'account_type', [
            { value: 'patient', label: 'Patient' }, { value: 'guarantor', label: 'Guarantor' }, { value: 'dependent', label: 'Dependent' },
          ])}
          {selectField('Status', 'status', [
            { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'archived', label: 'Archived' },
          ])}
          {/* Mother's Maiden Name — side by side in a 2-col span */}
          <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field("Mother's Maiden Last", 'mothers_maiden_last')}
            {field("Mother's Maiden First", 'mothers_maiden_first')}
          </div>
          {field('Professional Title', 'professional_title')}
          {field('Religion', 'religion')}
          {selectField('Sexual Orientation', 'sexual_orientation', [
            { value: 'straight', label: 'Straight' },
            { value: 'gay_lesbian', label: 'Gay or Lesbian' },
            { value: 'bisexual', label: 'Bisexual' },
            { value: 'prefer_not', label: 'Prefer not to say' },
            { value: 'unknown', label: 'Unknown' },
          ])}
        </div>
      </SectionCard>

      {/* Contact */}
      <SectionCard>
        <SectionHeader title="Contact Information" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {field('Email', 'email', { type: 'email' })}
          {field('Home Phone', 'phone_home', { type: 'tel' })}
          {field('Cell Phone', 'phone_cell', { type: 'tel' })}
          {field('Work Phone', 'phone_work', { type: 'tel' })}
          {field('Address Line 1', 'address_line1')}
          {field('Address Line 2', 'address_line2')}
          {field('City', 'city')}
          {field('State', 'state')}
          {field('ZIP', 'zip')}
        </div>
      </SectionCard>

      {/* Employer */}
      <SectionCard>
        <SectionHeader title="Employment" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {field('Employer Name', 'employer_name')}
          {field('Occupation', 'occupation')}
          {field('Work Phone', 'phone_work', { type: 'tel' })}
        </div>
      </SectionCard>

      {/* Advance Directive */}
      <SectionCard>
        <SectionHeader title="Advance Directive" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {selectField('Advance Directive Type', 'advance_directive_type', [
            { value: 'none', label: 'No Advance Directive' },
            { value: 'living_will', label: 'Living Will' },
            { value: 'healthcare_proxy', label: 'Healthcare Proxy' },
            { value: 'polst', label: 'POLST' },
            { value: 'dnr', label: 'DNR' },
            { value: 'other', label: 'Other' },
          ])}
          {field('Advance Directive Reviewed', 'advance_directive_reviewed', { type: 'date' })}
        </div>
      </SectionCard>

      {/* Smoking / Tobacco History */}
      <SectionCard>
        <SectionHeader title="Smoking / Tobacco History" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {selectField('Smoking (MU)', 'smoking_status', [
            { value: 'never', label: 'Never' },
            { value: 'current_every_day', label: 'Current Every Day' },
            { value: 'current_some_day', label: 'Current Some Day' },
            { value: 'former', label: 'Former' },
          ])}
          {field('Frequency', 'smoking_frequency')}
          {field('Smoking Start Date', 'smoking_start_date', { type: 'date' })}
          {field('Smoking End Date', 'smoking_end_date', { type: 'date' })}
          {selectField('Other Tobacco', 'other_tobacco', [
            { value: 'none', label: 'None' },
            { value: 'chewing', label: 'Chewing Tobacco' },
            { value: 'cigars', label: 'Cigars' },
            { value: 'pipe', label: 'Pipe' },
            { value: 'other', label: 'Other' },
          ])}
          {field('Other Tobacco Frequency', 'other_tobacco_frequency')}
          {field('Tobacco Start Date', 'tobacco_start_date', { type: 'date' })}
          {field('Tobacco End Date', 'tobacco_end_date', { type: 'date' })}
          {field('Last Tobacco Use Review Date', 'tobacco_review_date', { type: 'date' })}
          <div style={{ gridColumn: 'span 4' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              Smoking Comments
            </label>
            <textarea
              value={form.smoking_comments}
              onChange={e => setForm(p => ({ ...p, smoking_comments: e.target.value }))}
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13, boxSizing: 'border-box',
                border: '1px solid var(--bb-border)', borderRadius: 6,
                background: 'var(--bb-surface-card)', color: 'var(--bb-text-primary)',
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Emergency Contact */}
      <SectionCard>
        <SectionHeader title="Emergency Contact" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {field('Contact Name', 'ec_name')}
          {selectField('Relationship To Patient', 'ec_relationship', [
            { value: 'spouse', label: 'Spouse' }, { value: 'parent', label: 'Parent' },
            { value: 'child', label: 'Child' }, { value: 'sibling', label: 'Sibling' },
            { value: 'friend', label: 'Friend' }, { value: 'other', label: 'Other' },
          ])}
          {field('Address Line 1', 'ec_address_line1')}
          {field('Address Line 2', 'ec_address_line2')}
          {field('City', 'ec_city')}
          {field('State', 'ec_state')}
          {field('ZIP', 'ec_zip')}
          {field('Home Phone', 'ec_phone_home', { type: 'tel' })}
          {field('Cell Phone', 'ec_phone_cell', { type: 'tel' })}
          {field('Work Phone', 'ec_phone_work', { type: 'tel' })}
        </div>
      </SectionCard>

      {/* Next of Kin */}
      <SectionCard>
        <SectionHeader title="Next of Kin" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {field('Contact Name', 'nok_name')}
          {selectField('Relationship To Patient', 'nok_relationship', [
            { value: 'spouse', label: 'Spouse' }, { value: 'parent', label: 'Parent' },
            { value: 'child', label: 'Child' }, { value: 'sibling', label: 'Sibling' },
            { value: 'friend', label: 'Friend' }, { value: 'other', label: 'Other' },
          ])}
          {field('Address Line 1', 'nok_address_line1')}
          {field('Address Line 2', 'nok_address_line2')}
          {field('City', 'nok_city')}
          {field('State', 'nok_state')}
          {field('ZIP', 'nok_zip')}
          {field('Home Phone', 'nok_phone_home', { type: 'tel' })}
          {field('Cell Phone', 'nok_phone_cell', { type: 'tel' })}
          {field('Work Phone', 'nok_phone_work', { type: 'tel' })}
        </div>
      </SectionCard>

      {/* User-Defined Fields */}
      <SectionCard>
        <SectionHeader title="User-Defined Fields" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('Field 1', 'user_field_1')}
          {field('Field 2', 'user_field_2')}
          {field('Field 3', 'user_field_3')}
          {field('Field 4', 'user_field_4')}
          {field('Field 5', 'user_field_5')}
          {field('Field 6', 'user_field_6')}
        </div>
      </SectionCard>

      {/* Account Status */}
      <SectionCard>
        <SectionHeader title="Account Status" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {field('Patient Start Date', 'patient_start_date', { type: 'date' })}
          {field('Patient End Date', 'patient_end_date', { type: 'date' })}
          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.exempt_from_reporting}
                onChange={e => setForm(p => ({ ...p, exempt_from_reporting: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: 'var(--bb-brand-blue)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: 'var(--bb-text-primary)' }}>
                This patient is exempt from all reporting functions
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!form.confidential_health_info}
                onChange={e => setForm(p => ({ ...p, confidential_health_info: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: 'var(--bb-brand-blue)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: 'var(--bb-text-primary)' }}>
                This patient's health information is confidential
              </span>
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Edit / Save controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isEditing ? (
          <Button variant="secondary" size="sm" leftIcon={<Edit3 size={13} />} onClick={() => setIsEditing(true)}>
            Edit Demographics
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={mutation.isPending}
              disabled={hasDemographicsErrors || requiredMissing}
              onClick={() => {
                // Touch all required fields on submit attempt to reveal any untouched errors
                requiredDemographics.forEach(k => {
                  touchField(k)
                  validateDemographicsField(k, String(form[k as keyof typeof form] ?? ''))
                })
                if (hasDemographicsErrors || requiredMissing) return
                mutation.mutate(form)
              }}
            >
              Save Changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </>
        )}
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--bb-status-success)' }}>
            <CheckCircle size={14} />
            Saved
          </span>
        )}
        {mutation.isError && (
          <span style={{ fontSize: 13, color: 'var(--bb-status-danger)' }}>Save failed. Please try again.</span>
        )}
      </div>
    </div>
  )
}

// ─── Insurance Tab ────────────────────────────────────────────────────────────

function InsuranceTab({ patientId, insurance, refetch }: {
  patientId: string
  insurance: PatientInsuranceFull[]
  refetch: () => void
}) {
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [addingInsurance, setAddingInsurance] = useState(false)
  const [eligibilityResults, setEligibilityResults] = useState<Record<string, Record<string, unknown>>>({})

  async function checkEligibility(insId: string) {
    setCheckingId(insId)
    try {
      const res = await apiPost<Record<string, unknown>>(`/patients/${patientId}/eligibility-check`)
      setEligibilityResults(p => ({ ...p, [insId]: res }))
    } catch {
      // silently fail for demo
    } finally {
      setCheckingId(null)
    }
  }

  const sorted = [...insurance].sort((a, b) => {
    const order: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 }
    return (order[a.priority] ?? 99) - (order[b.priority] ?? 99)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />} onClick={async () => {
          const payerName = window.prompt('Payer name:')
          if (!payerName) return
          const memberId = window.prompt('Member ID:') ?? ''
          setAddingInsurance(true)
          try {
            await apiPost(`/patients/${patientId}/insurance`, {
              payer_name: payerName, member_id: memberId, priority: insurance.length === 0 ? 'primary' : 'secondary', is_active: true,
            })
            refetch()
          } catch { alert('Failed to add insurance') }
          finally { setAddingInsurance(false) }
        }} disabled={addingInsurance}>
          {addingInsurance ? 'Saving…' : 'Add Insurance'}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Shield} message="No insurance records found" />
        </SectionCard>
      ) : sorted.map(ins => {
        const eligResult = eligibilityResults[ins.id]
        return (
          <SectionCard key={ins.id}>
            <div style={{ padding: '14px 16px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge variant={priorityVariant(ins.priority)}>{priorityLabel(ins.priority)}</Badge>
                  {!ins.is_active && <Badge variant="default">Inactive</Badge>}
                  <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--bb-text-primary)' }}>
                    {ins.payer_name ?? `Payer ID: ${ins.payer_id ?? '—'}`}
                  </span>
                  {ins.plan_name && (
                    <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>— {ins.plan_name}</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="xs" variant="secondary" leftIcon={<Edit3 size={11} />}>Edit</Button>
                  <Button
                    size="xs" variant="secondary"
                    loading={checkingId === ins.id}
                    leftIcon={<ShieldCheck size={11} />}
                    onClick={() => void checkEligibility(ins.id)}
                  >
                    Check Eligibility
                  </Button>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                <InfoCell label="Member ID" value={ins.subscriber_id ?? '—'} mono />
                <InfoCell label="Group Number" value={ins.group_number ?? '—'} mono />
                <InfoCell label="Relationship" value={ins.relationship_to_insured ?? 'Self'} />
                <InfoCell label="Insured Name" value={ins.insured_name ?? '—'} />
                <InfoCell label="Effective Date" value={fmtDate(ins.effective_date)} />
                <InfoCell label="Term Date" value={fmtDate(ins.termination_date)} />
                <InfoCell label="Copay" value={ins.copay != null ? fmtCurrency(ins.copay) : '—'} />
                <InfoCell label="Deductible" value={ins.deductible != null ? fmtCurrency(ins.deductible) : '—'} />
                <InfoCell label="OOP Max" value={ins.out_of_pocket_max != null ? fmtCurrency(ins.out_of_pocket_max) : '—'} />
                <InfoCell label="Deductible Met" value={ins.deductible_met != null ? fmtCurrency(ins.deductible_met) : '—'} />
                <InfoCell label="Auth #" value={ins.auth_number ?? '—'} mono />
                <InfoCell label="Auth Visits" value={ins.auth_visits != null ? `${ins.auth_visits_used} / ${ins.auth_visits} used` : '—'} />
              </div>

              {/* Eligibility result */}
              {eligResult && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 6,
                  background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ShieldCheck size={14} color="var(--bb-status-success)" />
                    <span style={{ fontWeight: 600, color: 'var(--bb-text-primary)' }}>Eligibility Check Result</span>
                    <Badge variant={(eligResult.coverage_active ? 'success' : 'danger') as 'success' | 'danger'}>
                      {eligResult.coverage_active ? 'Active Coverage' : 'Not Active'}
                    </Badge>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    <InfoCell label="Status" value={String(eligResult.status ?? '—')} />
                    {eligResult.copay != null && <InfoCell label="Copay" value={fmtCurrency(eligResult.copay as number)} />}
                    {eligResult.deductible != null && <InfoCell label="Deductible" value={fmtCurrency(eligResult.deductible as number)} />}
                    {eligResult.deductible_met != null && <InfoCell label="Deductible Met" value={fmtCurrency(eligResult.deductible_met as number)} />}
                    {eligResult.out_of_pocket != null && <InfoCell label="OOP Max" value={fmtCurrency(eligResult.out_of_pocket as number)} />}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )
      })}
    </div>
  )
}

function InfoCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--bb-text-primary)', fontFamily: mono ? 'monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Visits Tab ───────────────────────────────────────────────────────────────

function VisitsTab({ visits, onNewVisit }: { patientId: string; visits: Visit[]; onNewVisit: () => void }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? visits : visits.filter(v => v.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'scheduled', 'completed', 'cancelled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--bb-border)',
                background: filter === f ? 'var(--bb-brand-blue)' : 'var(--bb-surface-card)',
                color: filter === f ? '#fff' : 'var(--bb-text-secondary)',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <Button
          size="sm" variant="primary"
          leftIcon={<Plus size={13} />}
          onClick={onNewVisit}
        >
          New Visit
        </Button>
      </div>

      <SectionCard>
        {filtered.length === 0 ? (
          <EmptyState icon={Stethoscope} message="No visits match this filter" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Date</TH>
                  <TH>Provider</TH>
                  <TH>Visit Type</TH>
                  <TH>Chief Complaint</TH>
                  <TH>Diagnoses</TH>
                  <TH>CPT Codes</TH>
                  <TH>Charges</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr
                    key={v.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/visits/${v.id}`)}
                  >
                    <TD style={{ whiteSpace: 'nowrap' }}>{fmtDate(v.visitDate)}</TD>
                    <TD style={{ whiteSpace: 'nowrap', color: 'var(--bb-text-secondary)' }}>
                      {v.provider ? `${v.provider.firstName} ${v.provider.lastName}` : '—'}
                    </TD>
                    <TD>{v.visitType ?? '—'}</TD>
                    <TD style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--bb-text-secondary)' }}>
                      {v.notes ?? '—'}
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {v.diagnoses?.slice(0, 3).map(d => (
                          <span key={d.id} style={{
                            fontSize: 10, background: 'var(--bb-surface-app)',
                            border: '1px solid var(--bb-border)', borderRadius: 3, padding: '1px 4px',
                          }}>
                            {d.code}
                          </span>
                        ))}
                        {(v.diagnoses?.length ?? 0) > 3 && (
                          <span style={{ fontSize: 10, color: 'var(--bb-text-secondary)' }}>+{v.diagnoses.length - 3}</span>
                        )}
                      </div>
                    </TD>
                    <TD>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {v.chargeLines?.slice(0, 3).map(cl => (
                          <span key={cl.id} style={{
                            fontSize: 10, background: 'var(--bb-status-info-bg)',
                            color: 'var(--bb-status-info)', border: '1px solid var(--bb-status-info-bg)',
                            borderRadius: 3, padding: '1px 4px',
                          }}>
                            {cl.cptCode}
                          </span>
                        ))}
                      </div>
                    </TD>
                    <TD style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtCurrency(v.totalCharges)}</TD>
                    <TD><StatusBadge status={v.status} /></TD>
                    <TD>
                      <ChevronRight size={14} color="var(--bb-text-secondary)" />
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────

function ClaimsTab({ patientId, claims }: { patientId: string; claims: Claim[] }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? claims : claims.filter(c => c.status === filter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['all', 'draft', 'submitted', 'pending', 'paid', 'denied', 'void'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--bb-border)',
                background: filter === f ? 'var(--bb-brand-blue)' : 'var(--bb-surface-card)',
                color: filter === f ? '#fff' : 'var(--bb-text-secondary)',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <Button size="sm" variant="primary" leftIcon={<Plus size={13} />} onClick={() => navigate(`/claims/new?patient=${patientId}`)}>
          Create Claim
        </Button>
      </div>

      <SectionCard>
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} message="No claims match this filter" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Claim #</TH>
                  <TH>DOS</TH>
                  <TH>Payer</TH>
                  <TH>Charges</TH>
                  <TH>Paid</TH>
                  <TH>Balance</TH>
                  <TH>Adj</TH>
                  <TH>Status</TH>
                  <TH>Age</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const adj = (c.totalCharges ?? 0) - (c.totalPaid ?? 0) - (c.balance ?? 0)
                  return (
                    <tr
                      key={c.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/claims/${c.id}`)}
                    >
                      <TD style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>{c.claimNumber}</TD>
                      <TD style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.dos)}</TD>
                      <TD style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.payerName}</TD>
                      <TD style={{ whiteSpace: 'nowrap' }}>{fmtCurrency(c.totalCharges)}</TD>
                      <TD style={{ whiteSpace: 'nowrap', color: 'var(--bb-status-success)' }}>{fmtCurrency(c.totalPaid)}</TD>
                      <TD style={{ whiteSpace: 'nowrap', color: (c.balance ?? 0) > 0 ? 'var(--bb-status-danger)' : 'var(--bb-text-primary)', fontWeight: 500 }}>
                        {fmtCurrency(c.balance)}
                      </TD>
                      <TD style={{ whiteSpace: 'nowrap', color: 'var(--bb-text-secondary)' }}>{fmtCurrency(adj)}</TD>
                      <TD><StatusBadge status={c.status} /></TD>
                      <TD style={{ color: 'var(--bb-text-secondary)' }}>{ageDays(c.dos)}</TD>
                      <TD>
                        <ChevronRight size={14} color="var(--bb-text-secondary)" />
                      </TD>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bb-surface-app)' }}>
                  <TD style={{ fontWeight: 700, fontSize: 12 }} colSpan={3}>Totals ({filtered.length} claims)</TD>
                  <TD style={{ fontWeight: 700 }}>{fmtCurrency(filtered.reduce((s, c) => s + (c.totalCharges ?? 0), 0))}</TD>
                  <TD style={{ fontWeight: 700, color: 'var(--bb-status-success)' }}>{fmtCurrency(filtered.reduce((s, c) => s + (c.totalPaid ?? 0), 0))}</TD>
                  <TD style={{ fontWeight: 700, color: 'var(--bb-status-danger)' }}>{fmtCurrency(filtered.reduce((s, c) => s + (c.balance ?? 0), 0))}</TD>
                  <TD colSpan={4}></TD>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ payments }: { payments: Payment[] }) {
  const runningBalance = payments.reduce((s, p) => s + (p.appliedAmount ?? 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionCard>
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} message="No payments on record" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH>Amount</TH>
                  <TH>Applied To</TH>
                  <TH>Check #</TH>
                  <TH>Posted By</TH>
                  <TH>Status</TH>
                  <TH>Notes</TH>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <TD style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.receivedDate)}</TD>
                    <TD style={{ textTransform: 'capitalize' }}>{p.paymentMethod?.replace('-', ' ') ?? '—'}</TD>
                    <TD style={{ fontWeight: 600, color: 'var(--bb-status-success)' }}>{fmtCurrency(p.amount)}</TD>
                    <TD style={{ color: 'var(--bb-text-secondary)' }}>{fmtCurrency(p.appliedAmount)}</TD>
                    <TD style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.checkNumber ?? '—'}</TD>
                    <TD style={{ color: 'var(--bb-text-secondary)' }}>—</TD>
                    <TD><StatusBadge status={p.status} /></TD>
                    <TD style={{ color: 'var(--bb-text-secondary)' }}>—</TD>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bb-surface-app)' }}>
                  <TD style={{ fontWeight: 700 }} colSpan={2}>Running Total ({payments.length} payments)</TD>
                  <TD style={{ fontWeight: 700, color: 'var(--bb-status-success)' }}>{fmtCurrency(payments.reduce((s, p) => s + (p.amount ?? 0), 0))}</TD>
                  <TD style={{ fontWeight: 700 }}>{fmtCurrency(runningBalance)}</TD>
                  <TD colSpan={4}></TD>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Notes & Activity Tab ─────────────────────────────────────────────────────

function NotesTab({ patientId, activity, onRefresh }: { patientId: string; activity: ActivityEvent[]; onRefresh?: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function eventIcon(type: string) {
    if (type.includes('visit')) return <Stethoscope size={14} />
    if (type.includes('claim')) return <FileText size={14} />
    if (type.includes('payment')) return <DollarSign size={14} />
    if (type.includes('insurance') || type.includes('eligibility')) return <Shield size={14} />
    if (type.includes('note')) return <MessageSquare size={14} />
    return <Activity size={14} />
  }

  function eventColor(type: string): string {
    if (type.includes('visit')) return 'var(--bb-status-info)'
    if (type.includes('claim')) return 'var(--bb-status-warning)'
    if (type.includes('payment')) return 'var(--bb-status-success)'
    if (type.includes('denied') || type.includes('error')) return 'var(--bb-status-danger)'
    return 'var(--bb-text-secondary)'
  }

  async function saveNote() {
    if (!note.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      await apiPost(`/api/v1/patients/${patientId}/activity`, { note })
      setNote('')
      onRefresh?.()
    } catch {
      setSaveError('Failed to save note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Add note */}
      <SectionCard>
        <SectionHeader title="Add Note" />
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a clinical or administrative note…"
            rows={3}
            style={{
              width: '100%', padding: '8px 12px', fontSize: 13,
              border: '1px solid var(--bb-border)', borderRadius: 6,
              resize: 'vertical', outline: 'none',
              color: 'var(--bb-text-primary)', background: 'var(--bb-surface-card)',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {saveError ? (
              <span style={{ fontSize: 12, color: 'var(--bb-status-danger)' }}>{saveError}</span>
            ) : <span />}
            <Button size="sm" variant="primary" loading={saving} onClick={() => void saveNote()}>
              Save Note
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Timeline */}
      <SectionCard>
        <SectionHeader title="Activity Timeline" />
        {activity.length === 0 ? (
          <EmptyState icon={Activity} message="No activity recorded yet" />
        ) : (
          <div style={{ padding: '16px', position: 'relative' }}>
            {/* Vertical line */}
            <div style={{
              position: 'absolute', left: 28, top: 16, bottom: 16,
              width: 2, background: 'var(--bb-border)',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.map((evt, idx) => (
                <div key={evt.id} style={{
                  display: 'flex', gap: 16, paddingBottom: idx < activity.length - 1 ? 20 : 0,
                  position: 'relative',
                }}>
                  {/* Icon circle */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bb-surface-card)', border: '2px solid var(--bb-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: eventColor(evt.event_type), position: 'relative', zIndex: 1,
                  }}>
                    {eventIcon(evt.event_type)}
                  </div>
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                        {evt.description}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--bb-text-secondary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} />
                        {fmtDate(evt.created_at)}
                      </span>
                      {evt.user_name && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <User size={10} />
                          {evt.user_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── PatientFull type (backend snake_case) ────────────────────────────────────

interface PatientFull extends Patient {
  first_name: string
  last_name: string
  middle_name?: string
  dob?: string
  sex?: string
  ssn_last_four?: string
  account_number: string
  account_type: string
  marital_status?: string
  race?: string
  ethnicity?: string
  preferred_language?: string
  gender_identity?: string
  phone_home?: string
  phone_cell?: string
  phone_work?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  zip?: string
}

// ─── Main PatientDetailPage ───────────────────────────────────────────────────

function NewVisitModal({ patientId, patientName, onClose }: { patientId: string; patientName: string; onClose: () => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    visitType: '99213',
    chiefComplaint: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const { apiClient } = await import('../../services/api')
      const res = await apiClient.post('/visits', {
        patient_id: patientId,
        visit_date: form.visitDate,
        visit_type: form.visitType,
        chief_complaint: form.chiefComplaint || undefined,
      })
      onClose()
      navigate(`/visits/${res.data.id}`)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create visit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 12, padding: 28, width: 420, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--bb-text-primary)' }}>New Visit</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{patientName}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Date of Service</label>
            <input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))}
              style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Visit Type</label>
            <select value={form.visitType} onChange={e => setForm(f => ({ ...f, visitType: e.target.value }))}
              style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, background: 'white', boxSizing: 'border-box', outline: 'none' }}>
              <option value="99202">99202 — New Patient Level 2</option>
              <option value="99203">99203 — New Patient Level 3</option>
              <option value="99204">99204 — New Patient Level 4</option>
              <option value="99212">99212 — Est. Patient Level 2</option>
              <option value="99213">99213 — Est. Patient Level 3</option>
              <option value="99214">99214 — Est. Patient Level 4</option>
              <option value="99215">99215 — Est. Patient Level 5</option>
              <option value="annual">Annual Wellness</option>
              <option value="telehealth">Telehealth</option>
              <option value="procedure">Procedure</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Chief Complaint</label>
            <input type="text" value={form.chiefComplaint} onChange={e => setForm(f => ({ ...f, chiefComplaint: e.target.value }))}
              placeholder="Reason for visit…"
              style={{ width: '100%', height: 36, padding: '0 10px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, boxSizing: 'border-box', outline: 'none' }} />
          </div>
        </div>
        {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--bb-status-danger)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', fontSize: 13, border: '1px solid var(--bb-border)', borderRadius: 6, background: 'white', cursor: 'pointer', color: 'var(--bb-text-secondary)' }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={{ height: 36, padding: '0 16px', fontSize: 13, border: 'none', borderRadius: 6, background: 'var(--bb-brand-blue)', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating…' : 'Create Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patient, isLoading } = usePatient(id ?? '')
  const [activeTab, setActiveTab] = useState('overview')
  const [demographicsEditMode, setDemographicsEditMode] = useState(false)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const isDental = localStorage.getItem('clinic_specialty') === 'dental'

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ['patient-visits', id],
    queryFn: () => apiFetch(`/patients/${id}/visits`),
    enabled: !!id,
  })

  const { data: claims = [] } = useQuery<Claim[]>({
    queryKey: ['patient-claims', id],
    queryFn: () => apiFetch(`/patients/${id}/claims`),
    enabled: !!id,
  })

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['patient-payments', id],
    queryFn: () => apiFetch(`/patients/${id}/payments`),
    enabled: !!id,
  })

  const { data: insurance = [], refetch: refetchInsurance } = useQuery<PatientInsuranceFull[]>({
    queryKey: ['patient-insurance', id],
    queryFn: () => apiFetch(`/patients/${id}/insurance`),
    enabled: !!id,
  })

  const { data: activity = [], refetch: refetchActivity } = useQuery<ActivityEvent[]>({
    queryKey: ['patient-activity', id],
    queryFn: () => apiFetch(`/patients/${id}/activity`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[80, 200, 48, 300].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 8, background: 'var(--bb-border)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>Patient not found.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/patients')} style={{ marginTop: 12 }}>
          Back to Patients
        </Button>
      </div>
    )
  }

  const p = patient as PatientFull
  const fullName = `${p.first_name ?? p.firstName} ${p.last_name ?? p.lastName}`
  const initials = `${(p.first_name ?? p.firstName ?? '?')[0]}${(p.last_name ?? p.lastName ?? '?')[0]}`
  const dob = p.dob ?? p.dateOfBirth
  const age = calcAge(dob)

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Back nav */}
      <button
        onClick={() => navigate('/patients')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--bb-text-secondary)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <ArrowLeft size={13} />
        Back to Patients
      </button>

      {/* Header card */}
      <div style={{
        background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
        borderRadius: 'var(--bb-radius-lg)', padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--bb-status-info-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: 'var(--bb-brand-blue)',
          }}>
            {initials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{fullName}</span>
              <StatusBadge status={patient.status} />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--bb-text-secondary)' }}>
              <span>MRN: <strong style={{ color: 'var(--bb-text-primary)' }}>{p.account_number ?? p.accountNumber}</strong></span>
              {dob && <span>DOB: <strong style={{ color: 'var(--bb-text-primary)' }}>{fmtDate(dob)}</strong></span>}
              <span>Age: <strong style={{ color: 'var(--bb-text-primary)' }}>{age}</strong></span>
              {(p.sex ?? p.gender) && (
                <span>Sex: <strong style={{ color: 'var(--bb-text-primary)' }}>
                  {(p.sex ?? p.gender) === 'M' ? 'Male' : (p.sex ?? p.gender) === 'F' ? 'Female' : (p.sex ?? p.gender)}
                </strong></span>
              )}
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="sm" variant="secondary" leftIcon={<Edit3 size={13} />} onClick={() => { setActiveTab('demographics'); setDemographicsEditMode(true) }}>
            Edit Patient
          </Button>
          <Button
            size="sm" variant="secondary" leftIcon={<ShieldCheck size={13} />}
            onClick={() => setActiveTab('insurance')}
          >
            Check Eligibility
          </Button>
          <Button
            size="sm" variant="secondary" leftIcon={<FileText size={13} />}
            onClick={() => setActiveTab('payments')}
          >
            Generate Statement
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="overview" value={activeTab} onChange={setActiveTab}>
        <TabList>
          <Tab id="overview">Overview</Tab>
          <Tab id="demographics">Demographics</Tab>
          <Tab id="insurance">Insurance</Tab>
          <Tab id="visits">Visits{visits.length > 0 ? ` (${visits.length})` : ''}</Tab>
          <Tab id="claims">Claims{claims.length > 0 ? ` (${claims.length})` : ''}</Tab>
          <Tab id="payments">Payments{payments.length > 0 ? ` (${payments.length})` : ''}</Tab>
          <Tab id="notes">Notes & Activity</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4">
          <OverviewTab patient={patient} visits={visits} claims={claims} insurance={insurance} onEditPatient={() => { setActiveTab('demographics'); setDemographicsEditMode(true) }} onNewVisit={() => setShowNewVisitModal(true)} isDental={isDental} />
        </TabPanel>

        <TabPanel id="demographics" className="pt-4">
          <DemographicsTab patient={patient} startEditing={demographicsEditMode} />
        </TabPanel>

        <TabPanel id="insurance" className="pt-4">
          <InsuranceTab patientId={id ?? ''} insurance={insurance} refetch={refetchInsurance} />
        </TabPanel>

        <TabPanel id="visits" className="pt-4">
          <VisitsTab patientId={id ?? ''} visits={visits} onNewVisit={() => setShowNewVisitModal(true)} />
        </TabPanel>

        <TabPanel id="claims" className="pt-4">
          <ClaimsTab patientId={id ?? ''} claims={claims} />
        </TabPanel>

        <TabPanel id="payments" className="pt-4">
          <PaymentsTab payments={payments} />
        </TabPanel>

        <TabPanel id="notes" className="pt-4">
          <NotesTab patientId={id ?? ''} activity={activity} onRefresh={() => void refetchActivity()} />
        </TabPanel>
      </Tabs>
      {showNewVisitModal && (
        <NewVisitModal
          patientId={id ?? ''}
          patientName={fullName}
          onClose={() => setShowNewVisitModal(false)}
        />
      )}
    </div>
  )
}
