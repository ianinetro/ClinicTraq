import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Trash2, Plus, Pencil } from 'lucide-react'
import { useVisit } from '../../services/queries'
import { apiClient } from '../../services/api'
import type { ChargeLine, PatientInsurance } from '../../types'

// ─── Shared micro-components ─────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--bb-text-secondary)',
      marginBottom: '3px',
    }}>
      {children}
    </label>
  )
}

function CompactInput(props: React.InputHTMLAttributes<HTMLInputElement> & { width?: string }) {
  const { width, style, ...rest } = props
  return (
    <input
      {...rest}
      style={{
        height: '30px',
        padding: '0 8px',
        fontSize: '13px',
        border: '1px solid var(--bb-border)',
        borderRadius: '4px',
        background: props.readOnly ? 'var(--bb-surface-app)' : '#fff',
        color: 'var(--bb-text-primary)',
        width: width ?? '100%',
        boxSizing: 'border-box',
        outline: 'none',
        ...style,
      }}
    />
  )
}

function CompactSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        height: '30px',
        padding: '0 8px',
        fontSize: '13px',
        border: '1px solid var(--bb-border)',
        borderRadius: '4px',
        background: '#fff',
        color: 'var(--bb-text-primary)',
        width: '100%',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    />
  )
}

function CompactTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        padding: '6px 8px',
        fontSize: '13px',
        border: '1px solid var(--bb-border)',
        borderRadius: '4px',
        background: '#fff',
        color: 'var(--bb-text-primary)',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        minHeight: '68px',
        outline: 'none',
        ...props.style,
      }}
    />
  )
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bb-surface-card)',
      border: '1px solid var(--bb-border)',
      borderRadius: '6px',
      marginBottom: '12px',
      overflow: 'hidden',
    }}>
      {title && (
        <div style={{
          padding: '7px 14px',
          background: 'var(--bb-surface-app)',
          borderBottom: '1px solid var(--bb-border)',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--bb-text-secondary)',
        }}>
          {title}
        </div>
      )}
      <div style={{ padding: '14px' }}>{children}</div>
    </div>
  )
}

function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '10px',
      marginBottom: '10px',
    }}>
      {children}
    </div>
  )
}

