import { useState, useRef, useEffect } from 'react'
import { Plus, X, Search } from 'lucide-react'
import { clsx } from 'clsx'
import apiClient from '../../services/api'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BodyMapProps {
  patientId: string
  compact?: boolean
}

type AnnotationType = 'note' | 'symptom' | 'finding' | 'diagnosis'
type SeverityType = 'mild' | 'moderate' | 'severe'

interface LocalAnnotation {
  id: string
  region: string
  type: AnnotationType
  text: string
  severity?: SeverityType
  icd10Code?: string
  icd10Description?: string
}

interface PopoverState {
  regionId: string
  svgX: number
  svgY: number
}

interface Icd10Result {
  code: string
  description: string
}

// ─── Common ICD-10 Quick Picks ───────────────────────────────────────────────

const QUICK_ICD10: Icd10Result[] = [
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M25.511', description: 'Pain in right shoulder' },
  { code: 'M54.2', description: 'Cervicalgia (neck pain)' },
  { code: 'R51', description: 'Headache' },
  { code: 'M79.3', description: 'Panniculitis' },
  { code: 'M79.1', description: 'Myalgia' },
]

// ─── Body Regions ────────────────────────────────────────────────────────────

interface BodyRegion {
  id: string
  label: string
  view: 'front' | 'back'
  dotX: number
  dotY: number
  d: string
}

// ViewBox: 0 0 200 420

