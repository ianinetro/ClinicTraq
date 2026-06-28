import { useState } from 'react'
import { X, Calendar } from 'lucide-react'

export type BodyRegion =
  | 'head' | 'neck' | 'chest' | 'abdomen' | 'pelvis'
  | 'left_shoulder' | 'right_shoulder'
  | 'left_arm' | 'right_arm'
  | 'left_hand' | 'right_hand'
  | 'left_hip' | 'right_hip'
  | 'left_leg' | 'right_leg'
  | 'left_foot' | 'right_foot'
  | 'back_upper' | 'back_lower'

interface RegionVisit {
  id: string
  date: string
  type: string
  provider?: string
  diagnoses: { code: string; description: string }[]
  procedures: { code: string; description: string }[]
}

interface BodyMapProps {
  sex: 'M' | 'F' | 'unknown'
  visits?: Record<BodyRegion, RegionVisit[]>
  onRegionClick?: (region: BodyRegion) => void
}

// ICD-10 prefix → body region mapping
export function icd10ToRegion(code: string): BodyRegion | null {
  const c = code.toUpperCase()
  if (c.match(/^[GH]/)) return 'head'
  if (c.match(/^J/)) return 'chest'
  if (c.match(/^[KI]/)) return 'abdomen'
  if (c.match(/^M54\.[0-4]/)) return 'neck'
  if (c.match(/^M54\.[5-9]/)) return 'back_lower'
  if (c.match(/^M4[0-9]/)) return 'back_upper'
  if (c.match(/^S[04][0-9]/)) return 'left_shoulder'
  if (c.match(/^S[4-6][0-9]/)) return 'left_arm'
  if (c.match(/^S[6-7][0-9]/)) return 'left_hand'
  if (c.match(/^S7[0-9]/)) return 'left_hip'
  if (c.match(/^S[8-9][0-9]/)) return 'left_leg'
  if (c.match(/^S9[0-9]/)) return 'left_foot'
  if (c.match(/^I[0-9]/)) return 'chest'
  if (c.match(/^N[0-9]/)) return 'pelvis'
  return null
}

const REGION_LABELS: Record<BodyRegion, string> = {
  head: 'Head', neck: 'Neck', chest: 'Chest', abdomen: 'Abdomen', pelvis: 'Pelvis',
  left_shoulder: 'Left Shoulder', right_shoulder: 'Right Shoulder',
  left_arm: 'Left Arm', right_arm: 'Right Arm',
  left_hand: 'Left Hand', right_hand: 'Right Hand',
  left_hip: 'Left Hip', right_hip: 'Right Hip',
  left_leg: 'Left Leg', right_leg: 'Right Leg',
  left_foot: 'Left Foot', right_foot: 'Right Foot',
  back_upper: 'Upper Back', back_lower: 'Lower Back',
}

interface RegionPath {
  region: BodyRegion
  path: string
  cx?: number
  cy?: number
}

// SVG paths for front-view male body (100x240 viewBox)
const FRONT_REGIONS_MALE: RegionPath[] = [
  { region: 'head', path: 'M 50 5 m -14 0 a 14 16 0 1 0 28 0 a 14 16 0 1 0 -28 0', cx: 50, cy: 5 },
  { region: 'neck', path: 'M 44 20 L 56 20 L 58 30 L 42 30 Z', cx: 50, cy: 25 },
  { region: 'chest', path: 'M 30 30 L 70 30 L 72 70 L 28 70 Z', cx: 50, cy: 50 },
  { region: 'abdomen', path: 'M 28 70 L 72 70 L 70 100 L 30 100 Z', cx: 50, cy: 85 },
  { region: 'pelvis', path: 'M 30 100 L 70 100 L 68 120 L 32 120 Z', cx: 50, cy: 110 },
  { region: 'left_shoulder', path: 'M 30 30 L 20 28 L 14 50 L 28 58 Z', cx: 22, cy: 44 },
  { region: 'right_shoulder', path: 'M 70 30 L 80 28 L 86 50 L 72 58 Z', cx: 78, cy: 44 },
  { region: 'left_arm', path: 'M 14 50 L 28 58 L 24 110 L 10 102 Z', cx: 19, cy: 80 },
  { region: 'right_arm', path: 'M 86 50 L 72 58 L 76 110 L 90 102 Z', cx: 81, cy: 80 },
  { region: 'left_hand', path: 'M 10 102 L 24 110 L 20 128 L 6 120 Z', cx: 15, cy: 115 },
  { region: 'right_hand', path: 'M 90 102 L 76 110 L 80 128 L 94 120 Z', cx: 85, cy: 115 },
  { region: 'left_hip', path: 'M 32 120 L 50 120 L 46 155 L 28 150 Z', cx: 38, cy: 138 },
  { region: 'right_hip', path: 'M 50 120 L 68 120 L 72 150 L 54 155 Z', cx: 62, cy: 138 },
  { region: 'left_leg', path: 'M 28 150 L 46 155 L 42 210 L 24 205 Z', cx: 35, cy: 180 },
  { region: 'right_leg', path: 'M 72 150 L 54 155 L 58 210 L 76 205 Z', cx: 65, cy: 180 },
  { region: 'left_foot', path: 'M 24 205 L 42 210 L 38 230 L 20 226 Z', cx: 31, cy: 218 },
  { region: 'right_foot', path: 'M 76 205 L 58 210 L 62 230 L 80 226 Z', cx: 69, cy: 218 },
]

