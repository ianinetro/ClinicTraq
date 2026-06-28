import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, MapPin, Shield, Calendar, Edit2, Plus, FileText, DollarSign } from 'lucide-react'

import { Badge } from '../../components/ui/Badge'
import { PHIField } from '../../components/shared/PHIField'
import { BodyMap } from './BodyMap'
import type { BodyAnnotation, BodySex } from './BodyMap'
import { apiClient as api } from '../../services/api'

const TABS = ['Demographics', 'Insurance', 'Body Map', 'Visits', 'Claims', 'Balance'] as const
type Tab = typeof TABS[number]

const MOCK_PATIENT = {
  id: 'p-001', mrn: 'MRN-001234',
  firstName: 'Mary', lastName: 'Johnson',
  dob: '1975-03-12', gender: 'Female', sex: 'female' as BodySex,
  phone: '(555) 234-5678', email: 'mary.j@example.com',
  address: '123 Main St, Springfield, IL 62701',
  ssn: '***-**-1234', status: 'active',
  emergencyContact: { name: 'Tom Johnson', phone: '(555) 234-9999', relationship: 'Spouse' },
  primaryInsurance: {
    payer: 'BlueCross PPO', memberId: 'BC123456', groupNumber: 'GRP-001',
    effectiveDate: '2024-01-01', planType: 'PPO', copay: '$25', deductible: '$1,500', deductibleMet: '$820',
  },
  secondaryInsurance: null,
  balance: 125.00,
  lastVisit: '2026-06-26',
  annotations: [] as BodyAnnotation[],
}

const MOCK_VISITS = [
  { id: 'v-1', date: '2026-06-26', provider: 'Dr. Smith', cpt: '99213, 85025', dx: 'Z00.00', status: 'Completed', billed: 185.00 },
  { id: 'v-2', date: '2026-03-10', provider: 'Dr. Smith', cpt: '99213', dx: 'J06.9', status: 'Completed', billed: 145.00 },
  { id: 'v-3', date: '2025-11-04', provider: 'Dr. Johnson', cpt: '99212', dx: 'M54.5', status: 'Completed', billed: 120.00 },
]

const MOCK_CLAIMS = [
  { id: 'c-1', claimId: 'A10042', dos: '2026-06-26', payer: 'BlueCross PPO', billed: 185.00, paid: 148.00, status: 'Paid' },
  { id: 'c-2', claimId: 'A09887', dos: '2026-03-10', payer: 'BlueCross PPO', billed: 145.00, paid: 116.00, status: 'Paid' },
]

const MOCK_LEDGER = [
  { date: '2026-06-26', desc: 'Charge — Office Visit', charge: 185.00, payment: 0, balance: 185.00 },
  { date: '2026-06-28', desc: 'Payment — BlueCross PPO', charge: 0, payment: -148.00, balance: 37.00 },
  { date: '2026-06-28', desc: 'Adjustment — Contractual', charge: 0, payment: -12.00, balance: 25.00 },
  { date: '2026-03-15', desc: 'Payment — BlueCross PPO', charge: 0, payment: -116.00, balance: 25.00 },
  { date: '2026-03-15', desc: 'Patient balance forward', charge: 100.00, payment: 0, balance: 125.00 },
]

