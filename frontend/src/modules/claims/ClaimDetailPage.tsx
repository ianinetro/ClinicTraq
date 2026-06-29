import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Send, RotateCcw, AlertCircle, CheckCircle2, FileText, ChevronDown, ChevronUp, Download, ShieldAlert, MessageSquare, Printer, GitBranch } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { apiClient as api } from '../../services/api'

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
  validationIssues: { severity: 'blocking' | 'warning' | 'info'; code: string; message: string }[]
  denials: { id: string; carc_code: string; rarc_code?: string; denial_reason: string; appeal_status: string; appeal_due_date?: string; denied_amount?: number }[]
  submissionHistory: { date: string; event: string; note: string; status: string }[]
}

interface ValidationIssue {
  severity: string
  message: string
  code?: string
}

interface DenialItem {
  id: string
  carc_code: string
  rarc_code?: string
  denial_reason: string
  appeal_status: string
  appeal_due_date?: string
  denied_amount?: number
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Paid') return 'success'
  if (s === 'Denied') return 'danger'
  if (s === 'Pending' || s === 'Partial') return 'warning'
  if (s === 'Submitted') return 'info'
  return 'default'
}

type Section = 'overview' | 'diagnoses' | 'lines' | 'validation' | 'denials' | 'provider' | 'history'

