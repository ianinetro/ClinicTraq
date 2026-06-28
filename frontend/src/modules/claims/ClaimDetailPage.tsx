import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, RotateCcw, AlertCircle, CheckCircle2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

type ClaimStatus = 'Draft' | 'Pending' | 'Submitted' | 'Denied' | 'Paid' | 'Partial'

interface ClaimData {
  claimId: string
  status: ClaimStatus
  patient: { name: string; dob: string; mrn: string; memberId: string; groupNumber: string; sex: string }
  payer: { name: string; payerId: string; planType: string; phone: string }
  provider: { name: string; npi: string; taxonomy: string; tin: string }
  facility: { name: string; npi: string; posCode: string; address: string }
  diagnoses: { icd10: string; description: string; pointer: string }[]
  serviceLines: { cpt: string; mods: string; dos: string; units: number; billed: number; allowed: number; paid: number; adjustment: number; adjReason: string }[]
  submitDate: string
  payerControlNumber: string
  checkNumber: string
  checkDate: string
  totalBilled: number
  totalPaid: number
  totalBalance: number
  denialReason?: string
  validationIssues: string[]
  submissionHistory: { date: string; event: string; note: string; status: string }[]
}

const MOCK: ClaimData = {
  claimId: 'A10044', status: 'Denied',
  patient: { name: 'Davis, Susan', dob: '1964-11-05', mrn: 'MRN-001236', memberId: 'UHC98765432', groupNumber: 'GRP-10044', sex: 'Female' },
  payer: { name: 'United Healthcare', payerId: 'UHC000', planType: 'PPO', phone: '1-800-555-0123' },
  provider: { name: 'Dr. Jennifer Smith', npi: '1234567890', taxonomy: '207Q00000X', tin: '**-***8901' },
  facility: { name: 'Springfield Medical Group', npi: '0987654321', posCode: '11', address: '456 Medical Drive, Springfield, IL 62701' },
  diagnoses: [
    { icd10: 'M54.5', description: 'Low back pain', pointer: 'A' },
    { icd10: 'M79.3', description: 'Panniculitis', pointer: 'B' },
  ],
  serviceLines: [
    { cpt: '99214', mods: '', dos: '2026-06-24', units: 1, billed: 200.00, allowed: 160.00, paid: 0, adjustment: 40.00, adjReason: 'CO-45: Exceeds fee schedule' },
    { cpt: '97110', mods: 'GP', dos: '2026-06-24', units: 2, billed: 50.00, allowed: 40.00, paid: 0, adjustment: 10.00, adjReason: 'CO-45: Exceeds fee schedule' },
  ],
  submitDate: '2026-06-25',
  payerControlNumber: 'UCH20260625-4421',
  checkNumber: '',
  checkDate: '',
  totalBilled: 250.00,
  totalPaid: 0,
  totalBalance: 250.00,
  denialReason: 'CO-45: Charges exceed the fee schedule/maximum allowable or contracted rate',
  validationIssues: [],
  submissionHistory: [
    { date: '2026-06-25 09:14', event: 'Submitted', note: 'EDI 837 sent to clearinghouse', status: 'info' },
    { date: '2026-06-25 11:02', event: 'Acknowledged', note: 'Clearinghouse accepted — 999 functional ACK', status: 'info' },
    { date: '2026-06-26 14:33', event: 'Denied', note: 'CO-45 on all service lines', status: 'danger' },
  ],
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Paid') return 'success'
  if (s === 'Denied') return 'danger'
  if (s === 'Pending' || s === 'Partial') return 'warning'
  if (s === 'Submitted') return 'info'
  return 'default'
}

