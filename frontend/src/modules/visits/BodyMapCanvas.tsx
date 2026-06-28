/**
 * BodyMapCanvas — interactive 28-zone human anatomy diagram.
 *
 * Each zone can be annotated with a color (blue/yellow/red) representing
 * finding severity, plus ICD-10 codes, CPT procedures, medications, and notes.
 *
 * Colors:
 *   blue   — chronic / historical condition
 *   yellow — sub-acute / monitoring
 *   red    — acute / primary complaint
 */
import { useState } from 'react'
import { X, Plus } from 'lucide-react'

// ── Zone definitions ─────────────────────────────────────────────────────────

interface ZoneDef {
  key: string
  label: string
  view: 'front' | 'back'
  // SVG path or simple rect on a 200×400 viewBox
  cx: number  // center x (0-200)
  cy: number  // center y (0-400)
  rx: number  // ellipse x-radius
  ry: number  // ellipse y-radius
  laterality?: 'left' | 'right'
}

const FRONT_ZONES: ZoneDef[] = [
  { key: 'head_front',      label: 'Head / Face',         view: 'front', cx: 100, cy: 28,  rx: 22, ry: 22 },
  { key: 'neck_front',      label: 'Neck (anterior)',     view: 'front', cx: 100, cy: 65,  rx: 13, ry: 12 },
  { key: 'chest',           label: 'Chest / Thorax',      view: 'front', cx: 100, cy: 115, rx: 35, ry: 30 },
  { key: 'abdomen',         label: 'Abdomen',             view: 'front', cx: 100, cy: 170, rx: 30, ry: 25 },
  { key: 'pelvis',          label: 'Pelvis / Groin',      view: 'front', cx: 100, cy: 215, rx: 28, ry: 18 },
  { key: 'shoulder_right',  label: 'Right Shoulder',      view: 'front', cx: 58,  cy: 95,  rx: 14, ry: 14, laterality: 'right' },
  { key: 'shoulder_left',   label: 'Left Shoulder',       view: 'front', cx: 142, cy: 95,  rx: 14, ry: 14, laterality: 'left' },
  { key: 'upper_arm_right', label: 'Right Upper Arm',     view: 'front', cx: 44,  cy: 140, rx: 11, ry: 20, laterality: 'right' },
  { key: 'upper_arm_left',  label: 'Left Upper Arm',      view: 'front', cx: 156, cy: 140, rx: 11, ry: 20, laterality: 'left' },
  { key: 'elbow_right',     label: 'Right Elbow',         view: 'front', cx: 40,  cy: 170, rx: 10, ry: 10, laterality: 'right' },
  { key: 'elbow_left',      label: 'Left Elbow',          view: 'front', cx: 160, cy: 170, rx: 10, ry: 10, laterality: 'left' },
  { key: 'forearm_right',   label: 'Right Forearm/Wrist', view: 'front', cx: 37,  cy: 210, rx: 9,  ry: 22, laterality: 'right' },
  { key: 'forearm_left',    label: 'Left Forearm/Wrist',  view: 'front', cx: 163, cy: 210, rx: 9,  ry: 22, laterality: 'left' },
  { key: 'hand_right',      label: 'Right Hand',          view: 'front', cx: 34,  cy: 248, rx: 11, ry: 14, laterality: 'right' },
  { key: 'hand_left',       label: 'Left Hand',           view: 'front', cx: 166, cy: 248, rx: 11, ry: 14, laterality: 'left' },
  { key: 'thigh_right',     label: 'Right Thigh',         view: 'front', cx: 83,  cy: 280, rx: 18, ry: 28, laterality: 'right' },
  { key: 'thigh_left',      label: 'Left Thigh',          view: 'front', cx: 117, cy: 280, rx: 18, ry: 28, laterality: 'left' },
  { key: 'knee_right',      label: 'Right Knee',          view: 'front', cx: 82,  cy: 325, rx: 14, ry: 13, laterality: 'right' },
  { key: 'knee_left',       label: 'Left Knee',           view: 'front', cx: 118, cy: 325, rx: 14, ry: 13, laterality: 'left' },
  { key: 'lower_leg_right', label: 'Right Lower Leg',     view: 'front', cx: 82,  cy: 360, rx: 10, ry: 22, laterality: 'right' },
  { key: 'lower_leg_left',  label: 'Left Lower Leg',      view: 'front', cx: 118, cy: 360, rx: 10, ry: 22, laterality: 'left' },
  { key: 'foot_right',      label: 'Right Foot/Ankle',    view: 'front', cx: 82,  cy: 393, rx: 13, ry: 10, laterality: 'right' },
  { key: 'foot_left',       label: 'Left Foot/Ankle',     view: 'front', cx: 118, cy: 393, rx: 13, ry: 10, laterality: 'left' },
]

