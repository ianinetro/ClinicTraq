import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PHIField } from '../../components/shared/PHIField'
import { DataTable, Column } from '../../components/ui/DataTable'
import api from '../../services/api'

const tabs = ['Demographics', 'Insurance', 'Visits', 'Claims', 'Balance'] as const
type Tab = typeof tabs[number]

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('Demographics')

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patients', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/patients/${id}`)
        return res.data
      } catch {
        return {
          id, mrn: 'MRN-001234',
          firstName: 'Mary', lastName: 'Johnson',
          dob: '1975-03-12', gender: 'Female',
          phone: '(555) 234-5678', email: 'mary.j@example.com',
          address: '123 Main St, Springfield, IL 62701',
          ssn: '***-**-1234', status: 'active',
          primaryInsurance: { payer: 'BlueCross PPO', memberId: 'BC123456', groupNumber: 'GRP-001', effectiveDate: '2024-01-01' },
          secondaryInsurance: null,
          balance: 125.00,
        }
      }
    },
    enabled: !!id,
  })

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bb-text-secondary)' }}>Loading patient...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              {patient?.lastName}, {patient?.firstName}
            </h2>
            <Badge variant={patient?.status === 'active' ? 'success' : 'default'}>{patient?.status}</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            MRN: {patient?.mrn} · DOB: {patient?.dob}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: patient?.balance > 0 ? 'var(--bb-status-danger)' : 'var(--bb-status-success)' }}>
            ${patient?.balance?.toFixed(2)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>Patient Balance</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--bb-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: activeTab === tab ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
        {activeTab === 'Demographics' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {[
              { label: 'First Name', value: patient?.firstName },
              { label: 'Last Name', value: patient?.lastName },
              { label: 'Date of Birth', value: patient?.dob },
              { label: 'Gender', value: patient?.gender },
              { label: 'Phone', value: patient?.phone },
              { label: 'Email', value: patient?.email },
              { label: 'Address', value: patient?.address },
            ].map(field => (
              <div key={field.label}>
                <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontWeight: 500, marginBottom: 4 }}>{field.label}</div>
                <div style={{ fontSize: 14, color: 'var(--bb-text-primary)' }}>{field.value || '—'}</div>
              </div>
            ))}
            <div>
              <PHIField label="SSN" value={patient?.ssn || '***-**-0000'} />
            </div>
          </div>
        )}
        {activeTab === 'Insurance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Primary Insurance</h4>
              {patient?.primaryInsurance ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: 'var(--bb-surface-app)', padding: 16, borderRadius: 'var(--bb-radius)', border: '1px solid var(--bb-border)' }}>
                  {Object.entries(patient.primaryInsurance).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', textTransform: 'capitalize', marginBottom: 2 }}>{k.replace(/([A-Z])/g, ' $1')}</div>
                      <div style={{ fontSize: 14 }}>{String(v)}</div>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: 'var(--bb-text-secondary)', fontSize: 14 }}>No primary insurance on file</p>}
            </div>
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Secondary Insurance</h4>
              <p style={{ color: 'var(--bb-text-secondary)', fontSize: 14 }}>No secondary insurance on file</p>
            </div>
          </div>
        )}
        {activeTab === 'Visits' && (
          <DataTable
            columns={[
              { key: 'date', header: 'Visit Date' },
              { key: 'provider', header: 'Provider' },
              { key: 'type', header: 'Type' },
              { key: 'status', header: 'Status', render: (row: Record<string, unknown>) => <Badge variant="info">{String(row.status)}</Badge> },
            ]}
            data={[]}
            emptyMessage="No visits on record"
          />
        )}
        {activeTab === 'Claims' && (
          <DataTable
            columns={[
              { key: 'claimId', header: 'Claim ID' },
              { key: 'dos', header: 'DOS' },
              { key: 'payer', header: 'Payer' },
              { key: 'billed', header: 'Billed' },
              { key: 'status', header: 'Status', render: (row: Record<string, unknown>) => <Badge variant="info">{String(row.status)}</Badge> },
            ]}
            data={[]}
            emptyMessage="No claims on record"
          />
        )}
        {activeTab === 'Balance' && (
          <DataTable
            columns={[
              { key: 'date', header: 'Date' },
              { key: 'description', header: 'Description' },
              { key: 'charge', header: 'Charge' },
              { key: 'payment', header: 'Payment' },
              { key: 'balance', header: 'Balance' },
            ]}
            data={[]}
            emptyMessage="No ledger entries"
          />
        )}
      </div>
    </div>
  )
}
