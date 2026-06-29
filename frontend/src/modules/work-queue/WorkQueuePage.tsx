import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Clock, User, Search, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, FileText, Send, XCircle, DollarSign, RefreshCw, Layers } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { apiClient as api } from '../../services/api'

interface WorkItem {
  id: string
  priority: 'high' | 'medium' | 'low'
  taskType: string
  category: string
  patient: string
  claimId: string
  assignedTo: string
  dueDate: string
  ageDays: number
  payer: string
  denialReason?: string
  nextAction?: string
  status: 'open' | 'in_progress' | 'resolved'
  // billing sub-queue fields
  billingSubQueue?: BillingSubQueue
  amount?: number
  claimStatus?: string
  errorCode?: string
  secondaryPayer?: string
}

type BillingSubQueue =
  | 'ready_to_bill'
  | 'validation_failures'
  | 'ready_to_submit'
  | 'rejections'
  | 'denials'
  | 'era_unmatched'
  | 'secondary_pending'
  | 'patient_balances'
  | 'aging_claims'

const CATEGORIES = ['All', 'Denials', 'Missing Info', 'Auth', 'Resubmission', 'Timely Filing', 'Patient Balance', 'Payments']

interface BillingSubQueueConfig {
  key: BillingSubQueue
  label: string
  description: string
  icon: React.ElementType
  urgencyColor: string
}

const BILLING_SUB_QUEUES: BillingSubQueueConfig[] = [
  { key: 'ready_to_bill', label: 'Ready to Bill', description: 'Visits with completed notes, ready for claim creation', icon: FileText, urgencyColor: '#0410BD' },
  { key: 'validation_failures', label: 'Validation Failures', description: 'Claims with errors blocking submission', icon: AlertCircle, urgencyColor: '#DC2626' },
  { key: 'ready_to_submit', label: 'Ready to Submit', description: 'Validated claims awaiting clearinghouse submission', icon: Send, urgencyColor: '#16A34A' },
  { key: 'rejections', label: 'Rejections', description: 'Claims rejected by the clearinghouse (999/277)', icon: XCircle, urgencyColor: '#DC2626' },
  { key: 'denials', label: 'Denials', description: 'Payer-denied claims requiring appeal or correction', icon: AlertCircle, urgencyColor: '#D97706' },
  { key: 'era_unmatched', label: 'ERA Unmatched', description: 'ERA payments that could not be auto-matched to claims', icon: RefreshCw, urgencyColor: '#D97706' },
  { key: 'secondary_pending', label: 'Secondary Pending', description: 'Primary paid, secondary claim not yet sent', icon: Layers, urgencyColor: '#7C3AED' },
  { key: 'patient_balances', label: 'Patient Balances', description: 'Claims with remaining patient responsibility', icon: DollarSign, urgencyColor: '#C2410C' },
  { key: 'aging_claims', label: 'Aging Claims', description: 'Claims 30+ days without payment or response', icon: Clock, urgencyColor: '#DC2626' },
]

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high:   { label: 'High', bg: '#FEF2F2', text: '#DC2626', dot: '#DC2626' },
  medium: { label: 'Medium', bg: '#FFFBEB', text: '#D97706', dot: '#D97706' },
  low:    { label: 'Low', bg: '#D9FCFF', text: '#007998', dot: '#007998' },
}

type WorkQueueView = 'tasks' | 'billing'

