import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { clsx } from 'clsx'


interface BodyRegion {
  id: string
  label: string
  view: 'front' | 'back'
  shape: 'rect' | 'ellipse' | 'path'
  d?: string
  x?: number; y?: number; width?: number; height?: number
  cx?: number; cy?: number; rx?: number; ry?: number
}

const FRONT_REGIONS: BodyRegion[] = [
  { id: 'head-front', label: 'Head', view: 'front', shape: 'ellipse', cx: 100, cy: 40, rx: 28, ry: 32 },
  { id: 'neck-front', label: 'Neck', view: 'front', shape: 'rect', x: 86, y: 70, width: 28, height: 20 },
  { id: 'chest-left', label: 'Chest Left', view: 'front', shape: 'rect', x: 72, y: 92, width: 30, height: 38 },
  { id: 'chest-right', label: 'Chest Right', view: 'front', shape: 'rect', x: 98, y: 92, width: 30, height: 38 },
  { id: 'abdomen-upper', label: 'Abdomen Upper', view: 'front', shape: 'rect', x: 72, y: 130, width: 56, height: 28 },
  { id: 'abdomen-lower', label: 'Abdomen Lower', view: 'front', shape: 'rect', x: 72, y: 158, width: 56, height: 28 },
  { id: 'shoulder-left', label: 'Left Shoulder', view: 'front', shape: 'ellipse', cx: 60, cy: 102, rx: 16, ry: 14 },
  { id: 'shoulder-right', label: 'Right Shoulder', view: 'front', shape: 'ellipse', cx: 140, cy: 102, rx: 16, ry: 14 },
  { id: 'arm-left', label: 'Left Arm', view: 'front', shape: 'rect', x: 41, y: 116, width: 28, height: 44 },
  { id: 'arm-right', label: 'Right Arm', view: 'front', shape: 'rect', x: 131, y: 116, width: 28, height: 44 },
  { id: 'forearm-left', label: 'Left Forearm', view: 'front', shape: 'rect', x: 41, y: 162, width: 28, height: 38 },
  { id: 'forearm-right', label: 'Right Forearm', view: 'front', shape: 'rect', x: 131, y: 162, width: 28, height: 38 },
  { id: 'hand-left', label: 'Left Hand', view: 'front', shape: 'ellipse', cx: 55, cy: 210, rx: 14, ry: 18 },
  { id: 'hand-right', label: 'Right Hand', view: 'front', shape: 'ellipse', cx: 145, cy: 210, rx: 14, ry: 18 },
  { id: 'hip-left', label: 'Left Hip', view: 'front', shape: 'rect', x: 72, y: 186, width: 26, height: 28 },
  { id: 'hip-right', label: 'Right Hip', view: 'front', shape: 'rect', x: 102, y: 186, width: 26, height: 28 },
  { id: 'thigh-left', label: 'Left Thigh', view: 'front', shape: 'rect', x: 74, y: 214, width: 24, height: 50 },
  { id: 'thigh-right', label: 'Right Thigh', view: 'front', shape: 'rect', x: 102, y: 214, width: 24, height: 50 },
  { id: 'knee-left', label: 'Left Knee', view: 'front', shape: 'ellipse', cx: 86, cy: 270, rx: 14, ry: 12 },
  { id: 'knee-right', label: 'Right Knee', view: 'front', shape: 'ellipse', cx: 114, cy: 270, rx: 14, ry: 12 },
  { id: 'lower-leg-left', label: 'Left Lower Leg', view: 'front', shape: 'rect', x: 74, y: 282, width: 22, height: 50 },
  { id: 'lower-leg-right', label: 'Right Lower Leg', view: 'front', shape: 'rect', x: 104, y: 282, width: 22, height: 50 },
  { id: 'foot-left', label: 'Left Foot', view: 'front', shape: 'ellipse', cx: 85, cy: 334, rx: 18, ry: 10 },
  { id: 'foot-right', label: 'Right Foot', view: 'front', shape: 'ellipse', cx: 115, cy: 334, rx: 18, ry: 10 },
]

