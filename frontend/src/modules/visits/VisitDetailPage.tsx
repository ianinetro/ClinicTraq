import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
// PageHeader imported for future use
// import { PageHeader } from '../../components/shell/PageHeader'
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { PHIField } from '../../components/shared/PHIField'
import { useVisit } from '../../services/queries'
import type { Diagnosis, ChargeLine } from '../../types'

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: visit, isLoading } = useVisit(id ?? '')

  if (isLoading) {
    return <div className="p-6 animate-pulse"><div className="h-8 bg-[#E3E3F1] rounded w-64" /></div>
  }

  if (!visit) {
    return (
      <div className="p-6">
        <p className="text-sm text-[#676687]">Visit not found.</p>
        <Button size="sm" variant="secondary" onClick={() => navigate('/visits')} className="mt-3">Back</Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <button onClick={() => navigate('/visits')} className="flex items-center gap-1.5 text-sm text-[#676687] hover:text-[#12122C]">
        <ArrowLeft size={14} />Back to Visits
      </button>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#676687] mb-1">Visit</p>
          <h1 className="text-2xl font-bold text-[#12122C]">
            {visit.visitDate ? format(new Date(visit.visitDate), 'MMMM d, yyyy') : '—'}
          </h1>
          {visit.patient && (
            <PHIField
              value={`${visit.patient.firstName} ${visit.patient.lastName}`}
              fieldName="Patient Name"
              patientId={visit.patientId}
              fieldType="name"
              inline
              className="mt-1"
            />
          )}
        </div>
        <StatusBadge status={visit.status} />
      </div>

      <Tabs defaultTab="summary">
        <TabList>
          <Tab id="summary">Summary</Tab>
          <Tab id="charges">Charge Lines</Tab>
          <Tab id="diagnoses">Diagnoses</Tab>
          <Tab id="claim">Claim</Tab>
        </TabList>

        <TabPanel id="summary" className="pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Visit Info</h3>
              <div className="space-y-2 text-sm">
                <div><span className="text-[#676687]">Type:</span> <span className="ml-1">{visit.visitType}</span></div>
                <div><span className="text-[#676687]">POS:</span> <span className="ml-1">{visit.pos}</span></div>
                <div><span className="text-[#676687]">Provider:</span> <span className="ml-1">{visit.provider?.lastName ?? '—'}</span></div>
              </div>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Charges</h3>
              <p className="text-2xl font-bold tabular-nums">${visit.totalCharges.toFixed(2)}</p>
              <p className="text-xs text-[#676687]">{visit.chargeLines?.length ?? 0} charge lines</p>
            </div>
            <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold">Diagnoses</h3>
              <div className="space-y-1">
                {visit.diagnoses?.map((dx: Diagnosis) => (
                  <div key={dx.id} className="text-xs flex gap-2">
                    <span className="font-bold text-[#676687]">{dx.pointer}.</span>
                    <span className="font-mono">{dx.code}</span>
                    <span className="text-[#676687] truncate">{dx.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel id="charges" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#F2F2F8]">
                <tr>
                  {['#', 'CPT', 'Description', 'Modifiers', 'DX Ptrs', 'Charge', 'Units', 'Balance'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#676687]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E3F1]">
                {visit.chargeLines?.map((line: ChargeLine) => (
                  <tr key={line.id} className="hover:bg-[#F2F2F8]">
                    <td className="px-3 py-2 font-mono text-[#676687]">{line.seq}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{line.cptCode}</td>
                    <td className="px-3 py-2 text-[#676687]">{line.cptDescription}</td>
                    <td className="px-3 py-2 font-mono">{line.modifiers.filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-2 font-mono">{line.dxPointers.join('')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${line.charge.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{line.units}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${line.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabPanel>

        <TabPanel id="diagnoses" className="pt-4">
          <div className="bg-white border border-[#E3E3F1] rounded-lg p-4 space-y-2 max-w-lg">
            {visit.diagnoses?.map((dx: Diagnosis) => (
              <div key={dx.id} className="flex items-start gap-3 py-1.5 border-b border-[#E3E3F1] last:border-0">
                <span className="w-5 text-xs font-bold text-[#676687]">{dx.pointer}.</span>
                <span className="font-mono text-sm font-semibold text-[#0410BD]">{dx.code}</span>
                <span className="text-sm text-[#676687]">{dx.description}</span>
                {dx.isPrimary && <span className="text-xs bg-[#EFF0FF] text-[#0410BD] px-1.5 py-0.5 rounded font-medium">Primary</span>}
              </div>
            ))}
          </div>
        </TabPanel>

        <TabPanel id="claim" className="pt-4">
          {visit.claimId ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-[#676687]">Claim created for this visit.</p>
              <Button size="sm" variant="primary" onClick={() => navigate(`/claims/${visit.claimId}`)}>
                View Claim
              </Button>
            </div>
          ) : (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4">
              <p className="text-sm text-[#B45309]">No claim has been created for this visit yet.</p>
            </div>
          )}
        </TabPanel>
      </Tabs>
    </div>
  )
}
