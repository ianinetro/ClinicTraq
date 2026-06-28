import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, Mail, Edit3, ShieldCheck, FileText,
  Plus, CheckCircle, Clock, ChevronRight, Activity,
  CreditCard, User, Shield, DollarSign, Stethoscope,
  MessageSquare, X, ChevronLeft, Search,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../../services/api'
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { Badge } from '../../components/ui/Badge'
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

interface NewVisitForm {
  visit_date: string
  visit_type: string
  provider_name: string
  chief_complaint: string
}

interface DiagnosisEntry {
  code: string
  description: string
}

// ─── Data fetching helpers ───────────────────────────────────────────────────

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

// ─── Common ICD-10 quick picks ───────────────────────────────────────────────

const COMMON_ICD10: DiagnosisEntry[] = [
  { code: 'Z00.00', description: 'Encounter for general adult medical exam without abnormal findings' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
]

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

// ─── Shared style constants ───────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  height: 34, width: '100%', padding: '0 10px', fontSize: 13, boxSizing: 'border-box',
  border: '1px solid var(--bb-border)', borderRadius: 6,
  background: 'var(--bb-surface-card)', color: 'var(--bb-text-primary)', outline: 'none',
}

const readLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3,
}

const readValueStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--bb-text-primary)', fontWeight: 500,
}

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

// ─── New Visit Modal ──────────────────────────────────────────────────────────

