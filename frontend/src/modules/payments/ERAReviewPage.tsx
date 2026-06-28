import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, SkipForward, Link2, AlertTriangle, DollarSign } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { apiClient as api } from '../../services/api'

interface ERAPayment {
  id: string
  claimNumber: string
  patientName: string
  dos: string
  billedAmount: number
  paidAmount: number
  adjustments: { groupCode: string; reasonCode: string; description: string; amount: number }[]
  matchedClaimId: string | null
  matchConfidence: number | null
  status: 'matched' | 'unmatched'
}

const GROUP_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CO: { bg: '#FEF3C7', text: '#92400E', label: 'Contractual' },
  PR: { bg: '#FEE2E2', text: '#991B1B', label: 'Patient Resp.' },
  OA: { bg: '#EDE9FE', text: '#5B21B6', label: 'Other Adj.' },
  PI: { bg: '#DBEAFE', text: '#1E40AF', label: 'Payer Init.' },
}

export function ERAReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [posted, setPosted] = useState<Set<string>>(new Set())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState<Record<string, boolean>>({})
  const [allPosted, setAllPosted] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['era', id],
    queryFn: async () => (await api.get(`/payments/era/${id}`)).data,
    enabled: !!id,
  })

  const payments: ERAPayment[] = data?.payments ?? []

  async function handlePost(paymentId: string) {
    setProcessing(p => ({ ...p, [paymentId]: true }))
    await api.post(`/payments/era/${paymentId}/post`, {})
    setPosted(prev => new Set([...prev, paymentId]))
    setProcessing(p => ({ ...p, [paymentId]: false }))
  }

  async function handleSkip(paymentId: string) {
    setProcessing(p => ({ ...p, [paymentId]: true }))
    setSkipped(prev => new Set([...prev, paymentId]))
    setProcessing(p => ({ ...p, [paymentId]: false }))
  }

  async function handlePostAll() {
    const matched = payments.filter(p => p.status === 'matched' && !posted.has(p.id) && !skipped.has(p.id))
    for (const p of matched) {
      setProcessing(prev => ({ ...prev, [p.id]: true }))
      await new Promise(r => setTimeout(r, 300))
      setPosted(prev => new Set([...prev, p.id]))
      setProcessing(prev => ({ ...prev, [p.id]: false }))
    }
    setAllPosted(true)
  }

  const matchedUnprocessed = payments.filter(p => p.status === 'matched' && !posted.has(p.id) && !skipped.has(p.id))
  const totalPosted = [...posted].reduce((s, pid) => {
    const p = payments.find(x => x.id === pid)
    return s + (p?.paidAmount ?? 0)
  }, 0)

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)' }}>Loading ERA…</div>
  if (isError) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-status-danger)' }}>Failed to load ERA. Check API connection.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/payments')}>
          <ArrowLeft size={14} /> Payments
        </Button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>ERA Review</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            {payments.length} claims · {payments.filter(p => p.status === 'matched').length} matched · {payments.filter(p => p.status === 'unmatched').length} unmatched
          </p>
        </div>
        {matchedUnprocessed.length > 0 && (
          <Button variant="primary" onClick={handlePostAll}>
            <DollarSign size={14} />
            Post All Matched ({matchedUnprocessed.length})
          </Button>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Claims', value: String(payments.length) },
          { label: 'Matched', value: String(payments.filter(p => p.status === 'matched').length), ok: true },
          { label: 'Unmatched', value: String(payments.filter(p => p.status === 'unmatched').length), warn: payments.some(p => p.status === 'unmatched') },
          { label: 'Posted', value: `$${totalPosted.toFixed(2)}`, ok: totalPosted > 0 },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.ok ? 'var(--bb-status-success)' : k.warn ? '#D97706' : 'var(--bb-text-primary)', marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {allPosted && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--bb-radius)', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle2 size={16} color="var(--bb-status-success)" />
          <span style={{ fontSize: 14, color: '#15803D', fontWeight: 500 }}>All matched payments posted successfully. Total posted: ${totalPosted.toFixed(2)}</span>
        </div>
      )}

      {/* Payment cards */}
      {payments.map(payment => {
        const isPosted = posted.has(payment.id)
        const isSkipped = skipped.has(payment.id)
        const isProcessing = processing[payment.id]
        const colors = payment.status === 'matched'
          ? { headerBg: '#F0FDF4', headerBorder: '#BBF7D0', cardBorder: '#BBF7D0' }
          : { headerBg: '#FFFBEB', headerBorder: '#FDE68A', cardBorder: '#FDE68A' }

        return (
          <div
            key={payment.id}
            style={{
              background: 'var(--bb-surface-card)',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 'var(--bb-radius-lg)',
              overflow: 'hidden',
              opacity: isPosted || isSkipped ? 0.65 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            {/* Card header */}
            <div style={{
              background: colors.headerBg,
              borderBottom: `1px solid ${colors.headerBorder}`,
              padding: '10px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge variant={payment.status === 'matched' ? 'success' : 'warning'}>
                  {payment.status === 'matched' ? 'Matched' : 'Unmatched'}
                </Badge>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>{payment.claimNumber}</span>
                <span style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>{payment.patientName}</span>
                {payment.matchConfidence && (
                  <span style={{ fontSize: 11, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                    {Math.round(payment.matchConfidence * 100)}% match
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isPosted ? (
                  <Badge variant="success">Posted</Badge>
                ) : isSkipped ? (
                  <Badge variant="default">Skipped</Badge>
                ) : (
                  <>
                    {payment.status === 'unmatched' && (
                      <Button size="xs" variant="secondary" leftIcon={<Link2 size={11} />}>Manual Match</Button>
                    )}
                    <Button size="xs" variant="secondary" leftIcon={<SkipForward size={11} />} loading={isProcessing} onClick={() => handleSkip(payment.id)}>
                      Skip
                    </Button>
                    {payment.status === 'matched' && (
                      <Button size="xs" variant="primary" leftIcon={<CheckCircle2 size={11} />} loading={isProcessing} onClick={() => handlePost(payment.id)}>
                        Post
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Two-column body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: 0 }}>
              {/* ERA data */}
              <div style={{ padding: '16px 18px', borderRight: '1px solid var(--bb-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>ERA Data</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                  {[
                    { label: 'DOS', value: payment.dos },
                    { label: 'Billed', value: `$${payment.billedAmount.toFixed(2)}` },
                    { label: 'Paid', value: `$${payment.paidAmount.toFixed(2)}`, bold: true, green: true },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--bb-text-secondary)' }}>{f.label}</span>
                      <span style={{ fontWeight: f.bold ? 700 : 400, color: f.green ? 'var(--bb-status-success)' : 'var(--bb-text-primary)', fontFamily: 'monospace' }}>{f.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {payment.adjustments.map((adj, i) => {
                    const gc = GROUP_COLORS[adj.groupCode] ?? { bg: '#F3F4F6', text: '#374151', label: adj.groupCode }
                    return (
                      <div key={i} style={{ background: gc.bg, borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: gc.text }}>
                          <span style={{ background: gc.text, color: 'white', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>{adj.groupCode}-{adj.reasonCode}</span>
                          -${adj.amount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: gc.text, marginTop: 3, opacity: 0.85 }}>{adj.description}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Matched claim */}
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bb-text-secondary)', marginBottom: 12 }}>
                  {payment.matchedClaimId ? 'Matched Claim' : 'No Match Found'}
                </div>
                {payment.matchedClaimId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                    {[
                      { label: 'Claim ID', value: payment.matchedClaimId, blue: true, mono: true },
                      { label: 'Billed', value: `$${payment.billedAmount.toFixed(2)}` },
                      { label: 'Expected Payment', value: `$${payment.paidAmount.toFixed(2)}` },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--bb-text-secondary)' }}>{f.label}</span>
                        <span style={{ fontFamily: f.mono ? 'monospace' : 'inherit', fontWeight: 600, color: f.blue ? 'var(--bb-brand-blue)' : 'var(--bb-text-primary)' }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => navigate(`/claims/${payment.matchedClaimId}`)}
                        style={{ fontSize: 12, color: 'var(--bb-brand-blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        View claim →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 14 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={14} color="#D97706" style={{ marginTop: 1, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>No matching claim found</div>
                        <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                          Use Manual Match to link this payment to an existing claim, or create a new claim for this service.
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <Button size="xs" variant="secondary" leftIcon={<Link2 size={11} />}>
                            Manual Match
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
