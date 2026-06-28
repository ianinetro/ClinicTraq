import { useState } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'

export type BodySex = 'male' | 'female'
type AnnotationType = 'symptom' | 'finding' | 'diagnosis' | 'injury' | 'note'
type SeverityType = 'mild' | 'moderate' | 'severe'

export interface BodyAnnotation {
  id: string
  region: string
  type: AnnotationType
  text: string
  severity: SeverityType
  icd10Code?: string
}

interface BodyRegion {
  id: string
  label: string
  view: 'front' | 'back'
  shape: 'rect' | 'ellipse' | 'path'
  // ellipse
  cx?: number; cy?: number; rx?: number; ry?: number
  // rect
  x?: number; y?: number; width?: number; height?: number
  // for male vs female specific overrides
  male?: Partial<BodyRegion>
  female?: Partial<BodyRegion>
}

// Shared regions, some with sex-specific adjustments
const FRONT_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head', view: 'front', shape: 'ellipse', cx: 100, cy: 36, rx: 24, ry: 28, female: { ry: 27, rx: 22 } },
  { id: 'neck', label: 'Neck', view: 'front', shape: 'rect', x: 90, y: 63, width: 20, height: 16 },
  { id: 'chest-left', label: 'Left Chest', view: 'front', shape: 'rect', x: 74, y: 82, width: 26, height: 32, female: { height: 36 } },
  { id: 'chest-right', label: 'Right Chest', view: 'front', shape: 'rect', x: 100, y: 82, width: 26, height: 32, female: { height: 36 } },
  { id: 'abdomen', label: 'Abdomen', view: 'front', shape: 'rect', x: 76, y: 116, width: 48, height: 30, male: { x: 74, width: 52 }, female: { x: 78, width: 44, y: 120 } },
  { id: 'pelvis', label: 'Pelvis / Groin', view: 'front', shape: 'rect', x: 76, y: 148, width: 48, height: 22, male: { x: 74, width: 52 }, female: { x: 70, width: 60, y: 152 } },
  { id: 'shoulder-left', label: 'Left Shoulder', view: 'front', shape: 'ellipse', cx: 62, cy: 92, rx: 14, ry: 12, male: { rx: 16, ry: 13 }, female: { rx: 12, ry: 11 } },
  { id: 'shoulder-right', label: 'Right Shoulder', view: 'front', shape: 'ellipse', cx: 138, cy: 92, rx: 14, ry: 12, male: { rx: 16, ry: 13 }, female: { rx: 12, ry: 11 } },
  { id: 'upperarm-left', label: 'Left Upper Arm', view: 'front', shape: 'rect', x: 47, y: 104, width: 18, height: 40 },
  { id: 'upperarm-right', label: 'Right Upper Arm', view: 'front', shape: 'rect', x: 135, y: 104, width: 18, height: 40 },
  { id: 'forearm-left', label: 'Left Forearm', view: 'front', shape: 'rect', x: 47, y: 146, width: 18, height: 34 },
  { id: 'forearm-right', label: 'Right Forearm', view: 'front', shape: 'rect', x: 135, y: 146, width: 18, height: 34 },
  { id: 'hand-left', label: 'Left Hand', view: 'front', shape: 'ellipse', cx: 56, cy: 192, rx: 12, ry: 14 },
  { id: 'hand-right', label: 'Right Hand', view: 'front', shape: 'ellipse', cx: 144, cy: 192, rx: 12, ry: 14 },
  { id: 'thigh-left', label: 'Left Thigh', view: 'front', shape: 'rect', x: 76, y: 173, width: 21, height: 46, female: { x: 72, width: 22 } },
  { id: 'thigh-right', label: 'Right Thigh', view: 'front', shape: 'rect', x: 103, y: 173, width: 21, height: 46, female: { x: 106, width: 22 } },
  { id: 'knee-left', label: 'Left Knee', view: 'front', shape: 'ellipse', cx: 87, cy: 224, rx: 12, ry: 10 },
  { id: 'knee-right', label: 'Right Knee', view: 'front', shape: 'ellipse', cx: 113, cy: 224, rx: 12, ry: 10 },
  { id: 'lowerleg-left', label: 'Left Lower Leg', view: 'front', shape: 'rect', x: 77, y: 234, width: 19, height: 44 },
  { id: 'lowerleg-right', label: 'Right Lower Leg', view: 'front', shape: 'rect', x: 104, y: 234, width: 19, height: 44 },
  { id: 'foot-left', label: 'Left Foot', view: 'front', shape: 'ellipse', cx: 87, cy: 287, rx: 16, ry: 10 },
  { id: 'foot-right', label: 'Right Foot', view: 'front', shape: 'ellipse', cx: 113, cy: 287, rx: 16, ry: 10 },
]

