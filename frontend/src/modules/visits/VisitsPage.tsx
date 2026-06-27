import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Select'
import { apiClient as api } from '../../services/api'

interface Visit {
  id: string
  visitDate: string
  patientName: string
  provider: string
  dos: string
  procedureCodes: string
  status: string
  billedAmount: number
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  if (s === 'Completed') return 'success'
  if (s === 'Scheduled') return 'info'
  if (s === 'Cancelled') return 'danger'
  return 'default'
}

export function VisitsPage() {
  const [status, setStatus] = useState('')
  const [provider, setProvider] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['visits', status, provider],
    queryFn: async () => {
      try {
        const res = await api.get('/visits', { params: { status, provider } })
        return res.data
      } catch {
        return {
          items: [
            { id: '1', visitDate: '2026-06-26', patientName: 'Johnson, Mary', provider: 'Dr. Smith', dos: '2026-06-26', procedureCodes: '99213, 85025', status: 'Completed', billedAmount: 185.00 },
            { id: '2', visitDate: '2026-06-27', patientName: 'Williams, Robert', provider: 'Dr. Johnson', dos: '2026-06-27', procedureCodes: '99202', status: 'Scheduled', billedAmount: 0 },
            { id: '3', visitDate: '2026-06-25', patientName: 'Davis, Susan', provider: 'Dr. Smith', dos: '2026-06-25', procedureCodes: '99214, 93000', status: 'Completed', billedAmount: 320.00 },
          ],
          total: 3,
        }
      }
    },
  })

  const columns: Column<Visit>[] = [
    { key: 'visitDate', header: 'Visit Date' },
    { key: 'patientName', header: 'Patient Name', render: r => <span style={{ fontWeight: 500 }}>{r.patientName}</span> },
    { key: 'provider', header: 'Provider' },
    { key: 'dos', header: 'DOS' },
    { key: 'procedureCodes', header: 'Procedure Codes', render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.procedureCodes}</span> },
    { key: 'status', header: 'Status', render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
    { key: 'billedAmount', header: 'Billed', render: r => r.billedAmount > 0 ? `$${r.billedAmount.toFixed(2)}` : '—' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Visits</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Encounter management</p>
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            options={[{ value: '', label: 'All Statuses' }, { value: 'Completed', label: 'Completed' }, { value: 'Scheduled', label: 'Scheduled' }, { value: 'Cancelled', label: 'Cancelled' }]}
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{ width: 160 }}
          />
          <Select
            options={[{ value: '', label: 'All Providers' }, { value: 'dr-smith', label: 'Dr. Smith' }, { value: 'dr-johnson', label: 'Dr. Johnson' }]}
            value={provider}
            onChange={e => setProvider(e.target.value)}
            style={{ width: 180 }}
          />
        </div>
        <DataTable
          columns={columns}
          data={data?.items || []}
          isLoading={isLoading}
          emptyMessage="No visits found"
        />
      </div>
    </div>
  )
}