function BillingSubQueuePanel({ items, navigate }: { items: WorkItem[]; navigate: ReturnType<typeof useNavigate> }) {
  const [activeSubQueue, setActiveSubQueue] = useState<BillingSubQueue>('ready_to_bill')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: subQueueData } = useQuery({
    queryKey: ['billing-sub-queue', activeSubQueue],
    queryFn: async () => {
      try {
        const res = await api.get(`/work-queue/billing/${activeSubQueue}`)
        return res.data
      } catch {
        // Fall back to filtering work-queue items by billingSubQueue
        return { items: items.filter(i => i.billingSubQueue === activeSubQueue) }
      }
    },
  })

  const subItems: WorkItem[] = subQueueData?.items ?? items.filter(i => i.billingSubQueue === activeSubQueue)
  const filtered = search
    ? subItems.filter(i => {
        const q = search.toLowerCase()
        return i.patient.toLowerCase().includes(q) || i.claimId.toLowerCase().includes(q)
      })
    : subItems

  const countForSubQueue = (key: BillingSubQueue) => items.filter(i => i.billingSubQueue === key).length

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left nav */}
      <div style={{ width: 220, flexShrink: 0 }}>
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
          {BILLING_SUB_QUEUES.map((sq, idx) => {
            const isActive = activeSubQueue === sq.key
            const count = countForSubQueue(sq.key)
            return (
              <button
                key={sq.key}
                onClick={() => setActiveSubQueue(sq.key)}
                style={{
                  width: '100%', padding: '11px 14px', textAlign: 'left',
                  background: isActive ? '#EFF0FF' : 'white',
                  border: 'none', borderBottom: idx < BILLING_SUB_QUEUES.length - 1 ? '1px solid #F2F2F8' : 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'background 0.1s',
                }}
              >
                <sq.icon size={14} style={{ color: isActive ? '#0410BD' : '#9CA3AF', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#0410BD' : '#374151' }}>
                  {sq.label}
                </span>
                {count > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: 10, padding: '0 4px',
                    background: isActive ? '#0410BD' : '#F2F2F8',
                    color: isActive ? 'white' : '#6B6B8A',
                    fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Sub-queue header */}
        {(() => {
          const sq = BILLING_SUB_QUEUES.find(s => s.key === activeSubQueue)!
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <sq.icon size={18} style={{ color: sq.urgencyColor }} />
                <span style={{ fontSize: 17, fontWeight: 700, color: '#12122C' }}>{sq.label}</span>
                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}>— {filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ fontSize: 13, color: '#6B6B8A' }}>{sq.description}</div>
            </div>
          )
        })()}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#BABACE' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient or claim…"
            style={{ height: 34, width: '100%', paddingLeft: 32, paddingRight: 12, border: '1px solid #E0E0EF', borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Items */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#BABACE', fontSize: 13 }}>
              <CheckCircle2 size={32} color="#BABACE" style={{ display: 'block', margin: '0 auto 12px' }} />
              No items in this queue.
            </div>
          ) : filtered.map((item, idx) => {
            const pc = PRIORITY_CONFIG[item.priority]
            const isExpanded = expandedId === item.id
            return (
              <div key={item.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F2F2F8' : 'none' }}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', background: isExpanded ? '#FAFAFA' : 'transparent' }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#FAFAFA' }}
                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: pc.dot, flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>{item.patient}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0410BD', fontWeight: 700 }}>{item.claimId}</span>
                      {item.amount != null && (
                        <span style={{ fontSize: 12, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>${item.amount.toFixed(2)}</span>
                      )}
                      {item.errorCode && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', padding: '1px 6px', borderRadius: 4 }}>{item.errorCode}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B6B8A', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{item.payer}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: item.ageDays >= 30 ? '#DC2626' : item.ageDays >= 14 ? '#D97706' : '#6B6B8A' }}>
                        <Clock size={11} />{item.ageDays}d
                      </span>
                      <span>Due {item.dueDate}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pc.text, background: pc.bg, borderRadius: 4, padding: '1px 6px' }}>{pc.label}</span>
                    {isExpanded ? <ChevronUp size={14} color="#6B6B8A" /> : <ChevronDown size={14} color="#6B6B8A" />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '12px 18px 16px 38px', background: '#FAFAFA', borderTop: '1px solid #F2F2F8' }}>
                    {item.denialReason && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase', marginBottom: 4 }}>Denial / Issue Reason</div>
                        <div style={{ fontSize: 13, color: '#12122C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px' }}>{item.denialReason}</div>
                      </div>
                    )}
                    {item.nextAction && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B6B8A', textTransform: 'uppercase', marginBottom: 4 }}>Recommended Action</div>
                        <div style={{ fontSize: 13, color: '#12122C', background: '#D9FCFF', border: '1px solid #94F2FA', borderRadius: 6, padding: '8px 12px' }}>{item.nextAction}</div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => navigate(`/claims/${item.claimId}`)} style={{ height: 30, padding: '0 14px', background: '#0410BD', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View Claim</button>
                      <button
                        onClick={() => {
                          const note = window.prompt('Log action note:')
                          if (!note) return
                          api.post(`/work-queue/${item.id}/log`, { note }).catch(() => null)
                        }}
                        style={{ height: 30, padding: '0 12px', background: 'white', color: '#374151', border: '1px solid #E0E0EF', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      ><RotateCcw size={11} /> Log Action</button>
                      <button
                        onClick={() => {
                          if (!window.confirm('Mark this item as resolved?')) return
                          api.patch(`/work-queue/${item.id}`, { status: 'resolved' }).catch(() => null)
                        }}
                        style={{ height: 30, padding: '0 12px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      ><CheckCircle2 size={11} /> Resolve</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function WorkQueuePage() {
  const navigate = useNavigate()
  const [view, setView] = useState<WorkQueueView>('tasks')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignFilter, setAssignFilter] = useState('')

  const { data } = useQuery({
    queryKey: ['work-queue'],
    queryFn: async () => (await api.get('/work-queue')).data,
  })

  const allItems: WorkItem[] = data?.items ?? []

  const filtered = allItems.filter(item => {
    if (category !== 'All' && item.category !== category) return false
    if (assignFilter && item.assignedTo !== assignFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return item.patient.toLowerCase().includes(q) || item.claimId.toLowerCase().includes(q) || item.taskType.toLowerCase().includes(q)
    }
    return true
  })

  const countByCategory = (cat: string) => cat === 'All' ? allItems.length : allItems.filter(i => i.category === cat).length
  const highCount = allItems.filter(i => i.priority === 'high' && i.status === 'open').length
  const billingCount = BILLING_SUB_QUEUES.reduce((sum, sq) => sum + allItems.filter(i => i.billingSubQueue === sq.key).length, 0)

  const assignees = [...new Set(allItems.map(i => i.assignedTo))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Billing</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#12122C' }}>Work Queue</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#676687' }}>Denial management, authorization follow-ups, and billing tasks.</p>
        </div>
        {highCount > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color="#DC2626" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#DC2626' }}>{highCount} high-priority task{highCount !== 1 ? 's' : ''} need attention</span>
          </div>
        )}
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 2, background: '#F2F2F8', padding: 3, borderRadius: 8, width: 'fit-content' }}>
        {([['tasks', 'Task Queue'], ['billing', 'Billing Pipeline']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: view === v ? 'white' : 'transparent',
              color: view === v ? '#0410BD' : '#6B6B8A',
              boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {label}
            {v === 'billing' && billingCount > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: '#DC2626', color: 'white', borderRadius: 99, padding: '1px 5px' }}>{billingCount}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'billing' ? (
        <BillingSubQueuePanel items={allItems} navigate={navigate} />
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Open', value: allItems.filter(i => i.status === 'open').length, color: '#12122C' },
              { label: 'High Priority', value: highCount, color: '#DC2626' },
              { label: 'In Progress', value: allItems.filter(i => i.status === 'in_progress').length, color: '#007998' },
              { label: 'Overdue (5+ days)', value: allItems.filter(i => i.ageDays >= 5).length, color: '#D97706' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 8, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#BABACE' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patient, claim, task…"
                style={{ height: 36, paddingLeft: 32, paddingRight: 12, border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, outline: 'none', width: 260 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#676687' }}>
              <User size={14} />
              <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)}
                style={{ height: 36, padding: '0 10px', border: '1px solid #BABACE', borderRadius: 6, fontSize: 13, outline: 'none', background: 'white' }}>
                <option value="">All assignees</option>
                {assignees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: '#676687' }}>
              {filtered.length} task{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => {
              const count = countByCategory(cat)
              const isActive = category === cat
              return (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: '5px 12px', borderRadius: 20, border: `1px solid ${isActive ? '#0410BD' : '#BABACE'}`,
                  background: isActive ? '#EFF0FF' : 'white', color: isActive ? '#0410BD' : '#676687',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {cat}
                  {count > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: isActive ? '#0410BD' : '#F2F2F8',
                      color: isActive ? 'white' : '#676687',
                      fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                    }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Queue list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '48px 0', textAlign: 'center', color: '#BABACE', fontSize: 13 }}>
                <CheckCircle2 size={32} color="#BABACE" style={{ display: 'block', margin: '0 auto 12px' }} />
                Work queue is empty for this filter.
              </div>
            ) : filtered.map((item, idx) => {
              const pc = PRIORITY_CONFIG[item.priority]
              const isExpanded = expandedId === item.id
              return (
                <div key={item.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F2F2F8' : 'none' }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    style={{
                      padding: '14px 20px', display: 'flex', gap: 14, alignItems: 'flex-start',
                      cursor: 'pointer', transition: 'background 0.1s',
                      background: isExpanded ? '#FAFAFA' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#FAFAFA' }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: pc.dot, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#12122C' }}>{item.taskType}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pc.text, background: pc.bg, borderRadius: 4, padding: '1px 7px' }}>{pc.label}</span>
                        <Badge variant={item.status === 'in_progress' ? 'info' : 'default'}>
                          {item.status === 'in_progress' ? 'In Progress' : 'Open'}
                        </Badge>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#676687', flexWrap: 'wrap' }}>
                        <span><strong style={{ color: '#12122C' }}>{item.patient}</strong></span>
                        {item.claimId !== '—' && <span style={{ fontFamily: 'monospace', color: '#0410BD', fontWeight: 700 }}>{item.claimId}</span>}
                        <span>{item.payer}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right', fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: item.ageDays >= 5 ? '#DC2626' : '#676687' }}>
                          <Clock size={12} />
                          <span style={{ fontWeight: item.ageDays >= 5 ? 700 : 400 }}>{item.ageDays}d old</span>
                        </div>
                        <div style={{ color: '#BABACE', marginTop: 2 }}>Due {item.dueDate}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#676687', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={12} />
                        {item.assignedTo === 'Unassigned' ? <span style={{ color: '#DC2626' }}>Unassigned</span> : item.assignedTo}
                      </div>
                      {isExpanded ? <ChevronUp size={16} color="#676687" /> : <ChevronDown size={16} color="#676687" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '16px 20px 20px 42px', background: '#FAFAFA', borderTop: '1px solid #F2F2F8' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        {item.denialReason && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', marginBottom: 4 }}>Denial / Issue Reason</div>
                            <div style={{ fontSize: 13, color: '#12122C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px' }}>{item.denialReason}</div>
                          </div>
                        )}
                        {item.nextAction && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', marginBottom: 4 }}>Recommended Next Action</div>
                            <div style={{ fontSize: 13, color: '#12122C', background: '#D9FCFF', border: '1px solid #94F2FA', borderRadius: 6, padding: '8px 12px' }}>{item.nextAction}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => navigate(`/claims/${item.claimId}`)} style={{ height: 32, padding: '0 14px', background: '#0410BD', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View claim</button>
                        <button style={{ height: 32, padding: '0 14px', background: '#EFF0FF', color: '#0410BD', border: '1px solid #BABACE', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <User size={12} /> Reassign
                        </button>
                        <button style={{ height: 32, padding: '0 14px', background: 'white', color: '#676687', border: '1px solid #BABACE', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <RotateCcw size={12} /> Log action
                        </button>
                        <button style={{ height: 32, padding: '0 14px', background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle2 size={12} /> Mark resolved
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
