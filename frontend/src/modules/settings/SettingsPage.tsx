import { useState } from 'react'
import { Plus, Save, Trash2, Edit2, AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { DataTable } from '../../components/ui/DataTable'

const TABS = ['Practice Info', 'Providers', 'Facilities', 'Payers', 'Fee Schedules', 'CPT Codes', 'Users & Roles', 'Timely Filing'] as const
type Tab = typeof TABS[number]

const MOCK_PROVIDERS = [
  { id: '1', name: 'Dr. Jennifer Smith', npi: '1234567890', taxonomy: '207Q00000X', specialty: 'Family Medicine', status: 'active' },
  { id: '2', name: 'Dr. Marcus Johnson', npi: '0987654321', taxonomy: '207R00000X', specialty: 'Internal Medicine', status: 'active' },
  { id: '3', name: 'Dr. Priya Patel', npi: '1122334455', taxonomy: '2084N0400X', specialty: 'Neurology', status: 'inactive' },
]

const MOCK_FACILITIES = [
  { id: '1', name: 'Springfield Medical Group – Main', npi: '0987654321', posCode: '11', address: '456 Medical Drive, Springfield, IL 62701', status: 'active' },
  { id: '2', name: 'Springfield Urgent Care', npi: '1122334456', posCode: '20', address: '789 Urgent Way, Springfield, IL 62701', status: 'active' },
]

const MOCK_PAYERS = [
  { id: '1', name: 'BlueCross BlueShield', payerId: 'BCBS00', type: 'Commercial', submissionMethod: 'Electronic', phone: '1-800-521-2227' },
  { id: '2', name: 'Aetna', payerId: 'AETNA0', type: 'Commercial', submissionMethod: 'Electronic', phone: '1-800-872-3862' },
  { id: '3', name: 'United Healthcare', payerId: 'UHC000', type: 'Commercial', submissionMethod: 'Electronic', phone: '1-800-842-3585' },
  { id: '4', name: 'Medicare (Noridian)', payerId: 'MCARE0', type: 'Government', submissionMethod: 'Electronic', phone: '1-800-444-4606' },
  { id: '5', name: 'Medicaid IL', payerId: 'MCDIL0', type: 'Government', submissionMethod: 'Electronic', phone: '1-800-252-8635' },
]

const MOCK_USERS = [
  { id: '1', name: 'Admin User', email: 'admin@clinictraq.com', role: 'Admin', status: 'active', lastLogin: '2026-06-28' },
  { id: '2', name: 'Dr. Jennifer Smith', email: 'jsmith@springfieldmed.com', role: 'Provider', status: 'active', lastLogin: '2026-06-27' },
  { id: '3', name: 'Maria Martinez', email: 'mmartinez@springfieldmed.com', role: 'Biller', status: 'active', lastLogin: '2026-06-28' },
  { id: '4', name: 'Kevin Thompson', email: 'kthompson@springfieldmed.com', role: 'Front Desk', status: 'active', lastLogin: '2026-06-26' },
]

const MOCK_CPT = [
  { code: '99213', description: 'Office Visit, Level 3 (Est)', fee: 150.00, rvu: 1.92 },
  { code: '99214', description: 'Office Visit, Level 4 (Est)', fee: 200.00, rvu: 2.56 },
  { code: '99202', description: 'Office Visit, Level 2 (New)', fee: 120.00, rvu: 1.60 },
  { code: '99203', description: 'Office Visit, Level 3 (New)', fee: 165.00, rvu: 2.16 },
  { code: '85025', description: 'CBC with Differential', fee: 35.00, rvu: 0.0 },
  { code: '93000', description: 'Electrocardiogram, 12-lead', fee: 52.00, rvu: 0.17 },
  { code: '97110', description: 'Therapeutic Exercise', fee: 55.00, rvu: 0.89 },
]

const TFL_RULES = [
  { payer: 'BlueCross BlueShield', days: 180, notes: '180 days from DOS' },
  { payer: 'Aetna', days: 180, notes: '180 days from DOS' },
  { payer: 'United Healthcare', days: 365, notes: '12 months from DOS' },
  { payer: 'Medicare', days: 365, notes: '12 months from DOS' },
  { payer: 'Medicaid IL', days: 180, notes: '180 days from DOS' },
]

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Practice Info')
  const [savedPractice, setSavedPractice] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--bb-text-primary)' }}>Settings</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--bb-text-secondary)' }}>Manage your practice configuration</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--bb-border)', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
            color: activeTab === tab ? 'var(--bb-brand-blue)' : 'var(--bb-text-secondary)',
            borderBottom: activeTab === tab ? '2px solid var(--bb-brand-blue)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {tab}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>

        {/* ── Practice Info ── */}
        {activeTab === 'Practice Info' && (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600 }}>Practice Information</h3>
            {savedPractice && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#15803D', fontWeight: 500 }}>
                ✓ Changes saved successfully
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input label="Practice Name" defaultValue="Springfield Medical Group" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Group NPI" defaultValue="0987654321" />
                <Input label="Tax ID (EIN)" defaultValue="**-***8901" />
              </div>
              <Input label="Address" defaultValue="456 Medical Drive, Springfield, IL 62701" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Phone" defaultValue="(555) 100-2000" />
                <Input label="Fax" defaultValue="(555) 100-2001" />
              </div>
              <Input label="Billing Email" defaultValue="billing@springfieldmed.com" />
              <Input label="Clearinghouse" defaultValue="Office Ally" />
              <div style={{ marginTop: 8 }}>
                <Button variant="primary" onClick={() => { setSavedPractice(true); setTimeout(() => setSavedPractice(false), 3000) }}>
                  <Save size={14} />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Providers ── */}
        {activeTab === 'Providers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Rendering Providers</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Add Provider</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Provider Name', render: (r: Record<string, unknown>) => <span style={{ fontWeight: 600 }}>{String(r.name)}</span> },
                { key: 'npi', header: 'NPI', render: (r: Record<string, unknown>) => <span style={{ fontFamily: 'monospace' }}>{String(r.npi)}</span> },
                { key: 'specialty', header: 'Specialty' },
                { key: 'taxonomy', header: 'Taxonomy', render: (r: Record<string, unknown>) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(r.taxonomy)}</span> },
                { key: 'status', header: 'Status', render: (r: Record<string, unknown>) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{String(r.status)}</Badge> },
                { key: 'actions', header: '', render: () => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                )},
              ]}
              data={MOCK_PROVIDERS}
            />
          </div>
        )}

        {/* ── Facilities ── */}
        {activeTab === 'Facilities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Facilities / Practice Locations</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Add Facility</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Facility Name', render: (r: Record<string, unknown>) => <span style={{ fontWeight: 600 }}>{String(r.name)}</span> },
                { key: 'npi', header: 'NPI', render: (r: Record<string, unknown>) => <span style={{ fontFamily: 'monospace' }}>{String(r.npi)}</span> },
                { key: 'posCode', header: 'POS Code' },
                { key: 'address', header: 'Address', render: (r: Record<string, unknown>) => <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{String(r.address)}</span> },
                { key: 'status', header: 'Status', render: (r: Record<string, unknown>) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{String(r.status)}</Badge> },
                { key: 'actions', header: '', render: () => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                )},
              ]}
              data={MOCK_FACILITIES}
            />
          </div>
        )}

        {/* ── Payers ── */}
        {activeTab === 'Payers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Payer Configuration</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Add Payer</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Payer Name', render: (r: Record<string, unknown>) => <span style={{ fontWeight: 600 }}>{String(r.name)}</span> },
                { key: 'payerId', header: 'Payer ID', render: (r: Record<string, unknown>) => <span style={{ fontFamily: 'monospace' }}>{String(r.payerId)}</span> },
                { key: 'type', header: 'Type' },
                { key: 'submissionMethod', header: 'Submission' },
                { key: 'phone', header: 'Phone', render: (r: Record<string, unknown>) => <span style={{ fontSize: 12 }}>{String(r.phone)}</span> },
                { key: 'actions', header: '', render: () => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                  </div>
                )},
              ]}
              data={MOCK_PAYERS}
            />
          </div>
        )}

        {/* ── Fee Schedules ── */}
        {activeTab === 'Fee Schedules' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Fee Schedules</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Add Schedule</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Schedule Name', render: (r: Record<string, unknown>) => <span style={{ fontWeight: 600 }}>{String(r.name)}</span> },
                { key: 'payer', header: 'Payer' },
                { key: 'effective', header: 'Effective Date' },
                { key: 'cptCount', header: 'CPT Codes', render: (r: Record<string, unknown>) => <Badge variant="info">{String(r.cptCount)}</Badge> },
              ]}
              data={[
                { name: 'Standard Fee Schedule 2026', payer: 'All Payers', effective: '2026-01-01', cptCount: 1204 },
                { name: 'BlueCross Contracted 2026', payer: 'BlueCross PPO', effective: '2026-01-01', cptCount: 847 },
                { name: 'Medicare 2026 (Noridian)', payer: 'Medicare', effective: '2026-01-01', cptCount: 1102 },
              ]}
            />
          </div>
        )}

        {/* ── CPT Codes ── */}
        {activeTab === 'CPT Codes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>CPT / Procedure Codes</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Add CPT Code</Button>
            </div>
            <DataTable
              columns={[
                { key: 'code', header: 'CPT Code', render: (r: Record<string, unknown>) => <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{String(r.code)}</span> },
                { key: 'description', header: 'Description' },
                { key: 'fee', header: 'Standard Fee', render: (r: Record<string, unknown>) => `$${(r.fee as number).toFixed(2)}` },
                { key: 'rvu', header: 'RVU', render: (r: Record<string, unknown>) => (r.rvu as number) > 0 ? (r.rvu as number).toFixed(2) : '—' },
                { key: 'actions', header: '', render: () => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                  </div>
                )},
              ]}
              data={MOCK_CPT}
            />
          </div>
        )}

        {/* ── Users & Roles ── */}
        {activeTab === 'Users & Roles' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Users & Access Control</h3>
              <Button variant="primary" size="sm"><Plus size={14} />Invite User</Button>
            </div>
            <DataTable
              columns={[
                { key: 'name', header: 'Name', render: (r: Record<string, unknown>) => <span style={{ fontWeight: 600 }}>{String(r.name)}</span> },
                { key: 'email', header: 'Email', render: (r: Record<string, unknown>) => <span style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>{String(r.email)}</span> },
                { key: 'role', header: 'Role', render: (r: Record<string, unknown>) => <Badge variant="info">{String(r.role)}</Badge> },
                { key: 'lastLogin', header: 'Last Login', render: (r: Record<string, unknown>) => <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{String(r.lastLogin)}</span> },
                { key: 'status', header: 'Status', render: (r: Record<string, unknown>) => <Badge variant={r.status === 'active' ? 'success' : 'default'}>{String(r.status)}</Badge> },
                { key: 'actions', header: '', render: () => (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                  </div>
                )},
              ]}
              data={MOCK_USERS}
            />
            <div style={{ marginTop: 20, padding: 16, background: 'var(--bb-surface-app)', borderRadius: 8, border: '1px solid var(--bb-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Role Permissions Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { role: 'Admin', perms: ['Full access', 'User management', 'Settings', 'Billing'] },
                  { role: 'Biller', perms: ['Claims', 'Payments', 'ERA import', 'Work Queue'] },
                  { role: 'Provider', perms: ['Visits', 'Patient chart', 'Orders', 'Body Map'] },
                  { role: 'Front Desk', perms: ['Patients', 'Scheduling', 'Demographics', 'Insurance'] },
                ].map(r => (
                  <div key={r.role}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-brand-blue)', marginBottom: 6 }}>{r.role}</div>
                    {r.perms.map(p => (
                      <div key={p} style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginBottom: 3 }}>✓ {p}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Timely Filing ── */}
        {activeTab === 'Timely Filing' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Timely Filing Limits</h3>
              <Button variant="secondary" size="sm"><Plus size={14} />Add Rule</Button>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={14} color="#D97706" />
              <span style={{ fontSize: 13, color: '#92400E' }}>Claims approaching their timely filing deadline will appear in the Work Queue automatically.</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bb-surface-app)', borderBottom: '2px solid var(--bb-border)' }}>
                  {['Payer', 'Filing Limit (Days)', 'Notes', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TFL_RULES.map((r, i) => (
                  <tr key={r.payer} style={{ borderBottom: '1px solid var(--bb-border)', background: i % 2 === 0 ? 'white' : 'var(--bb-surface-app)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600 }}>{r.payer}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ background: r.days <= 180 ? '#FEF3C7' : '#DCFCE7', color: r.days <= 180 ? '#92400E' : '#15803D', padding: '3px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>
                        {r.days} days
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>{r.notes}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-brand-blue)', padding: 4 }}><Edit2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
