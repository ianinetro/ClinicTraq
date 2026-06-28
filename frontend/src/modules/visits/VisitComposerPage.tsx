import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, User, Stethoscope, ClipboardList, DollarSign, Plus, Trash2, Activity } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { BodyMapCanvas, type BodyMapState } from './BodyMapCanvas'

// ─── Step definitions ───────────────────────────────────────────────
const STEPS = [
  { id: 'patient',    label: 'Patient',    icon: User },
  { id: 'encounter',  label: 'Encounter',  icon: Stethoscope },
  { id: 'bodymap',    label: 'Body Map',   icon: Activity },
  { id: 'diagnoses',  label: 'Diagnoses',  icon: ClipboardList },
  { id: 'procedures', label: 'Procedures', icon: DollarSign },
  { id: 'review',     label: 'Review',     icon: Check },
] as const
type StepId = typeof STEPS[number]['id']

// ─── Data shapes ─────────────────────────────────────────────────────
interface DiagRow { pointer: string; icd10: string; description: string }
interface ProcRow { cpt: string; description: string; mods: string; units: number; fee: number; diagPtrs: string }

interface FormState {
  patientSearch: string
  patientName: string
  patientId: string
  dob: string
  mrn: string
  insurance: string
  visitDate: string
  visitType: string
  provider: string
  facility: string
  posCode: string
  chiefComplaint: string
  diagnoses: DiagRow[]
  procedures: ProcRow[]
  bodyMap: BodyMapState
}

const EMPTY: FormState = {
  patientSearch: '', patientName: '', patientId: '', dob: '', mrn: '', insurance: '',
  visitDate: new Date().toISOString().slice(0, 10),
  visitType: '99213', provider: 'Dr. Jennifer Smith', facility: 'Springfield Medical Group', posCode: '11',
  chiefComplaint: '',
  diagnoses: [],
  procedures: [],
  bodyMap: {},
}

// ─── Debounce hook ───────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Code search hook ────────────────────────────────────────────────
interface CodeResult { code: string; description: string; default_fee?: number }