function InfoRow({ label, value, phi }: { label: string; value?: string; phi?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      {phi ? <PHIField label={label} value={value ?? '—'} /> : <div style={{ fontSize: 14, color: '#12122C' }}>{value || '—'}</div>}
    </div>
  )
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('Demographics')
  const [annotations, setAnnotations] = useState<BodyAnnotation[]>([])

  const { data: patient = MOCK_PATIENT } = useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      try { return (await api.get(`/patients/${id}`)).data }
      catch { return { ...MOCK_PATIENT, id } }
    },
    enabled: !!id,
  })

  const sex: BodySex = (patient.gender?.toLowerCase() === 'female' || patient.sex === 'female') ? 'female' : 'male'

  const statusVariant = patient.status === 'active' ? 'success' : 'default'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/patients')} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13, color: '#676687', fontWeight: 500, padding: '6px 10px',
          borderRadius: 6, transition: 'background 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <ArrowLeft size={14} /> Patients
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: sex === 'female' ? '#F3E8FF' : '#EFF0FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: sex === 'female' ? '#7C3AED' : '#0410BD',
          }}>
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#12122C' }}>
                {patient.lastName}, {patient.firstName}
              </h2>
              <Badge variant={statusVariant}>{patient.status}</Badge>
              <span style={{ fontSize: 13, color: '#676687' }}>{sex === 'female' ? '♀' : '♂'} {patient.gender}</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#676687' }}>
              MRN: <strong style={{ color: '#12122C' }}>{patient.mrn}</strong> · DOB: {patient.dob} · Last visit: {patient.lastVisit}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: patient.balance > 0 ? '#DC2626' : '#16A34A', fontVariantNumeric: 'tabular-nums' }}>
              ${patient.balance?.toFixed(2)}
            </div>
            <div style={{ fontSize: 11, color: '#676687' }}>Patient balance</div>
          </div>
          <button style={{
            height: 36, padding: '0 14px', background: '#EFF0FF', color: '#0410BD',
            border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Edit2 size={13} /> Edit patient
          </button>
          <button onClick={() => navigate('/visits/new')} style={{
            height: 36, padding: '0 14px', background: '#0410BD', color: 'white',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={13} /> New visit
          </button>
        </div>
      </div>

      {/* Quick info strip */}
      <div style={{ display: 'flex', gap: 20, background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '12px 20px' }}>
        {[
          { icon: <Phone size={14} />, value: patient.phone },
          { icon: <Mail size={14} />, value: patient.email },
          { icon: <MapPin size={14} />, value: patient.address },
          { icon: <Shield size={14} />, value: patient.primaryInsurance?.payer ?? 'No insurance' },
          { icon: <Calendar size={14} />, value: `DOB: ${patient.dob}` },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#676687' }}>
            <span style={{ color: '#BABACE' }}>{item.icon}</span>
            {item.value}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E3E3F1', gap: 0 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: activeTab === tab ? '#0410BD' : '#676687',
            borderBottom: activeTab === tab ? '2px solid #0410BD' : '2px solid transparent',
            transition: 'color 0.12s', marginBottom: -1,
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: 24 }}>

        {activeTab === 'Demographics' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#12122C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Personal Information</h4>
              <InfoRow label="First Name" value={patient.firstName} />
              <InfoRow label="Last Name" value={patient.lastName} />
              <InfoRow label="Date of Birth" value={patient.dob} />
              <InfoRow label="Gender" value={patient.gender} />
              <InfoRow label="SSN" value={patient.ssn} phi />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#12122C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contact Information</h4>
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Address" value={patient.address} />
              <h4 style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 700, color: '#12122C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Emergency Contact</h4>
              <InfoRow label="Name" value={patient.emergencyContact?.name} />
              <InfoRow label="Phone" value={patient.emergencyContact?.phone} />
              <InfoRow label="Relationship" value={patient.emergencyContact?.relationship} />
            </div>
          </div>
        )}

        {activeTab === 'Insurance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {patient.primaryInsurance ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Primary Insurance</h4>
                  <Badge variant="info">Active</Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, background: '#F2F2F8', padding: 20, borderRadius: 8, border: '1px solid #E3E3F1' }}>
                  <InfoRow label="Payer" value={patient.primaryInsurance.payer} />
                  <InfoRow label="Member ID" value={patient.primaryInsurance.memberId} />
                  <InfoRow label="Group #" value={patient.primaryInsurance.groupNumber} />
                  <InfoRow label="Plan Type" value={patient.primaryInsurance.planType} />
                  <InfoRow label="Effective Date" value={patient.primaryInsurance.effectiveDate} />
                  <InfoRow label="Copay" value={patient.primaryInsurance.copay} />
                  <InfoRow label="Deductible" value={patient.primaryInsurance.deductible} />
                  <InfoRow label="Deductible Met" value={patient.primaryInsurance.deductibleMet} />
                </div>
              </div>
            ) : (
              <p style={{ color: '#676687', fontSize: 14 }}>No primary insurance on file</p>
            )}
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700 }}>Secondary Insurance</h4>
              <p style={{ color: '#676687', fontSize: 14 }}>No secondary insurance on file</p>
              <button style={{ marginTop: 8, height: 32, padding: '0 14px', background: '#EFF0FF', color: '#0410BD', border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> Add secondary insurance
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Body Map' && (
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#12122C' }}>Clinical Body Map</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#676687' }}>Click any region to record findings, symptoms, or diagnoses. Annotated areas appear highlighted in orange.</p>
              </div>
              <BodyMap sex={sex} annotations={annotations} onAnnotationsChange={setAnnotations} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#12122C' }}>Recorded Findings</h4>
              {annotations.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#BABACE', fontSize: 13 }}>
                  No findings recorded yet. Click a body region to add one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {annotations.map(a => (
                    <div key={a.id} style={{
                      padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FED7AA',
                      borderLeft: '3px solid #F97316', borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', textTransform: 'uppercase' }}>{a.type}</span>
                        <span style={{ fontSize: 11, color: '#676687', background: '#F2F2F8', borderRadius: 3, padding: '0 4px' }}>{a.severity}</span>
                        {a.icd10Code && <span style={{ fontSize: 11, color: '#676687', fontFamily: 'monospace' }}>{a.icd10Code}</span>}
                      </div>
                      <p style={{ margin: '0 0 2px', fontSize: 13, color: '#12122C' }}>{a.text}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#676687' }}>Region: {a.region.replace(/-/g, ' ')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Visits' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: '#676687' }}>{MOCK_VISITS.length} visits on record</span>
              <button onClick={() => navigate('/visits/new')} style={{
                height: 32, padding: '0 14px', background: '#0410BD', color: 'white',
                border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}><Plus size={13} /> New visit</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E3F1' }}>
                  {['Date', 'Provider', 'CPT Codes', 'Dx', 'Status', 'Billed'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_VISITS.map(v => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #F2F2F8', cursor: 'pointer' }}
                    onClick={() => navigate(`/visits/${v.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F8')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px', color: '#12122C', fontWeight: 500 }}>{v.date}</td>
                    <td style={{ padding: '10px 12px', color: '#676687' }}>{v.provider}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{v.cpt}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{v.dx}</td>
                    <td style={{ padding: '10px 12px' }}><Badge variant="success">{v.status}</Badge></td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${v.billed.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Claims' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E3F1' }}>
                  {['Claim ID', 'DOS', 'Payer', 'Billed', 'Paid', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_CLAIMS.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F2F2F8', cursor: 'pointer' }}
                    onClick={() => navigate(`/claims/${c.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F8')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px' }}><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0410BD' }}>{c.claimId}</span></td>
                    <td style={{ padding: '10px 12px', color: '#676687' }}>{c.dos}</td>
                    <td style={{ padding: '10px 12px' }}>{c.payer}</td>
                    <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>${c.billed.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px', color: '#16A34A', fontWeight: 600 }}>${c.paid.toFixed(2)}</td>
                    <td style={{ padding: '10px 12px' }}><Badge variant="success">{c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Balance' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {[
                { label: 'Current Balance', value: `$${patient.balance?.toFixed(2)}`, color: patient.balance > 0 ? '#DC2626' : '#16A34A', icon: <DollarSign size={16} /> },
                { label: 'Total Billed', value: '$450.00', color: '#12122C', icon: <FileText size={16} /> },
                { label: 'Total Paid', value: '$325.00', color: '#16A34A', icon: <DollarSign size={16} /> },
              ].map(s => (
                <div key={s.label} style={{ background: '#F2F2F8', borderRadius: 8, padding: '12px 16px', flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#676687', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E3E3F1' }}>
                  {['Date', 'Description', 'Charge', 'Payment', 'Balance'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_LEDGER.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F2F2F8' }}>
                    <td style={{ padding: '10px 12px', color: '#676687' }}>{row.date}</td>
                    <td style={{ padding: '10px 12px' }}>{row.desc}</td>
                    <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', color: row.charge > 0 ? '#12122C' : 'transparent' }}>{row.charge > 0 ? `$${row.charge.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', color: row.payment < 0 ? '#16A34A' : 'transparent' }}>{row.payment < 0 ? `($${Math.abs(row.payment).toFixed(2)})` : '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: row.balance > 0 ? '#DC2626' : '#16A34A' }}>${row.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