const BACK_ZONES: ZoneDef[] = [
  { key: 'head_back',   label: 'Head (posterior)',     view: 'back', cx: 100, cy: 28,  rx: 22, ry: 22 },
  { key: 'neck_back',   label: 'Neck (posterior)',     view: 'back', cx: 100, cy: 65,  rx: 13, ry: 12 },
  { key: 'upper_back',  label: 'Upper Back / Thoracic',view: 'back', cx: 100, cy: 120, rx: 35, ry: 35 },
  { key: 'lower_back',  label: 'Lower Back / Lumbar',  view: 'back', cx: 100, cy: 180, rx: 30, ry: 28 },
  { key: 'buttocks',    label: 'Buttocks / Sacrum',    view: 'back', cx: 100, cy: 223, rx: 30, ry: 18 },
]

const ALL_ZONES = [...FRONT_ZONES, ...BACK_ZONES]

// ── Types ────────────────────────────────────────────────────────────────────

export type ZoneColor = 'blue' | 'yellow' | 'red'

export interface ZoneAnnotation {
  zone_key: string
  color: ZoneColor
  icd_codes: string[]
  cpt_codes: string[]
  notes: string
  modifier_hint?: string
}

export type BodyMapState = Record<string, ZoneAnnotation>

interface Props {
  value: BodyMapState
  onChange: (next: BodyMapState) => void
}

const COLOR_FILL: Record<ZoneColor, string> = {
  blue:   'rgba(59, 130, 246, 0.55)',
  yellow: 'rgba(245, 158, 11, 0.55)',
  red:    'rgba(220, 38, 38, 0.55)',
}
const COLOR_STROKE: Record<ZoneColor, string> = {
  blue:   '#2563EB',
  yellow: '#D97706',
  red:    '#DC2626',
}
const COLOR_LABEL: Record<ZoneColor, string> = {
  blue:   '#1D4ED8',
  yellow: '#92400E',
  red:    '#991B1B',
}
const COLOR_BG: Record<ZoneColor, string> = {
  blue:   '#DBEAFE',
  yellow: '#FEF3C7',
  red:    '#FEE2E2',
}

// ── Component ────────────────────────────────────────────────────────────────