function useCodeSearch(endpoint: string, query: string): { results: CodeResult[]; loading: boolean } {
  const [results, setResults] = useState<CodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api${endpoint}?q=${encodeURIComponent(debouncedQuery)}&limit=10`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setResults(data) })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQuery, endpoint])

  return { results, loading }
}

const MOCK_PATIENTS = [
  { id: '1', name: 'Brown, James', dob: '1990-01-28', mrn: 'MRN-001237', insurance: 'Cigna PPO' },
  { id: '2', name: 'Johnson, Mary', dob: '1975-03-12', mrn: 'MRN-001234', insurance: 'BlueCross PPO' },
  { id: '3', name: 'Davis, Susan', dob: '1964-11-05', mrn: 'MRN-001236', insurance: 'United Healthcare' },
  { id: '4', name: 'Williams, Robert', dob: '1982-07-24', mrn: 'MRN-001235', insurance: 'Aetna HMO' },
  { id: '5', name: 'Garcia, Elena', dob: '1955-08-17', mrn: 'MRN-001238', insurance: 'Medicare' },
]

const COMMON_ICD10 = [
  { icd10: 'J06.9', description: 'Acute upper respiratory infection' },
  { icd10: 'M54.5', description: 'Low back pain' },
  { icd10: 'I10', description: 'Essential hypertension' },
  { icd10: 'E11.9', description: 'Type 2 diabetes mellitus, uncontrolled' },
  { icd10: 'Z00.00', description: 'Encounter for general adult medical exam' },
  { icd10: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { icd10: 'G43.909', description: 'Migraine, unspecified, not intractable' },
]

const COMMON_CPT = [
  { cpt: '99213', description: 'Office Visit Level 3 (Est)', fee: 150 },
  { cpt: '99214', description: 'Office Visit Level 4 (Est)', fee: 200 },
  { cpt: '99202', description: 'Office Visit Level 2 (New)', fee: 120 },
  { cpt: '99203', description: 'Office Visit Level 3 (New)', fee: 165 },
  { cpt: '85025', description: 'CBC with Differential', fee: 35 },
  { cpt: '93000', description: 'ECG, 12-lead', fee: 52 },
  { cpt: '97110', description: 'Therapeutic Exercise', fee: 55 },
]

const POINTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// ─── Helper components ───────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      {children}
    </div>
  )
}

function inputStyle(extraStyle?: React.CSSProperties): React.CSSProperties {
  return {
    height: 38, padding: '0 12px',
    border: '1px solid var(--bb-border)',
    borderRadius: 'var(--bb-radius)',
    fontSize: 13, background: 'white',
    color: 'var(--bb-text-primary)', outline: 'none',
    width: '100%', boxSizing: 'border-box' as const,
    ...extraStyle,
  }
}

// ─── Main component ───────────────────────────────────────────────────
export function VisitComposerPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<StepId>('patient')
  const [form, setForm] = useState<FormState>(EMPTY)
  const [patientResults, setPatientResults] = useState<typeof MOCK_PATIENTS>([])
  const [diagSearch, setDiagSearch] = useState('')
  const [procSearch, setProcSearch] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const icdSearch = useCodeSearch('/icd10/search', diagSearch)
  const cptSearch = useCodeSearch('/cpt/search', procSearch)

  const stepIdx = STEPS.findIndex(s => s.id === step)
  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }))

  function searchPatient(q: string) {
    set({ patientSearch: q })
    if (q.length >= 2) {
      setPatientResults(MOCK_PATIENTS.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.mrn.toLowerCase().includes(q.toLowerCase())
      ))
    } else {
      setPatientResults([])
    }
  }

  function selectPatient(p: typeof MOCK_PATIENTS[number]) {
    set({ patientName: p.name, patientId: p.id, dob: p.dob, mrn: p.mrn, insurance: p.insurance, patientSearch: p.name })
    setPatientResults([])
  }

  function addDiag(d: typeof COMMON_ICD10[number]) {
    const pointer = POINTERS[form.diagnoses.length] ?? 'A'
    set({ diagnoses: [...form.diagnoses, { pointer, icd10: d.icd10, description: d.description }] })
    setDiagSearch('')
  }

  function addProc(p: typeof COMMON_CPT[number]) {
    set({ procedures: [...form.procedures, { cpt: p.cpt, description: p.description, mods: '', units: 1, fee: p.fee, diagPtrs: form.diagnoses[0]?.pointer ?? 'A' }] })
    setProcSearch('')
  }

  function handleSubmit() {
    setSubmitted(true)
    setTimeout(() => navigate('/visits'), 1800)
  }

  const canAdvance = () => {
    if (step === 'patient') return !!form.patientId
    if (step === 'encounter') return !!form.visitDate && !!form.provider
    if (step === 'diagnoses') return form.diagnoses.length > 0
    if (step === 'procedures') return form.procedures.length > 0
    return true
  }

  const advance = () => {
    const next = STEPS[stepIdx + 1]
    if (next) setStep(next.id)
  }

  const back = () => {
    const prev = STEPS[stepIdx - 1]
    if (prev) setStep(prev.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      {/* Back */}
      <Button variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/visits')}>
        <ArrowLeft size={14} /> Visits
      </Button>

      {/* Title */}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Visit</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Create a new patient encounter</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((s, i) => {
          const done = i < stepIdx
          const active = s.id === step
          const Icon = s.icon
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <button
                onClick={() => done && setStep(s.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: done ? 'pointer' : 'default', padding: '0 8px' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--bb-status-success)' : active ? 'var(--bb-brand-blue)' : 'var(--bb-surface-app)',
                  border: `2px solid ${done ? 'var(--bb-status-success)' : active ? 'var(--bb-brand-blue)' : 'var(--bb-border)'}`,
                  color: done || active ? 'white' : 'var(--bb-text-secondary)',
                  transition: 'all 0.2s',
                }}>
                  {done ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? 'var(--bb-brand-blue)' : done ? 'var(--bb-status-success)' : 'var(--bb-text-secondary)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? 'var(--bb-status-success)' : 'var(--bb-border)', marginBottom: 20, transition: 'background 0.3s' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: 28, boxShadow: 'var(--bb-shadow-sm)' }}>

        {/* ── Step 1: Patient ── */}
        {step === 'patient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Select Patient</h3>
            <Field label="Search Patient (name or MRN)">
              <div style={{ position: 'relative' }}>
                <input
                  value={form.patientSearch}
                  onChange={e => searchPatient(e.target.value)}
                  placeholder="Type to search…"
                  style={inputStyle()}
                />
                {patientResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
                    {patientResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--bb-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{p.mrn} · DOB {p.dob}</div>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{p.insurance}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            {form.patientId && (
              <div style={{ padding: '14px 16px', background: '#EFF0FF', border: '1px solid #C7C8E8', borderRadius: 'var(--bb-radius)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Patient', value: form.patientName },
                  { label: 'DOB', value: form.dob },
                  { label: 'MRN', value: form.mrn },
                  { label: 'Insurance', value: form.insurance },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>
              Patient not in system? <button style={{ background: 'none', border: 'none', color: 'var(--bb-brand-blue)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }} onClick={() => navigate('/patients/new')}>Create new patient</button>
            </div>
          </div>
        )}

        {/* ── Step 2: Encounter ── */}
        {step === 'encounter' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Encounter Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Date of Service">
                <input type="date" value={form.visitDate} onChange={e => set({ visitDate: e.target.value })} style={inputStyle()} />
              </Field>
              <Field label="Visit Type / E&M Code">
                <select value={form.visitType} onChange={e => set({ visitType: e.target.value })} style={inputStyle()}>
                  <option value="99202">99202 – New Patient, Level 2</option>
                  <option value="99203">99203 – New Patient, Level 3</option>
                  <option value="99213">99213 – Established, Level 3</option>
                  <option value="99214">99214 – Established, Level 4</option>
                  <option value="99215">99215 – Established, Level 5</option>
                </select>
              </Field>
              <Field label="Rendering Provider">
                <select value={form.provider} onChange={e => set({ provider: e.target.value })} style={inputStyle()}>
                  <option>Dr. Jennifer Smith</option>
                  <option>Dr. Marcus Johnson</option>
                  <option>Dr. Priya Patel</option>
                </select>
              </Field>
              <Field label="Facility">
                <select value={form.facility} onChange={e => set({ facility: e.target.value })} style={inputStyle()}>
                  <option>Springfield Medical Group</option>
                  <option>Springfield Urgent Care</option>
                </select>
              </Field>
              <Field label="POS Code">
                <select value={form.posCode} onChange={e => set({ posCode: e.target.value })} style={inputStyle()}>
                  <option value="11">11 – Office</option>
                  <option value="20">20 – Urgent Care</option>
                  <option value="21">21 – Inpatient Hospital</option>
                  <option value="22">22 – Outpatient Hospital</option>
                </select>
              </Field>
              <Field label="Chief Complaint">
                <input
                  value={form.chiefComplaint}
                  onChange={e => set({ chiefComplaint: e.target.value })}
                  placeholder="Brief reason for visit…"
                  style={inputStyle()}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 3b: Body Map ── */}
        {step === 'bodymap' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Body Map</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                Click anatomical zones to document findings. Annotations auto-populate diagnosis codes.
              </p>
            </div>
            <BodyMapCanvas
              value={form.bodyMap}
              onChange={bodyMap => set({ bodyMap })}
            />
          </div>
        )}

        {/* ── Step 4: Diagnoses ── */}
        {step === 'diagnoses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Diagnoses (ICD-10)</h3>
            <Field label="Search ICD-10 code or description">
              <div style={{ position: 'relative' }}>
                <input
                  value={diagSearch}
                  onChange={e => setDiagSearch(e.target.value)}
                  placeholder="e.g. M54.5 or low back pain…"
                  style={inputStyle()}
                />
                {(icdSearch.results.length > 0 || icdSearch.loading) && diagSearch.length >= 2 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                    {icdSearch.loading && (
                      <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Searching…</div>
                    )}
                    {icdSearch.results.map(r => (
                      <button
                        key={r.code}
                        onClick={() => addDiag({ icd10: r.code, description: r.description })}
                        style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 10, alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--bb-brand-blue)', flexShrink: 0 }}>{r.code}</span>
                        <span style={{ fontSize: 13, color: 'var(--bb-text-primary)' }}>{r.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            {/* Body map suggestions */}
            {Object.keys(form.bodyMap).length > 0 && (() => {
              const bodyCodes = [...new Set(Object.values(form.bodyMap).flatMap(a => a.icd_codes))]
                .filter(c => !form.diagnoses.find(d => d.icd10 === c))
              return bodyCodes.length > 0 ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 6 }}>FROM BODY MAP</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {bodyCodes.map(code => (
                      <button key={code} onClick={() => addDiag({ icd10: code, description: code })}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#EFF0FF', border: '1px solid #C7C8E8', borderRadius: 'var(--bb-radius)', cursor: 'pointer', fontSize: 13 }}>
                        <Plus size={12} color="var(--bb-brand-blue)" />
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            })()}
            {/* Quick picks */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 8 }}>COMMON DIAGNOSES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMMON_ICD10
                  .filter(d => !diagSearch || d.icd10.toLowerCase().includes(diagSearch.toLowerCase()) || d.description.toLowerCase().includes(diagSearch.toLowerCase()))
                  .filter(d => !form.diagnoses.find(x => x.icd10 === d.icd10))
                  .map(d => (
                    <button
                      key={d.icd10}
                      onClick={() => addDiag(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
                    >
                      <Plus size={12} color="var(--bb-brand-blue)" />
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{d.icd10}</span>
                      <span style={{ color: 'var(--bb-text-secondary)', fontSize: 12 }}>{d.description}</span>
                    </button>
                  ))}
              </div>
            </div>
            {form.diagnoses.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 8 }}>SELECTED DIAGNOSES</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.diagnoses.map((d, i) => (
                    <div key={d.icd10} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#EFF0FF', border: '1px solid #C7C8E8', borderRadius: 'var(--bb-radius)' }}>
                      <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bb-brand-blue)', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{d.pointer}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{d.icd10}</span>
                      <span style={{ fontSize: 13, flex: 1 }}>{d.description}</span>
                      <button onClick={() => set({ diagnoses: form.diagnoses.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Procedures ── */}
        {step === 'procedures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Procedures / CPT Codes</h3>
            <Field label="Search CPT code or description">
              <div style={{ position: 'relative' }}>
                <input value={procSearch} onChange={e => setProcSearch(e.target.value)} placeholder="e.g. 99213 or office visit…" style={inputStyle()} />
                {(cptSearch.results.length > 0 || cptSearch.loading) && procSearch.length >= 2 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                    {cptSearch.loading && (
                      <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Searching…</div>
                    )}
                    {cptSearch.results.map(r => (
                      <button
                        key={r.code}
                        onClick={() => addProc({ cpt: r.code, description: r.description, fee: r.default_fee ?? 0 })}
                        style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--bb-border)', display: 'flex', gap: 10, alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--bb-brand-blue)', flexShrink: 0, width: 54 }}>{r.code}</span>
                        <span style={{ fontSize: 13, color: 'var(--bb-text-primary)', flex: 1 }}>{r.description}</span>
                        {r.default_fee != null && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', flexShrink: 0 }}>${r.default_fee.toFixed(2)}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 8 }}>COMMON PROCEDURES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {COMMON_CPT
                  .filter(p => !procSearch || p.cpt.includes(procSearch) || p.description.toLowerCase().includes(procSearch.toLowerCase()))
                  .map(p => (
                    <button
                      key={p.cpt}
                      onClick={() => addProc(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bb-surface-app)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius)', cursor: 'pointer', fontSize: 13 }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#EFF0FF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
                    >
                      <Plus size={12} color="var(--bb-brand-blue)" />
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{p.cpt}</span>
                      <span style={{ color: 'var(--bb-text-secondary)', fontSize: 12 }}>{p.description}</span>
                      <span style={{ fontWeight: 600, color: 'var(--bb-text-primary)', fontSize: 12 }}>${p.fee}</span>
                    </button>
                  ))}
              </div>
            </div>
            {form.procedures.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', marginBottom: 8 }}>SELECTED PROCEDURES</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bb-surface-app)' }}>
                      {['CPT', 'Description', 'Mods', 'Units', 'Fee', 'Diag Ptrs', ''].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.procedures.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--bb-border)' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{p.cpt}</td>
                        <td style={{ padding: '8px 12px', fontSize: 13 }}>{p.description}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <input value={p.mods} onChange={e => { const ps = [...form.procedures]; ps[i] = { ...ps[i], mods: e.target.value }; set({ procedures: ps }) }} placeholder="—" style={{ ...inputStyle(), width: 60 }} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="number" min={1} value={p.units} onChange={e => { const ps = [...form.procedures]; ps[i] = { ...ps[i], units: parseInt(e.target.value) || 1 }; set({ procedures: ps }) }} style={{ ...inputStyle(), width: 52 }} />
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>${(p.fee * p.units).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <select value={p.diagPtrs} onChange={e => { const ps = [...form.procedures]; ps[i] = { ...ps[i], diagPtrs: e.target.value }; set({ procedures: ps }) }} style={{ ...inputStyle(), width: 72 }}>
                            {form.diagnoses.map(d => <option key={d.pointer} value={d.pointer}>{d.pointer}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={() => set({ procedures: form.procedures.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bb-status-danger)', padding: 4 }}><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--bb-border)' }}>
                      <td colSpan={4} style={{ padding: '8px 12px', fontWeight: 600 }}>Total</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--bb-brand-blue)' }}>
                        ${form.procedures.reduce((s, p) => s + p.fee * p.units, 0).toFixed(2)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={28} color="var(--bb-status-success)" />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Visit Created Successfully</h3>
                <p style={{ margin: 0, color: 'var(--bb-text-secondary)', fontSize: 14 }}>Redirecting to Visits…</p>
              </div>
            ) : (
              <>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Review & Save</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 10 }}>Patient</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{form.patientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>{form.mrn} · DOB {form.dob}</div>
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{form.insurance}</div>
                  </div>
                  <div style={{ background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', padding: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 10 }}>Encounter</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{form.visitDate} · {form.visitType}</div>
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', marginTop: 2 }}>{form.provider}</div>
                    <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)' }}>{form.facility} (POS {form.posCode})</div>
                  </div>
                </div>
                <div style={{ background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 10 }}>Diagnoses</div>
                  {form.diagnoses.map(d => (
                    <div key={d.icd10} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: 'var(--bb-brand-blue)', width: 20 }}>{d.pointer}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>{d.icd10}</span>
                      <span style={{ fontSize: 13, color: 'var(--bb-text-secondary)' }}>{d.description}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 10 }}>Procedures</div>
                  {form.procedures.map(p => (
                    <div key={p.cpt} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--bb-brand-blue)' }}>{p.cpt}</span> {p.mods && <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.mods}</span>} × {p.units} — {p.description}</span>
                      <span style={{ fontWeight: 600 }}>${(p.fee * p.units).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--bb-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                    <span>Total Billed</span>
                    <span style={{ color: 'var(--bb-brand-blue)' }}>${form.procedures.reduce((s, p) => s + p.fee * p.units, 0).toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {!submitted && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="secondary" onClick={back} disabled={stepIdx === 0}>
            <ArrowLeft size={14} /> Back
          </Button>
          {step === 'review' ? (
            <Button variant="primary" onClick={handleSubmit}>
              <Check size={14} /> Save Visit
            </Button>
          ) : (
            <Button variant="primary" onClick={advance} disabled={!canAdvance()}>
              Next <ArrowRight size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
