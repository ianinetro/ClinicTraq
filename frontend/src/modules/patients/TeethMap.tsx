import { useState } from 'react'

// Universal Numbering System — 1-16 upper (right→left), 17-32 lower (left→right)
// Each tooth has 5 surfaces: O (occlusal/incisal), B (buccal), L (lingual), M (mesial), D (distal)
// Layout: 16 teeth per arch, spread across the SVG width

const UPPER_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const LOWER_NUMS = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17]

type ToothCondition = 'healthy' | 'decay' | 'missing' | 'crown' | 'implant' | 'root_canal' | 'filling'
type Surface = 'O' | 'B' | 'L' | 'M' | 'D'

const CONDITION_COLORS: Record<ToothCondition, { fill: string; stroke: string; dot: string }> = {
  healthy:    { fill: '#FFFFFF', stroke: '#CBD5E1', dot: '#CBD5E1' },
  decay:      { fill: '#FEF2F2', stroke: '#DC2626', dot: '#DC2626' },
  missing:    { fill: '#F1F5F9', stroke: '#94A3B8', dot: '#94A3B8' },
  crown:      { fill: '#FFFBEB', stroke: '#D97706', dot: '#D97706' },
  implant:    { fill: '#EFF6FF', stroke: '#2563EB', dot: '#2563EB' },
  root_canal: { fill: '#FDF4FF', stroke: '#7C3AED', dot: '#7C3AED' },
  filling:    { fill: '#F0FDF4', stroke: '#16A34A', dot: '#16A34A' },
}

const CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: 'Healthy', decay: 'Decay', missing: 'Missing',
  crown: 'Crown', implant: 'Implant', root_canal: 'Root Canal', filling: 'Filling',
}

interface ToothStatus {
  toothNum: number
  condition: ToothCondition
  surfaces?: Partial<Record<Surface, ToothCondition>>
  notes?: string
}

interface TeethMapProps {
  patientId: string
  toothStatuses?: ToothStatus[]
  compact?: boolean
  onToothClick?: (toothNum: number) => void
}

// Layout constants
const SVG_W = 680
const SVG_H = 220
const TOOTH_W = 32
const TOOTH_H = 38
const GAP = 10      // gap between teeth (filler space)
const ARCH_X_START = 18
const UPPER_Y = 28
const LOWER_Y = SVG_H - 28 - TOOTH_H

// Draw 5-surface tooth diagram inside a bounding rect (x,y,w,h)
// Surfaces: center=occlusal, top=buccal, bottom=lingual, left=mesial, right=distal
function ToothBlock({
  x, y, w, h, num, status, isSelected, compact, onClick,
}: {
  x: number; y: number; w: number; h: number
  num: number; status: ToothStatus | undefined
  isSelected: boolean; compact: boolean
  onClick: () => void
}) {
  const cond: ToothCondition = status?.condition ?? 'healthy'
  const colors = CONDITION_COLORS[cond]
  const isMissing = cond === 'missing'

  // Surface override colors
  const sf = status?.surfaces ?? {}
  function sfColor(s: Surface) {
    const c = sf[s] ?? cond
    return CONDITION_COLORS[c]
  }

  const cx = x + w / 2
  const cy = y + h / 2
  const ow = w * 0.44  // occlusal inner box width
  const oh = h * 0.42  // occlusal inner box height
  const ox = cx - ow / 2
  const oy = cy - oh / 2

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {isMissing ? (
        <>
          <rect x={x} y={y} width={w} height={h} rx={4}
            fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={x + 4} y1={y + 4} x2={x + w - 4} y2={y + h - 4} stroke="#CBD5E1" strokeWidth={1.5} />
          <line x1={x + w - 4} y1={y + 4} x2={x + 4} y2={y + h - 4} stroke="#CBD5E1" strokeWidth={1.5} />
        </>
      ) : (
        <>
          {/* Outer tooth shape */}
          <rect x={x} y={y} width={w} height={h} rx={5}
            fill={colors.fill}
            stroke={isSelected ? '#0410BD' : colors.stroke}
            strokeWidth={isSelected ? 2.5 : 1.5}
          />
          {/* 5-surface diagram (only in non-compact) */}
          {!compact && (
            <>
              {/* Buccal (top) */}
              <rect x={ox} y={y + 2} width={ow} height={oy - y - 2} rx={2}
                fill={sfColor('B').fill} stroke={sfColor('B').stroke} strokeWidth={1} />
              {/* Lingual (bottom) */}
              <rect x={ox} y={oy + oh} width={ow} height={y + h - 2 - (oy + oh)} rx={2}
                fill={sfColor('L').fill} stroke={sfColor('L').stroke} strokeWidth={1} />
              {/* Mesial (left) */}
              <rect x={x + 2} y={oy} width={ox - x - 2} height={oh} rx={2}
                fill={sfColor('M').fill} stroke={sfColor('M').stroke} strokeWidth={1} />
              {/* Distal (right) */}
              <rect x={ox + ow} y={oy} width={x + w - 2 - (ox + ow)} height={oh} rx={2}
                fill={sfColor('D').fill} stroke={sfColor('D').stroke} strokeWidth={1} />
              {/* Occlusal (center) */}
              <rect x={ox} y={oy} width={ow} height={oh} rx={3}
                fill={sfColor('O').fill} stroke={sfColor('O').stroke} strokeWidth={1.5} />
            </>
          )}
          {/* Condition dot for compact */}
          {compact && cond !== 'healthy' && (
            <circle cx={x + w - 4} cy={y + 4} r={3} fill={colors.dot} stroke="white" strokeWidth={0.8} />
          )}
        </>
      )}
      {/* Tooth number */}
      {!compact && (
        <text x={cx} y={y + h + 10} textAnchor="middle" fontSize={8} fill="#64748B" fontWeight="600">
          {num}
        </text>
      )}
    </g>
  )
}