const EMPTY_CLAIM: ClaimData = {
  claimId: '', status: 'Draft',
  patient: { name: '', dob: '', mrn: '', memberId: '', groupNumber: '', sex: '' },
  payer: { name: '', payerId: '', planType: '', phone: '' },
  provider: { name: '', npi: '', taxonomy: '', tin: '' },
  facility: { name: '', npi: '', posCode: '', address: '' },
  diagnoses: [], serviceLines: [],
  submitDate: '', payerControlNumber: '', checkNumber: '', checkDate: '',
  totalBilled: 0, totalPaid: 0, totalBalance: 0,
  validationIssues: [], denials: [], submissionHistory: [],
}

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const claimId = id ?? ''
  const [openSection, setOpenSection] = useState<Section | null>('lines')

  // Validation state
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | null>(null)
  const [validating, setValidating] = useState(false)

  // Denial state
  const [denials, setDenials] = useState<DenialItem[]>([])
  const [denialsLoaded, setDenialsLoaded] = useState(false)
  const [showRecordDenialForm, setShowRecordDenialForm] = useState(false)
  const [recordDenialForm, setRecordDenialForm] = useState({ carc_code: '', rarc_code: '', denial_reason: '', appeal_due_date: '' })
  const [recordingDenial, setRecordingDenial] = useState(false)

  // Per-denial appeal form state
  const [appealForms, setAppealForms] = useState<Record<string, { open: boolean; appeal_notes: string; status: string }>>({})
  const [savingAppeal, setSavingAppeal] = useState<string | null>(null)

  // Secondary claim state
  const [secondaryClaimId, setSecondaryClaimId] = useState<string | null>(null)
  const [creatingSecondary, setCreatingSecondary] = useState(false)

  const { data: claim = EMPTY_CLAIM, isLoading, isError } = useQuery<ClaimData>({
    queryKey: ['claims', claimId],
    queryFn: async () => {
      const raw = (await api.get(`/claims/${claimId}`)).data
      const statusMap: Record<string, ClaimStatus> = {
        draft: 'Draft', pending: 'Pending', submitted: 'Submitted',
        denied: 'Denied', paid: 'Paid', partial: 'Partial',
      }
      return {
        ...EMPTY_CLAIM,
        claimId: String(raw.id ?? claimId),
        status: statusMap[raw.status?.toLowerCase()] ?? 'Draft',
        submitDate: raw.last_submitted_at ? new Date(raw.last_submitted_at).toLocaleDateString() : '—',
        payerControlNumber: raw.payer_claim_number ?? '',
        totalBilled: raw.total_charge ?? 0,
        totalPaid: raw.total_paid ?? 0,
        totalBalance: raw.balance ?? 0,
        diagnoses: (raw.diagnoses_snapshot ?? []).map((d: Record<string, string>, i: number) => ({
          icd10: d.diagnosis_code ?? d.icd10_code ?? '—',
          description: d.description ?? '',
          pointer: String.fromCharCode(65 + i),
        })),
        serviceLines: (raw.lines ?? []).map((l: Record<string, unknown>) => ({
          cpt: String(l.cpt_code ?? ''),
          mods: Array.isArray(l.modifiers) ? (l.modifiers as string[]).join(', ') : '',
          dos: raw.date_of_service ? new Date(raw.date_of_service as string).toLocaleDateString() : '—',
          units: Number(l.units ?? 1),
          billed: Number(l.charge_amount ?? 0),
          allowed: Number(l.allowed_amount ?? 0),
          paid: Number(l.paid_amount ?? 0),
          adjustment: Number(l.adjustment_amount ?? 0),
          adjReason: '',
        })),
        validationIssues: (raw.validation_issues ?? []).map((v: Record<string, string>) => ({
          severity: v.severity as 'blocking' | 'warning' | 'info',
          code: v.code ?? '',
          message: v.message ?? '',
        })),
      } as ClaimData
    },
    enabled: !!claimId,
  })

  // Fetch denials on mount
  useEffect(() => {
    if (!claimId) return
    api.get(`/claims/${claimId}/denials`)
      .then(res => {
        setDenials(res.data ?? [])
        setDenialsLoaded(true)
      })
      .catch(() => setDenialsLoaded(true))
  }, [claimId])

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

  async function handleRunValidation() {
    setValidating(true)
    try {
      const res = await api.post(`/claims/${claimId}/validate`)
      setValidationIssues(res.data?.issues ?? res.data ?? [])
    } catch {
      alert('Validation failed')
    } finally {
      setValidating(false)
    }
  }

  async function handlePrintCMS1500() {
    try {
      const res = await api.get(`/claims/${claimId}/cms1500/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank')
    } catch {
      alert('PDF generation failed')
    }
  }

  async function handleDownload837() {
    try {
      const res = await api.get(`/claims/${claimId}/edi837`, { responseType: 'text' })
      const blob = new Blob([res.data], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `claim_${claimId}.837`
      a.click()
    } catch {
      alert('EDI generation failed')
    }
  }

  async function handleSubmitClaim() {
    try {
      await api.post(`/claims/${claimId}/submit`)
      navigate('/claims')
    } catch {
      alert('Failed to submit claim. Please validate first.')
    }
  }

  async function handleCreateSecondary() {
    setCreatingSecondary(true)
    try {
      const res = await api.post(`/claims/${claimId}/crossover`)
      setSecondaryClaimId(res.data?.claim_id ?? res.data?.id ?? null)
    } catch {
      alert('Failed to create secondary claim')
    } finally {
      setCreatingSecondary(false)
    }
  }

  async function handleRecordDenial() {
    if (!recordDenialForm.carc_code || !recordDenialForm.denial_reason) return
    setRecordingDenial(true)
    try {
      await api.post(`/claims/${claimId}/denial`, recordDenialForm)
      const res = await api.get(`/claims/${claimId}/denials`)
      setDenials(res.data ?? [])
      setRecordDenialForm({ carc_code: '', rarc_code: '', denial_reason: '', appeal_due_date: '' })
      setShowRecordDenialForm(false)
    } catch {
      alert('Failed to record denial')
    } finally {
      setRecordingDenial(false)
    }
  }

  function toggleAppealForm(denialId: string) {
    setAppealForms(prev => ({
      ...prev,
      [denialId]: prev[denialId]?.open
        ? { ...prev[denialId], open: false }
        : { open: true, appeal_notes: '', status: 'draft' },
    }))
  }

  async function handleSaveAppeal(denialId: string) {
    const form = appealForms[denialId]
    if (!form) return
    setSavingAppeal(denialId)
    try {
      await api.patch(`/denials/${denialId}`, { appeal_notes: form.appeal_notes, appeal_status: form.status })
      const res = await api.get(`/claims/${claimId}/denials`)
      setDenials(res.data ?? [])
      setAppealForms(prev => ({ ...prev, [denialId]: { ...prev[denialId], open: false } }))
    } catch {
      alert('Failed to save appeal')
    } finally {
      setSavingAppeal(null)
    }
  }

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)' }}>Loading claim…</div>
  if (isError) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-status-danger)' }}>Failed to load claim. Check API connection.</div>

  const showSecondaryButton = claim.status === 'Paid' || claim.status === 'Partial'
  const today = new Date()

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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={handlePrintCMS1500}>
            <Printer size={14} />
            CMS-1500
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload837}>
            <Download size={14} />
            837
          </Button>
          {showSecondaryButton && !secondaryClaimId && (
            <Button variant="secondary" size="sm" onClick={handleCreateSecondary} disabled={creatingSecondary}>
              <GitBranch size={14} />
              {creatingSecondary ? 'Creating…' : 'Secondary Claim'}
            </Button>
          )}
          {secondaryClaimId && (
            <button
              onClick={() => navigate(`/claims/${secondaryClaimId}`)}
              style={{
                fontSize: 13, padding: '6px 12px', borderRadius: 6,
                background: 'var(--bb-status-success)', color: 'white',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              Secondary claim created — view {secondaryClaimId}
            </button>
          )}
          {claim.status === 'Denied' && (
            <Button variant="secondary" onClick={() => void handleSubmitClaim()}>
              <RotateCcw size={14} />
              Resubmit
            </Button>
          )}
          {(claim.status === 'Draft' || claim.status === 'Pending') && (
            <Button variant="primary" onClick={() => void handleSubmitClaim()}>
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
          { label: 'Billed', value: `$${(claim.totalBilled ?? 0).toFixed(2)}`, sub: 'total charged' },
          { label: 'Paid', value: `$${(claim.totalPaid ?? 0).toFixed(2)}`, sub: 'received', ok: (claim.totalPaid ?? 0) > 0 },
          { label: 'Balance', value: `$${(claim.totalBalance ?? 0).toFixed(2)}`, sub: 'outstanding', warn: (claim.totalBalance ?? 0) > 0 },
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
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>${(sl.billed ?? 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>{(sl.allowed ?? 0) > 0 ? `$${(sl.allowed ?? 0).toFixed(2)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: (sl.paid ?? 0) > 0 ? 'var(--bb-status-success)' : 'var(--bb-text-secondary)' }}>
                      {(sl.paid ?? 0) > 0 ? `$${(sl.paid ?? 0).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--bb-status-danger)' }}>
                      {(sl.adjustment ?? 0) > 0 ? `-$${(sl.adjustment ?? 0).toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--bb-status-danger)', maxWidth: 220 }}>{sl.adjReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--bb-border)', background: 'var(--bb-surface-app)' }}>
                  <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>Totals</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>${(claim.totalBilled ?? 0).toFixed(2)}</td>
                  <td />
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--bb-status-success)' }}>${(claim.totalPaid ?? 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--bb-status-danger)' }}>
                    -${claim.serviceLines.reduce((s, sl) => s + (sl.adjustment ?? 0), 0).toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Validation Panel */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: openSection === 'validation' ? '1px solid var(--bb-border)' : 'none',
        }}>
          <button
            onClick={() => toggle('validation')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: 'var(--bb-text-primary)', padding: 0,
            }}
          >
            <ShieldAlert size={14} />
            Validation
            {openSection === 'validation' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={handleRunValidation}
            disabled={validating}
            style={{
              fontSize: 13, padding: '5px 14px', borderRadius: 6,
              background: 'var(--bb-brand-blue)', color: 'white',
              border: 'none', cursor: validating ? 'not-allowed' : 'pointer',
              opacity: validating ? 0.7 : 1, fontWeight: 500,
            }}
          >
            {validating ? 'Running…' : 'Run Validation'}
          </button>
        </div>
        {openSection === 'validation' && (
          <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {validationIssues === null && claim.validationIssues.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>Click "Run Validation" to check this claim.</div>
            )}
            {/* Show live-fetched issues if available, otherwise fall back to claim data */}
            {(() => {
              const issues = validationIssues ?? claim.validationIssues
              if (validationIssues !== null && issues.length === 0) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--bb-status-success)', fontSize: 13, fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    No validation issues
                  </div>
                )
              }
              return issues.map((issue, i) => {
                const colors = issue.severity === 'blocking'
                  ? { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', badge: 'var(--bb-status-danger)' }
                  : issue.severity === 'warning'
                    ? { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', badge: 'var(--bb-status-warning)' }
                    : { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', badge: 'var(--bb-brand-blue)' }
                return (
                  <div key={i} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: colors.badge, color: 'white', padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', marginTop: 1 }}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <div>
                      {issue.code && <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{issue.code}</div>}
                      <div style={{ fontSize: 13, color: colors.text, marginTop: issue.code ? 2 : 0 }}>{issue.message}</div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {/* Denial History */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: openSection === 'denials' ? '1px solid var(--bb-border)' : 'none',
        }}>
          <button
            onClick={() => toggle('denials')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: 'var(--bb-text-primary)', padding: 0,
            }}
          >
            <MessageSquare size={14} />
            Denial History {denialsLoaded && denials.length > 0 ? `(${denials.length})` : ''}
            {openSection === 'denials' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => setShowRecordDenialForm(v => !v)}
            style={{
              fontSize: 13, padding: '5px 14px', borderRadius: 6,
              background: 'none', color: 'var(--bb-brand-blue)',
              border: '1px solid var(--bb-brand-blue)', cursor: 'pointer', fontWeight: 500,
            }}
          >
            {showRecordDenialForm ? 'Cancel' : '+ Record Denial'}
          </button>
        </div>

        {/* Record Denial inline form */}
        {showRecordDenialForm && (
          <div style={{ padding: '16px 20px', background: 'var(--bb-surface-app)', borderBottom: '1px solid var(--bb-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>Record New Denial</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>CARC Code *</label>
                <input
                  value={recordDenialForm.carc_code}
                  onChange={e => setRecordDenialForm(f => ({ ...f, carc_code: e.target.value }))}
                  placeholder="e.g. 4"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>RARC Code</label>
                <input
                  value={recordDenialForm.rarc_code}
                  onChange={e => setRecordDenialForm(f => ({ ...f, rarc_code: e.target.value }))}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>Denial Reason *</label>
              <textarea
                value={recordDenialForm.denial_reason}
                onChange={e => setRecordDenialForm(f => ({ ...f, denial_reason: e.target.value }))}
                rows={2}
                placeholder="Describe the denial reason"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>Appeal Due Date</label>
              <input
                type="date"
                value={recordDenialForm.appeal_due_date}
                onChange={e => setRecordDenialForm(f => ({ ...f, appeal_due_date: e.target.value }))}
                style={{ padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleRecordDenial}
                disabled={recordingDenial || !recordDenialForm.carc_code || !recordDenialForm.denial_reason}
                style={{
                  fontSize: 13, padding: '6px 16px', borderRadius: 6,
                  background: 'var(--bb-brand-blue)', color: 'white',
                  border: 'none', cursor: recordingDenial ? 'not-allowed' : 'pointer',
                  opacity: recordingDenial ? 0.7 : 1, fontWeight: 500,
                }}
              >
                {recordingDenial ? 'Saving…' : 'Save Denial'}
              </button>
              <button
                onClick={() => setShowRecordDenialForm(false)}
                style={{
                  fontSize: 13, padding: '6px 16px', borderRadius: 6,
                  background: 'none', color: 'var(--bb-text-secondary)',
                  border: '1px solid var(--bb-border)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {openSection === 'denials' && (
          <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {denialsLoaded && denials.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>No denials recorded for this claim.</div>
            )}
            {denials.map(denial => {
              const dueDate = denial.appeal_due_date ? new Date(denial.appeal_due_date) : null
              const isPastDue = dueDate ? dueDate < today && denial.appeal_status !== 'won' && denial.appeal_status !== 'lost' : false
              const appealColors: Record<string, { bg: string; text: string }> = {
                draft: { bg: '#F3F4F6', text: '#374151' },
                submitted: { bg: '#DBEAFE', text: '#1E40AF' },
                won: { bg: '#DCFCE7', text: '#15803D' },
                lost: { bg: '#FEE2E2', text: '#991B1B' },
                write_off: { bg: '#F3F4F6', text: '#6B7280' },
              }
              const ac = appealColors[denial.appeal_status] || appealColors.draft
              const appealForm = appealForms[denial.id]
              return (
                <div key={denial.id} style={{ border: '1px solid #FECACA', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#DC2626' }}>{denial.carc_code}</span>
                      {denial.rarc_code && <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>{denial.rarc_code}</span>}
                      {denial.denied_amount !== undefined && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#DC2626' }}>-${denial.denied_amount.toFixed(2)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: ac.bg, color: ac.text, padding: '2px 8px', borderRadius: 4 }}>
                        {denial.appeal_status.replace('_', ' ').toUpperCase()}
                      </span>
                      {dueDate && (
                        <span style={{ fontSize: 11, color: isPastDue ? 'var(--bb-status-danger)' : 'var(--bb-text-secondary)' }}>
                          Due: {denial.appeal_due_date}
                        </span>
                      )}
                      <button
                        onClick={() => toggleAppealForm(denial.id)}
                        style={{
                          fontSize: 12, padding: '3px 10px', borderRadius: 5,
                          background: 'none', color: 'var(--bb-brand-blue)',
                          border: '1px solid var(--bb-border)', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        {appealForm?.open ? 'Cancel' : 'File Appeal'}
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                    {denial.denial_reason}
                  </div>
                  {/* Inline appeal form */}
                  {appealForm?.open && (
                    <div style={{ padding: '12px 16px', background: 'var(--bb-surface-app)', borderTop: '1px solid var(--bb-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>Appeal Notes</label>
                        <textarea
                          value={appealForm.appeal_notes}
                          onChange={e => setAppealForms(prev => ({ ...prev, [denial.id]: { ...prev[denial.id], appeal_notes: e.target.value } }))}
                          rows={3}
                          placeholder="Describe the grounds for appeal…"
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--bb-text-secondary)', display: 'block', marginBottom: 4 }}>Status</label>
                        <select
                          value={appealForm.status}
                          onChange={e => setAppealForms(prev => ({ ...prev, [denial.id]: { ...prev[denial.id], status: e.target.value } }))}
                          style={{ padding: '7px 10px', border: '1px solid var(--bb-border)', borderRadius: 6, fontSize: 13 }}
                        >
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleSaveAppeal(denial.id)}
                          disabled={savingAppeal === denial.id}
                          style={{
                            fontSize: 13, padding: '6px 16px', borderRadius: 6,
                            background: 'var(--bb-brand-blue)', color: 'white',
                            border: 'none', cursor: savingAppeal === denial.id ? 'not-allowed' : 'pointer',
                            opacity: savingAppeal === denial.id ? 0.7 : 1, fontWeight: 500,
                          }}
                        >
                          {savingAppeal === denial.id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => toggleAppealForm(denial.id)}
                          style={{
                            fontSize: 13, padding: '6px 16px', borderRadius: 6,
                            background: 'none', color: 'var(--bb-text-secondary)',
                            border: '1px solid var(--bb-border)', cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
