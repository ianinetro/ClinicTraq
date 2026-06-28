import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Send, Plus, Stethoscope, ClipboardList, DollarSign, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

interface ServiceLine {
  cpt: string
  description: string
  mods: string[]
  units: number
  fee: number
  diagPtrs: string
}

interface Diagnosis {
  pointer: string
  icd10: string
  description: string
}

interface VisitData {
  id: string
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'
  billingStatus: 'Unbilled' | 'Ready to Bill' | 'Billed' | 'Denied'
  visitDate: string
  visitType: string
  patient: { name: string; dob: string; mrn: string; insurance: string; memberId: string }
  provider: { name: string; npi: string; facility: string; posCode: string }
  chiefComplaint: string
  diagnoses: Diagnosis[]
  serviceLines: ServiceLine[]
  notes: string
  totalBilled: number
  claimId?: string
}

const MOCK_VISITS: Record<string, VisitData> = {
  '1': {
    id: '1', status: 'Scheduled', billingStatus: 'Unbilled',
    visitDate: '2026-06-28', visitType: 'Office Visit – Established Patient',
    patient: { name: 'Brown, James', dob: '1990-01-28', mrn: 'MRN-001237', insurance: 'Cigna PPO', memberId: 'CIG-44382211' },
    provider: { name: 'Dr. Jennifer Smith', npi: '1234567890', facility: 'Springfield Medical Group', posCode: '11' },
    chiefComplaint: 'Follow-up for upper respiratory symptoms',
    diagnoses: [{ pointer: 'A', icd10: 'J06.9', description: 'Acute upper respiratory infection, unspecified' }],
    serviceLines: [{ cpt: '99213', description: 'Office Visit, Level 3 (Est)', mods: [], units: 1, fee: 150.00, diagPtrs: 'A' }],
    notes: '', totalBilled: 0,
  },
  '2': {
    id: '2', status: 'Completed', billingStatus: 'Billed',
    visitDate: '2026-06-26', visitType: 'Office Visit – Established Patient',
    patient: { name: 'Johnson, Mary', dob: '1975-03-12', mrn: 'MRN-001234', insurance: 'BlueCross PPO', memberId: 'BCB-98765001' },
    provider: { name: 'Dr. Jennifer Smith', npi: '1234567890', facility: 'Springfield Medical Group', posCode: '11' },
    chiefComplaint: 'Low back pain, worsening over 2 weeks',
    diagnoses: [
      { pointer: 'A', icd10: 'M54.5', description: 'Low back pain' },
      { pointer: 'B', icd10: 'M79.3', description: 'Panniculitis' },
    ],
    serviceLines: [
      { cpt: '99213', description: 'Office Visit, Level 3 (Est)', mods: [], units: 1, fee: 150.00, diagPtrs: 'A,B' },
      { cpt: '85025', description: 'CBC with Differential', mods: [], units: 1, fee: 35.00, diagPtrs: 'A' },
    ],
    notes: 'Patient reports pain is 6/10 at rest, 9/10 with activity. Prescribed NSAIDs and referred to PT.',
    totalBilled: 185.00,
    claimId: 'A10042',
  },
}

const DEFAULT_VISIT = MOCK_VISITS['2']

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Completed') return 'success'
  if (s === 'Scheduled') return 'info'
  if (s === 'In Progress') return 'warning'
  if (s === 'Cancelled') return 'danger'
  return 'default'
}

const billingVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Billed') return 'success'
  if (s === 'Ready to Bill') return 'warning'
  if (s === 'Denied') return 'danger'
  return 'default'
}