const BACK_REGIONS: BodyRegion[] = [
  { id: 'head-back', label: 'Head (Back)', view: 'back', shape: 'ellipse', cx: 100, cy: 36, rx: 24, ry: 28 },
  { id: 'neck-back', label: 'Neck (Back)', view: 'back', shape: 'rect', x: 90, y: 63, width: 20, height: 16 },
  { id: 'upper-back', label: 'Upper Back', view: 'back', shape: 'rect', x: 74, y: 82, width: 52, height: 36, male: { width: 56, x: 72 }, female: { width: 46, x: 77 } },
  { id: 'mid-back', label: 'Mid Back', view: 'back', shape: 'rect', x: 76, y: 118, width: 48, height: 28, female: { x: 80, width: 40 } },
  { id: 'lower-back', label: 'Lower Back', view: 'back', shape: 'rect', x: 76, y: 146, width: 48, height: 24, female: { x: 72, width: 56 } },
  { id: 'shoulder-back-left', label: 'Left Shoulder (Back)', view: 'back', shape: 'ellipse', cx: 62, cy: 92, rx: 14, ry: 12, male: { rx: 16 } },
  { id: 'shoulder-back-right', label: 'Right Shoulder (Back)', view: 'back', shape: 'ellipse', cx: 138, cy: 92, rx: 14, ry: 12, male: { rx: 16 } },
  { id: 'upperarm-back-left', label: 'Left Upper Arm (Back)', view: 'back', shape: 'rect', x: 47, y: 104, width: 18, height: 40 },
  { id: 'upperarm-back-right', label: 'Right Upper Arm (Back)', view: 'back', shape: 'rect', x: 135, y: 104, width: 18, height: 40 },
  { id: 'forearm-back-left', label: 'Left Forearm (Back)', view: 'back', shape: 'rect', x: 47, y: 146, width: 18, height: 34 },
  { id: 'forearm-back-right', label: 'Right Forearm (Back)', view: 'back', shape: 'rect', x: 135, y: 146, width: 18, height: 34 },
  { id: 'buttock-left', label: 'Left Buttock', view: 'back', shape: 'ellipse', cx: 86, cy: 178, rx: 18, ry: 16, female: { rx: 22, ry: 19 } },
  { id: 'buttock-right', label: 'Right Buttock', view: 'back', shape: 'ellipse', cx: 114, cy: 178, rx: 18, ry: 16, female: { rx: 22, ry: 19 } },
  { id: 'hamstring-left', label: 'Left Hamstring', view: 'back', shape: 'rect', x: 76, y: 194, width: 21, height: 44 },
  { id: 'hamstring-right', label: 'Right Hamstring', view: 'back', shape: 'rect', x: 103, y: 194, width: 21, height: 44 },
  { id: 'calf-left', label: 'Left Calf', view: 'back', shape: 'rect', x: 77, y: 244, width: 19, height: 40 },
  { id: 'calf-right', label: 'Right Calf', view: 'back', shape: 'rect', x: 104, y: 244, width: 19, height: 40 },
  { id: 'heel-left', label: 'Left Heel', view: 'back', shape: 'ellipse', cx: 87, cy: 293, rx: 15, ry: 9 },
  { id: 'heel-right', label: 'Right Heel', view: 'back', shape: 'ellipse', cx: 113, cy: 293, rx: 15, ry: 9 },
]

const SEVERITY_COLORS: Record<SeverityType, { fill: string; stroke: string; dot: string }> = {
  mild:     { fill: '#FED7AA', stroke: '#F97316', dot: '#F97316' },
  moderate: { fill: '#FCA5A5', stroke: '#EF4444', dot: '#EF4444' },
  severe:   { fill: '#FCA5A5', stroke: '#DC2626', dot: '#DC2626' },
}

const TYPE_LABELS: Record<AnnotationType, string> = {
  symptom: 'Symptom', finding: 'Finding', diagnosis: 'Diagnosis', injury: 'Injury', note: 'Note',
}

function getRegionProps(region: BodyRegion, sex: BodySex): BodyRegion {
  const override = sex === 'male' ? region.male : region.female
  return override ? { ...region, ...override } : region
}

interface BodyMapProps {
  sex?: BodySex
  patientId?: string
  compact?: boolean
  annotations?: BodyAnnotation[]
  onAnnotationsChange?: (a: BodyAnnotation[]) => void
}