const FRONT_REGIONS: BodyRegion[] = [
  {
    id: 'head-front', label: 'Head', view: 'front',
    dotX: 100, dotY: 30,
    d: 'M100,14 C122,14 138,30 138,50 C138,70 122,86 100,86 C78,86 62,70 62,50 C62,30 78,14 100,14 Z',
  },
  {
    id: 'neck-front', label: 'Neck', view: 'front',
    dotX: 100, dotY: 96,
    d: 'M88,86 L112,86 L114,108 L86,108 Z',
  },
  {
    id: 'shoulder-left', label: 'Left Shoulder', view: 'front',
    dotX: 58, dotY: 116,
    d: 'M72,108 C70,106 64,104 54,104 C44,104 34,110 32,120 C30,130 34,140 42,142 C48,144 56,142 62,138 L62,108 Z',
  },
  {
    id: 'shoulder-right', label: 'Right Shoulder', view: 'front',
    dotX: 142, dotY: 116,
    d: 'M128,108 C130,106 136,104 146,104 C156,104 166,110 168,120 C170,130 166,140 158,142 C152,144 144,142 138,138 L138,108 Z',
  },
  {
    id: 'chest-left', label: 'Chest Left', view: 'front',
    dotX: 86, dotY: 132,
    d: 'M72,108 L100,108 L100,162 L72,158 C68,148 67,130 72,108 Z',
  },
  {
    id: 'chest-right', label: 'Chest Right', view: 'front',
    dotX: 114, dotY: 132,
    d: 'M100,108 L128,108 C133,130 132,148 128,158 L100,162 Z',
  },
  {
    id: 'abdomen-upper', label: 'Upper Abdomen', view: 'front',
    dotX: 100, dotY: 174,
    d: 'M72,158 L100,162 L128,158 L130,188 L70,188 Z',
  },
  {
    id: 'abdomen-lower', label: 'Lower Abdomen', view: 'front',
    dotX: 100, dotY: 204,
    d: 'M70,188 L130,188 L128,218 L72,218 Z',
  },
  {
    id: 'hip-left', label: 'Left Hip', view: 'front',
    dotX: 82, dotY: 232,
    d: 'M72,218 L100,218 L98,248 L68,252 C64,242 65,228 72,218 Z',
  },
  {
    id: 'hip-right', label: 'Right Hip', view: 'front',
    dotX: 118, dotY: 232,
    d: 'M100,218 L128,218 C135,228 136,242 132,252 L102,248 Z',
  },
  {
    id: 'arm-left', label: 'Left Upper Arm', view: 'front',
    dotX: 47, dotY: 162,
    d: 'M62,138 C56,140 50,142 46,142 L38,190 C36,200 36,214 40,224 L54,224 L54,138 Z',
  },
  {
    id: 'arm-right', label: 'Right Upper Arm', view: 'front',
    dotX: 153, dotY: 162,
    d: 'M138,138 C144,140 150,142 154,142 L162,190 C164,200 164,214 160,224 L146,224 L146,138 Z',
  },
  {
    id: 'forearm-left', label: 'Left Forearm', view: 'front',
    dotX: 44, dotY: 248,
    d: 'M40,224 L54,224 L56,272 C54,278 48,282 42,280 C36,278 32,270 34,264 Z',
  },
  {
    id: 'forearm-right', label: 'Right Forearm', view: 'front',
    dotX: 156, dotY: 248,
    d: 'M160,224 L146,224 L144,272 C146,278 152,282 158,280 C164,278 168,270 166,264 Z',
  },
  {
    id: 'hand-left', label: 'Left Hand', view: 'front',
    dotX: 44, dotY: 292,
    d: 'M42,280 C38,282 34,288 34,296 C34,304 38,312 44,314 C50,316 56,312 58,304 C60,296 58,286 56,272 C50,278 44,280 42,280 Z',
  },
  {
    id: 'hand-right', label: 'Right Hand', view: 'front',
    dotX: 156, dotY: 292,
    d: 'M158,280 C162,282 166,288 166,296 C166,304 162,312 156,314 C150,316 144,312 142,304 C140,296 142,286 144,272 C150,278 156,282 158,280 Z',
  },
  {
    id: 'thigh-left', label: 'Left Thigh', view: 'front',
    dotX: 84, dotY: 290,
    d: 'M68,252 L98,248 L96,334 L70,334 C64,316 64,278 68,252 Z',
  },
  {
    id: 'thigh-right', label: 'Right Thigh', view: 'front',
    dotX: 116, dotY: 290,
    d: 'M102,248 L132,252 C136,278 136,316 130,334 L104,334 Z',
  },
  {
    id: 'knee-left', label: 'Left Knee', view: 'front',
    dotX: 83, dotY: 346,
    d: 'M70,334 L96,334 L95,362 L71,362 Z',
  },
  {
    id: 'knee-right', label: 'Right Knee', view: 'front',
    dotX: 117, dotY: 346,
    d: 'M104,334 L130,334 L129,362 L105,362 Z',
  },
  {
    id: 'lower-leg-left', label: 'Left Lower Leg', view: 'front',
    dotX: 81, dotY: 384,
    d: 'M71,362 L95,362 L94,406 L72,406 Z',
  },
  {
    id: 'lower-leg-right', label: 'Right Lower Leg', view: 'front',
    dotX: 119, dotY: 384,
    d: 'M105,362 L129,362 L128,406 L106,406 Z',
  },
  {
    id: 'foot-left', label: 'Left Foot', view: 'front',
    dotX: 80, dotY: 414,
    d: 'M72,406 L94,406 C93,413 90,418 84,419 C76,419 70,415 70,410 Z',
  },
  {
    id: 'foot-right', label: 'Right Foot', view: 'front',
    dotX: 120, dotY: 414,
    d: 'M106,406 L128,406 L130,410 C130,415 124,419 116,419 C110,418 107,413 106,406 Z',
  },
]

