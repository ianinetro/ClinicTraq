import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/visits')}>
          <ArrowLeft size={14} /> Back
        </Button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Visit #{id}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Visit detail</p>
        </div>
      </div>
      <div style={{ background: 'var(--bb-surface-card)', borderRadius: 'var(--bb-radius-lg)', padding: 24, border: '1px solid var(--bb-border)', boxShadow: 'var(--bb-shadow-sm)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { label: 'Patient', value: 'Johnson, Mary' },
            { label: 'Provider', value: 'Dr. Smith' },
            { label: 'Date of Service', value: '2026-06-26' },
            { label: 'Visit Type', value: 'Office Visit' },
            { label: 'Status', value: <Badge variant="success">Completed</Badge> },
            { label: 'Billed Amount', value: '$185.00' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', fontWeight: 500, marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 14 }}>{f.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--bb-border)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Procedure Codes</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            {['99213', '85025'].map(code => (
              <span key={code} style={{ padding: '4px 10px', background: 'var(--bb-status-info-bg)', color: 'var(--bb-status-info)', borderRadius: 'var(--bb-radius-sm)', fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>
                {code}
              </span>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Diagnoses</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            {['J06.9', 'Z23'].map(code => (
              <span key={code} style={{ padding: '4px 10px', background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-sm)', fontSize: 13, fontFamily: 'monospace' }}>
                {code}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