// Filler gap between teeth (visual space indicator)
function FillerGap({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <rect x={x} y={y + h * 0.25} width={GAP - 2} height={h * 0.5} rx={2}
      fill="#F1F5F9" stroke="#E2E8F0" strokeWidth={0.5} />
  )
}

export function TeethMap({ toothStatuses = [], compact = false, onToothClick }: TeethMapProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  const statusMap = Object.fromEntries(toothStatuses.map(t => [t.toothNum, t]))
  const selected = selectedTooth ? statusMap[selectedTooth] : undefined


  function handleToothClick(num: number) {
    setSelectedTooth(num === selectedTooth ? null : num)
    onToothClick?.(num)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: compact ? 440 : '100%', maxWidth: SVG_W, height: 'auto', display: 'block' }}
          aria-label="Dental chart"
        >
          {/* Arch labels */}
          {!compact && (
            <>
              <text x={SVG_W / 2} y={12} textAnchor="middle" fontSize={8} fill="#94A3B8" fontWeight="700" letterSpacing="1.5">UPPER</text>
              <text x={SVG_W / 2} y={SVG_H - 2} textAnchor="middle" fontSize={8} fill="#94A3B8" fontWeight="700" letterSpacing="1.5">LOWER</text>
              {/* Midline indicator */}
              <line x1={SVG_W / 2} y1={UPPER_Y - 6} x2={SVG_W / 2} y2={UPPER_Y + TOOTH_H + 6} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,2" />
              <line x1={SVG_W / 2} y1={LOWER_Y - 6} x2={SVG_W / 2} y2={LOWER_Y + TOOTH_H + 6} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3,2" />
            </>
          )}

          {/* Upper arch */}
          {UPPER_NUMS.map((num, i) => {
            const x = ARCH_X_START + i * (TOOTH_W + GAP)
            return (
              <g key={`upper-${num}`}>
                {i > 0 && <FillerGap x={x - GAP} y={UPPER_Y} h={TOOTH_H} />}
                <ToothBlock
                  x={x} y={UPPER_Y} w={TOOTH_W} h={TOOTH_H}
                  num={num} status={statusMap[num]}
                  isSelected={selectedTooth === num}
                  compact={compact}
                  onClick={() => handleToothClick(num)}
                />
              </g>
            )
          })}

          {/* Lower arch */}
          {LOWER_NUMS.map((num, i) => {
            const x = ARCH_X_START + i * (TOOTH_W + GAP)
            return (
              <g key={`lower-${num}`}>
                {i > 0 && <FillerGap x={x - GAP} y={LOWER_Y} h={TOOTH_H} />}
                <ToothBlock
                  x={x} y={LOWER_Y} w={TOOTH_W} h={TOOTH_H}
                  num={num} status={statusMap[num]}
                  isSelected={selectedTooth === num}
                  compact={compact}
                  onClick={() => handleToothClick(num)}
                />
              </g>
            )
          })}
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
            {' '}
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 600,
              color: CONDITION_COLORS[selected?.condition ?? 'healthy'].stroke,
              background: CONDITION_COLORS[selected?.condition ?? 'healthy'].fill,
              border: `1px solid ${CONDITION_COLORS[selected?.condition ?? 'healthy'].stroke}`,
              borderRadius: 4, padding: '1px 6px',
            }}>
              {CONDITION_LABELS[selected?.condition ?? 'healthy']}
            </span>
          </div>
          {selected?.notes && (
            <div style={{ color: '#6B6B8A', fontSize: 12, marginTop: 4 }}>{selected.notes}</div>
          )}
          {selected?.surfaces && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(Object.entries(selected.surfaces) as [Surface, ToothCondition][]).map(([surf, cond]) => (
                <span key={surf} style={{
                  fontSize: 11, fontWeight: 600,
                  color: CONDITION_COLORS[cond].stroke,
                  background: CONDITION_COLORS[cond].fill,
                  border: `1px solid ${CONDITION_COLORS[cond].stroke}`,
                  borderRadius: 4, padding: '1px 7px',
                }}>
                  {surf}: {CONDITION_LABELS[cond]}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {(Object.entries(CONDITION_LABELS) as [ToothCondition, string][]).map(([cond, label]) => (
            <span key={cond} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
              <span style={{
                width: 11, height: 11, borderRadius: 2,
                background: CONDITION_COLORS[cond].fill,
                border: `1.5px solid ${CONDITION_COLORS[cond].stroke}`,
                display: 'inline-block',
              }} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