type Section = 'details' | 'diagnoses' | 'lines' | 'notes'

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const visit = (id && MOCK_VISITS[id]) ? MOCK_VISITS[id] : DEFAULT_VISIT
  const [openSection, setOpenSection] = useState<Section>('lines')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(visit.notes)

  const toggle = (s: Section) => setOpenSection(prev => prev === s ? 'lines' : s)

  const SectionCard = ({ title, section, icon, children }: { title: string; section: Section; icon: React.ReactNode; children: React.ReactNode }) => (
    <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => toggle(section)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--bb-text-primary)', borderBottom: openSection === section ? '1px solid var(--bb-border)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</div>
        {openSection === section ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {openSection === section && children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/visits')}>
          <ArrowLeft size={14} /> Visits
        </Button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{visit.visitType}</h2>
            <Badge variant={statusVariant(visit.status)}>{visit.status}</Badge>
            <Badge variant={billingVariant(visit.billingStatus)}>{visit.billingStatus}</Badge>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            {visit.patient.name} · {visit.visitDate} · {visit.provider.name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {visit.claimId && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/claims/${visit.claimId}`)}>
              <FileText size={13} /> View Claim
            </Button>
          )}
          {visit.billingStatus === 'Ready to Bill' && (
            <Button variant="primary" size="sm">
              <Send size={13} /> Create Claim
            </Button>
          )}
          {visit.status === 'Completed' && visit.billingStatus === 'Unbilled' && (
            <Button variant="secondary" size="sm">
              <DollarSign size={13} /> Mark Ready to Bill
            </Button>
          )}
        </div>
      </div>

      {/* Patient + Provider summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>Patient</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Name', value: visit.patient.name },
              { label: 'DOB', value: visit.patient.dob },
              { label: 'MRN', value: visit.patient.mrn },
              { label: 'Insurance', value: visit.patient.insurance },
              { label: 'Member ID', value: visit.patient.memberId },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>Provider & Facility</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Rendering Provider', value: visit.provider.name },
              { label: 'NPI', value: visit.provider.npi },
              { label: 'Facility', value: visit.provider.facility },
              { label: 'POS Code', value: visit.provider.posCode },
              { label: 'Chief Complaint', value: visit.chiefComplaint },
            ].map(f => (
              <div key={f.label} style={{ gridColumn: f.label === 'Chief Complaint' ? '1 / -1' : undefined }}>
                <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diagnoses */}
      <SectionCard title="Diagnoses" section="diagnoses" icon={<Stethoscope size={14} />}>
        <div style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bb-surface-app)' }}>
                {['Ptr', 'ICD-10', 'Description', ''].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visit.diagnoses.map(d => (
                <tr key={d.icd10} style={{ borderTop: '1px solid var(--bb-border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--bb-brand-blue)', width: 48 }}>{d.pointer}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{d.icd10}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{d.description}</td>
                  <td style={{ padding: '10px 16px', width: 60 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={13} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bb-border)' }}>
            <Button variant="secondary" size="sm"><Plus size={13} /> Add Diagnosis</Button>
          </div>
        </div>
      </SectionCard>

      {/* Service Lines */}
      <SectionCard title="Procedures / Service Lines" section="lines" icon={<ClipboardList size={14} />}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--bb-surface-app)' }}>
                {['CPT', 'Description', 'Mods', 'Units', 'Diag Ptrs', 'Fee', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visit.serviceLines.map((sl, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--bb-border)', background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{sl.cpt}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{sl.description}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{sl.mods.join(' ') || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{sl.units}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace' }}>{sl.diagPtrs}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>${sl.fee.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={13} /></button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--bb-border)', background: 'var(--bb-surface-app)' }}>
                <td colSpan={5} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Total</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 14, color: 'var(--bb-brand-blue)' }}>
                  ${visit.serviceLines.reduce((s, sl) => s + sl.fee * sl.units, 0).toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bb-border)' }}>
            <Button variant="secondary" size="sm"><Plus size={13} /> Add Procedure</Button>
          </div>
        </div>
      </SectionCard>

      {/* Clinical Notes */}
      <SectionCard title="Clinical Notes" section="notes" icon={<FileText size={14} />}>
        <div style={{ padding: '16px 20px' }}>
          {editingNotes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={6}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="primary" size="sm" onClick={() => setEditingNotes(false)}>Save Notes</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              {notes ? (
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--bb-text-primary)', margin: 0 }}>{notes}</p>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--bb-text-secondary)', fontStyle: 'italic', margin: 0 }}>No clinical notes recorded.</p>
              )}
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" size="sm" onClick={() => setEditingNotes(true)}>
                  <Edit2 size={13} /> {notes ? 'Edit Notes' : 'Add Notes'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
