import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Send, RefreshCw, Clock, User, FileText } from 'lucide-react'
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { Modal } from '../../components/ui/Modal'
import { useClaim, useValidateClaim, useSubmitClaim } from '../../services/queries'
import { useToast } from '../../components/ui/Toast'
import { clsx } from 'clsx'
import { useState } from 'react'
import type { ValidationError } from '../../types'

// Fake audit events for display (real data would come from API)
const mockLifecycle = [
  { icon: FileText, label: 'Visit Created', time: '2024-01-15 09:00', by: 'System', color: '#676687' },
  { icon: FileText, label: 'Claim Created', time: '2024-01-15 09:05', by: 'admin@practice.com', color: '#0410BD' },
  { icon: RefreshCw, label: 'Validation Run — Passed', time: '2024-01-15 09:05', by: 'System', color: '#047857' },
  { icon: Send, label: 'Submitted to Payer', time: '2024-01-15 09:10', by: 'admin@practice.com', color: '#0410BD' },
  { icon: CheckCircle, label: 'Acknowledged by Payer (277CA)', time: '2024-01-16 14:22', by: 'System', color: '#047857' },
]

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  const { data: claim, isLoading } = useClaim(id ?? '')
  const validateClaim = useValidateClaim()
  const submitClaim = useSubmitClaim()

  if (isLoading) {
    return <div className="p-6 animate-pulse"><div className="h-8 bg-[#E3E3F1] rounded w-64" /></div>
  }

  if (!claim) {
    return (
      <div className="p-6">
        <p className="text-sm text-[#676687]">Claim not found.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/claims')} className="mt-3">Back</Button>
      </div>
    )
  }

  const blockingErrors = claim.validationErrors?.filter(e => e.severity === 'error') ?? []
  const validationWarnings = claim.validationErrors?.filter(e => e.severity === 'warning') ?? []
  const canSubmit = blockingErrors.length === 0

  async function handleValidate() {
    try {
      await validateClaim.mutateAsync(claim.id)
      addToast({ variant: 'success', message: 'Validation complete.' })
    } catch {
      addToast({ variant: 'error', message: 'Validation failed.' })
    }
  }

  async function handleSubmit() {
    try {
      await submitClaim.mutateAsync(claim.id)
      addToast({ variant: 'success', message: 'Claim submitted successfully.' })
      setSubmitConfirmOpen(false)
    } catch {
      addToast({ variant: 'error', message: 'Submission failed. Please try again.' })
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <button onClick={() => navigate('/claims')} className="flex items-center gap-1.5 text-sm text-[#676687] hover:text-[#12122C]">
        <ArrowLeft size={14} />Back to Claims
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Claim</p>
          <h1 className="text-2xl font-bold text-[#12122C] font-mono">{claim.claimNumber}</h1>
          {claim.patient && (
            <div className="mt-1">
              <PHIField
                value={`${claim.patient.firstName} ${claim.patient.lastName}`}
                fieldName="Patient Name"
                patientId={claim.patientId}
                fieldType="name"
                inline
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={claim.status} />
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw size={13} />}
            loading={validateClaim.isPending}
            onClick={handleValidate}
          >
            Validate
          </Button>
          {canSubmit && claim.status !== 'submitted' && claim.status !== 'paid' && (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Send size={13} />}
              onClick={() => setSubmitConfirmOpen(true)}
            >
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* Blocking errors banner */}
      {blockingErrors.length > 0 && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4">
          <p className="text-sm font-semibold text-[#B91C1C] mb-2">
            {blockingErrors.length} blocking {blockingErrors.length === 1 ? 'error' : 'errors'} — cannot submit
          </p>
          {blockingErrors.map((e: ValidationError) => (
            <p key={e.id} className="text-xs text-[#B91C1C]">• {e.message}</p>
          ))}
        </div>
      )}

      <Tabs defaultTab="summary">
        <TabList>
          <Tab id="summary">Summary</Tab>
          <Tab id="validation">Validation</Tab>
          <Tab id="lines">Service Lines</Tab>
          <Tab id="providers">Providers</Tab>
          <Tab id="submissions">Submission History</Tab>
          <Tab id="payments">Payments</Tab>
          <Tab id="notes">Notes</Tab>
          <Tab id="cms1500">CMS-1500</Tab>
          <Tab id="lifecycle">Lifecycle</Tab>
        </TabList>

        {/* Summary Tab */}
        <TabPanel id="summary" className="pt-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Total Charges</p>
              <p className="text-xl font-bold tabular-nums">${claim.totalCharges.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Total Paid</p>
              <p className="text-xl font-bold tabular-nums text-[#047857]">${claim.totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Balance</p>
              <p className={`text-xl font-bold tabular-nums ${claim.balance > 0 ? 'text-[#B91C1C]' : 'text-[#676687]'}`}>
                ${claim.balance.toFixed(2)}
              </p>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Payer</p>
              <p className="text-sm font-medium text-[#12122C]">{claim.payerName}</p>
            </div>
          </div>
          <div className="bg-white border border-[#E3E3F1] rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-[#676687]">DOS:</span>
                <span className="ml-2 font-mono">{claim.dos ? format(new Date(claim.dos), 'MM/dd/yyyy') : '—'}</span>
              </div>
              <div>
                <span className="text-[#676687]">Submitted:</span>
                <span className="ml-2 font-mono">{claim.submittedAt ? format(new Date(claim.submittedAt), 'MM/dd/yyyy') : 'Not yet'}</span>
              </div>
              <div>
                <span className="text-[#676687]">Adjudicated:</span>
                <span className="ml-2 font-mono">{claim.adjudicatedAt ? format(new Date(claim.adjudicatedAt), 'MM/dd/yyyy') : '—'}</span>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* Validation Tab */}
        <TabPanel id="validation" className="pt-4 space-y-3">
          {claim.validationErrors.length === 0 ? (
            <div className="flex items-center gap-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg p-4">
              <CheckCircle size={18} className="text-[#047857]" />
              <p className="text-sm text-[#047857] font-medium">No validation errors. Claim is ready to submit.</p>
            </div>
          ) : (
            <>
              {blockingErrors.length > 0 && (
                <div className="border border-[#FECACA] rounded-lg overflow-hidden">
                  <div className="bg-[#FEF2F2] px-4 py-2.5 flex items-center gap-2">
                    <XCircle size={15} className="text-[#B91C1C]" />
                    <span className="text-sm font-semibold text-[#B91C1C]">{blockingErrors.length} Blocking Errors</span>
                  </div>
                  <div className="divide-y divide-[#FECACA]">
                    {blockingErrors.map((e: ValidationError) => (
                      <div key={e.id} className="px-4 py-3 bg-white">
                        <p className="text-sm text-[#B91C1C] font-medium">{e.message}</p>
                        {e.field && <p className="text-xs text-[#676687] mt-0.5">Field: <span className="font-mono">{e.field}</span></p>}
                        {e.suggestion && <p className="text-xs text-[#676687] mt-0.5">Suggestion: {e.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {validationWarnings.length > 0 && (
                <div className="border border-[#FDE68A] rounded-lg overflow-hidden">
                  <div className="bg-[#FFFBEB] px-4 py-2.5 flex items-center gap-2">
                    <AlertTriangle size={15} className="text-[#B45309]" />
                    <span className="text-sm font-semibold text-[#B45309]">{validationWarnings.length} Warnings</span>
                  </div>
                  <div className="divide-y divide-[#FDE68A]">
                    {validationWarnings.map((w: ValidationError) => (
                      <div key={w.id} className="px-4 py-3 bg-white">
                        <p className="text-sm text-[#B45309] font-medium">{w.message}</p>
                        {w.suggestion && <p className="text-xs text-[#676687] mt-0.5">{w.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabPanel>

        {/* Service Lines Tab */}
        <TabPanel id="lines" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#F2F2F8]">
                <tr>
                  {['#', 'CPT', 'Description', 'Modifiers', 'DX Ptrs', 'DOS', 'POS', 'Charge', 'Units', 'Paid', 'Adj', 'Balance', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#676687] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E3F1]">
                {claim.claimLines?.map(line => (
                  <tr key={line.id} className="hover:bg-[#F2F2F8]">
                    <td className="px-3 py-2 font-mono text-[#676687]">{line.seq}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-[#0410BD]">{line.cptCode}</td>
                    <td className="px-3 py-2 text-[#676687] max-w-32 truncate">{line.cptDescription}</td>
                    <td className="px-3 py-2 font-mono">{line.modifiers.filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-3 py-2 font-mono">{line.dxPointers.join('')}</td>
                    <td className="px-3 py-2 font-mono text-[#676687] whitespace-nowrap">
                      {line.dosFrom ? format(new Date(line.dosFrom), 'MM/dd/yy') : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono">{line.pos}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${line.charge.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.units}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#047857]">
                      {line.paid != null ? `$${line.paid.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#676687]">
                      {line.adjustment != null ? `$${line.adjustment.toFixed(2)}` : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${(line.balance ?? 0) > 0 ? 'text-[#B91C1C]' : 'text-[#676687]'}`}>
                      ${(line.balance ?? line.charge).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {line.status ? <StatusBadge status={line.status} size="sm" /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabPanel>

        {/* Providers Tab */}
        <TabPanel id="providers" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-3 max-w-md">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Rendering Provider ID</p>
                <p className="font-mono">{claim.renderingProviderId}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Billing Provider ID</p>
                <p className="font-mono">{claim.billingProviderId}</p>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* Submission History Tab */}
        <TabPanel id="submissions" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
            {claim.submittedAt ? (
              <table className="w-full text-sm">
                <thead className="bg-[#F2F2F8]">
                  <tr>
                    {['Submitted', 'By', 'Method', 'Status', 'Response'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-[#F2F2F8]">
                    <td className="px-4 py-3 font-mono text-[#676687]">{format(new Date(claim.submittedAt), 'MM/dd/yyyy HH:mm')}</td>
                    <td className="px-4 py-3">System</td>
                    <td className="px-4 py-3">EDI 837P</td>
                    <td className="px-4 py-3"><StatusBadge status={claim.status} size="sm" /></td>
                    <td className="px-4 py-3 text-[#676687]">—</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center text-sm text-[#676687]">No submissions yet.</div>
            )}
          </div>
        </TabPanel>

        {/* Payments Tab */}
        <TabPanel id="payments" className="pt-4">
          <p className="text-sm text-[#676687]">Payment records for this claim will appear here.</p>
        </TabPanel>

        {/* Notes Tab */}
        <TabPanel id="notes" className="pt-4">
          <p className="text-sm text-[#676687]">Claim notes will appear here.</p>
        </TabPanel>

        {/* CMS-1500 Preview Tab */}
        <TabPanel id="cms1500" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg p-6 font-mono text-xs max-w-4xl">
            <div className="border-2 border-gray-800 p-4">
              <div className="text-center font-bold text-sm mb-4 border-b border-gray-800 pb-2">
                HEALTH INSURANCE CLAIM FORM
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="border border-gray-300 p-2">
                    <p className="text-[9px] text-gray-500 uppercase">1a. Insured's ID Number</p>
                    <p className="mt-1">— — —</p>
                  </div>
                  <div className="border border-gray-300 p-2">
                    <p className="text-[9px] text-gray-500 uppercase">2. Patient Name</p>
                    <p className="mt-1">
                      {claim.patient
                        ? `${claim.patient.lastName.toUpperCase()}, ${claim.patient.firstName.toUpperCase()}`
                        : '—'}
                    </p>
                  </div>
                  <div className="border border-gray-300 p-2">
                    <p className="text-[9px] text-gray-500 uppercase">3. Patient DOB / Sex</p>
                    <p className="mt-1">
                      {claim.patient
                        ? `${claim.patient.dateOfBirth} / ${claim.patient.gender}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="border border-gray-300 p-2">
                    <p className="text-[9px] text-gray-500 uppercase">21. Diagnosis Codes</p>
                    <div className="mt-1 grid grid-cols-2 gap-x-4">
                      {claim.visit?.diagnoses?.map(dx => (
                        <div key={dx.id}>{dx.pointer}. {dx.code}</div>
                      )) ?? <span>—</span>}
                    </div>
                  </div>
                  <div className="border border-gray-300 p-2">
                    <p className="text-[9px] text-gray-500 uppercase">24. Service Lines</p>
                    <div className="mt-1 space-y-0.5">
                      {claim.claimLines?.map(line => (
                        <div key={line.id} className="flex gap-2">
                          <span>{line.dosFrom ? format(new Date(line.dosFrom), 'MM/dd/yy') : '—'}</span>
                          <span>{line.pos}</span>
                          <span className="font-bold">{line.cptCode}</span>
                          <span>{line.modifiers.filter(Boolean).join(' ')}</span>
                          <span>{line.dxPointers.join('')}</span>
                          <span className="ml-auto">${line.charge.toFixed(2)}</span>
                          <span>{line.units}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-gray-300 pt-2 grid grid-cols-3 gap-4">
                <div className="border border-gray-300 p-2">
                  <p className="text-[9px] text-gray-500 uppercase">28. Total Charge</p>
                  <p className="mt-1 font-bold">${claim.totalCharges.toFixed(2)}</p>
                </div>
                <div className="border border-gray-300 p-2">
                  <p className="text-[9px] text-gray-500 uppercase">29. Amount Paid</p>
                  <p className="mt-1">${claim.totalPaid.toFixed(2)}</p>
                </div>
                <div className="border border-gray-300 p-2">
                  <p className="text-[9px] text-gray-500 uppercase">30. Balance Due</p>
                  <p className="mt-1 font-bold text-[#B91C1C]">${claim.balance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        {/* Lifecycle Tab */}
        <TabPanel id="lifecycle" className="pt-4">
          <div className="relative max-w-lg">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-[#E3E3F1]" />
            <div className="space-y-4">
              {mockLifecycle.map((event, i) => {
                const Icon = event.icon
                return (
                  <div key={i} className="relative flex gap-4 items-start">
                    <div
                      className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center bg-white border-2 flex-shrink-0"
                      style={{ borderColor: event.color }}
                    >
                      <Icon size={18} style={{ color: event.color }} />
                    </div>
                    <div className="bg-white border border-[#E3E3F1] rounded-lg px-4 py-3 flex-1 shadow-sm">
                      <p className="text-sm font-medium text-[#12122C]">{event.label}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-[#676687] flex items-center gap-1">
                          <Clock size={11} />{event.time}
                        </span>
                        <span className="text-xs text-[#676687] flex items-center gap-1">
                          <User size={11} />{event.by}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabPanel>
      </Tabs>

      {/* Submit confirmation modal */}
      <Modal
        open={submitConfirmOpen}
        onClose={() => setSubmitConfirmOpen(false)}
        title="Submit Claim"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={submitClaim.isPending} onClick={handleSubmit}>
              Submit Claim
            </Button>
          </>
        }
      >
        <p className="text-sm text-[#676687]">
          Submit claim <span className="font-mono font-semibold text-[#12122C]">{claim.claimNumber}</span> to {claim.payerName}?
          {validationWarnings.length > 0 && (
            <span className="block mt-2 text-[#B45309]">
              Note: {validationWarnings.length} warning{validationWarnings.length > 1 ? 's' : ''} were found. You may proceed, but review them first.
            </span>
          )}
        </p>
      </Modal>
    </div>
  )
}
