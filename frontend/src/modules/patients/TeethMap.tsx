import { useState } from 'react'

// Universal Numbering System (1–32 upper/lower, adult dentition)
// Odd/even placement: 1-16 upper, 17-32 lower, left-to-right from patient's right
const TOOTH_POSITIONS: { num: number; cx: number; cy: number; label: string }[] = [
  // Upper arch (1–16), patient's right to left
  { num: 1,  cx: 20,  cy: 28, label: 'UR3M' },
  { num: 2,  cx: 36,  cy: 20, label: 'UR2M' },
  { num: 3,  cx: 52,  cy: 16, label: 'UR1M' },
  { num: 4,  cx: 68,  cy: 14, label: 'UR2P' },
  { num: 5,  cx: 84,  cy: 14, label: 'UR1P' },
  { num: 6,  cx: 100, cy: 16, label: 'URC'  },
  { num: 7,  cx: 114, cy: 20, label: 'URI2' },
  { num: 8,  cx: 126, cy: 24, label: 'URI1' },
  { num: 9,  cx: 138, cy: 24, label: 'ULI1' },
  { num: 10, cx: 150, cy: 20, label: 'ULI2' },
  { num: 11, cx: 164, cy: 16, label: 'ULC'  },
  { num: 12, cx: 180, cy: 14, label: 'UL1P' },
  { num: 13, cx: 196, cy: 14, label: 'UL2P' },
  { num: 14, cx: 212, cy: 16, label: 'UL1M' },
  { num: 15, cx: 228, cy: 20, label: 'UL2M' },
  { num: 16, cx: 244, cy: 28, label: 'UL3M' },
  // Lower arch (17–32), patient's left to right
  { num: 17, cx: 244, cy: 96, label: 'LL3M' },
  { num: 18, cx: 228, cy: 104, label: 'LL2M' },
  { num: 19, cx: 212, cy: 108, label: 'LL1M' },
  { num: 20, cx: 196, cy: 110, label: 'LL2P' },
  { num: 21, cx: 180, cy: 110, label: 'LL1P' },
  { num: 22, cx: 164, cy: 108, label: 'LLC'  },
  { num: 23, cx: 150, cy: 104, label: 'LLI2' },
  { num: 24, cx: 138, cy: 100, label: 'LLI1' },
  { num: 25, cx: 126, cy: 100, label: 'LRI1' },
  { num: 26, cx: 114, cy: 104, label: 'LRI2' },
  { num: 27, cx: 100, cy: 108, label: 'LRC'  },
  { num: 28, cx: 84,  cy: 110, label: 'LR1P' },
  { num: 29, cx: 68,  cy: 110, label: 'LR2P' },
  { num: 30, cx: 52,  cy: 108, label: 'LR1M' },
  { num: 31, cx: 36,  cy: 104, label: 'LR2M' },
  { num: 32, cx: 20,  cy: 96, label: 'LR3M'  },
]

type ToothCondition = 'healthy' | 'decay' | 'missing' | 'crown' | 'implant' | 'root_canal' | 'filling'

const CONDITION_COLORS: Record<ToothCondition, { fill: string; stroke: string }> = {
  healthy:    { fill: '#F9FAFB', stroke: '#D1D5DB' },
  decay:      { fill: '#FEF2F2', stroke: '#DC2626' },
  missing:    { fill: '#F3F4F6', stroke: '#9CA3AF' },
  crown:      { fill: '#FFFBEB', stroke: '#D97706' },
  implant:    { fill: '#EFF0FF', stroke: '#0410BD' },
  root_canal: { fill: '#FDF4FF', stroke: '#7C3AED' },
  filling:    { fill: '#ECFDF5', stroke: '#16A34A' },
}

const CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: 'Healthy', decay: 'Decay', missing: 'Missing',
  crown: 'Crown', implant: 'Implant', root_canal: 'Root Canal', filling: 'Filling',
}

interface ToothStatus {
  toothNum: number
  condition: ToothCondition
  notes?: string
}

interface TeethMapProps {
  patientId: string
  toothStatuses?: ToothStatus[]
  compact?: boolean
  onToothClick?: (toothNum: number) => void
}

export function TeethMap({ toothStatuses = [], compact = false, onToothClick }: TeethMapProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  const statusMap = Object.fromEntries(toothStatuses.map(t => [t.toothNum, t]))

  function getCondition(num: number): ToothCondition {
    return statusMap[num]?.condition ?? 'healthy'
  }

  const selected = selectedTooth ? statusMap[selectedTooth] : null
  const R = compact ? 8 : 11

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox="0 0 264 130"
          style={{ width: compact ? 200 : 280, height: 'auto', display: 'block' }}
          aria-label="Dental chart"
        >
          {/* Arch guide lines */}
          <path d="M 20 28 Q 132 2 244 28" fill="none" stroke="#E5E7EB" strokeWidth="1.5" />
          <path d="M 20 96 Q 132 124 244 96" fill="none" stroke="#E5E7EB" strokeWidth="1.5" />

          {TOOTH_POSITIONS.map(({ num, cx, cy }) => {
            const cond = getCondition(num)
            const colors = CONDITION_COLORS[cond]
            const isMissing = cond === 'missing'
            const isSelected = selectedTooth === num

            return (
              <g key={num} onClick={() => { setSelectedTooth(num === selectedTooth ? null : num); onToothClick?.(num) }} style={{ cursor: 'pointer' }}>
                {isMissing ? (
                  <line x1={cx - R + 2} y1={cy - R + 2} x2={cx + R - 2} y2={cy + R - 2}
                    stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="3,2" />
                ) : (
                  <circle cx={cx} cy={cy} r={R}
                    fill={colors.fill}
                    stroke={isSelected ? '#0410BD' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                )}
                {/* Condition indicator dot */}
                {cond !== 'healthy' && cond !== 'missing' && (
                  <circle cx={cx + R - 3} cy={cy - R + 3} r={3}
                    fill={colors.stroke} stroke="white" strokeWidth={1} />
                )}
                {!compact && (
                  <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={6} fill="#6B7280" fontWeight="600">
                    {num}
                  </text>
                )}
              </g>
            )
          })}

          {/* UPPER / LOWER labels */}
          {!compact && (
            <>
              <text x={132} y={8} textAnchor="middle" fontSize={7} fill="#9CA3AF" fontWeight="700" letterSpacing="1">UPPER</text>
              <text x={132} y={127} textAnchor="middle" fontSize={7} fill="#9CA3AF" fontWeight="700" letterSpacing="1">LOWER</text>
            </>
          )}
        </svg>
      </div>

      {/* Selected tooth detail */}
      {selectedTooth && !compact && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '10px 14px', fontSize: 13,
        }}>
          <div style={{ fontWeight: 700, color: '#12122C', marginBottom: 4 }}>
            Tooth #{selectedTooth}
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: CONDITION_COLORS[getCondition(selectedTooth)].stroke }}>
              {CONDITION_LABELS[getCondition(selectedTooth)]}
            </span>
          </div>
          {selected?.notes && (
            <div style={{ color: '#6B6B8A', fontSize: 12 }}>{selected.notes}</div>
          )}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {(Object.entries(CONDITION_LABELS) as [ToothCondition, string][]).map(([cond, label]) => (
            <span key={cond} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CONDITION_COLORS[cond].fill, border: `1.5px solid ${CONDITION_COLORS[cond].stroke}`, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