type Section = 'overview' | 'diagnoses' | 'lines' | 'provider' | 'history'

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const claim = MOCK
  const [openSection, setOpenSection] = useState<Section | null>('lines')

  const toggle = (s: Section) => setOpenSection(prev => prev === s ? null : s)

  const SectionHeader = ({ title, section, icon }: { title: string; section: Section; icon?: React.ReactNode }) => (
    <button
      onClick={() => toggle(section)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 600, color: 'var(--bb-text-primary)',
        borderBottom: openSection === section ? '1px solid var(--bb-border)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{title}</div>
      {openSection === section ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/claims')}>
          <ArrowLeft size={14} /> Claims
        </Button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Claim {claim.claimId}</h2>
            <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            {claim.patient.name} · {claim.payer.name} · DOS {claim.serviceLines[0]?.dos}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {claim.status === 'Denied' && (
            <Button variant="secondary">
              <RotateCcw size={14} />
              Resubmit
            </Button>
          )}
          {(claim.status === 'Draft' || claim.status === 'Pending') && (
            <Button variant="primary">
              <Send size={14} />
              Submit Claim
            </Button>
          )}
        </div>
      </div>

      {/* Denial alert */}
      {claim.denialReason && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--bb-radius)', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="var(--bb-status-danger)" style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-status-danger)' }}>Claim Denied</div>
            <div style={{ fontSize: 13, color: '#991B1B', marginTop: 2 }}>{claim.denialReason}</div>
          </div>
        </div>
      )}

      {/* Financial summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Billed', value: `$${claim.totalBilled.toFixed(2)}`, sub: 'total charged' },
          { label: 'Paid', value: `$${claim.totalPaid.toFixed(2)}`, sub: 'received', ok: claim.totalPaid > 0 },
          { label: 'Balance', value: `$${claim.totalBalance.toFixed(2)}`, sub: 'outstanding', warn: claim.totalBalance > 0 },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.warn ? 'var(--bb-status-danger)' : k.ok ? 'var(--bb-status-success)' : 'var(--bb-text-primary)', marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Patient & Payer side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Patient */}
        <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 14 }}>Patient & Insured</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Patient Name', value: claim.patient.name },
              { label: 'DOB', value: claim.patient.dob },
              { label: 'MRN', value: claim.patient.mrn },
              { label: 'Sex', value: claim.patient.sex },
              { label: 'Member ID', value: claim.patient.memberId },
              { label: 'Group Number', value: claim.patient.groupNumber },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Payer */}
        <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '18px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 14 }}>Payer & Plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Payer Name', value: claim.payer.name },
              { label: 'Payer ID', value: claim.payer.payerId },
              { label: 'Plan Type', value: claim.payer.planType },
              { label: 'Payer Phone', value: claim.payer.phone },
              { label: 'Submit Date', value: claim.submitDate },
              { label: 'Payer Control #', value: claim.payerControlNumber || '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Diagnoses */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <SectionHeader title="Diagnoses" section="diagnoses" icon={<FileText size={14} />} />
        {openSection === 'diagnoses' && (
          <div style={{ padding: '0 0 4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bb-surface-app)' }}>
                  {['Ptr', 'ICD-10', 'Description'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claim.diagnoses.map(d => (
                  <tr key={d.icd10} style={{ borderTop: '1px solid var(--bb-border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--bb-brand-blue)', width: 48 }}>{d.pointer}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{d.icd10}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13 }}>{d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Service Lines */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <SectionHeader title="Service Lines" section="lines" />
        {openSection === 'lines' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ background: 'var(--bb-surface-app)' }}>
                  {['CPT', 'Mods', 'DOS', 'Units', 'Billed', 'Allowed', 'Paid', 'Adj', 'Reason'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {claim.serviceLines.map((sl, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--bb-border)', background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{sl.cpt}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{sl.mods || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{sl.dos}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{sl.units}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>${sl.billed.toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{sl.allowed > 0 ? `$${sl.allowed.toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: sl.paid > 0 ? 'var(--bb-status-success)' : 'var(--bb-text-secondary)' }}>
                      {sl.paid > 0 ? `$${sl.paid.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--bb-status-danger)' }}>
                      {sl.adjustment > 0 ? `-$${sl.adjustment.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--bb-status-danger)', maxWidth: 220 }}>{sl.adjReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--bb-border)', background: 'var(--bb-surface-app)' }}>
                  <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Totals</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>${claim.totalBilled.toFixed(2)}</td>
                  <td />
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--bb-status-success)' }}>${claim.totalPaid.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--bb-status-danger)' }}>
                    -${claim.serviceLines.reduce((s, sl) => s + sl.adjustment, 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Provider & Facility */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <SectionHeader title="Rendering Provider & Facility" section="provider" />
        {openSection === 'provider' && (
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>Rendering Provider</div>
              {[
                { label: 'Name', value: claim.provider.name },
                { label: 'NPI', value: claim.provider.npi },
                { label: 'Taxonomy', value: claim.provider.taxonomy },
                { label: 'TIN', value: claim.provider.tin },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>Facility</div>
              {[
                { label: 'Name', value: claim.facility.name },
                { label: 'NPI', value: claim.facility.npi },
                { label: 'POS Code', value: claim.facility.posCode },
                { label: 'Address', value: claim.facility.address },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Submission History */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <SectionHeader title="Submission History" section="history" />
        {openSection === 'history' && (
          <div style={{ padding: '12px 20px 16px' }}>
            {claim.submissionHistory.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ marginTop: 2 }}>
                  {h.status === 'danger'
                    ? <AlertCircle size={16} color="var(--bb-status-danger)" />
                    : <CheckCircle2 size={16} color="var(--bb-status-success)" />
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{h.event}</span>
                    <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{h.date}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 2 }}>{h.note}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