const BACK_REGIONS: BodyRegion[] = [
  { id: 'head-back', label: 'Head', view: 'back', shape: 'ellipse', cx: 100, cy: 40, rx: 28, ry: 32 },
  { id: 'neck-back', label: 'Neck', view: 'back', shape: 'rect', x: 86, y: 70, width: 28, height: 20 },
  { id: 'upper-back', label: 'Upper Back', view: 'back', shape: 'rect', x: 72, y: 92, width: 56, height: 40 },
  { id: 'lower-back', label: 'Lower Back', view: 'back', shape: 'rect', x: 72, y: 132, width: 56, height: 35 },
  { id: 'buttock-left', label: 'Left Buttock', view: 'back', shape: 'ellipse', cx: 85, cy: 185, rx: 20, ry: 18 },
  { id: 'buttock-right', label: 'Right Buttock', view: 'back', shape: 'ellipse', cx: 115, cy: 185, rx: 20, ry: 18 },
  { id: 'shoulder-back-left', label: 'Left Shoulder (Back)', view: 'back', shape: 'ellipse', cx: 60, cy: 100, rx: 16, ry: 14 },
  { id: 'shoulder-back-right', label: 'Right Shoulder (Back)', view: 'back', shape: 'ellipse', cx: 140, cy: 100, rx: 16, ry: 14 },
  { id: 'arm-back-left', label: 'Left Arm (Back)', view: 'back', shape: 'rect', x: 41, y: 114, width: 28, height: 46 },
  { id: 'arm-back-right', label: 'Right Arm (Back)', view: 'back', shape: 'rect', x: 131, y: 114, width: 28, height: 46 },
  { id: 'hamstring-left', label: 'Left Hamstring', view: 'back', shape: 'rect', x: 74, y: 210, width: 24, height: 50 },
  { id: 'hamstring-right', label: 'Right Hamstring', view: 'back', shape: 'rect', x: 102, y: 210, width: 24, height: 50 },
  { id: 'calf-left', label: 'Left Calf', view: 'back', shape: 'rect', x: 74, y: 270, width: 22, height: 50 },
  { id: 'calf-right', label: 'Right Calf', view: 'back', shape: 'rect', x: 104, y: 270, width: 22, height: 50 },
]

type AnnotationType = 'note' | 'symptom' | 'finding' | 'diagnosis'
type SeverityType = 'mild' | 'moderate' | 'severe'

interface LocalAnnotation {
  id: string
  region: string
  type: AnnotationType
  text: string
  severity?: SeverityType
  icd10Code?: string
}

interface BodyMapProps {
  patientId: string
  compact?: boolean
}

interface PopoverState {
  regionId: string
  x: number
  y: number
}

