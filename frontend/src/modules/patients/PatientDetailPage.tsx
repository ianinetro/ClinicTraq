import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, Mail, Edit3, ShieldCheck, FileText,
  Plus, CheckCircle, Clock, ChevronRight, Activity,
  CreditCard, User, Shield, DollarSign, Stethoscope,
  MessageSquare,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { KPICard } from '../../components/ui/KPICard'
import { Badge } from '../../components/ui/Badge'
// Input and Select are available but not currently used in this view
// import { Input } from '../../components/ui/Input'
// import { Select } from '../../components/ui/Select'
import { BodyMap } from './BodyMap'
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

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
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

function OverviewTab({ patient, visits, claims, insurance }: {
  patient: Patient
  visits: Visit[]
  claims: Claim[]
  insurance: PatientInsuranceFull[]
}) {
  const totalCharges = claims.reduce((s, c) => s + (c.totalCharges ?? 0), 0)
  const totalPaid = claims.reduce((s, c) => s + (c.totalPaid ?? 0), 0)
  const balance = claims.reduce((s, c) => s + (c.balance ?? 0), 0)
  const openClaims = claims.filter(c => !['paid', 'void', 'denied'].includes(c.status)).length
  const lastVisit = visits[0]?.visitDate

  const primaryIns = insurance.find(i => i.priority === 'primary' && i.is_active)

  const recentVisits = visits.slice(0, 5)
  const recentClaims = claims.slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        <KPICard label="Total Charges" value={fmtCurrency(totalCharges)} />
        <KPICard label="Total Paid" value={fmtCurrency(totalPaid)} />
        <KPICard label="Balance Due" value={fmtCurrency(balance)} />
        <KPICard label="Open Claims" value={String(openClaims)} />
        <KPICard label="Last Visit" value={lastVisit ? fmtDate(lastVisit) : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Contact */}
        <SectionCard>
          <SectionHeader title="Contact Information" />
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {patient.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Phone size={13} color="var(--bb-text-secondary)" />
                <PHIField value={patient.phone} fieldName="Phone" patientId={patient.id} fieldType="phone" inline />
              </div>
            )}
            {patient.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Mail size={13} color="var(--bb-text-secondary)" />
                <PHIField value={patient.email} fieldName="Email" patientId={patient.id} fieldType="email" inline />
              </div>
            )}
            {patient.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
                <MapPin size={13} color="var(--bb-text-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <PHIField
                  value={`${patient.address.line1}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}`}
                  fieldName="Address" patientId={patient.id} fieldType="address" inline
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* Insurance summary */}
        <SectionCard>
          <SectionHeader title="Primary Insurance" />
          {primaryIns ? (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Shield size={13} color="var(--bb-text-secondary)" />
                <span style={{ fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                  {primaryIns.payer_name ?? `Payer ID: ${primaryIns.payer_id ?? '—'}`}
                </span>
              </div>
              {primaryIns.plan_name && (
                <span style={{ color: 'var(--bb-text-secondary)', paddingLeft: 19 }}>{primaryIns.plan_name}</span>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 19 }}>
                <div>
                  <span style={{ color: 'var(--bb-text-secondary)', fontSize: 11 }}>Member ID</span>
                  <p style={{ margin: 0, fontWeight: 500 }}>{primaryIns.subscriber_id ?? '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--bb-text-secondary)', fontSize: 11 }}>Group #</span>
                  <p style={{ margin: 0, fontWeight: 500 }}>{primaryIns.group_number ?? '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--bb-text-secondary)', fontSize: 11 }}>Copay</span>
                  <p style={{ margin: 0, fontWeight: 500 }}>{primaryIns.copay != null ? fmtCurrency(primaryIns.copay) : '—'}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--bb-text-secondary)', fontSize: 11 }}>Deductible</span>
                  <p style={{ margin: 0, fontWeight: 500 }}>{primaryIns.deductible != null ? fmtCurrency(primaryIns.deductible) : '—'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 13 }}>
              No active primary insurance
            </div>
          )}
        </SectionCard>
      </div>

      {/* Recent Visits */}
      <SectionCard>
        <SectionHeader title="Recent Visits (last 5)" />
        {recentVisits.length === 0 ? (
          <EmptyState icon={Stethoscope} message="No visits on record" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>Date</TH>
                  <TH>Provider</TH>
                  <TH>Type</TH>
                  <TH>Diagnoses</TH>
                  <TH>Status</TH>
                  <TH>Charges</TH>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map(v => (
                  <tr key={v.id} style={{ cursor: 'pointer' }}>
                    <TD>{fmtDate(v.visitDate)}</TD>
                    <TD style={{ color: 'var(--bb-text-secondary)' }}>
                      {v.provider ? `${v.provider.firstName} ${v.provider.lastName}` : '—'}
                    </TD>
                    <TD>{v.visitType ?? '—'}</TD>
                    <TD style={{ maxWidth: 200 }}>
                      {v.diagnoses?.slice(0, 2).map(d => (
                        <span key={d.id} style={{
                          display: 'inline-block', fontSize: 11,
                          background: 'var(--bb-surface-app)', borderRadius: 4,
                          padding: '1px 5px', marginRight: 4, marginBottom: 2,
                          border: '1px solid var(--bb-border)',
                        }}>
                          {d.code}
                        </span>
                      ))}
                      {(v.diagnoses?.length ?? 0) > 2 && (
                        <span style={{ fontSize: 11, color: 'var(--bb-text-secondary)' }}>+{v.diagnoses.length - 2}</span>
                      )}
                    </TD>
                    <TD><StatusBadge status={v.status} /></TD>
                    <TD style={{ fontWeight: 500 }}>{fmtCurrency(v.totalCharges)}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Recent Claims */}
      <SectionCard>
        <SectionHeader title="Recent Claims (last 5)" />
        {recentClaims.length === 0 ? (
          <EmptyState icon={FileText} message="No claims on record" />
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
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {recentClaims.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }}>
                    <TD style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.claimNumber}</TD>
                    <TD>{fmtDate(c.dos)}</TD>
                    <TD style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.payerName}</TD>
                    <TD>{fmtCurrency(c.totalCharges)}</TD>
                    <TD style={{ color: 'var(--bb-status-success)' }}>{fmtCurrency(c.totalPaid)}</TD>
                    <TD style={{ color: c.balance > 0 ? 'var(--bb-status-danger)' : 'var(--bb-text-primary)', fontWeight: 500 }}>
                      {fmtCurrency(c.balance)}
                    </TD>
                    <TD><StatusBadge status={c.status} /></TD>
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

// ─── Demographics Tab ─────────────────────────────────────────────────────────

function DemographicsTab({ patient }: { patient: Patient }) {
  const queryClient = useQueryClient()
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
  })
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: (data: Partial<typeof form>) =>
      apiPatch<Patient>(`/api/v1/patients/${patient.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', patient.id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const age = calcAge(form.dob)

  function field(label: string, key: keyof typeof form, opts?: { readOnly?: boolean; type?: string }) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          {label}
        </label>
        <input
          type={opts?.type ?? 'text'}
          value={String(form[key] ?? '')}
          readOnly={opts?.readOnly}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
          style={{
            height: 32, width: '100%', padding: '0 10px', fontSize: 13,
            border: '1px solid var(--bb-border)', borderRadius: 6,
            background: opts?.readOnly ? 'var(--bb-surface-app)' : 'var(--bb-surface-card)',
            color: 'var(--bb-text-primary)', outline: 'none',
          }}
        />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
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

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button
          variant="primary"
          size="sm"
          loading={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          Save Demographics
        </Button>
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

function InsuranceTab({ patientId, insurance, refetch: _refetch }: {
  patientId: string
  insurance: PatientInsuranceFull[]
  refetch: () => void
}) {
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [eligibilityResults, setEligibilityResults] = useState<Record<string, Record<string, unknown>>>({})

  async function checkEligibility(insId: string) {
    setCheckingId(insId)
    try {
      const res = await apiPost<Record<string, unknown>>(`/api/v1/patients/${patientId}/eligibility-check`)
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
        <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />}>
          Add Insurance
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

function VisitsTab({ patientId, visits }: { patientId: string; visits: Visit[] }) {
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
          onClick={() => navigate(`/visits/new?patient=${patientId}`)}
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

function ClaimsTab({ patientId: _patientId, claims }: { patientId: string; claims: Claim[] }) {
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
        <Button size="sm" variant="primary" leftIcon={<Plus size={13} />}>
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

function NotesTab({ patientId, activity }: { patientId: string; activity: ActivityEvent[] }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

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
    try {
      await apiPost(`/api/v1/patients/${patientId}/activity`, { note })
      setNote('')
    } catch {
      // ignore
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
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: patient, isLoading } = usePatient(id ?? '')

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ['patient-visits', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}/visits`),
    enabled: !!id,
  })

  const { data: claims = [] } = useQuery<Claim[]>({
    queryKey: ['patient-claims', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}/claims`),
    enabled: !!id,
  })

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['patient-payments', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}/payments`),
    enabled: !!id,
  })

  const { data: insurance = [], refetch: refetchInsurance } = useQuery<PatientInsuranceFull[]>({
    queryKey: ['patient-insurance', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}/insurance`),
    enabled: !!id,
  })

  const { data: activity = [] } = useQuery<ActivityEvent[]>({
    queryKey: ['patient-activity', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}/activity`),
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

  const totalCharges = claims.reduce((s, c) => s + (c.totalCharges ?? 0), 0)
  const totalPaid = claims.reduce((s, c) => s + (c.totalPaid ?? 0), 0)
  const balance = claims.reduce((s, c) => s + (c.balance ?? 0), 0)
  const openClaims = claims.filter(c => !['paid', 'void', 'denied'].includes(c.status)).length
  const lastVisit = visits[0]?.visitDate

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
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
            <Button size="sm" variant="secondary" leftIcon={<Edit3 size={13} />}>
              Edit Patient
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<ShieldCheck size={13} />}>
              Check Eligibility
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<FileText size={13} />}>
              Generate Statement
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Total Charges', value: fmtCurrency(totalCharges) },
            { label: 'Total Paid', value: fmtCurrency(totalPaid) },
            { label: 'Balance Due', value: fmtCurrency(balance) },
            { label: 'Open Claims', value: String(openClaims) },
            { label: 'Last Visit', value: lastVisit ? fmtDate(lastVisit) : '—' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--bb-surface-app)', borderRadius: 8, padding: '10px 14px',
              border: '1px solid var(--bb-border)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="overview">
        <TabList>
          <Tab id="overview">Overview</Tab>
          <Tab id="demographics">Demographics</Tab>
          <Tab id="insurance">Insurance</Tab>
          <Tab id="visits">Visits{visits.length > 0 ? ` (${visits.length})` : ''}</Tab>
          <Tab id="claims">Claims{claims.length > 0 ? ` (${claims.length})` : ''}</Tab>
          <Tab id="payments">Payments{payments.length > 0 ? ` (${payments.length})` : ''}</Tab>
          <Tab id="bodymap">Body Map</Tab>
          <Tab id="notes">Notes & Activity</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4">
          <OverviewTab patient={patient} visits={visits} claims={claims} insurance={insurance} />
        </TabPanel>

        <TabPanel id="demographics" className="pt-4">
          <DemographicsTab patient={patient} />
        </TabPanel>

        <TabPanel id="insurance" className="pt-4">
          <InsuranceTab patientId={id ?? ''} insurance={insurance} refetch={refetchInsurance} />
        </TabPanel>

        <TabPanel id="visits" className="pt-4">
          <VisitsTab patientId={id ?? ''} visits={visits} />
        </TabPanel>

        <TabPanel id="claims" className="pt-4">
          <ClaimsTab patientId={id ?? ''} claims={claims} />
        </TabPanel>

        <TabPanel id="payments" className="pt-4">
          <PaymentsTab payments={payments} />
        </TabPanel>

        <TabPanel id="bodymap" className="pt-4">
          <BodyMap patientId={id ?? ''} />
        </TabPanel>

        <TabPanel id="notes" className="pt-4">
          <NotesTab patientId={id ?? ''} activity={activity} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
