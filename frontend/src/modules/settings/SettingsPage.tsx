import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { DataTable } from '../../components/ui/DataTable'
import { Badge } from '../../components/ui/Badge'

const tabs = ['Practice Info', 'Users & Roles', 'Payers', 'Fee Schedules'] as const
type Tab = typeof tabs[number]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Practice Info')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Settings</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Manage your practice configuration</p>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid var(--bb-border)' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
            color: activeTab === tab ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
            borderBottom: activeTab === tab ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
        {activeTab === 'Practice Info' && (
          <div style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600 }}>Practice Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Practice Name" defaultValue="Springfield Medical Group" />
              <Input label="NPI" defaultValue="1234567890" />
              <Input label="Tax ID" defaultValue="**-*****89" />
              <Input label="Address" defaultValue="456 Medical Drive, Springfield, IL 62701" />
              <Input label="Phone" defaultValue="(555) 100-2000" />
              <Input label="Email" defaultValue="billing@springfieldmed.com" />
              <div style={{ marginTop: 8 }}>
                <Button variant="primary">Save Changes</Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Users & Roles' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Users & Roles</h3>
              <Button variant="primary" size="sm">Add User</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Name' },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role', render: (r: Record<string, unknown>) => <Badge variant="info">{String(r.role)}</Badge> },
                { key: 'status', header: 'Status', render: (r: Record<string, unknown>) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{String(r.status)}</Badge> },
              ]}
              data={[
                { name: 'Dr. Smith', email: 'smith@springfieldmed.com', role: 'Provider', status: 'active' },
                { name: 'J. Martinez', email: 'jmartinez@springfieldmed.com', role: 'Biller', status: 'active' },
                { name: 'K. Thompson', email: 'kthompson@springfieldmed.com', role: 'Front Desk', status: 'active' },
              ]}
            />
          </div>
        )}

        {activeTab === 'Payers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Payer Configuration</h3>
              <Button variant="primary" size="sm">Add Payer</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Payer Name' },
                { key: 'payerId', header: 'Payer ID' },
                { key: 'type', header: 'Type' },
                { key: 'submissionMethod', header: 'Submission' },
              ]}
              data={[
                { name: 'BlueCross BlueShield', payerId: 'BCBS00', type: 'Commercial', submissionMethod: 'Electronic' },
                { name: 'Aetna', payerId: 'AETNA0', type: 'Commercial', submissionMethod: 'Electronic' },
                { name: 'United Healthcare', payerId: 'UHC000', type: 'Commercial', submissionMethod: 'Electronic' },
                { name: 'Medicare', payerId: 'MCARE0', type: 'Government', submissionMethod: 'Electronic' },
              ]}
            />
          </div>
        )}

        {activeTab === 'Fee Schedules' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Fee Schedules</h3>
              <Button variant="primary" size="sm">Add Schedule</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Schedule Name' },
                { key: 'payer', header: 'Payer' },
                { key: 'effective', header: 'Effective Date' },
                { key: 'cptCount', header: 'CPT Codes' },
              ]}
              data={[
                { name: 'Standard Fee Schedule 2026', payer: 'All Payers', effective: '2026-01-01', cptCount: 1204 },
                { name: 'BlueCross Contracted', payer: 'BlueCross PPO', effective: '2026-01-01', cptCount: 847 },
                { name: 'Medicare 2026', payer: 'Medicare', effective: '2026-01-01', cptCount: 1102 },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