export function BodyMap({ patientId: _patientId, compact = false }: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const [annotations, setAnnotations] = useState<LocalAnnotation[]>([])
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [addingAnnotation, setAddingAnnotation] = useState(false)
  const [newAnnotation, setNewAnnotation] = useState<{
    type: AnnotationType; text: string; severity: SeverityType; icd10Code: string
  }>({ type: 'note', text: '', severity: 'mild', icd10Code: '' })

  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS

  function getRegionFill(regionId: string) {
    const hasAnnotation = annotations.some(a => a.region === regionId)
    if (selectedRegion === regionId) return '#0410BD'
    if (hasAnnotation) return '#D9FCFF'
    return '#E3E3F1'
  }

  function getRegionStroke(regionId: string) {
    const hasAnnotation = annotations.some(a => a.region === regionId)
    if (selectedRegion === regionId) return '#0410BD'
    if (hasAnnotation) return '#94F2FA'
    return '#BABACE'
  }

  function handleRegionClick(region: BodyRegion, e: React.MouseEvent) {
    const svg = (e.currentTarget as SVGElement).closest('svg')
    const rect = svg?.getBoundingClientRect()
    if (!rect) return

    setSelectedRegion(region.id)
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    setPopover({ regionId: region.id, x: svgX, y: svgY })
    setAddingAnnotation(false)
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
    }
    setAnnotations(prev => [...prev, anno])
    setNewAnnotation({ type: 'note', text: '', severity: 'mild', icd10Code: '' })
    setAddingAnnotation(false)
  }

  function renderRegion(region: BodyRegion) {
    const fill = getRegionFill(region.id)
    const stroke = getRegionStroke(region.id)
    const strokeWidth = selectedRegion === region.id ? 2 : 1
    const commonProps = {
      'data-region': region.id,
      fill,
      stroke,
      strokeWidth,
      className: 'cursor-pointer transition-all duration-100 hover:fill-[#EFF0FF] hover:stroke-[#3F4CFF]',
      onClick: (e: React.MouseEvent<SVGElement>) => handleRegionClick(region, e),
      role: 'button' as const,
      'aria-label': region.label,
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent<SVGElement>) => {
        if (e.key === 'Enter') e.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      },
    }

    if (region.shape === 'ellipse') {
      return <ellipse key={region.id} cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry} {...commonProps} />
    }
    if (region.shape === 'rect') {
      return <rect key={region.id} x={region.x} y={region.y} width={region.width} height={region.height} rx={4} {...commonProps} />
    }
    return null
  }

  const regionAnnotations = popover ? annotations.filter(a => a.region === popover.regionId) : []
  const popoverRegion = popover ? regions.find(r => r.id === popover.regionId) : null

  const svgHeight = compact ? 180 : 360
  const viewBox = compact ? '40 20 120 200' : '30 0 140 360'

  return (
    <div className="relative select-none">
      {/* Toggle */}
      {!compact && (
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => { setView('front'); setPopover(null); setSelectedRegion(null) }}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              view === 'front' ? 'bg-[#0410BD] text-white' : 'bg-[#F2F2F8] text-[#676687] hover:bg-[#EFF0FF]',
            )}
          >
            Front
          </button>
          <button
            onClick={() => { setView('back'); setPopover(null); setSelectedRegion(null) }}
            className={clsx(
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              view === 'back' ? 'bg-[#0410BD] text-white' : 'bg-[#F2F2F8] text-[#676687] hover:bg-[#EFF0FF]',
            )}
          >
            Back
          </button>
        </div>
      )}

      <div className="relative inline-block">
        <svg
          width="200"
          height={svgHeight}
          viewBox={viewBox}
          className="overflow-visible"
          onClick={(e) => {
            if ((e.target as SVGElement).tagName === 'svg') {
              setPopover(null)
              setSelectedRegion(null)
            }
          }}
        >
          {regions.map(renderRegion)}

          {/* Annotation dots */}
          {annotations.map(anno => {
            const region = regions.find(r => r.id === anno.region)
            if (!region) return null
            const cx = region.shape === 'ellipse' ? region.cx! : (region.x! + region.width! / 2)
            const cy = region.shape === 'ellipse' ? region.cy! - region.ry! + 4 : region.y! + 4
            return (
              <circle key={anno.id} cx={cx} cy={cy} r={4} fill="#0410BD" stroke="white" strokeWidth={1.5} className="pointer-events-none" />
            )
          })}
        </svg>

        {/* Popover */}
        {popover && !compact && (
          <div
            className="absolute z-20 bg-white border border-[#E3E3F1] rounded-lg shadow-lg p-3 w-64"
            style={{
              left: Math.min(popover.x + 8, 160),
              top: Math.max(popover.y - 60, 0),
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#12122C]">{popoverRegion?.label}</span>
              <button onClick={() => { setPopover(null); setSelectedRegion(null) }} className="text-[#676687] hover:text-[#12122C]">
                <X size={12} />
              </button>
            </div>

            {regionAnnotations.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {regionAnnotations.map(a => (
                  <div key={a.id} className="text-xs bg-[#F2F2F8] rounded p-1.5">
                    <span className="font-medium capitalize text-[#007998]">{a.type}</span>
                    {a.severity && <span className="text-[#676687] ml-1">({a.severity})</span>}
                    <p className="text-[#12122C] mt-0.5">{a.text}</p>
                    {a.icd10Code && <p className="text-[#676687] font-mono">{a.icd10Code}</p>}
                  </div>
                ))}
              </div>
            )}

            {!addingAnnotation ? (
              <button
                onClick={() => setAddingAnnotation(true)}
                className="flex items-center gap-1 text-xs text-[#0410BD] hover:underline"
              >
                <Plus size={11} />
                Add Annotation
              </button>
            ) : (
              <div className="space-y-2">
                <select
                  value={newAnnotation.type}
                  onChange={e => setNewAnnotation(p => ({ ...p, type: e.target.value as AnnotationType }))}
                  className="w-full text-xs border border-[#BABACE] rounded px-2 py-1 outline-none"
                >
                  <option value="note">Note</option>
                  <option value="symptom">Symptom</option>
                  <option value="finding">Finding</option>
                  <option value="diagnosis">Diagnosis</option>
                </select>
                <textarea
                  value={newAnnotation.text}
                  onChange={e => setNewAnnotation(p => ({ ...p, text: e.target.value }))}
                  placeholder="Describe finding…"
                  rows={2}
                  className="w-full text-xs border border-[#BABACE] rounded px-2 py-1 outline-none resize-none focus:border-[#3F4CFF]"
                />
                <select
                  value={newAnnotation.severity}
                  onChange={e => setNewAnnotation(p => ({ ...p, severity: e.target.value as SeverityType }))}
                  className="w-full text-xs border border-[#BABACE] rounded px-2 py-1 outline-none"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <input
                  value={newAnnotation.icd10Code}
                  onChange={e => setNewAnnotation(p => ({ ...p, icd10Code: e.target.value }))}
                  placeholder="ICD-10 code (optional)"
                  className="w-full text-xs border border-[#BABACE] rounded px-2 py-1 outline-none focus:border-[#3F4CFF]"
                />
                <div className="flex gap-1">
                  <button
                    onClick={handleAddAnnotation}
                    className="flex-1 bg-[#0410BD] text-white text-xs rounded px-2 py-1 hover:bg-[#3F4CFF]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setAddingAnnotation(false)}
                    className="flex-1 bg-[#F2F2F8] text-[#676687] text-xs rounded px-2 py-1 hover:bg-[#EFF0FF]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {annotations.length > 0 && !compact && (
        <div className="mt-3 text-xs text-[#676687]">
          {annotations.length} annotation{annotations.length > 1 ? 's' : ''} recorded
        </div>
      )}
    </div>
  )
}