export function BodyMapCanvas({ value, onChange }: Props) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [panel, setPanel] = useState<'front' | 'back'>('front')

  const zones = panel === 'front' ? FRONT_ZONES : BACK_ZONES

  function handleZoneClick(key: string) {
    setSelectedZone(key === selectedZone ? null : key)
    if (!value[key]) {
      // First click creates an annotation with default color
      onChange({ ...value, [key]: { zone_key: key, color: 'yellow', icd_codes: [], cpt_codes: [], notes: '' } })
    }
  }

  function updateAnnotation(key: string, patch: Partial<ZoneAnnotation>) {
    onChange({ ...value, [key]: { ...(value[key] || { zone_key: key, color: 'yellow', icd_codes: [], cpt_codes: [], notes: '' }), ...patch } })
  }

  function removeAnnotation(key: string) {
    const next = { ...value }
    delete next[key]
    onChange(next)
    if (selectedZone === key) setSelectedZone(null)
  }

  const annotation = selectedZone ? value[selectedZone] : null
  const zone = selectedZone ? ALL_ZONES.find(z => z.key === selectedZone) : null

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* SVG body diagram */}
      <div style={{ flexShrink: 0 }}>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 10, border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', overflow: 'hidden', width: 'fit-content' }}>
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setPanel(v); setSelectedZone(null) }}
              style={{
                padding: '5px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: panel === v ? 'var(--bb-brand-blue)' : 'white',
                color: panel === v ? 'white' : 'var(--bb-text-secondary)',
              }}
            >
              {v === 'front' ? 'Anterior' : 'Posterior'}
            </button>
          ))}
        </div>

        <svg
          viewBox="0 0 200 410"
          width={200}
          height={410}
          style={{ display: 'block', border: '1px solid var(--bb-border)', borderRadius: 8, background: '#FAFAFA' }}
        >
          {/* Stick figure body outline */}
          <g stroke="#CBD5E1" strokeWidth="1.5" fill="none">
            {/* Head */}
            <circle cx="100" cy="28" r="22" />
            {/* Neck */}
            <line x1="100" y1="50" x2="100" y2="70" />
            {panel === 'front' ? (
              <>
                {/* Torso */}
                <rect x="70" y="70" width="60" height="80" rx="6" />
                {/* Hips */}
                <rect x="74" y="148" width="52" height="30" rx="4" />
                {/* Left arm */}
                <line x1="70" y1="78" x2="44" y2="120" />
                <line x1="44" y1="120" x2="37" y2="200" />
                {/* Right arm */}
                <line x1="130" y1="78" x2="156" y2="120" />
                <line x1="156" y1="120" x2="163" y2="200" />
                {/* Legs */}
                <line x1="88" y1="178" x2="82" y2="320" />
                <line x1="82" y1="320" x2="82" y2="385" />
                <line x1="112" y1="178" x2="118" y2="320" />
                <line x1="118" y1="320" x2="118" y2="385" />
              </>
            ) : (
              <>
                {/* Torso back */}
                <rect x="68" y="70" width="64" height="100" rx="6" />
                {/* Hips */}
                <rect x="72" y="168" width="56" height="30" rx="4" />
                {/* Arms */}
                <line x1="68" y1="78" x2="42" y2="140" />
                <line x1="132" y1="78" x2="158" y2="140" />
                {/* Legs */}
                <line x1="88" y1="198" x2="82" y2="320" />
                <line x1="82" y1="320" x2="82" y2="385" />
                <line x1="112" y1="198" x2="118" y2="320" />
                <line x1="118" y1="320" x2="118" y2="385" />
              </>
            )}
          </g>

          {/* Clickable zone ellipses */}
          {zones.map(z => {
            const ann = value[z.key]
            const isSelected = selectedZone === z.key
            return (
              <ellipse
                key={z.key}
                cx={z.cx}
                cy={z.cy}
                rx={z.rx}
                ry={z.ry}
                fill={ann ? COLOR_FILL[ann.color] : 'rgba(148, 163, 184, 0.15)'}
                stroke={isSelected ? '#0410BD' : (ann ? COLOR_STROKE[ann.color] : '#CBD5E1')}
                strokeWidth={isSelected ? 2.5 : (ann ? 1.5 : 1)}
                strokeDasharray={isSelected ? '3 2' : undefined}
                style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => handleZoneClick(z.key)}
              />
            )
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'center' }}>
          {(['blue', 'yellow', 'red'] as ZoneColor[]).map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_FILL[c], border: `1.5px solid ${COLOR_STROKE[c]}` }} />
              <span style={{ color: 'var(--bb-text-secondary)', textTransform: 'capitalize' }}>{c === 'blue' ? 'Chronic' : c === 'yellow' ? 'Sub-acute' : 'Acute'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: annotated zones list + selected zone editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Annotated zones summary */}
        {Object.keys(value).length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 8 }}>ANNOTATED ZONES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {Object.entries(value).map(([key, ann]) => {
                const z = ALL_ZONES.find(z => z.key === key)
                if (!z) return null
                return (
                  <div
                    key={key}
                    onClick={() => { setPanel(z.view); setSelectedZone(key) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      background: selectedZone === key ? COLOR_BG[ann.color] : 'var(--bb-surface-app)',
                      border: `1px solid ${selectedZone === key ? COLOR_STROKE[ann.color] : 'var(--bb-border)'}`,
                      borderRadius: 'var(--bb-radius)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_FILL[ann.color], border: `1.5px solid ${COLOR_STROKE[ann.color]}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>{z.label}</div>
                      {ann.icd_codes.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontFamily: 'monospace' }}>
                          {ann.icd_codes.join(', ')}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeAnnotation(key) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--bb-text-secondary)' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Selected zone editor */}
        {annotation && zone ? (
          <div style={{ background: 'var(--bb-surface-card)', border: `1px solid ${COLOR_STROKE[annotation.color]}`, borderRadius: 'var(--bb-radius)', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: COLOR_LABEL[annotation.color] }}>{zone.label}</div>

            {/* Severity color */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['blue', 'yellow', 'red'] as ZoneColor[]).map(c => (
                  <button
                    key={c}
                    onClick={() => updateAnnotation(zone.key, { color: c })}
                    style={{
                      padding: '5px 12px', fontSize: 12, fontWeight: 600, border: `2px solid ${annotation.color === c ? COLOR_STROKE[c] : 'var(--bb-border)'}`,
                      borderRadius: 'var(--bb-radius)', cursor: 'pointer',
                      background: annotation.color === c ? COLOR_BG[c] : 'white',
                      color: annotation.color === c ? COLOR_LABEL[c] : 'var(--bb-text-secondary)',
                    }}
                  >
                    {c === 'blue' ? 'Chronic' : c === 'yellow' ? 'Sub-acute' : 'Acute'}
                  </button>
                ))}
              </div>
            </div>

            {/* ICD-10 codes */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ICD-10 Codes</div>
              <IcdCodeInput
                value={annotation.icd_codes}
                onChange={codes => updateAnnotation(zone.key, { icd_codes: codes })}
              />
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clinical Notes</div>
              <textarea
                value={annotation.notes}
                onChange={e => updateAnnotation(zone.key, { notes: e.target.value })}
                placeholder="Brief finding or note for this zone…"
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                  border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)',
                  fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                  color: 'var(--bb-text-primary)',
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 16px', background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', textAlign: 'center', color: 'var(--bb-text-secondary)', fontSize: 13 }}>
            Click a body zone to annotate it
          </div>
        )}
      </div>
    </div>
  )
}

// ── ICD code mini-input ───────────────────────────────────────────────────────

function IcdCodeInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const code = input.trim().toUpperCase()
    if (code && !value.includes(code)) {
      onChange([...value, code])
    }
    setInput('')
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: value.length ? 6 : 0 }}>
        {value.map(code => (
          <span
            key={code}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: '#EFF0FF', border: '1px solid #C7C8E8', borderRadius: 20, fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}
          >
            {code}
            <button onClick={() => onChange(value.filter(c => c !== code))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--bb-text-secondary)', lineHeight: 1 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. M54.5"
          style={{ flex: 1, height: 32, padding: '0 10px', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', fontSize: 12, fontFamily: 'monospace' }}
        />
        <button
          onClick={add}
          style={{ height: 32, padding: '0 10px', background: 'var(--bb-brand-blue)', color: 'white', border: 'none', borderRadius: 'var(--bb-radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  )
}