const BACK_REGIONS: BodyRegion[] = [
  {
    id: 'head-back', label: 'Head', view: 'back',
    dotX: 100, dotY: 30,
    d: 'M100,14 C122,14 138,30 138,50 C138,70 122,86 100,86 C78,86 62,70 62,50 C62,30 78,14 100,14 Z',
  },
  {
    id: 'neck-back', label: 'Neck', view: 'back',
    dotX: 100, dotY: 96,
    d: 'M88,86 L112,86 L114,108 L86,108 Z',
  },
  {
    id: 'shoulder-back-left', label: 'Left Shoulder (Back)', view: 'back',
    dotX: 58, dotY: 116,
    d: 'M72,108 C70,106 64,104 54,104 C44,104 34,110 32,120 C30,130 34,140 42,142 C48,144 56,142 62,138 L62,108 Z',
  },
  {
    id: 'shoulder-back-right', label: 'Right Shoulder (Back)', view: 'back',
    dotX: 142, dotY: 116,
    d: 'M128,108 C130,106 136,104 146,104 C156,104 166,110 168,120 C170,130 166,140 158,142 C152,144 144,142 138,138 L138,108 Z',
  },
  {
    id: 'upper-back', label: 'Upper Back', view: 'back',
    dotX: 100, dotY: 136,
    d: 'M72,108 L128,108 C132,120 133,150 128,162 L72,162 C67,150 68,120 72,108 Z',
  },
  {
    id: 'lower-back', label: 'Lower Back', view: 'back',
    dotX: 100, dotY: 182,
    d: 'M72,162 L128,162 L128,205 L72,205 Z',
  },
  {
    id: 'arm-back-left', label: 'Left Arm (Back)', view: 'back',
    dotX: 45, dotY: 180,
    d: 'M62,138 C56,140 50,142 46,142 L36,192 C34,204 34,224 40,236 L54,236 L54,138 Z',
  },
  {
    id: 'arm-back-right', label: 'Right Arm (Back)', view: 'back',
    dotX: 155, dotY: 180,
    d: 'M138,138 C144,140 150,142 154,142 L164,192 C166,204 166,224 160,236 L146,236 L146,138 Z',
  },
  {
    id: 'buttock-left', label: 'Left Buttock', view: 'back',
    dotX: 86, dotY: 226,
    d: 'M72,205 L100,205 L98,252 L68,256 C63,244 63,220 72,205 Z',
  },
  {
    id: 'buttock-right', label: 'Right Buttock', view: 'back',
    dotX: 114, dotY: 226,
    d: 'M100,205 L128,205 C137,220 137,244 132,256 L102,252 Z',
  },
  {
    id: 'hamstring-left', label: 'Left Hamstring', view: 'back',
    dotX: 84, dotY: 292,
    d: 'M68,256 L98,252 L96,338 L70,338 C64,320 64,280 68,256 Z',
  },
  {
    id: 'hamstring-right', label: 'Right Hamstring', view: 'back',
    dotX: 116, dotY: 292,
    d: 'M102,252 L132,256 C136,280 136,320 130,338 L104,338 Z',
  },
  {
    id: 'calf-left', label: 'Left Calf', view: 'back',
    dotX: 81, dotY: 380,
    d: 'M70,338 L96,338 L95,406 L72,406 Z',
  },
  {
    id: 'calf-right', label: 'Right Calf', view: 'back',
    dotX: 119, dotY: 380,
    d: 'M104,338 L130,338 L128,406 L105,406 Z',
  },
  {
    id: 'foot-back-left', label: 'Left Foot (Back)', view: 'back',
    dotX: 82, dotY: 414,
    d: 'M72,406 L95,406 C94,413 91,418 85,419 C77,419 70,415 70,410 Z',
  },
  {
    id: 'foot-back-right', label: 'Right Foot (Back)', view: 'back',
    dotX: 118, dotY: 414,
    d: 'M105,406 L128,406 L130,410 C130,415 123,419 115,419 C109,418 106,413 105,406 Z',
  },
]

// ─── ICD-10 Search Hook ──────────────────────────────────────────────────────

