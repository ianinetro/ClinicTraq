import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Upload, FileUp } from 'lucide-react'
import { DataTable, Column } from '../../components/ui/DataTable'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import api from '../../services/api'

const tabs = ['Post Payments', 'ERA Import', 'Payment History'] as const
type Tab = typeof tabs[number]

interface Payment {
  id: string
  date: string
  patient: string
  payer: string
  checkNumber: string
  amount: number
  type: string
  status: string
}

export function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Payment History')
  const [dragging, setDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        const res = await api.get('/payments')
        return res.data
      } catch {
        return {
          items: [
            { id: '1', date: '2026-06-27', patient: 'Johnson, Mary', payer: 'BlueCross PPO', checkNumber: 'CHK-9923', amount: 148.00, type: 'ERA', status: 'Posted' },
            { id: '2', date: '2026-06-27', patient: 'Williams, Robert', payer: 'Aetna HMO', checkNumber: 'EFT-1102', amount: 264.00, type: 'EFT', status: 'Posted' },
            { id: '3', date: '2026-06-26', patient: 'Brown, James', payer: 'Cigna PPO', checkNumber: 'CHK-8841', amount: 92.50, type: 'Check', status: 'Posted' },
          ],
          total: 3,
        }
      }
    },
  })

  const columns: Column<Payment>[] = [
    { key: 'date', header: 'Date' },
    { key: 'patient', header: 'Patient', render: r => <span style={{ fontWeight: 500 }}>{r.patient}</span> },
    { key: 'payer', header: 'Payer' },
    { key: 'checkNumber', header: 'Check/EFT #', render: r => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.checkNumber}</span> },
    { key: 'amount', header: 'Amount', render: r => <span style={{ fontWeight: 600, color: 'var(--bb-status-success)' }}>${r.amount.toFixed(2)}</span> },
    { key: 'type', header: 'Type', render: r => <Badge variant="info">{r.type}</Badge> },
    { key: 'status', header: 'Status', render: r => <Badge variant="success">{r.status}</Badge> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Payments</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Payment posting and ERA management</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid var(--bb-border)' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
            color: activeTab === tab ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
            borderBottom: activeTab === tab ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Payment History' && (
        <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)', overflow: 'hidden' }}>
          <DataTable
            columns={columns as Column<Record<string, unknown>>[]}
            data={(data?.items || []) as Record<string, unknown>[]}
            isLoading={isLoading}
            emptyMessage="No payments found"
          />
        </div>
      )}

      {activeTab === 'ERA Import' && (
        <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 32, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>Import ERA 835 File</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Upload an 835 ERA file to automatically post payments to claims.</p>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setUploadedFile(f) }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--bb-brand-blue)' : 'var(--bb-border)'}`,
              borderRadius: 'var(--bb-radius-lg)',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--bb-status-info-bg)' : 'var(--bb-surface-app)',
              transition: 'all 0.15s',
            }}
          >
            <FileUp size={32} style={{ color: 'var(--bb-text-secondary)', marginBottom: 12 }} />
            <p style={{ margin: '0 0 4px', fontWeight: 500, color: 'var(--bb-text-primary)' }}>
              {uploadedFile ? uploadedFile.name : 'Drop 835 ERA file here'}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--bb-text-secondary)' }}>or click to browse</p>
            <input ref={fileRef} type="file" accept=".835,.txt,.edi" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setUploadedFile(e.target.files[0])} />
          </div>
          {uploadedFile && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary">
                <Upload size={14} />
                Import ERA File
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Post Payments' && (
        <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600 }}>Manual Payment Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600 }}>
            {['Patient', 'Claim ID', 'Payment Amount', 'Check/EFT Number', 'Payment Date', 'Payer'].map(field => (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)' }}>{field}</label>
                <input type={field === 'Payment Date' ? 'date' : field === 'Payment Amount' ? 'number' : 'text'}
                  placeholder={field}
                  style={{ height: 36, padding: '0 12px', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', fontSize: 14, color: 'var(--bb-text-primary)', background: 'var(--bb-surface-card)', outline: 'none' }}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <Button variant="primary">Post Payment</Button>
          </div>
        </div>
      )}
    </div>
  )
}
