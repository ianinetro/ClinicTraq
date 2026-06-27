import { useState } from 'react'
import { AlertTriangle, Save } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

interface TFLRow {
  id: string
  payerName: string
  payerId: string
  tflDays: number
  claimsAtRisk: number
  editing: boolean
  editValue: string
}

const INITIAL_TFL_DATA: TFLRow[] = [
  { id: '1', payerName: 'Medicare Part B', payerId: '00001', tflDays: 365, claimsAtRisk: 3, editing: false, editValue: '365' },
  { id: '2', payerName: 'Medicaid', payerId: '00002', tflDays: 180, claimsAtRisk: 7, editing: false, editValue: '180' },
  { id: '3', payerName: 'Blue Cross Blue Shield', payerId: '00003', tflDays: 365, claimsAtRisk: 1, editing: false, editValue: '365' },
  { id: '4', payerName: 'Aetna', payerId: '00004', tflDays: 180, claimsAtRisk: 4, editing: false, editValue: '180' },
  { id: '5', payerName: 'UnitedHealthcare', payerId: '00005', tflDays: 365, claimsAtRisk: 0, editing: false, editValue: '365' },
  { id: '6', payerName: 'Cigna', payerId: '00006', tflDays: 180, claimsAtRisk: 2, editing: false, editValue: '180' },
]

const recentChanges = [
  { by: 'admin@practice.com', field: 'Aetna TFL', from: '365', to: '180', at: '2024-01-10 14:22' },
  { by: 'billing@practice.com', field: 'Medicaid TFL', from: '90', to: '180', at: '2024-01-08 09:15' },
]

export function TFLSettings() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<TFLRow[]>(INITIAL_TFL_DATA)

  const totalAtRisk = rows.reduce((sum, r) => sum + r.claimsAtRisk, 0)

  function startEdit(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, editing: true } : r))
  }

  function cancelEdit(id: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, editing: false, editValue: String(r.tflDays) } : r))
  }

  function saveEdit(id: string) {
    const row = rows.find(r => r.id === id)
    if (!row) return
    const days = parseInt(row.editValue)
    if (isNaN(days) || days < 1 || days > 730) {
      addToast({ variant: 'error', message: 'TFL must be between 1 and 730 days.' })
      return
    }
    setRows(prev => prev.map(r => r.id === id ? { ...r, tflDays: days, editing: false } : r))
    addToast({ variant: 'success', message: `TFL updated for ${row.payerName}.` })
  }

  function updateEditValue(id: string, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, editValue: value } : r))
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[#12122C]">Timely Filing Limits</h2>
        <p className="text-sm text-[#676687] mt-1">
          Set the number of days each payer allows for claim submission after the date of service.
        </p>
        <div className="mt-2 bg-[#D9FCFF] border border-[#94F2FA] rounded-lg px-3 py-2 text-xs text-[#007998]">
          Downstream impact: TFL settings directly control the "Near TFL" work queue alerts and dashboard KPI counts.
          Claims approaching their limit appear in the work queue with a configurable warning threshold.
        </div>
      </div>

      {totalAtRisk > 0 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-[#B45309] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#B45309]">
              {totalAtRisk} claims currently at risk based on current TFL settings
            </p>
            <p className="text-xs text-[#676687] mt-0.5">
              Review the work queue for near-TFL items.
            </p>
          </div>
        </div>
      )}

      {/* TFL Table */}
      <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F2F2F8]">
            <tr>
              {['Payer', 'Payer ID', 'TFL Days', 'Claims at Risk', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E3F1]">
            {rows.map(row => (
              <tr key={row.id} className="hover:bg-[#F2F2F8]">
                <td className="px-4 py-3 text-sm font-medium text-[#12122C]">{row.payerName}</td>
                <td className="px-4 py-3 text-sm font-mono text-[#676687]">{row.payerId}</td>
                <td className="px-4 py-3">
                  {row.editing ? (
                    <input
                      value={row.editValue}
                      onChange={e => updateEditValue(row.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(row.id)
                        if (e.key === 'Escape') cancelEdit(row.id)
                      }}
                      type="number"
                      min="1"
                      max="730"
                      autoFocus
                      className="w-24 h-8 border border-[#3F4CFF] rounded px-2 text-sm font-mono outline-none shadow-[0_0_0_3px_rgba(63,76,255,0.16)]"
                    />
                  ) : (
                    <span className="text-sm font-mono tabular-nums">
                      {row.tflDays} <span className="text-[#676687]">days</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.claimsAtRisk > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#B45309]">
                      <AlertTriangle size={13} />
                      {row.claimsAtRisk}
                    </span>
                  ) : (
                    <span className="text-sm text-[#676687]">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.editing ? (
                    <div className="flex items-center gap-1.5">
                      <Button size="xs" variant="primary" onClick={() => saveEdit(row.id)}>
                        <Save size={11} />Save
                      </Button>
                      <Button size="xs" variant="secondary" onClick={() => cancelEdit(row.id)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="xs" variant="secondary" onClick={() => startEdit(row.id)}>Edit</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit trail */}
      <div className="bg-white border border-[#E3E3F1] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E3E3F1]">
          <h3 className="text-sm font-semibold text-[#12122C]">Recent Changes</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F2F2F8]">
            <tr>
              {['Changed By', 'Field', 'Before', 'After', 'Date/Time'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E3F1]">
            {recentChanges.map((c, i) => (
              <tr key={i} className="hover:bg-[#F2F2F8]">
                <td className="px-4 py-2.5 text-[#676687]">{c.by}</td>
                <td className="px-4 py-2.5">{c.field}</td>
                <td className="px-4 py-2.5 font-mono text-[#B91C1C]">{c.from}</td>
                <td className="px-4 py-2.5 font-mono text-[#047857]">{c.to}</td>
                <td className="px-4 py-2.5 text-[#676687] tabular-nums">{c.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