function SaveButtons({ onUpdate, onCancel, onApply, saved }: {
  onUpdate: () => void
  onCancel: () => void
  onApply: () => void
  saved: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {saved && (
        <span style={{ fontSize: '12px', color: 'var(--bb-status-success)', fontWeight: 600 }}>
          Saved ✓
        </span>
      )}
      <button
        onClick={onUpdate}
        style={{
          height: '30px',
          padding: '0 16px',
          background: 'var(--bb-brand-blue)',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Update
      </button>
      <button
        onClick={onApply}
        style={{
          height: '30px',
          padding: '0 14px',
          background: 'transparent',
          color: 'var(--bb-brand-blue)',
          border: '1px solid var(--bb-brand-blue)',
          borderRadius: '4px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Apply
      </button>
      <button
        onClick={onCancel}
        style={{
          height: '30px',
          padding: '0 14px',
          background: 'transparent',
          color: 'var(--bb-text-secondary)',
          border: '1px solid var(--bb-border)',
          borderRadius: '4px',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

// ─── Insurance display block ──────────────────────────────────────────────────

function InsuranceBlock({ ins, label }: { ins?: PatientInsurance; label: string }) {
  return (
    <SectionCard title={label}>
      {!ins ? (
        <p style={{ fontSize: '12px', color: 'var(--bb-text-secondary)' }}>None on file.</p>
      ) : (
        <>
          <FormRow cols={3}>
            <div>
              <FieldLabel>Insurance Co. ID</FieldLabel>
              <CompactInput readOnly value={ins.payerId} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <FieldLabel>Insurance Name</FieldLabel>
              <CompactInput readOnly value={ins.payerName} />
            </div>
          </FormRow>
          <FormRow cols={4}>
            <div>
              <FieldLabel>Relationship</FieldLabel>
              <CompactInput readOnly value={ins.relationshipToInsured} />
            </div>
            <div>
              <FieldLabel>Accept Assign.</FieldLabel>
              <div style={{ paddingTop: '6px' }}>
                <input type="checkbox" readOnly checked={true} />
              </div>
            </div>
            <div>
              <FieldLabel>Copay</FieldLabel>
              <CompactInput readOnly value={ins.copay != null ? `$${ins.copay}` : '—'} />
            </div>
            <div>
              <FieldLabel>Plan Name</FieldLabel>
              <CompactInput readOnly value={ins.planName ?? '—'} />
            </div>
          </FormRow>
          <FormRow cols={3}>
            <div>
              <FieldLabel>Insured First</FieldLabel>
              <CompactInput readOnly value={ins.insuredFirstName ?? '—'} />
            </div>
            <div>
              <FieldLabel>Insured Last</FieldLabel>
              <CompactInput readOnly value={ins.insuredLastName ?? '—'} />
            </div>
            <div>
              <FieldLabel>Subscriber ID</FieldLabel>
              <CompactInput readOnly value={ins.memberId} />
            </div>
          </FormRow>
          <FormRow cols={2}>
            <div>
              <FieldLabel>Group No.</FieldLabel>
              <CompactInput readOnly value={ins.groupNumber ?? '—'} />
            </div>
            <div>
              <FieldLabel>Effective Date</FieldLabel>
              <CompactInput readOnly value={ins.effectiveDate ?? '—'} />
            </div>
          </FormRow>
        </>
      )}
    </SectionCard>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'visit-info' | 'billing-info' | 'billing-options'

interface NoteRow {
  id: string
  text: string
  createdAt: string
  updatedAt: string
}

interface MedRow {
  id: string
  date: string
  medicine: string
  description: string
  quantity: string
  refill: string
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: visit, isLoading } = useVisit(id ?? '')

  const { data: insuranceList } = useQuery<PatientInsurance[]>({
    queryKey: ['patient-insurance', visit?.patientId],
    queryFn: () => apiClient.get(`/patients/${visit!.patientId}/insurance`).then(r => r.data),
    enabled: !!visit?.patientId,
  })

  const primaryIns = insuranceList?.find(i => i.priority === 'primary')
  const secondaryIns = insuranceList?.find(i => i.priority === 'secondary')

  const [activeTab, setActiveTab] = useState<TabId>('visit-info')
  const [saved, setSaved] = useState(false)

  // Visit Info form
  const [visitDate, setVisitDate] = useState('')
  const [reason, setReason] = useState('')
  const [complaints, setComplaints] = useState('')
  const [allergies, setAllergies] = useState('')
  const [visitStatus, setVisitStatus] = useState('')
  const [printBilling, setPrintBilling] = useState('Yes')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bp, setBp] = useState('')
  const [providerId, setProviderId] = useState('')
  const [providerFirst, setProviderFirst] = useState('')
  const [providerLast, setProviderLast] = useState('')
  const [entityType, setEntityType] = useState('individual')
  const [office, setOffice] = useState('')
  const [providerNotes, setProviderNotes] = useState('')

  // Notes
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [noteInput, setNoteInput] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')

  // Medications
  const [meds, setMeds] = useState<MedRow[]>([
    { id: 'blank', date: '', medicine: '', description: '', quantity: '', refill: '' },
  ])

  // Charge lines
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [chargesInited, setChargesInited] = useState(false)

  // Billing Options
  const [acceptAssignment, setAcceptAssignment] = useState(true)
  const [capitation, setCapitation] = useState(false)
  const [cobIndicator, setCobIndicator] = useState(false)
  const [billingNotes, setBillingNotes] = useState('')

  // Seed form state once visit loads
  if (visit && visitStatus === '') {
    setVisitDate(visit.visitDate ?? '')
    setVisitStatus(visit.status ?? 'completed')
    setReason(visit.visitType ?? '')
    setProviderFirst(visit.provider?.firstName ?? '')
    setProviderLast(visit.provider?.lastName ?? '')
    setProviderId(visit.providerId ?? '')
    setProviderNotes(visit.notes ?? '')
  }

  if (visit && !chargesInited && visit.chargeLines) {
    setChargeLines(visit.chargeLines)
    setChargesInited(true)
  }

  const handleUpdate = async () => {
    if (!id) return
    try {
      await apiClient.patch(`/visits/${id}`, {
        visitDate,
        status: visitStatus,
        visitType: reason,
        notes: providerNotes,
      })
    } catch {
      // mock success
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleAddNote = () => {
    if (!noteInput.trim()) return
    const now = new Date().toISOString()
    setNotes(prev => [...prev, { id: crypto.randomUUID(), text: noteInput.trim(), createdAt: now, updatedAt: now }])
    setNoteInput('')
  }

  const handleDeleteNote = (noteId: string) => setNotes(prev => prev.filter(n => n.id !== noteId))

  const handleSaveNoteEdit = (noteId: string) => {
    setNotes(prev => prev.map(n => n.id === noteId
      ? { ...n, text: editingNoteText, updatedAt: new Date().toISOString() }
      : n
    ))
    setEditingNoteId(null)
    setEditingNoteText('')
  }

  const handleAddMed = () =>
    setMeds(prev => [...prev, { id: crypto.randomUUID(), date: '', medicine: '', description: '', quantity: '', refill: '' }])

  const handleDeleteMed = (medId: string) => setMeds(prev => prev.filter(m => m.id !== medId))

  const updateMed = (medId: string, field: keyof MedRow, value: string) =>
    setMeds(prev => prev.map(m => m.id === medId ? { ...m, [field]: value } : m))

  const handleAddChargeLine = () => {
    const newLine: ChargeLine = {
      id: crypto.randomUUID(),
      seq: chargeLines.length + 1,
      dosFrom: visitDate,
      dosTo: visitDate,
      pos: visit?.pos ?? '11',
      cptCode: '',
      cptDescription: '',
      modifiers: ['', '', '', ''],
      dxPointers: [],
      charge: 0,
      units: 1,
      balance: 0,
    }
    setChargeLines(prev => [...prev, newLine])
  }

  const updateChargeLine = (lineId: string, field: keyof ChargeLine, value: unknown) =>
    setChargeLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l))

  const deleteChargeLine = (lineId: string) =>
    setChargeLines(prev => prev.filter(l => l.id !== lineId))

  const totalCharges = chargeLines.reduce((s, l) => s + Number(l.charge) * Number(l.units), 0)

  // ─── Loading / not-found states ───────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ height: '32px', background: '#E3E3F1', borderRadius: '4px', width: '260px' }} />
      </div>
    )
  }

  if (!visit) {
    return (
      <div style={{ padding: '24px' }}>
        <p style={{ fontSize: '14px', color: 'var(--bb-text-secondary)' }}>Visit not found.</p>
        <button
          onClick={() => navigate('/visits')}
          style={{ marginTop: '12px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', border: '1px solid var(--bb-border)', borderRadius: '4px', background: '#fff' }}
        >
          Back to Visits
        </button>
      </div>
    )
  }

  const patientAddr = visit.patient?.address
  const addrLine = patientAddr
    ? [patientAddr.line1, patientAddr.line2, patientAddr.city, patientAddr.state, patientAddr.zip].filter(Boolean).join(', ')
    : '—'

  const tabs: { id: TabId; label: string }[] = [
    { id: 'visit-info', label: 'Visit Info' },
    { id: 'billing-info', label: 'Billing Info' },
    { id: 'billing-options', label: 'Billing Options' },
  ]

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--bb-text-secondary)',
    borderBottom: '1px solid var(--bb-border)',
    whiteSpace: 'nowrap',
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Back + title + save row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/visits')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--bb-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Visits
          </button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--bb-text-primary)' }}>
            Edit Visit{' '}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--bb-text-secondary)' }}>— {visit.id.slice(0, 8)}</span>
          </h1>
        </div>
        <SaveButtons onUpdate={handleUpdate} onCancel={() => navigate('/visits')} onApply={handleUpdate} saved={saved} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--bb-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'pointer',
              letterSpacing: '0.01em',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1 }}>

        {/* ── VISIT INFO ─────────────────────────────────────────────────── */}
        {activeTab === 'visit-info' && (
          <>
            {/* Patient strip */}
            <SectionCard title="Patient Information">
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <FieldLabel>Patient ID</FieldLabel>
                  <CompactInput readOnly value={visit.patientId} width="138px" />
                </div>
                <div>
                  <FieldLabel>Last Name</FieldLabel>
                  <CompactInput readOnly value={visit.patient?.lastName ?? '—'} width="130px" />
                </div>
                <div>
                  <FieldLabel>First Name</FieldLabel>
                  <CompactInput readOnly value={visit.patient?.firstName ?? '—'} width="130px" />
                </div>
                <div>
                  <FieldLabel>DOB</FieldLabel>
                  <CompactInput
                    readOnly
                    value={visit.patient?.dateOfBirth ? format(new Date(visit.patient.dateOfBirth), 'MM/dd/yyyy') : '—'}
                    width="100px"
                  />
                </div>
                <div>
                  <FieldLabel>Sex</FieldLabel>
                  <CompactInput readOnly value={visit.patient?.gender ?? '—'} width="48px" />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <FieldLabel>Address</FieldLabel>
                  <CompactInput readOnly value={addrLine} />
                </div>
                <div style={{ paddingBottom: '2px' }}>
                  <Link
                    to={`/patients/${visit.patientId}`}
                    style={{ fontSize: '12px', color: 'var(--bb-brand-blue)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Edit Patient →
                  </Link>
                </div>
              </div>
            </SectionCard>

            {/* Visit details */}
            <SectionCard title="Visit Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <div style={{ marginBottom: '10px' }}>
                    <FieldLabel>Visit Date</FieldLabel>
                    <CompactInput type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} width="160px" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <FieldLabel>Reason for Visit</FieldLabel>
                    <CompactInput value={reason} onChange={e => setReason(e.target.value)} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <FieldLabel>Chief Complaints</FieldLabel>
                    <CompactTextarea value={complaints} onChange={e => setComplaints(e.target.value)} rows={3} />
                  </div>
                  <div>
                    <FieldLabel>Allergies</FieldLabel>
                    <CompactTextarea value={allergies} onChange={e => setAllergies(e.target.value)} rows={2} />
                  </div>
                </div>
                <div>
                  <div style={{ marginBottom: '10px' }}>
                    <FieldLabel>Visit Status</FieldLabel>
                    <CompactSelect value={visitStatus} onChange={e => setVisitStatus(e.target.value)}>
                      <option value="scheduled">Scheduled</option>
                      <option value="checked-in">Checked In</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no-show">No Show</option>
                    </CompactSelect>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <FieldLabel>Print Billing Statement?</FieldLabel>
                    <CompactSelect value={printBilling} onChange={e => setPrintBilling(e.target.value)}>
                      <option>Yes</option>
                      <option>No</option>
                    </CompactSelect>
                  </div>
                  <div>
                    <FieldLabel>Vital Signs</FieldLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                      <div>
                        <FieldLabel>Weight (lbs)</FieldLabel>
                        <CompactInput value={weight} onChange={e => setWeight(e.target.value)} placeholder="—" />
                      </div>
                      <div>
                        <FieldLabel>Height (in)</FieldLabel>
                        <CompactInput value={height} onChange={e => setHeight(e.target.value)} placeholder="—" />
                      </div>
                      <div>
                        <FieldLabel>Temp (°F)</FieldLabel>
                        <CompactInput value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="—" />
                      </div>
                      <div>
                        <FieldLabel>Blood Pressure</FieldLabel>
                        <CompactInput value={bp} onChange={e => setBp(e.target.value)} placeholder="120/80" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Provider */}
            <SectionCard title="Provider">
              <FormRow cols={4}>
                <div>
                  <FieldLabel>Provider ID</FieldLabel>
                  <CompactInput value={providerId} onChange={e => setProviderId(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>First Name</FieldLabel>
                  <CompactInput value={providerFirst} onChange={e => setProviderFirst(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Last Name</FieldLabel>
                  <CompactInput value={providerLast} onChange={e => setProviderLast(e.target.value)} />
                </div>
                <div>
                  <FieldLabel>Entity Type</FieldLabel>
                  <CompactSelect value={entityType} onChange={e => setEntityType(e.target.value)}>
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                    <option value="facility">Facility</option>
                  </CompactSelect>
                </div>
              </FormRow>
              <FormRow cols={2}>
                <div>
                  <FieldLabel>Office / Clinic</FieldLabel>
                  <CompactSelect value={office} onChange={e => setOffice(e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="main">Main Clinic</option>
                    <option value="north">North Branch</option>
                    <option value="south">South Branch</option>
                  </CompactSelect>
                </div>
                <div>
                  <FieldLabel>Provider Notes (max 500 chars)</FieldLabel>
                  <CompactTextarea
                    value={providerNotes}
                    onChange={e => setProviderNotes(e.target.value.slice(0, 500))}
                    rows={2}
                  />
                </div>
              </FormRow>
            </SectionCard>

            {/* Medications */}
            <SectionCard title="Medications">
              <div style={{ marginBottom: '8px' }}>
                <button
                  onClick={handleAddMed}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 600, color: 'var(--bb-brand-blue)',
                    background: 'none', border: '1px solid var(--bb-brand-blue)',
                    borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  <Plus size={12} /> Add Medicine
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bb-surface-app)' }}>
                      {['Date', 'Medicine', 'Description', 'Quantity', 'Refill', ''].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map(med => (
                      <tr key={med.id} style={{ borderBottom: '1px solid var(--bb-border)' }}>
                        <td style={{ padding: '4px 6px' }}>
                          <CompactInput type="date" value={med.date} onChange={e => updateMed(med.id, 'date', e.target.value)} width="120px" />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <CompactInput value={med.medicine} onChange={e => updateMed(med.id, 'medicine', e.target.value)} width="140px" />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <CompactInput value={med.description} onChange={e => updateMed(med.id, 'description', e.target.value)} width="180px" />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <CompactInput value={med.quantity} onChange={e => updateMed(med.id, 'quantity', e.target.value)} width="70px" />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <CompactInput value={med.refill} onChange={e => updateMed(med.id, 'refill', e.target.value)} width="70px" />
                        </td>
                        <td style={{ padding: '4px 6px' }}>
                          <button onClick={() => handleDeleteMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', display: 'flex' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Visit Notes */}
            <SectionCard title="Visit Notes">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
                <thead>
                  <tr style={{ background: 'var(--bb-surface-app)' }}>
                    {['Note', 'Date Created', 'Last Modified', '', ''].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notes.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '10px 8px', color: 'var(--bb-text-secondary)', fontStyle: 'italic', fontSize: '12px' }}>
                        No notes added yet.
                      </td>
                    </tr>
                  )}
                  {notes.map(note => (
                    <tr key={note.id} style={{ borderBottom: '1px solid var(--bb-border)' }}>
                      <td style={{ padding: '6px 8px', maxWidth: '320px', wordBreak: 'break-word' }}>
                        {editingNoteId === note.id ? (
                          <CompactTextarea
                            value={editingNoteText}
                            onChange={e => setEditingNoteText(e.target.value)}
                            rows={2}
                            style={{ minHeight: '40px' }}
                          />
                        ) : note.text}
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--bb-text-secondary)' }}>
                        {format(new Date(note.createdAt), 'MM/dd/yyyy HH:mm')}
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: 'var(--bb-text-secondary)' }}>
                        {format(new Date(note.updatedAt), 'MM/dd/yyyy HH:mm')}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        {editingNoteId === note.id ? (
                          <button
                            onClick={() => handleSaveNoteEdit(note.id)}
                            style={{ fontSize: '11px', color: 'var(--bb-brand-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', display: 'flex' }}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', display: 'flex' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <CompactInput
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Enter note…"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNote() }}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAddNote}
                  style={{
                    height: '30px', padding: '0 14px', background: 'var(--bb-brand-blue)',
                    color: '#fff', border: 'none', borderRadius: '4px', fontSize: '13px',
                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Add Note
                </button>
              </div>
            </SectionCard>

            {/* Insurance */}
            <InsuranceBlock ins={primaryIns} label="Primary Insurance" />
            <InsuranceBlock ins={secondaryIns} label="Secondary Insurance" />

            {/* Guarantor */}
            <SectionCard title="Guarantor">
              <FormRow cols={3}>
                <div>
                  <FieldLabel>Guarantor Name</FieldLabel>
                  <CompactInput placeholder="—" />
                </div>
                <div>
                  <FieldLabel>Relationship</FieldLabel>
                  <CompactInput placeholder="—" />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <CompactInput placeholder="—" />
                </div>
              </FormRow>
            </SectionCard>
          </>
        )}

        {/* ── BILLING INFO ───────────────────────────────────────────────── */}
        {activeTab === 'billing-info' && (
          <SectionCard title="Charge Lines">
            <div style={{ marginBottom: '10px' }}>
              <button
                onClick={handleAddChargeLine}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '12px', fontWeight: 600, color: 'var(--bb-brand-blue)',
                  background: 'none', border: '1px solid var(--bb-brand-blue)',
                  borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
                }}
              >
                <Plus size={12} /> Add Charge Line
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bb-surface-app)' }}>
                    {['#', 'CPT', 'Description', 'Mod 1', 'Mod 2', 'Mod 3', 'DX Ptrs', 'Charge', 'Units', 'Balance', ''].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chargeLines.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: '12px 8px', color: 'var(--bb-text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                        No charge lines. Click "Add Charge Line" to begin.
                      </td>
                    </tr>
                  )}
                  {chargeLines.map((line, idx) => (
                    <tr key={line.id} style={{ borderBottom: '1px solid var(--bb-border)' }}>
                      <td style={{ padding: '4px 6px', color: 'var(--bb-text-secondary)', fontSize: '12px' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 6px' }}>
                        <CompactInput
                          value={line.cptCode}
                          onChange={e => updateChargeLine(line.id, 'cptCode', e.target.value)}
                          width="72px"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <CompactInput
                          value={line.cptDescription}
                          onChange={e => updateChargeLine(line.id, 'cptDescription', e.target.value)}
                          width="200px"
                        />
                      </td>
                      {[0, 1, 2].map(mi => (
                        <td key={mi} style={{ padding: '4px 6px' }}>
                          <CompactInput
                            value={line.modifiers[mi] ?? ''}
                            onChange={e => {
                              const mods = [...line.modifiers]
                              mods[mi] = e.target.value.toUpperCase().slice(0, 2)
                              updateChargeLine(line.id, 'modifiers', mods)
                            }}
                            width="44px"
                            style={{ fontFamily: 'monospace' }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '4px 6px' }}>
                        <CompactInput
                          value={line.dxPointers.join('')}
                          onChange={e => updateChargeLine(line.id, 'dxPointers', e.target.value.split(''))}
                          width="60px"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <CompactInput
                          type="number"
                          value={line.charge}
                          onChange={e => updateChargeLine(line.id, 'charge', parseFloat(e.target.value) || 0)}
                          width="80px"
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <CompactInput
                          type="number"
                          value={line.units}
                          onChange={e => updateChargeLine(line.id, 'units', parseInt(e.target.value) || 1)}
                          width="52px"
                        />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--bb-text-secondary)', whiteSpace: 'nowrap' }}>
                        ${(line.balance ?? 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <button
                          onClick={() => deleteChargeLine(line.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', display: 'flex' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bb-surface-app)', fontWeight: 700 }}>
                    <td colSpan={7} style={{ padding: '8px', textAlign: 'right', fontSize: '12px', color: 'var(--bb-text-secondary)' }}>
                      Total Charges:
                    </td>
                    <td colSpan={4} style={{ padding: '8px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--bb-brand-ink)' }}>
                      ${totalCharges.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        )}

        {/* ── BILLING OPTIONS ────────────────────────────────────────────── */}
        {activeTab === 'billing-options' && (
          <SectionCard title="Billing Options">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <FieldLabel>Indicators</FieldLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--bb-text-primary)' }}>
                      <input type="checkbox" checked={acceptAssignment} onChange={e => setAcceptAssignment(e.target.checked)} />
                      Accept Assignment
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--bb-text-primary)' }}>
                      <input type="checkbox" checked={capitation} onChange={e => setCapitation(e.target.checked)} />
                      Capitation
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--bb-text-primary)' }}>
                      <input type="checkbox" checked={cobIndicator} onChange={e => setCobIndicator(e.target.checked)} />
                      COB (Coordination of Benefits)
                    </label>
                  </div>
                </div>
                <div>
                  <FieldLabel>Billing Notes</FieldLabel>
                  <CompactTextarea
                    value={billingNotes}
                    onChange={e => setBillingNotes(e.target.value)}
                    rows={4}
                    placeholder="Internal billing notes…"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Clearinghouse Submission</FieldLabel>
                <div style={{
                  marginTop: '8px', padding: '16px',
                  background: 'var(--bb-surface-app)',
                  border: '1px solid var(--bb-border)',
                  borderRadius: '6px',
                }}>
                  <p style={{ fontSize: '13px', color: 'var(--bb-text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
                    Submit this visit's charges to the clearinghouse. Ensure all charge lines and diagnoses are complete before submitting.
                  </p>
                  <button
                    onClick={() => alert('Submitted to clearinghouse (mock)')}
                    style={{
                      height: '32px', padding: '0 18px',
                      background: 'var(--bb-brand-blue)', color: '#fff',
                      border: 'none', borderRadius: '4px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Submit to Clearinghouse
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Bottom save bar */}
        <div style={{
          marginTop: '16px',
          padding: '12px 0',
          borderTop: '1px solid var(--bb-border)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <SaveButtons onUpdate={handleUpdate} onCancel={() => navigate('/visits')} onApply={handleUpdate} saved={saved} />
        </div>
      </div>
  )
}