function useIcd10Search(query: string) {
  const [results, setResults] = useState<Icd10Result[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiClient.get('/icd10/search', { params: { q: query, limit: 8 } })
        setResults(res.data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return { results, loading }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityDotColor(severity?: SeverityType) {
  switch (severity) {
    case 'severe': return '#DC2626'
    case 'moderate': return '#D97706'
    case 'mild': return '#16A34A'
    default: return '#0410BD'
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function BodyMap({ patientId: _patientId, compact = false }: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const [annotations, setAnnotations] = useState<LocalAnnotation[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [addingAnnotation, setAddingAnnotation] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState<{
    type: AnnotationType
    text: string
    severity: SeverityType
    icd10Code: string
    icd10Description: string
  }>({ type: 'symptom', text: '', severity: 'mild', icd10Code: '', icd10Description: '' })
  const [icd10Query, setIcd10Query] = useState('')
  const [showIcd10Dropdown, setShowIcd10Dropdown] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const { results: icd10Results, loading: icd10Loading } = useIcd10Search(icd10Query)

  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS

  function handleRegionClick(region: BodyRegion, e: React.MouseEvent) {
    e.stopPropagation()
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = rect.width / 200
    const scaleY = rect.height / 420
    const svgX = region.dotX * scaleX
    const svgY = region.dotY * scaleY
    setSelectedRegion(region.id)
    setPopover({ regionId: region.id, svgX, svgY })
    setAddingAnnotation(false)
    setIcd10Query('')
    setShowIcd10Dropdown(false)
  }

  function handleAddAnnotation() {
    if (!newAnnotation.text.trim() || !popover) return
    const anno: LocalAnnotation = {
      id: Math.random().toString(36).slice(2),
      region: popover.regionId,
      type: newAnnotation.type,
      text: newAnnotation.text,
      severity: newAnnotation.severity,
      icd10Code: newAnnotation.icd10Code || undefined,
      icd10Description: newAnnotation.icd10Description || undefined,
    }
    setAnnotations(prev => [...prev, anno])
    setNewAnnotation({ type: 'symptom', text: '', severity: 'mild', icd10Code: '', icd10Description: '' })
    setIcd10Query('')
    setAddingAnnotation(false)
  }

  function selectIcd10(item: Icd10Result) {
    setNewAnnotation(p => ({ ...p, icd10Code: item.code, icd10Description: item.description }))
    setIcd10Query(`${item.code} – ${item.description}`)
    setShowIcd10Dropdown(false)
  }

  const regionAnnotations = popover ? annotations.filter(a => a.region === popover.regionId) : []
  const popoverRegion = popover ? regions.find(r => r.id === popover.regionId) : null

  const svgDisplayWidth = compact ? 120 : 200
  const svgDisplayHeight = compact ? 252 : 420
  const popoverOnLeft = popover ? popover.svgX > svgDisplayWidth * 0.5 : false

  return (
    <div className="relative select-none">
      {/* Front / Back Toggle */}
      {!compact && (
        <div className="flex gap-1 mb-4">
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setPopover(null); setSelectedRegion(null) }}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                view === v
                  ? 'bg-[--bb-brand-blue] text-white'
                  : 'bg-[--bb-surface-app] text-[--bb-text-secondary] hover:bg-[#EFF0FF]',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      <div className="relative inline-block">
        <svg
          ref={svgRef}
          width={svgDisplayWidth}
          height={svgDisplayHeight}
          viewBox="0 0 200 420"
          className="overflow-visible"
          onClick={() => { setPopover(null); setSelectedRegion(null) }}
        >
          {/* ── Body silhouette background (non-interactive) ── */}

          {/* Head */}
          <circle cx={100} cy={50} r={36}
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Neck */}
          <path d="M88,84 L112,84 L114,108 L86,108 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Left shoulder wing */}
          <path d="M72,108 C70,106 64,104 54,104 C44,104 34,110 32,120 C30,130 34,140 42,142 C48,144 56,142 62,138 L62,108 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Right shoulder wing */}
          <path d="M128,108 C130,106 136,104 146,104 C156,104 166,110 168,120 C170,130 166,140 158,142 C152,144 144,142 138,138 L138,108 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Torso */}
          <path d="M72,108 L128,108 L132,220 C132,236 134,252 132,265 L128,420 L72,420 L68,265 C66,252 68,236 68,220 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Left upper arm */}
          <path d="M62,138 C58,140 52,142 48,142 L38,192 C36,204 36,220 40,230 L54,230 L54,138 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Right upper arm */}
          <path d="M138,138 C142,140 148,142 152,142 L162,192 C164,204 164,220 160,230 L146,230 L146,138 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Left forearm */}
          <path d="M40,230 L54,230 L56,274 C54,280 48,284 42,282 C36,280 32,272 34,266 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Right forearm */}
          <path d="M160,230 L146,230 L144,274 C146,280 152,284 158,282 C164,280 168,272 166,266 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Left hand */}
          <ellipse cx={44} cy={294} rx={10} ry={14}
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Right hand */}
          <ellipse cx={156} cy={294} rx={10} ry={14}
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Left leg */}
          <path d="M68,265 L98,260 L96,338 L90,362 L88,410 C86,418 78,420 72,418 L70,410 L72,362 L70,338 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* Right leg */}
          <path d="M132,265 L102,260 L104,338 L110,362 L112,410 C114,418 122,420 128,418 L130,410 L128,362 L130,338 Z"
            fill="#F0E6D8" stroke="#C8A882" strokeWidth="1.5"
            className="pointer-events-none" />

          {/* ── Clickable region overlays ── */}
          {regions.map(region => {
            const isSelected = selectedRegion === region.id
            const hasAnnotation = annotations.some(a => a.region === region.id)

            return (
              <path
                key={region.id}
                d={region.d}
                fill={isSelected ? '#0410BD' : hasAnnotation ? '#BFDBFE' : '#0410BD'}
                fillOpacity={isSelected ? 0.45 : hasAnnotation ? 0.35 : 0}
                stroke={isSelected ? '#0410BD' : hasAnnotation ? '#60A5FA' : '#C8A882'}
                strokeWidth={isSelected ? 1.5 : hasAnnotation ? 1 : 0.4}
                strokeOpacity={isSelected ? 1 : hasAnnotation ? 0.8 : 0.25}
                className="cursor-pointer transition-all duration-150"
                onClick={(e) => handleRegionClick(region, e)}
                onMouseEnter={e => {
                  if (!isSelected) {
                    const el = e.currentTarget as SVGPathElement
                    el.style.fill = '#0410BD'
                    el.style.fillOpacity = '0.18'
                    el.style.strokeOpacity = '0.5'
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    const el = e.currentTarget as SVGPathElement
                    el.style.fill = hasAnnotation ? '#BFDBFE' : '#0410BD'
                    el.style.fillOpacity = hasAnnotation ? '0.35' : '0'
                    el.style.strokeOpacity = hasAnnotation ? '0.8' : '0.25'
                  }
                }}
                role="button"
                aria-label={region.label}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                }}
              />
            )
          })}

          {/* ── Annotation dots ── */}
          {annotations.map(anno => {
            const region = regions.find(r => r.id === anno.region)
            if (!region) return null
            return (
              <circle
                key={anno.id}
                cx={region.dotX}
                cy={region.dotY - 10}
                r={4}
                fill={severityDotColor(anno.severity)}
                stroke="white"
                strokeWidth={1.5}
                className="pointer-events-none"
              />
            )
          })}
        </svg>

        {/* ── Popover ── */}
        {popover && !compact && (
          <div
            className="absolute z-30 bg-white border border-[--bb-border] rounded-xl shadow-xl p-4 w-72"
            style={{
              top: Math.max(0, popover.svgY - 40),
              ...(popoverOnLeft
                ? { right: svgDisplayWidth - popover.svgX + 16 }
                : { left: popover.svgX + 16 }),
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[--bb-text-primary]">
                {popoverRegion?.label}
              </span>
              <button
                onClick={() => { setPopover(null); setSelectedRegion(null) }}
                className="text-[--bb-text-secondary] hover:text-[--bb-text-primary] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Existing annotations for this region */}
            {regionAnnotations.length > 0 && (
              <div className="space-y-2 mb-3">
                {regionAnnotations.map(a => (
                  <div key={a.id} className="text-xs bg-[--bb-surface-app] rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: severityDotColor(a.severity) }}
                      />
                      <span className="font-medium capitalize text-[--bb-text-primary]">{a.type}</span>
                      {a.severity && (
                        <span className="text-[--bb-text-secondary]">· {a.severity}</span>
                      )}
                    </div>
                    <p className="text-[--bb-text-primary] leading-snug">{a.text}</p>
                    {a.icd10Code && (
                      <p className="text-[--bb-text-secondary] font-mono mt-0.5 text-[10px]">
                        {a.icd10Code}
                        {a.icd10Description && (
                          <span className="font-sans not-italic ml-1">{a.icd10Description}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add annotation */}
            {!addingAnnotation ? (
              <button
                onClick={() => setAddingAnnotation(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-[--bb-brand-blue] hover:underline"
              >
                <Plus size={12} />
                Add Annotation
              </button>
            ) : (
              <div className="space-y-2.5">
                {/* Type */}
                <select
                  value={newAnnotation.type}
                  onChange={e => setNewAnnotation(p => ({ ...p, type: e.target.value as AnnotationType }))}
                  className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary]"
                >
                  <option value="note">Note</option>
                  <option value="symptom">Symptom</option>
                  <option value="finding">Finding</option>
                  <option value="diagnosis">Diagnosis</option>
                </select>

                {/* Description */}
                <textarea
                  value={newAnnotation.text}
                  onChange={e => setNewAnnotation(p => ({ ...p, text: e.target.value }))}
                  placeholder="Describe finding…"
                  rows={2}
                  className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] resize-none bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary]"
                />

                {/* Severity */}
                <select
                  value={newAnnotation.severity}
                  onChange={e => setNewAnnotation(p => ({ ...p, severity: e.target.value as SeverityType }))}
                  className="w-full text-xs border border-[--bb-border] rounded-lg px-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary]"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>

                {/* ICD-10 search */}
                <div className="relative">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--bb-text-secondary] pointer-events-none" />
                    <input
                      value={icd10Query}
                      onChange={e => {
                        setIcd10Query(e.target.value)
                        setNewAnnotation(p => ({ ...p, icd10Code: '', icd10Description: '' }))
                        setShowIcd10Dropdown(true)
                      }}
                      onFocus={() => setShowIcd10Dropdown(true)}
                      placeholder="Search ICD-10 code…"
                      className="w-full text-xs border border-[--bb-border] rounded-lg pl-7 pr-2.5 py-1.5 outline-none focus:border-[--bb-brand-blue] bg-white text-[--bb-text-primary] placeholder:text-[--bb-text-secondary]"
                    />
                  </div>

                  {showIcd10Dropdown && icd10Query.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[--bb-border] rounded-lg shadow-lg z-50 overflow-hidden max-h-40 overflow-y-auto">
                      {icd10Loading ? (
                        <div className="px-3 py-2 text-xs text-[--bb-text-secondary]">Searching…</div>
                      ) : icd10Results.length > 0 ? (
                        icd10Results.map(item => (
                          <button
                            key={`${item.code}-${item.description}`}
                            onClick={() => selectIcd10(item)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[--bb-surface-app] transition-colors"
                          >
                            <span className="font-mono text-[--bb-brand-blue]">{item.code}</span>
                            <span className="text-[--bb-text-primary] ml-1.5">{item.description}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-[--bb-text-secondary]">No results</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick-pick ICD-10 codes */}
                <div>
                  <p className="text-[10px] font-medium text-[--bb-text-secondary] mb-1.5 uppercase tracking-wide">
                    Common codes
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_ICD10.map(item => (
                      <button
                        key={`${item.code}-${item.description}`}
                        onClick={() => selectIcd10(item)}
                        title={item.description}
                        className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                          newAnnotation.icd10Code === item.code
                            ? 'border-[--bb-brand-blue] bg-[--bb-brand-blue] text-white'
                            : 'border-[--bb-border] text-[--bb-text-secondary] hover:border-[--bb-brand-blue] hover:text-[--bb-brand-blue] bg-white',
                        )}
                      >
                        {item.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save / Cancel */}
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={handleAddAnnotation}
                    className="flex-1 bg-[--bb-brand-blue] text-white text-xs rounded-lg px-2.5 py-1.5 hover:opacity-90 transition-opacity font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingAnnotation(false); setIcd10Query('') }}
                    className="flex-1 bg-[--bb-surface-app] text-[--bb-text-secondary] text-xs rounded-lg px-2.5 py-1.5 hover:bg-[#EFF0FF] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Annotation count */}
      {annotations.length > 0 && !compact && (
        <div className="mt-3 text-xs text-[--bb-text-secondary]">
          {annotations.length} annotation{annotations.length > 1 ? 's' : ''} recorded
        </div>
      )}
    </div>
  )
}