function NewVisitModal({
  patientId,
  patientName,
  onClose,
  onSaved,
}: {
  patientId: string
  patientName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const todayISO = new Date().toISOString().split('T')[0]

  const [encounter, setEncounter] = useState<NewVisitForm>({
    visit_date: todayISO,
    visit_type: 'office_visit',
    provider_name: '',
    chief_complaint: '',
  })

  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([])
  const [icdSearch, setIcdSearch] = useState('')

  const filteredCommon = icdSearch.trim()
    ? COMMON_ICD10.filter(d =>
        d.code.toLowerCase().includes(icdSearch.toLowerCase()) ||
        d.description.toLowerCase().includes(icdSearch.toLowerCase())
      )
    : COMMON_ICD10

  function toggleDiagnosis(d: DiagnosisEntry) {
    setDiagnoses(prev => {
      const exists = prev.find(x => x.code === d.code)
      return exists ? prev.filter(x => x.code !== d.code) : [...prev, d]
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const visitPayload = {
        patient_id: patientId,
        visit_date: encounter.visit_date,
        visit_type: encounter.visit_type,
        chief_complaint: encounter.chief_complaint,
        provider_name: encounter.provider_name,
      }
      const created = await apiPost<{ id: string }>('/api/v1/visits', visitPayload)

      for (const d of diagnoses) {
        await apiPost(`/api/v1/visits/${created.id}/diagnoses`, {
          code: d.code,
          description: d.description,
        })
      }

      onSaved()
      onClose()
    } catch {
      setSaveError('Failed to save visit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const stepLabels = ['Encounter Details', 'Diagnoses', 'Review & Save']

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(18, 18, 44, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bb-surface-card)',
        borderRadius: 'var(--bb-radius-lg)',
        boxShadow: 'var(--bb-shadow-sm)',
        width: '100%', maxWidth: 600,
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--bb-border)',
          background: 'var(--bb-surface-app)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--bb-text-primary)' }}>New Visit</div>
            <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>{patientName}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-text-secondary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '12px 20px', borderBottom: '1px solid var(--bb-border)',
        }}>
          {stepLabels.map((label, i) => {
            const num = i + 1
            const active = step === num
            const done = step > num
            return (
              <React.Fragment key={num}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: active ? 'var(--bb-brand-blue)' : done ? 'var(--bb-status-success)' : 'var(--bb-border)',
                    color: active || done ? '#fff' : 'var(--bb-text-secondary)',
                  }}>
                    {done ? <CheckCircle size={12} /> : num}
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    color: active ? 'var(--bb-text-primary)' : 'var(--bb-text-secondary)',
                  }}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: 'var(--bb-border)', margin: '0 12px' }} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Step content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Visit Date</label>
                  <input
                    type="date"
                    value={encounter.visit_date}
                    onChange={e => setEncounter(p => ({ ...p, visit_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Visit Type</label>
                  <select
                    value={encounter.visit_type}
                    onChange={e => setEncounter(p => ({ ...p, visit_type: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="office_visit">Office Visit</option>
                    <option value="new_patient">New Patient</option>
                    <option value="follow_up">Follow-Up</option>
                    <option value="telehealth">Telehealth</option>
                    <option value="urgent_care">Urgent Care</option>
                    <option value="annual_wellness">Annual Wellness</option>
                    <option value="procedure">Procedure</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Provider</label>
                <input
                  type="text"
                  value={encounter.provider_name}
                  onChange={e => setEncounter(p => ({ ...p, provider_name: e.target.value }))}
                  placeholder="Provider name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Chief Complaint</label>
                <textarea
                  value={encounter.chief_complaint}
                  onChange={e => setEncounter(p => ({ ...p, chief_complaint: e.target.value }))}
                  placeholder="Patient's chief complaint…"
                  rows={3}
                  style={{ ...inputStyle, height: 'auto', resize: 'vertical', padding: '8px 10px' }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--bb-text-secondary)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={icdSearch}
                  onChange={e => setIcdSearch(e.target.value)}
                  placeholder="Search ICD-10 codes…"
                  style={{ ...inputStyle, paddingLeft: 32 }}
                />
              </div>

              {diagnoses.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Selected ({diagnoses.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {diagnoses.map(d => (
                      <div
                        key={d.code}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'var(--bb-brand-blue)', color: '#fff',
                          borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 500,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace' }}>{d.code}</span>
                        <span style={{ opacity: 0.85, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</span>
                        <button
                          onClick={() => toggleDiagnosis(d)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 0, display: 'flex', alignItems: 'center' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  {icdSearch ? 'Search Results' : 'Common Diagnoses'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filteredCommon.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)', padding: '12px 0' }}>No matches found.</div>
                  )}
                  {filteredCommon.map(d => {
                    const selected = diagnoses.some(x => x.code === d.code)
                    return (
                      <button
                        key={d.code}
                        onClick={() => toggleDiagnosis(d)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                          background: selected ? 'rgba(4,16,189,0.06)' : 'var(--bb-surface-app)',
                          border: `1px solid ${selected ? 'var(--bb-brand-blue)' : 'var(--bb-border)'}`,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--bb-brand-blue)', minWidth: 60 }}>{d.code}</span>
                        <span style={{ fontSize: 12, color: 'var(--bb-text-primary)', flex: 1 }}>{d.description}</span>
                        {selected && <CheckCircle size={14} color="var(--bb-brand-blue)" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--bb-surface-app)', borderRadius: 8, border: '1px solid var(--bb-border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Encounter Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <InfoCell label="Visit Date" value={fmtDate(encounter.visit_date)} />
                  <InfoCell label="Visit Type" value={encounter.visit_type.replace(/_/g, ' ')} />
                  <InfoCell label="Provider" value={encounter.provider_name || '—'} />
                  <InfoCell label="Patient" value={patientName} />
                </div>
                {encounter.chief_complaint && (
                  <div>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Chief Complaint</span>
                    <span style={{ fontSize: 13, color: 'var(--bb-text-primary)' }}>{encounter.chief_complaint}</span>
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bb-surface-app)', borderRadius: 8, border: '1px solid var(--bb-border)', padding: '14px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Diagnoses ({diagnoses.length})
                </div>
                {diagnoses.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>No diagnoses selected.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diagnoses.map(d => (
                      <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{d.code}</span>
                        <span style={{ color: 'var(--bb-text-primary)' }}>{d.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {saveError && (
                <div style={{ fontSize: 13, color: 'var(--bb-status-danger)', padding: '8px 12px', background: 'rgba(220,38,38,0.06)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)' }}>
                  {saveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderTop: '1px solid var(--bb-border)',
          background: 'var(--bb-surface-app)',
        }}>
          <Button
            size="sm" variant="secondary"
            leftIcon={step > 1 ? <ChevronLeft size={13} /> : undefined}
            onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>Step {step} of 3</span>
            {step < 3 ? (
              <Button
                size="sm" variant="primary"
                rightIcon={<ChevronRight size={13} />}
                onClick={() => setStep(s => s + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                size="sm" variant="primary"
                loading={saving}
                onClick={() => void handleSave()}
              >
                Save Visit
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ patient, visits, claims, insurance, onNewVisit }: {
  patient: Patient
  visits: Visit[]
  claims: Claim[]
  insurance: PatientInsuranceFull[]
  onNewVisit: () => void
}) {
  const navigate = useNavigate()
  const openClaims = claims.filter(c => !['paid', 'void', 'denied'].includes(c.status)).length
  const lastVisit = visits[0]?.visitDate
  const activeInsurance = insurance.filter(i => i.is_active)
  const primaryIns = insurance.find(i => i.priority === 'primary' && i.is_active)

  const p = patient as PatientFull
  const dob = p.dob ?? p.dateOfBirth
  const age = calcAge(dob)
  const sexLabel = (p.sex ?? p.gender) === 'M' ? 'Male' : (p.sex ?? p.gender) === 'F' ? 'Female' : (p.sex ?? p.gender) ?? '—'

  const recentVisits = visits.slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 3-stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Last Visit', value: lastVisit ? fmtDate(lastVisit) : '—' },
          { label: 'Open Claims', value: String(openClaims) },
          {
            label: 'Active Insurance',
            value: activeInsurance.length > 0 ? activeInsurance.map(i => i.payer_name ?? 'Insurance').join(', ') : '—',
          },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius)', padding: '12px 16px',
            border: '1px solid var(--bb-border)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--bb-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: demographics (55%) + body map (45%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 16, alignItems: 'start' }}>
        {/* Left: demographics info panel */}
        <SectionCard>
          <SectionHeader title="Patient Demographics" />
          <div style={{ padding: '16px' }}>
            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 4 }}>
                {p.first_name ?? p.firstName}{p.middle_name ? ` ${p.middle_name}` : ''} {p.last_name ?? p.lastName}
              </div>
              <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>
                MRN: <strong style={{ color: 'var(--bb-text-primary)' }}>{p.account_number ?? p.accountNumber ?? '—'}</strong>
              </div>
            </div>

            {/* Key identity fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={readLabelStyle}>Date of Birth</div>
                <div style={readValueStyle}>{fmtDate(dob)}</div>
              </div>
              <div>
                <div style={readLabelStyle}>Age</div>
                <div style={readValueStyle}>{age}</div>
              </div>
              <div>
                <div style={readLabelStyle}>Sex</div>
                <div style={readValueStyle}>{sexLabel}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--bb-border)', marginBottom: 14 }} />

            {/* Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {(patient.phone ?? p.phone_cell ?? p.phone_home) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={13} color="var(--bb-text-secondary)" />
                  <PHIField value={patient.phone ?? p.phone_cell ?? p.phone_home ?? ''} fieldName="Phone" patientId={patient.id} fieldType="phone" inline />
                </div>
              )}
              {patient.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={13} color="var(--bb-text-secondary)" />
                  <PHIField value={patient.email} fieldName="Email" patientId={patient.id} fieldType="email" inline />
                </div>
              )}
              {(patient.address || p.address_line1) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <MapPin size={13} color="var(--bb-text-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <PHIField
                    value={
                      patient.address
                        ? `${patient.address.line1}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}`
                        : `${p.address_line1 ?? ''}, ${p.city ?? ''}, ${p.state ?? ''} ${p.zip ?? ''}`
                    }
                    fieldName="Address" patientId={patient.id} fieldType="address" inline
                  />
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--bb-border)', marginBottom: 14 }} />

            {/* Insurance summary */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Insurance</div>
              {primaryIns ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Shield size={13} color="var(--bb-text-secondary)" style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                      {primaryIns.payer_name ?? `Payer ID: ${primaryIns.payer_id ?? '—'}`}
                    </div>
                    {primaryIns.plan_name && (
                      <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{primaryIns.plan_name}</div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>
                      Member ID: <strong style={{ color: 'var(--bb-text-primary)' }}>{primaryIns.subscriber_id ?? '—'}</strong>
                      {primaryIns.group_number && (
                        <> · Group: <strong style={{ color: 'var(--bb-text-primary)' }}>{primaryIns.group_number}</strong></>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>No active insurance on file</div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Right: Body Map */}
        <SectionCard>
          <SectionHeader title="Body Map" />
          <div style={{ padding: '12px' }}>
            <BodyMap patientId={patient.id} compact />
          </div>
        </SectionCard>
      </div>

      {/* Recent Visits as cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)' }}>Recent Visits</span>
          <Button size="sm" variant="primary" leftIcon={<Plus size={13} />} onClick={onNewVisit}>
            New Visit
          </Button>
        </div>

        {recentVisits.length === 0 ? (
          <SectionCard>
            <EmptyState icon={Stethoscope} message="No visits on record" />
          </SectionCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentVisits.map(v => (
              <div
                key={v.id}
                onClick={() => navigate(`/visits/${v.id}`)}
                style={{
                  background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)',
                  borderRadius: 'var(--bb-radius)', padding: '14px 16px',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--bb-shadow-sm)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)' }}>{fmtDate(v.visitDate)}</div>
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>
                      {v.visitType ?? 'Visit'}{v.provider ? ` · ${v.provider.firstName} ${v.provider.lastName}` : ''}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <StatusBadge status={v.status} />
                  </div>
                </div>

                {v.notes && (
                  <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontStyle: 'italic' }}>
                    "{v.notes}"
                  </div>
                )}

                {v.diagnoses && v.diagnoses.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {v.diagnoses.slice(0, 4).map(d => (
                      <span key={d.id} style={{
                        display: 'inline-block', fontSize: 11,
                        background: 'var(--bb-surface-app)', borderRadius: 4,
                        padding: '2px 7px',
                        border: '1px solid var(--bb-border)',
                        color: 'var(--bb-text-secondary)',
                        fontFamily: 'monospace',
                      }}>
                        {d.code}
                      </span>
                    ))}
                    {v.diagnoses.length > 4 && (
                      <span style={{ fontSize: 11, color: 'var(--bb-text-secondary)', alignSelf: 'center' }}>
                        +{v.diagnoses.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Demographics Tab ─────────────────────────────────────────────────────────

function DemographicsTab({ patient }: { patient: Patient }) {
  const queryClient = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [saved, setSaved] = useState(false)

  const p = patient as PatientFull
  const [form, setForm] = useState({
    first_name: p.first_name ?? patient.firstName ?? '',
    middle_name: p.middle_name ?? '',
    last_name: p.last_name ?? patient.lastName ?? '',
    suffix: '',
    dob: p.dob ?? patient.dateOfBirth ?? '',
    sex: p.sex ?? patient.gender ?? '',
    ssn: '',
    marital_status: p.marital_status ?? '',
    race: p.race ?? '',
    ethnicity: p.ethnicity ?? '',
    preferred_language: p.preferred_language ?? '',
    gender_identity: p.gender_identity ?? '',
    account_type: p.account_type ?? 'patient',
    status: patient.status ?? 'active',
    email: patient.email ?? '',
    phone_home: p.phone_home ?? '',
    phone_cell: p.phone_cell ?? '',
    phone_work: p.phone_work ?? '',
    address_line1: p.address_line1 ?? patient.address?.line1 ?? '',
    address_line2: p.address_line2 ?? patient.address?.line2 ?? '',
    city: p.city ?? patient.address?.city ?? '',
    state: p.state ?? patient.address?.state ?? '',
    zip: p.zip ?? patient.address?.zip ?? '',
    employer_name: '',
    occupation: '',
  })

  const mutation = useMutation({
    mutationFn: (data: Partial<typeof form>) =>
      apiPatch<Patient>(`/api/v1/patients/${patient.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patients', patient.id] })
      setSaved(true)
      setEditMode(false)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const age = calcAge(form.dob)

  function ReadRow({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <div style={readLabelStyle}>{label}</div>
        <div style={{ ...readValueStyle, minHeight: 20 }}>{value || '—'}</div>
      </div>
    )
  }

  function EditField(label: string, key: keyof typeof form, opts?: { readOnly?: boolean; type?: string }) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={String(form[key] ?? '')}
          readOnly={opts?.readOnly}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          style={{
            ...inputStyle,
            background: opts?.readOnly ? 'var(--bb-surface-app)' : 'var(--bb-surface-card)',
            color: opts?.readOnly ? 'var(--bb-text-secondary)' : 'var(--bb-text-primary)',
          }}
        />
      </div>
    )
  }

  function EditSelect(label: string, key: keyof typeof form, options: { value: string; label: string }[]) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <select
          value={String(form[key] ?? '')}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          style={inputStyle}
        >
          <option value="">—</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    )
  }

  const sexLabel = form.sex === 'M' ? 'Male' : form.sex === 'F' ? 'Female' : form.sex || '—'
  const maritalLabels: Record<string, string> = { single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed', separated: 'Separated', other: 'Other' }
  const raceLabels: Record<string, string> = { white: 'White', black: 'Black / African American', asian: 'Asian', aian: 'American Indian / Alaska Native', nhopi: 'Native Hawaiian / Pacific Islander', other: 'Other', unknown: 'Unknown' }
  const ethnicityLabels: Record<string, string> = { hispanic: 'Hispanic or Latino', not_hispanic: 'Not Hispanic or Latino', unknown: 'Unknown' }
  const langLabels: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', zh: 'Chinese', vi: 'Vietnamese', other: 'Other' }
  const genderIdLabels: Record<string, string> = { male: 'Male', female: 'Female', nonbinary: 'Non-binary', transgender_male: 'Transgender Male', transgender_female: 'Transgender Female', other: 'Other', unknown: 'Unknown / Prefer not to say' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header with edit toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>
          {editMode ? 'Editing patient demographics' : 'Viewing patient demographics (read-only)'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!editMode && (
            <Button size="sm" variant="secondary" leftIcon={<Edit3 size={13} />} onClick={() => setEditMode(true)}>
              Edit Patient
            </Button>
          )}
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--bb-status-success)' }}>
              <CheckCircle size={14} />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Name section */}
      <SectionCard>
        <SectionHeader title="Name" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 120px', gap: 12 }}>
          {editMode ? (
            <>
              {EditField('First Name', 'first_name')}
              {EditField('Middle Name', 'middle_name')}
              {EditField('Last Name', 'last_name')}
              {EditField('Suffix', 'suffix')}
              <div>
                <label style={labelStyle}>Account #</label>
                <input readOnly value={p.account_number ?? ''} style={{ ...inputStyle, background: 'var(--bb-surface-app)', color: 'var(--bb-text-secondary)' }} />
              </div>
            </>
          ) : (
            <>
              <ReadRow label="First Name" value={form.first_name} />
              <ReadRow label="Middle Name" value={form.middle_name} />
              <ReadRow label="Last Name" value={form.last_name} />
              <ReadRow label="Suffix" value={form.suffix} />
              <ReadRow label="Account #" value={p.account_number ?? '—'} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Identity */}
      <SectionCard>
        <SectionHeader title="Identity & Demographics" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {editMode ? (
            <>
              {EditField('Date of Birth', 'dob', { type: 'date' })}
              <div>
                <label style={labelStyle}>Age</label>
                <input readOnly value={age} style={{ ...inputStyle, background: 'var(--bb-surface-app)', color: 'var(--bb-text-secondary)' }} />
              </div>
              {EditSelect('Sex', 'sex', [{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }, { value: 'U', label: 'Unknown' }])}
              <div>
                <label style={labelStyle}>SSN (masked)</label>
                <PHIField value={patient.ssn ?? p.ssn_last_four ?? '***-**-****'} fieldName="SSN" patientId={patient.id} fieldType="ssn" />
              </div>
              {EditSelect('Marital Status', 'marital_status', [
                { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' },
                { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' },
                { value: 'separated', label: 'Separated' }, { value: 'other', label: 'Other' },
              ])}
              {EditSelect('Race', 'race', [
                { value: 'white', label: 'White' }, { value: 'black', label: 'Black / African American' },
                { value: 'asian', label: 'Asian' }, { value: 'aian', label: 'American Indian / Alaska Native' },
                { value: 'nhopi', label: 'Native Hawaiian / Pacific Islander' },
                { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown' },
              ])}
              {EditSelect('Ethnicity', 'ethnicity', [
                { value: 'hispanic', label: 'Hispanic or Latino' },
                { value: 'not_hispanic', label: 'Not Hispanic or Latino' },
                { value: 'unknown', label: 'Unknown' },
              ])}
              {EditSelect('Language', 'preferred_language', [
                { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' },
                { value: 'fr', label: 'French' }, { value: 'zh', label: 'Chinese' },
                { value: 'vi', label: 'Vietnamese' }, { value: 'other', label: 'Other' },
              ])}
              {EditSelect('Gender Identity', 'gender_identity', [
                { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
                { value: 'nonbinary', label: 'Non-binary' }, { value: 'transgender_male', label: 'Transgender Male' },
                { value: 'transgender_female', label: 'Transgender Female' },
                { value: 'other', label: 'Other' }, { value: 'unknown', label: 'Unknown / Prefer not to say' },
              ])}
              {EditSelect('Account Type', 'account_type', [
                { value: 'patient', label: 'Patient' }, { value: 'guarantor', label: 'Guarantor' }, { value: 'dependent', label: 'Dependent' },
              ])}
              {EditSelect('Status', 'status', [
                { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'archived', label: 'Archived' },
              ])}
            </>
          ) : (
            <>
              <ReadRow label="Date of Birth" value={fmtDate(form.dob)} />
              <ReadRow label="Age" value={age} />
              <ReadRow label="Sex" value={sexLabel} />
              <div>
                <div style={readLabelStyle}>SSN (masked)</div>
                <PHIField value={patient.ssn ?? p.ssn_last_four ?? '***-**-****'} fieldName="SSN" patientId={patient.id} fieldType="ssn" />
              </div>
              <ReadRow label="Marital Status" value={maritalLabels[form.marital_status] ?? form.marital_status} />
              <ReadRow label="Race" value={raceLabels[form.race] ?? form.race} />
              <ReadRow label="Ethnicity" value={ethnicityLabels[form.ethnicity] ?? form.ethnicity} />
              <ReadRow label="Language" value={langLabels[form.preferred_language] ?? form.preferred_language} />
              <ReadRow label="Gender Identity" value={genderIdLabels[form.gender_identity] ?? form.gender_identity} />
              <ReadRow label="Account Type" value={form.account_type} />
              <ReadRow label="Status" value={form.status} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Contact */}
      <SectionCard>
        <SectionHeader title="Contact Information" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {editMode ? (
            <>
              {EditField('Email', 'email', { type: 'email' })}
              {EditField('Home Phone', 'phone_home', { type: 'tel' })}
              {EditField('Cell Phone', 'phone_cell', { type: 'tel' })}
              {EditField('Work Phone', 'phone_work', { type: 'tel' })}
              {EditField('Address Line 1', 'address_line1')}
              {EditField('Address Line 2', 'address_line2')}
              {EditField('City', 'city')}
              {EditField('State', 'state')}
              {EditField('ZIP', 'zip')}
            </>
          ) : (
            <>
              <ReadRow label="Email" value={form.email} />
              <ReadRow label="Home Phone" value={form.phone_home} />
              <ReadRow label="Cell Phone" value={form.phone_cell} />
              <ReadRow label="Work Phone" value={form.phone_work} />
              <ReadRow label="Address Line 1" value={form.address_line1} />
              <ReadRow label="Address Line 2" value={form.address_line2} />
              <ReadRow label="City" value={form.city} />
              <ReadRow label="State" value={form.state} />
              <ReadRow label="ZIP" value={form.zip} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Employer */}
      <SectionCard>
        <SectionHeader title="Employment" />
        <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {editMode ? (
            <>
              {EditField('Employer Name', 'employer_name')}
              {EditField('Occupation', 'occupation')}
              {EditField('Work Phone', 'phone_work', { type: 'tel' })}
            </>
          ) : (
            <>
              <ReadRow label="Employer Name" value={form.employer_name} />
              <ReadRow label="Occupation" value={form.occupation} />
              <ReadRow label="Work Phone" value={form.phone_work} />
            </>
          )}
        </div>
      </SectionCard>

      {/* Save / Cancel — only shown in edit mode */}
      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="primary"
            size="sm"
            loading={mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            Save Demographics
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditMode(false)}
          >
            Cancel
          </Button>
          {mutation.isError && (
            <span style={{ fontSize: 13, color: 'var(--bb-status-danger)' }}>Save failed. Please try again.</span>
          )}
        </div>
      )}
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
      setEligibilityResults(prev => ({ ...prev, [insId]: res }))
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

// ─── Visits Tab ───────────────────────────────────────────────────────────────

function VisitsTab({ patientId: _patientId, visits, onNewVisit }: {
  patientId: string
  visits: Visit[]
  onNewVisit: () => void
}) {
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

      <SectionCard>
        <SectionHeader title="Activity Timeline" />
        {activity.length === 0 ? (
          <EmptyState icon={Activity} message="No activity recorded yet" />
        ) : (
          <div style={{ padding: '16px', position: 'relative' }}>
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
  const queryClient = useQueryClient()
  const { data: patient, isLoading } = usePatient(id ?? '')
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)

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

  function handleVisitSaved() {
    void queryClient.invalidateQueries({ queryKey: ['patient-visits', id] })
  }

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

  const openClaims = claims.filter(c => !['paid', 'void', 'denied'].includes(c.status)).length
  const lastVisit = visits[0]?.visitDate

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* New Visit Modal */}
      {showNewVisitModal && (
        <NewVisitModal
          patientId={id ?? ''}
          patientName={fullName}
          onClose={() => setShowNewVisitModal(false)}
          onSaved={handleVisitSaved}
        />
      )}

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

        {/* 3-stat strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Last Visit', value: lastVisit ? fmtDate(lastVisit) : '—' },
            { label: 'Open Claims', value: String(openClaims) },
            {
              label: 'Active Insurance',
              value: insurance.filter(i => i.is_active).length > 0
                ? insurance.filter(i => i.is_active).map(i => i.payer_name ?? 'Insurance').join(', ')
                : '—',
            },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--bb-surface-app)', borderRadius: 8, padding: '10px 14px',
              border: '1px solid var(--bb-border)',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--bb-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs — Body Map tab removed; body map is now in the Overview */}
      <Tabs defaultTab="overview">
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
          <OverviewTab
            patient={patient}
            visits={visits}
            claims={claims}
            insurance={insurance}
            onNewVisit={() => setShowNewVisitModal(true)}
          />
        </TabPanel>

        <TabPanel id="demographics" className="pt-4">
          <DemographicsTab patient={patient} />
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
          <NotesTab patientId={id ?? ''} activity={activity} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
