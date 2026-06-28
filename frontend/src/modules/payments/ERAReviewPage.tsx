import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, SkipForward, Link2 } from 'lucide-react'
import { PageHeader } from '../../components/shell/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../services/api'
import { clsx } from 'clsx'
import { useState } from 'react'

// Mock ERA claim payment data for display
const MOCK_ERA_PAYMENTS = [
  {
    id: '1',
    claimNumber: 'CLM-001',
    patientName: '••••• •••••',
    dos: '2024-01-10',
    billedAmount: 450.00,
    paidAmount: 360.00,
    adjustments: [
      { groupCode: 'CO', reasonCode: '45', description: 'Charge exceeds fee schedule/maximum allowable.', amount: 90.00 }
    ],
    matchedClaimId: 'abc123',
    matchConfidence: 0.98,
    status: 'matched' as const,
  },
  {
    id: '2',
    claimNumber: 'CLM-002',
    patientName: '••••• •••••',
    dos: '2024-01-11',
    billedAmount: 300.00,
    paidAmount: 240.00,
    adjustments: [
      { groupCode: 'CO', reasonCode: '45', description: 'Charge exceeds fee schedule.', amount: 60.00 }
    ],
    matchedClaimId: null,
    matchConfidence: null,
    status: 'unmatched' as const,
  },
]

export function ERAReviewPage() {
  useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [posted, setPosted] = useState<Set<string>>(new Set())

  async function handlePost(paymentId: string) {
    setProcessing(p => ({ ...p, [paymentId]: true }))
    try {
      await api.payments.postEraPayment(paymentId)
      setPosted(prev => new Set([...prev, paymentId]))
      addToast({ variant: 'success', message: 'Payment posted successfully.' })
    } catch {
      addToast({ variant: 'error', message: 'Failed to post payment.' })
    } finally {
      setProcessing(p => ({ ...p, [paymentId]: false }))
    }
  }

  async function handleSkip(paymentId: string, reason: string) {
    setProcessing(p => ({ ...p, [paymentId]: true }))
    try {
      await api.payments.skipEraPayment(paymentId, reason)
      setSkipped(prev => new Set([...prev, paymentId]))
      addToast({ variant: 'info', message: 'Payment skipped.' })
    } catch {
      addToast({ variant: 'error', message: 'Failed to skip payment.' })
    } finally {
      setProcessing(p => ({ ...p, [paymentId]: false }))
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <button onClick={() => navigate('/payments')} className="flex items-center gap-1.5 text-sm text-[#676687] hover:text-[#12122C]">
        <ArrowLeft size={14} />Back to Payments
      </button>

      <PageHeader
        eyebrow="ERA Review"
        title="ERA File Review"
        description="Review and post matched ERA payments"
      />

      <div className="space-y-4">
        {MOCK_ERA_PAYMENTS.map(payment => {
          const isPosted = posted.has(payment.id)
          const isSkipped = skipped.has(payment.id)
          const isProcessing = processing[payment.id]

          return (
            <div
              key={payment.id}
              className={clsx(
                'bg-white border rounded-lg overflow-hidden',
                payment.status === 'matched' ? 'border-[#A7F3D0]' : 'border-[#FDE68A]',
                (isPosted || isSkipped) && 'opacity-60',
              )}
            >
              {/* Header bar */}
              <div className={clsx(
                'flex items-center justify-between px-4 py-2.5',
                payment.status === 'matched' ? 'bg-[#ECFDF5]' : 'bg-[#FFFBEB]',
              )}>
                <div className="flex items-center gap-3">
                  <Badge variant={payment.status === 'matched' ? 'success' : 'warning'} size="sm">
                    {payment.status === 'matched' ? 'Matched' : 'Unmatched'}
                  </Badge>
                  <span className="text-sm font-mono font-semibold">{payment.claimNumber}</span>
                  <span className="text-sm text-[#676687]">{payment.patientName}</span>
                  {payment.matchConfidence && (
                    <span className="text-xs text-[#047857] bg-[#ECFDF5] px-1.5 py-0.5 rounded-full">
                      {Math.round(payment.matchConfidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPosted ? (
                    <Badge variant="success" size="sm">Posted</Badge>
                  ) : isSkipped ? (
                    <Badge variant="inactive" size="sm">Skipped</Badge>
                  ) : (
                    <>
                      {payment.status === 'unmatched' && (
                        <Button size="xs" variant="secondary" leftIcon={<Link2 size={12} />}>
                          Manual Match
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="secondary"
                        leftIcon={<SkipForward size={12} />}
                        loading={isProcessing}
                        onClick={() => handleSkip(payment.id, 'Manual skip')}
                      >
                        Skip
                      </Button>
                      {payment.status === 'matched' && (
                        <Button
                          size="xs"
                          variant="primary"
                          leftIcon={<CheckCircle size={12} />}
                          loading={isProcessing}
                          onClick={() => handlePost(payment.id)}
                        >
                          Post
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-0 divide-x divide-[#E3E3F1]">
                {/* ERA Data side */}
                <div className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#676687] mb-3">ERA Data</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#676687]">DOS</span>
                      <span className="font-mono">{payment.dos}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#676687]">Billed</span>
                      <span className="tabular-nums">${payment.billedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#676687]">Paid</span>
                      <span className="tabular-nums font-semibold text-[#047857]">${payment.paidAmount.toFixed(2)}</span>
                    </div>
                    {payment.adjustments.map((adj, i) => (
                      <div key={i} className="bg-[#FFFBEB] rounded p-2 mt-2">
                        <p className="text-[10px] font-semibold text-[#B45309]">
                          {adj.groupCode}-{adj.reasonCode}: ${adj.amount.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-[#676687] mt-0.5">{adj.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matched Claim side */}
                <div className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#676687] mb-3">
                    {payment.matchedClaimId ? 'Matched Claim' : 'No Match Found'}
                  </p>
                  {payment.matchedClaimId ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#676687]">Claim ID</span>
                        <span className="font-mono text-[#0410BD]">{payment.matchedClaimId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#676687]">Billed</span>
                        <span className="tabular-nums">${payment.billedAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded p-3">
                      <p className="text-xs text-[#B45309]">
                        No matching claim found. Use Manual Match to link this payment to a claim.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