export function BodyMap({ sex = 'male', compact = false, annotations: externalAnnos, onAnnotationsChange }: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const [internalAnnos, setInternalAnnos] = useState<BodyAnnotation[]>([])
  const annotations = externalAnnos ?? internalAnnos
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [popoverId, setPopoverId] = useState<string | null>(null)
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 })
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ type: 'symptom' as AnnotationType, text: '', severity: 'mild' as SeverityType, icd10: '' })

  const regions = (view === 'front' ? FRONT_REGIONS : BACK_REGIONS).map(r => getRegionProps(r, sex))

  function updateAnnotations(next: BodyAnnotation[]) {
    if (onAnnotationsChange) onAnnotationsChange(next)
    else setInternalAnnos(next)
  }

  function getRegionFill(id: string) {
    const annos = annotations.filter(a => a.region === id)
    if (!annos.length) return selectedId === id ? '#EFF0FF' : sex === 'female' ? '#F9E7F5' : '#E8EDF8'
    const worst = annos.reduce((acc, a) => ({ mild: 0, moderate: 1, severe: 2 }[a.severity] > ({ mild: 0, moderate: 1, severe: 2 }[acc.severity]) ? a : acc))
    return SEVERITY_COLORS[worst.severity].fill
  }

  function getRegionStroke(id: string) {
    const annos = annotations.filter(a => a.region === id)
    if (!annos.length) return selectedId === id ? '#0410BD' : sex === 'female' ? '#C084C4' : '#93A8D4'
    const worst = annos.reduce((acc, a) => ({ mild: 0, moderate: 1, severe: 2 }[a.severity] > ({ mild: 0, moderate: 1, severe: 2 }[acc.severity]) ? a : acc))
    return SEVERITY_COLORS[worst.severity].stroke
  }

  function handleRegionClick(region: BodyRegion, e: React.MouseEvent<SVGElement>) {
    const svg = e.currentTarget.closest('svg')
    const rect = svg?.getBoundingClientRect()
    if (!rect) return
    setSelectedId(region.id)
    setPopoverId(region.id)
    setPopoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setAdding(false)
  }

  function handleAdd() {
    if (!form.text.trim() || !popoverId) return
    updateAnnotations([...annotations, {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
      region: popoverId, type: form.type, text: form.text,
      severity: form.severity, icd10Code: form.icd10 || undefined,
    }])
    setForm({ type: 'symptom', text: '', severity: 'mild', icd10: '' })
    setAdding(false)
  }

  function renderRegion(region: BodyRegion) {
    const fill = getRegionFill(region.id)
    const stroke = getRegionStroke(region.id)
    const isSelected = selectedId === region.id
    const common = {
      fill, stroke, strokeWidth: isSelected ? 2 : 1,
      style: { cursor: 'pointer', transition: 'fill 0.1s, stroke 0.1s' },
      onClick: (e: React.MouseEvent<SVGElement>) => handleRegionClick(region, e),
      role: 'button' as const, tabIndex: 0,
      'aria-label': region.label,
    }
    if (region.shape === 'ellipse')
      return <ellipse key={region.id} cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry} {...common} />
    return <rect key={region.id} x={region.x} y={region.y} width={region.width} height={region.height} rx={5} {...common} />
  }

  // Female chest decoration (breast outline)
  function renderFemaleChest() {
    if (sex !== 'female' || view !== 'front') return null
    return (
      <g style={{ pointerEvents: 'none' }}>
        <ellipse cx={87} cy={100} rx={14} ry={11} fill="none" stroke="#C084C4" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
        <ellipse cx={113} cy={100} rx={14} ry={11} fill="none" stroke="#C084C4" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
      </g>
    )
  }

  const popoverAnnos = popoverId ? annotations.filter(a => a.region === popoverId) : []
  const popoverRegion = popoverId ? regions.find(r => r.id === popoverId) : null

  return (
    <div style={{ position: 'relative', userSelect: 'none', display: 'inline-flex', flexDirection: 'column', gap: 8 }}>
      {!compact && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['front', 'back'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); setPopoverId(null); setSelectedId(null) }} style={{
              padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
              border: 'none', cursor: 'pointer', transition: 'all 0.12s',
              background: view === v ? '#0410BD' : '#F2F2F8',
              color: view === v ? 'white' : '#676687',
            }}>{v === 'front' ? 'Front' : 'Back'}</button>
          ))}
          <span style={{ fontSize: 11, color: '#676687', marginLeft: 4 }}>
            {sex === 'female' ? '♀ Female' : '♂ Male'}
          </span>
          {annotations.length > 0 && (
            <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, marginLeft: 8 }}>
              {annotations.length} finding{annotations.length !== 1 ? 's' : ''} marked
            </span>
          )}
        </div>
      )}

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg
          width={compact ? 110 : 200}
          height={compact ? 180 : 310}
          viewBox="32 5 136 305"
          style={{ overflow: 'visible', display: 'block' }}
          onClick={e => {
            if ((e.target as Element).tagName === 'svg') { setPopoverId(null); setSelectedId(null) }
          }}
        >
          {/* Body outline background */}
          <rect x="72" y="79" width={sex === 'male' ? 56 : 56} height="92" rx="8"
            fill={sex === 'female' ? '#FDF4FF' : '#EEF2FA'} stroke="none" />
          {regions.map(renderRegion)}
          {renderFemaleChest()}

          {/* Annotation dots */}
          {annotations.map(anno => {
            const region = regions.find(r => r.id === anno.region)
            if (!region) return null
            const cx = region.shape === 'ellipse' ? region.cx! : (region.x! + region.width! / 2)
            const cy = region.shape === 'ellipse' ? (region.cy! - region.ry! + 5) : (region.y! + 5)
            return (
              <g key={anno.id} style={{ pointerEvents: 'none' }}>
                <circle cx={cx} cy={cy} r={5} fill={SEVERITY_COLORS[anno.severity].dot} stroke="white" strokeWidth={1.5} />
              </g>
            )
          })}
        </svg>

        {/* Popover */}
        {popoverId && !compact && (
          <div style={{
            position: 'absolute',
            left: Math.min(popoverPos.x + 12, 130),
            top: Math.max(popoverPos.y - 40, 4),
            zIndex: 40, background: 'white',
            border: '1px solid #E3E3F1', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(18,18,44,0.16)', padding: 14, width: 268,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#12122C' }}>{popoverRegion?.label}</span>
              <button onClick={() => { setPopoverId(null); setSelectedId(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#676687', padding: 2, display: 'flex' }}>
                <X size={13} />
              </button>
            </div>

            {popoverAnnos.length > 0 && (
              <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {popoverAnnos.map(a => (
                  <div key={a.id} style={{
                    background: a.severity === 'severe' ? '#FEF2F2' : a.severity === 'moderate' ? '#FFF7ED' : '#FFFBEB',
                    border: `1px solid ${SEVERITY_COLORS[a.severity].stroke}20`,
                    borderLeft: `3px solid ${SEVERITY_COLORS[a.severity].stroke}`,
                    borderRadius: 6, padding: '8px 10px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_COLORS[a.severity].stroke, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {TYPE_LABELS[a.type]}
                        </span>
                        <span style={{ fontSize: 10, color: '#676687', background: '#F2F2F8', borderRadius: 3, padding: '0 4px' }}>{a.severity}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#12122C', lineHeight: 1.4 }}>{a.text}</p>
                      {a.icd10Code && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#676687', fontFamily: 'monospace' }}>{a.icd10Code}</p>}
                    </div>
                    <button onClick={() => updateAnnotations(annotations.filter(x => x.id !== a.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BABACE', padding: '0 0 0 8px', flexShrink: 0 }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!adding ? (
              <button onClick={() => setAdding(true)} style={{
                display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 12, color: '#0410BD', fontWeight: 600, padding: 0,
              }}>
                <Plus size={13} /> Add annotation
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as AnnotationType }))}
                    style={{ flex: 1, height: 30, fontSize: 12, border: '1px solid #BABACE', borderRadius: 4, padding: '0 6px', outline: 'none', background: 'white' }}>
                    {(Object.keys(TYPE_LABELS) as AnnotationType[]).map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value as SeverityType }))}
                    style={{ flex: 1, height: 30, fontSize: 12, border: '1px solid #BABACE', borderRadius: 4, padding: '0 6px', outline: 'none', background: 'white' }}>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <textarea value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
                  placeholder="Describe the finding or symptom…" rows={2}
                  style={{ fontSize: 12, border: '1px solid #BABACE', borderRadius: 4, padding: '6px 8px', resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
                <input value={form.icd10} onChange={e => setForm(p => ({ ...p, icd10: e.target.value }))}
                  placeholder="ICD-10 code (optional)"
                  style={{ height: 30, fontSize: 12, border: '1px solid #BABACE', borderRadius: 4, padding: '0 8px', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleAdd} style={{ flex: 1, height: 30, background: '#0410BD', color: 'white', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setAdding(false)} style={{ flex: 1, height: 30, background: '#F2F2F8', color: '#676687', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!compact && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          {(Object.entries(SEVERITY_COLORS) as [SeverityType, typeof SEVERITY_COLORS[SeverityType]][]).map(([sev, c]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#676687' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.fill, border: `1.5px solid ${c.stroke}` }} />
              {sev}
            </div>
          ))}
          {annotations.length === 0 && (
            <span style={{ fontSize: 11, color: '#BABACE', display: 'flex', alignItems: 'center', gap: 3 }}>
              <AlertCircle size={11} /> Click a body region to annotate
            </span>
          )}
        </div>
      )}
    </div>
  )
}
