import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

export function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/claims')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Claim #{id}</h2>
        </div>
      </div>
      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 24 }}>
          {[
            { label: 'Patient', value: 'Johnson, Mary' },
            { label: 'Date of Service', value: '2026-06-26' },
            { label: 'Payer', value: 'BlueCross PPO' },
            { label: 'Billed Amount', value: '$185.00' },
            { label: 'Paid Amount', value: '$148.00' },
            { label: 'Balance', value: '$37.00' },
            { label: 'Status', value: <Badge variant="success">Paid</Badge> },
            { label: 'Submission Date', value: '2026-06-27' },
            { label: 'NPI', value: '1234567890' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontWeight: 500, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 14 }}>{f.value}</div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--bb-border)', paddingTop: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Claim Lines</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
                {['CPT', 'Description', 'Units', 'Billed', 'Allowed', 'Paid'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--bb-border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>99213</td>
                <td style={{ padding: '10px 12px' }}>Office Visit, Level 3</td>
                <td style={{ padding: '10px 12px' }}>1</td>
                <td style={{ padding: '10px 12px' }}>$150.00</td>
                <td style={{ padding: '10px 12px' }}>$120.00</td>
                <td style={{ padding: '10px 12px', color: 'var(--bb-status-success)', fontWeight: 600 }}>$120.00</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>85025</td>
                <td style={{ padding: '10px 12px' }}>CBC with Differential</td>
                <td style={{ padding: '10px 12px' }}>1</td>
                <td style={{ padding: '10px 12px' }}>$35.00</td>
                <td style={{ padding: '10px 12px' }}>$28.00</td>
                <td style={{ padding: '10px 12px', color: 'var(--bb-status-success)', fontWeight: 600 }}>$28.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
