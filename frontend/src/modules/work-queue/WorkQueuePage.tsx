import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { apiClient as api } from '../../services/api'

interface WorkItem {
  id: string
  priority: 'high' | 'medium' | 'low'
  taskType: string
  patient: string
  claimId: string
  assignedTo: string
  dueDate: string
  ageDays: number
}

const priorityVariant = (p: string): 'danger' | 'warning' | 'info' | 'default' => {
  if (p === 'high') return 'danger'
  if (p === 'medium') return 'warning'
  return 'info'
}

export function WorkQueuePage() {
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['work-queue', priority, type],
    queryFn: async () => {
      try {
        const res = await api.get('/work-queue', { params: { priority, type } })
        return res.data
      } catch {
        return {
          items: [
            { id: '1', priority: 'high', taskType: 'Denial Follow-up', patient: 'Davis, Susan', claimId: 'A10044', assignedTo: 'J. Martinez', dueDate: '2026-06-28', ageDays: 5 },
            { id: '2', priority: 'high', taskType: 'Missing Information', patient: 'Brown, James', claimId: 'A10045', assignedTo: 'K. Thompson', dueDate: '2026-06-28', ageDays: 4 },
            { id: '3', priority: 'medium', taskType: 'Authorization Required', patient: 'Johnson, Mary', claimId: 'A10046', assignedTo: 'J. Martinez', dueDate: '2026-06-30', ageDays: 2 },
            { id: '4', priority: 'medium', taskType: 'Claim Resubmission', patient: 'Williams, Robert', claimId: 'A10043', assignedTo: 'Unassigned', dueDate: '2026-07-01', ageDays: 3 },
            { id: '5', priority: 'low', taskType: 'Patient Statement', patient: 'Anderson, Lisa', claimId: '—', assignedTo: 'K. Thompson', dueDate: '2026-07-05', ageDays: 1 },
          ],
          total: 5,
        }
      }
    },
  })

  const columns: Column<WorkItem>[] = [
    { key: 'priority', header: 'Priority', render: r => <Badge variant={priorityVariant(r.priority)}>{r.priority.toUpperCase()}</Badge> },
    { key: 'taskType', header: 'Task Type', render: r => <span style={{ fontWeight: 500 }}>{r.taskType}</span> },
    { key: 'patient', header: 'Patient' },
    { key: 'claimId', header: 'Claim', render: r => r.claimId !== '—' ? <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--bb-brand-blue)' }}>{r.claimId}</span> : <span style={{ color: 'var(--bb-text-secondary)' }}>—</span> },
    { key: 'assignedTo', header: 'Assigned To' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'ageDays', header: 'Age', render: r => <span style={{ color: r.ageDays > 3 ? 'var(--bb-status-danger)' : 'var(--bb-text-secondary)', fontWeight: r.ageDays > 3 ? 600 : 400 }}>{r.ageDays}d</span> },
    {
      key: 'actions', header: 'Actions',
      render: () => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" size="sm">View</Button>
          <Button variant="secondary" size="sm">Reassign</Button>
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Work Queue</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Denial management and follow-up tasks</p>
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 12 }}>
          <Select
            options={[{ value: '', label: 'All Priorities' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]}
            value={priority}
            onChange={e => setPriority(e.target.value)}
            style={{ width: 160 }}
          />
          <Select
            options={[{ value: '', label: 'All Types' }, { value: 'denial', label: 'Denial Follow-up' }, { value: 'auth', label: 'Authorization' }, { value: 'missing', label: 'Missing Info' }]}
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ width: 180 }}
          />
        </div>
        <DataTable
          columns={columns as Column<Record<string, unknown>>[]}
          data={(data?.items || []) as Record<string, unknown>[]}
          isLoading={isLoading}
          emptyMessage="Work queue is empty"
        />
      </div>
    </div>
  )
}
