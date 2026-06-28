import { useState } from 'react'
import { X, DollarSign, Search, Trash2, CheckCircle2 } from 'lucide-react'
import { apiClient as api } from '../../services/api'

interface ClaimOption {
  id: string
  claim_number: string
  patient_name: string
  date_of_service: string
  billed: number
  balance: number
}

interface Application {
  claim_id: string
  claim_number: string
  patient_name: string
  applied_amount: string
  adjustment_amount: string
  carc_code: string
}

interface Props {
  onClose: () => void
  onSuccess?: () => void
}

const inp: React.CSSProperties = {
  height: 36, border: '1px solid #D1D5DB', borderRadius: 7,
  padding: '0 10px', fontSize: 13, color: '#12122C', outline: 'none',
  background: 'white', width: '100%',
}

const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

export function PostPaymentModal({ onClose, onSuccess }: Props) {
  const [paymentType, setPaymentType] = useState('check')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [checkNumber, setCheckNumber] = useState('')
  const [payerType, setPayerType] = useState<'payer' | 'patient'>('payer')
  const [payerName, setPayerName] = useState('')
  const [notes, setNotes] = useState('')

  const [claimSearch, setClaimSearch] = useState('')
  const [claimResults, setClaimResults] = useState<ClaimOption[]>([])
  const [applications, setApplications] = useState<Application[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function searchClaims(q: string) {
    if (q.length < 2) { setClaimResults([]); return }
    try {
      const res = await api.get('/claims', { params: { search: q, status: 'submitted', limit: 10 } })
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      setClaimResults(items.map((c: { id: string; claim_number: string; patient_name?: string; date_of_service?: string; total_charge?: number; balance?: number }) => ({
        id: c.id,
        claim_number: c.claim_number || c.id.slice(0, 8),
        patient_name: c.patient_name || 'Patient',
        date_of_service: c.date_of_service || '',
        billed: c.total_charge || 0,
        balance: c.balance || c.total_charge || 0,
      })))
    } catch { setClaimResults([]) }
  }

  function addApplication(claim: ClaimOption) {
    if (applications.find(a => a.claim_id === claim.id)) return
    setApplications(prev => [...prev, {
      claim_id: claim.id,
      claim_number: claim.claim_number,
      patient_name: claim.patient_name,
      applied_amount: claim.balance.toFixed(2),
      adjustment_amount: '0.00',
      carc_code: '',
    }])
    setClaimSearch('')
    setClaimResults([])
  }

  function updateApplication(i: number, key: keyof Application, val: string) {
    setApplications(prev => {
      const copy = [...prev]
      copy[i] = { ...copy[i], [key]: val }
      return copy
    })
  }

  function removeApplication(i: number) {
    setApplications(prev => prev.filter((_, idx) => idx !== i))
  }

  const totalApplied = applications.reduce((s, a) => s + (parseFloat(a.applied_amount) || 0), 0)
  const totalAdjusted = applications.reduce((s, a) => s + (parseFloat(a.adjustment_amount) || 0), 0)
  const unapplied = (parseFloat(amount) || 0) - totalApplied

  async function handleSave() {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter a payment amount'); return }
    if (!paymentDate) { setError('Payment date is required'); return }
    setSaving(true)
    setError(null)
    try {
      const paymentRes = await api.post('/payments', {
        payment_date: paymentDate,
        payment_type: paymentType,
        amount: parseFloat(amount),
        check_number: checkNumber || undefined,
        payer_name: payerName || undefined,
        notes: notes || undefined,
        payment_source: payerType,
      })
      const paymentId = paymentRes.data.id

      // Apply to claims
      for (const app of applications) {
        if (!parseFloat(app.applied_amount) && !parseFloat(app.adjustment_amount)) continue
        await api.post(`/payments/${paymentId}/apply`, {
          claim_id: app.claim_id,
          applied_amount: parseFloat(app.applied_amount) || 0,
          adjustment_amount: parseFloat(app.adjustment_amount) || 0,
          carc_code: app.carc_code || undefined,
        }).catch(() => {/* best-effort */})
      }

      setSuccess(true)
      setTimeout(() => { onSuccess?.(); onClose() }, 1200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to post payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 14, width: '100%', maxWidth: 620,
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} style={{ color: '#16A34A' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#12122C' }}>Post Payment</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Manual payment entry</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <CheckCircle2 size={48} style={{ color: '#16A34A', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C' }}>Payment Posted</div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Redirecting…</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Payment details */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Payment Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Payment Date *</label>
                    <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Amount *</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inp} placeholder="0.00" min={0} step={0.01} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Payment Type</label>
                    <select value={paymentType} onChange={e => setPaymentType(e.target.value)} style={sel}>
                      <option value="check">Check</option>
                      <option value="eft">EFT / Direct Deposit</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cash">Cash</option>
                      <option value="adjustment">Adjustment / Write-Off</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Check / Trace #</label>
                    <input value={checkNumber} onChange={e => setCheckNumber(e.target.value)} style={inp} placeholder="Check or EFT number" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Source</label>
                    <select value={payerType} onChange={e => setPayerType(e.target.value as 'payer' | 'patient')} style={sel}>
                      <option value="payer">Insurance Payer</option>
                      <option value="patient">Patient</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Payer / Patient Name</label>
                    <input value={payerName} onChange={e => setPayerName(e.target.value)} style={inp} placeholder="Name" />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inp, height: 56, resize: 'none', paddingTop: 8 } as React.CSSProperties} placeholder="Optional notes…" />
                </div>
              </div>

              {/* Apply to claims */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Apply to Claims (optional)</div>

                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E3E3F1', borderRadius: 7, padding: '0 10px' }}>
                    <Search size={13} style={{ color: '#9CA3AF' }} />
                    <input
                      value={claimSearch}
                      onChange={e => { setClaimSearch(e.target.value); searchClaims(e.target.value) }}
                      placeholder="Search claim by # or patient name…"
                      style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, height: 34, background: 'transparent' }}
                    />
                  </div>
                  {claimResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: 'white', border: '1px solid #E3E3F1', borderRadius: 8,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2,
                    }}>
                      {claimResults.map(c => (
                        <button
                          key={c.id}
                          onClick={() => addApplication(c)}
                          style={{
                            width: '100%', padding: '8px 12px', border: 'none', background: 'white',
                            cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #F3F4F6',
                            display: 'flex', justifyContent: 'space-between', fontSize: 12,
                          }}
                        >
                          <span>
                            <strong>{c.claim_number}</strong> · {c.patient_name}
                            {c.date_of_service && ` · DOS: ${c.date_of_service}`}
                          </span>
                          <span style={{ color: '#374151', fontWeight: 600 }}>Bal: ${c.balance.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {applications.length > 0 && (
                  <div style={{ border: '1px solid #E3E3F1', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Claim', 'Patient', 'Applied', 'Adjustment', 'CARC', ''].map(h => (
                            <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E3E3F1' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app, i) => (
                          <tr key={app.claim_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '5px 8px', fontWeight: 600 }}>{app.claim_number}</td>
                            <td style={{ padding: '5px 8px', color: '#374151' }}>{app.patient_name}</td>
                            <td style={{ padding: '5px 8px' }}>
                              <input type="number" value={app.applied_amount} onChange={e => updateApplication(i, 'applied_amount', e.target.value)}
                                style={{ ...inp, height: 28, width: 70, fontSize: 11 }} step={0.01} />
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <input type="number" value={app.adjustment_amount} onChange={e => updateApplication(i, 'adjustment_amount', e.target.value)}
                                style={{ ...inp, height: 28, width: 70, fontSize: 11 }} step={0.01} />
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <input value={app.carc_code} onChange={e => updateApplication(i, 'carc_code', e.target.value)}
                                style={{ ...inp, height: 28, width: 60, fontSize: 11 }} placeholder="—" maxLength={5} />
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <button onClick={() => removeApplication(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '8px 12px', background: '#F9FAFB', display: 'flex', justifyContent: 'flex-end', gap: 20, fontSize: 12 }}>
                      <span>Applied: <strong>${totalApplied.toFixed(2)}</strong></span>
                      <span>Adjusted: <strong>${totalAdjusted.toFixed(2)}</strong></span>
                      <span style={{ color: unapplied > 0.005 ? '#D97706' : '#16A34A', fontWeight: 700 }}>
                        Unapplied: ${unapplied.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!success && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {error && <div style={{ fontSize: 12, color: '#DC2626' }}>{error}</div>}
            {!error && <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ height: 36, padding: '0 16px', background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ height: 36, padding: '0 20px', background: '#0410BD', color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 13, fontWeight: 700 }}
              >
                {saving ? 'Posting…' : 'Post Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