// Female version — same regions, slightly adjusted for body shape
const FRONT_REGIONS_FEMALE: RegionPath[] = FRONT_REGIONS_MALE.map(r => {
  if (r.region === 'chest') return { ...r, path: 'M 28 30 L 72 30 L 74 72 L 26 72 Z' }
  if (r.region === 'abdomen') return { ...r, path: 'M 26 72 L 74 72 L 72 102 L 28 102 Z' }
  if (r.region === 'pelvis') return { ...r, path: 'M 28 102 L 72 102 L 70 122 L 30 122 Z' }
  return r
})

function RegionDetailPanel({
  region, visits, onClose,
}: {
  region: BodyRegion
  visits: RegionVisit[]
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: '100%', marginLeft: 12,
      width: 280, background: 'white', border: '1px solid #E3E3F1',
      borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      zIndex: 100, overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#12122C' }}>{REGION_LABELS[region]}</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
          <X size={15} />
        </button>
      </div>
      {visits.length === 0 ? (
        <div style={{ padding: '16px 14px', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
          No prior visits for this region
        </div>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {visits.map(v => (
            <div key={v.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <Calendar size={12} style={{ color: '#9CA3AF' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{v.date}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {v.type}</span>
              </div>
              {v.provider && (
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Provider: {v.provider}</div>
              )}
              {v.diagnoses.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>Diagnoses</div>
                  {v.diagnoses.map(d => (
                    <div key={d.code} style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#0410BD' }}>{d.code}</span>
                      <span style={{ color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.description}</span>
                    </div>
                  ))}
                </div>
              )}
              {v.procedures.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>Procedures</div>
                  {v.procedures.map(p => (
                    <div key={p.code} style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 4 }}>
                      <span style={{ fontWeight: 600, color: '#16A34A' }}>{p.code}</span>
                      <span style={{ color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BodyMap({ sex, visits = {} as Record<BodyRegion, RegionVisit[]> }: BodyMapProps) {
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null)

  const regions = sex === 'F' ? FRONT_REGIONS_FEMALE : FRONT_REGIONS_MALE

  function getRegionColor(region: BodyRegion): string {
    const v = visits[region]
    if (!v || v.length === 0) return 'transparent'
    const latest = v[0]
    const daysSince = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000)
    if (daysSince <= 30) return 'rgba(220, 38, 38, 0.35)'   // recent — red
    if (daysSince <= 180) return 'rgba(217, 119, 6, 0.30)'  // within 6mo — amber
    return 'rgba(22, 163, 74, 0.25)'                         // older — green
  }

  function getRegionStroke(region: BodyRegion): string {
    if (region === selectedRegion) return '#0410BD'
    if (region === hoveredRegion) return '#4F46E5'
    const v = visits[region]
    if (v && v.length > 0) return 'rgba(0,0,0,0.2)'
    return 'rgba(0,0,0,0.08)'
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <svg
        viewBox="0 0 100 240"
        width={130}
        height={310}
        style={{ display: 'block' }}
      >
        {/* Body outline */}
        <rect width={100} height={240} fill="none" />

        {regions.map(({ region, path }) => {
          const fill = getRegionColor(region)
          const stroke = getRegionStroke(region)
          const hasVisits = visits[region]?.length > 0

          return (
            <path
              key={region}
              d={path}
              fill={fill === 'transparent' ? '#F8FAFC' : fill}
              stroke={stroke}
              strokeWidth={region === selectedRegion ? 1.5 : 0.8}
              style={{
                cursor: 'pointer',
                transition: 'fill 0.15s, stroke 0.15s',
                filter: region === hoveredRegion ? 'brightness(0.95)' : 'none',
              }}
              onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
              onMouseEnter={() => setHoveredRegion(region)}
              onMouseLeave={() => setHoveredRegion(null)}
            >
              {hasVisits && <title>{REGION_LABELS[region]} — {visits[region].length} visit{visits[region].length !== 1 ? 's' : ''}</title>}
              {!hasVisits && <title>{REGION_LABELS[region]} — No prior visits</title>}
            </path>
          )
        })}

        {/* Dot indicators for regions with visits */}
        {regions.map(({ region, cx, cy }) => {
          const count = visits[region]?.length ?? 0
          if (!count || cx === undefined || cy === undefined) return null
          return (
            <circle
              key={`dot-${region}`}
              cx={cx}
              cy={cy}
              r={2.5}
              fill="#0410BD"
              opacity={0.8}
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {[
          { color: 'rgba(220,38,38,0.35)', label: '< 30 days' },
          { color: 'rgba(217,119,6,0.30)', label: '< 6 months' },
          { color: 'rgba(22,163,74,0.25)', label: 'Older' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#9CA3AF' }}>
            <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }} />
            {l.label}
          </div>
        ))}
      </div>

      {selectedRegion && (
        <RegionDetailPanel
          region={selectedRegion}
          visits={visits[selectedRegion] ?? []}
          onClose={() => setSelectedRegion(null)}
        />
      )}
    </div>
  )
}
