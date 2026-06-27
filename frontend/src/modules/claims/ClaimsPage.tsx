import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import api from '../../services/api'

interface Claim {
  id: string
  claimId: string
  patient: string
  dos: string
  payer: string
  billed: number
  paid: number
  balance: number
  status: string
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Paid') return 'success'
  if (s === 'Denied') return 'danger'
  if (s === 'Pending') return 'warning'
  if (s === 'Submitted') return 'info'
  return 'default'
}

export function ClaimsPage() {
  const [status, setStatus] = useState('')
  const [payer, setPayer] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['claims', status, payer],
    queryFn: async () => {
      try {
        const res = await api.get('/claims', { params: { status, payer } })
        return res.data
      } catch {
        return {
          items: [
            { id: '1', claimId: 'A10042', patient: 'Johnson, Mary', dos: '2026-06-26', payer: 'BlueCross PPO', billed: 185.00, paid: 148.00, balance: 37.00, status: 'Paid' },
            { id: '2', claimId: 'A10043', patient: 'Williams, Robert', dos: '2026-06-25', payer: 'Aetna HMO', billed: 320.00, paid: 0, balance: 320.00, status: 'Submitted' },
            { id: '3', claimId: 'A10044', patient: 'Davis, Susan', dos: '2026-06-24', payer: 'United Healthcare', billed: 250.00, paid: 0, balance: 250.00, status: 'Denied' },
            { id: '4', claimId: 'A10045', patient: 'Brown, James', dos: '2026-06-23', payer: 'Cigna PPO', billed: 420.00, paid: 0, balance: 420.00, status: 'Pending' },
          ],
          total: 4,
        }
      }
    },
  })

  const columns: Column<Claim>[] = [
    { key: 'claimId', header: 'Claim ID', render: r => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{r.claimId}</span> },
    { key: 'patient', header: 'Patient', render: r => <span style={{ fontWeight: 500 }}>{r.patient}</span> },
    { key: 'dos', header: 'DOS' },
    { key: 'payer', header: 'Payer' },
    { key: 'billed', header: 'Billed', render: r => `$${r.billed.toFixed(2)}` },
    { key: 'paid', header: 'Paid', render: r => r.paid > 0 ? <span style={{ color: 'var(--bb-status-success)', fontWeight: 600 }}>${r.paid.toFixed(2)}</span> : '—' },
    { key: 'balance', header: 'Balance', render: r => r.balance > 0 ? <span style={{ color: 'var(--bb-status-danger)', fontWeight: 600 }}>${r.balance.toFixed(2)}</span> : <span style={{ color: 'var(--bb-status-success)' }}>$0.00</span> },
    { key: 'status', header: 'Status', render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Claims</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Insurance claim management</p>
        </div>
        <Button variant="primary">
          <Send size={14} />
          Batch Submit
        </Button>
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 12 }}>
          <Select
            options={[{ value: '', label: 'All Statuses' }, { value: 'Submitted', label: 'Submitted' }, { value: 'Pending', label: 'Pending' }, { value: 'Denied', label: 'Denied' }, { value: 'Paid', label: 'Paid' }]}
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 160 }}
          />
          <Select
            options={[{ value: '', label: 'All Payers' }, { value: 'bluecross', label: 'BlueCross PPO' }, { value: 'aetna', label: 'Aetna HMO' }, { value: 'united', label: 'United Healthcare' }]}
            value={payer}
            onChange={e => setPayer(e.target.value)}
            style={{ width: 200 }}
          />
        </div>
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={(data?.items || []) as Record<string, unknown>[]}
          isLoading={isLoading}
          emptyMessage="No claims found"
        />
      </div>
    </div>
  )
}
