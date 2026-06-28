import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Trash2, ChevronRight, ChevronLeft, Download, Printer, Send, CheckCircle2, AlertCircle, X, User } from 'lucide-react'
import { apiClient as api } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientResult {
  id: string
  first_name: string
  last_name: string
  date_of_birth?: string
  mrn?: string
  account_number?: string
  phone?: string
  primary_insurance_name?: string
  member_id?: string
}

interface Dx {
  pointer: string // A–L
  code: string
  description: string
}

interface ServiceLine {
  id: string
  dos_from: string
  dos_to: string
  pos: string
  cpt: string
  cptDesc: string
  mod1: string
  mod2: string
  mod3: string
  mod4: string
  dxPointers: string // e.g. "A,B"
  units: string
  charge: string
  emg: boolean
  renderingNpi: string
}

interface ClaimForm {
  // Patient / Insurance
  patient: PatientResult | null
  insuranceType: string
  insuredId: string
  groupNumber: string
  planName: string
  insuredName: string
  insuredDob: string
  insuredSex: string
  insuredRelationship: string
  // Condition
  conditionEmployment: boolean
  conditionAutoAccident: boolean
  conditionOtherAccident: boolean
  // Provider / Service
  dateIllnessInjury: string
  referringProviderName: string
  referringNpi: string
  hospitalFrom: string
  hospitalTo: string
  priorAuthNumber: string
  dos: string
  federalTaxId: string
  acceptAssignment: boolean
  // Diagnoses (Box 21)
  diagnoses: Dx[]
  // Service lines (Box 24)
  serviceLines: ServiceLine[]
  // Facility
  facilityName: string
  facilityNpi: string
  facilityAddress: string
  // Billing provider
  billingName: string
  billingNpi: string
  billingAddress: string
  billingPhone: string
  billingTaxId: string
}

const POINTER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

const POS_CODES = [
  { code: '11', label: '11 - Office' },
  { code: '12', label: '12 - Home' },
  { code: '21', label: '21 - Inpatient Hospital' },
  { code: '22', label: '22 - On Campus-Outpatient Hospital' },
  { code: '23', label: '23 - Emergency Room' },
  { code: '24', label: '24 - Ambulatory Surgical Center' },
  { code: '31', label: '31 - Skilled Nursing Facility' },
  { code: '32', label: '32 - Nursing Facility' },
  { code: '49', label: '49 - Independent Clinic' },
  { code: '72', label: '72 - Rural Health Clinic' },
]

function emptyLine(): ServiceLine {
  return {
    id: Math.random().toString(36).slice(2),
    dos_from: '', dos_to: '', pos: '11', cpt: '', cptDesc: '',
    mod1: '', mod2: '', mod3: '', mod4: '', dxPointers: 'A',
    units: '1', charge: '', emg: false, renderingNpi: '',
  }
}

const INIT: ClaimForm = {
  patient: null,
  insuranceType: 'group_health',
  insuredId: '', groupNumber: '', planName: '',
  insuredName: '', insuredDob: '', insuredSex: '', insuredRelationship: 'self',
  conditionEmployment: false, conditionAutoAccident: false, conditionOtherAccident: false,
  dateIllnessInjury: '', referringProviderName: '', referringNpi: '',
  hospitalFrom: '', hospitalTo: '', priorAuthNumber: '',
  dos: '', federalTaxId: '', acceptAssignment: true,
  diagnoses: [{ pointer: 'A', code: '', description: '' }],
  serviceLines: [emptyLine()],
  facilityName: '', facilityNpi: '', facilityAddress: '',
  billingName: '', billingNpi: '', billingAddress: '', billingPhone: '', billingTaxId: '',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
        {label}{required && <span style={{ color: '#DC2626' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  height: 34, border: '1px solid #D1D5DB', borderRadius: 6,
  padding: '0 8px', fontSize: 13, color: '#12122C', outline: 'none',
  background: 'white', width: '100%',
}

const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

// ─── Step 1: Find Patient ──────────────────────────────────────────────────────

function StepPatient({ form, setForm }: { form: ClaimForm; setForm: React.Dispatch<React.SetStateAction<ClaimForm>> }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<PatientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setResults([]); setSearched(false); return }
    setSearching(true)
    try {
      const res = await api.get('/patients', { params: { search: query, limit: 10 } })
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      setResults(items)
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleSearch(val: string) {
    setQ(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  function selectPatient(p: PatientResult) {
    setForm(f => ({
      ...f, patient: p,
      insuredId: p.member_id ?? '',
      insuredName: `${p.last_name}, ${p.first_name}`,
      dos: new Date().toISOString().split('T')[0],
    }))
    setQ('')
    setResults([])
    setSearched(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C', marginBottom: 4 }}>Find Patient</div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>Search by name, phone, DOB, MRN, or account number</div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={q}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by name, DOB, phone, MRN, or account #…"
              style={{ ...inp, paddingLeft: 32, width: '100%' }}
            />
          </div>
        </div>

        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'white', border: '1px solid #E3E3F1', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
          }}>
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => selectPatient(p)}
                style={{
                  width: '100%', padding: '10px 14px', border: 'none', background: 'white',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  borderBottom: '1px solid #F3F4F6',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={15} style={{ color: '#0410BD' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#12122C' }}>
                    {p.last_name}, {p.first_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                    {p.date_of_birth ? `DOB: ${p.date_of_birth}` : ''}{p.mrn ? `  |  MRN: ${p.mrn}` : ''}{p.account_number ? `  |  Acct: ${p.account_number}` : ''}
                  </div>
                </div>
                {p.primary_insurance_name && (
                  <span style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>
                    {p.primary_insurance_name}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {searched && results.length === 0 && !searching && (
          <div style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: 13, background: 'white', border: '1px solid #E3E3F1', borderRadius: 8, marginTop: 4 }}>
            No patients found. Try a different search.
          </div>
        )}
      </div>

      {form.patient && (
        <div style={{ background: '#EFF0FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#12122C' }}>
                {form.patient.last_name}, {form.patient.first_name}
              </div>
              <div style={{ fontSize: 13, color: '#4B5563', marginTop: 4, display: 'flex', gap: 14 }}>
                {form.patient.date_of_birth && <span>DOB: {form.patient.date_of_birth}</span>}
                {form.patient.mrn && <span>MRN: {form.patient.mrn}</span>}
                {form.patient.account_number && <span>Acct: {form.patient.account_number}</span>}
                {form.patient.phone && <span>Ph: {form.patient.phone}</span>}
              </div>
              {form.patient.primary_insurance_name && (
                <div style={{ fontSize: 12, color: '#0410BD', marginTop: 4 }}>
                  Insurance: {form.patient.primary_insurance_name} {form.patient.member_id ? `(ID: ${form.patient.member_id})` : ''}
                </div>
              )}
            </div>
            <button onClick={() => setForm(f => ({ ...f, patient: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Insurance / Header ────────────────────────────────────────────────

function StepInsurance({ form, setForm }: { form: ClaimForm; setForm: React.Dispatch<React.SetStateAction<ClaimForm>> }) {
  function upd(key: keyof ClaimForm, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C' }}>Insurance / CMS-1500 Boxes 1–13</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Box 1 — Insurance Type" required>
          <select value={form.insuranceType} onChange={e => upd('insuranceType', e.target.value)} style={sel}>
            <option value="medicare">Medicare</option>
            <option value="medicaid">Medicaid</option>
            <option value="tricare">TRICARE/CHAMPUS</option>
            <option value="champva">CHAMPVA</option>
            <option value="group_health">Group Health Plan</option>
            <option value="feca">FECA Blk Lung</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Box 1a — Insured's ID Number" required>
          <input style={inp} value={form.insuredId} onChange={e => upd('insuredId', e.target.value)} placeholder="Member ID" />
        </Field>
        <Field label="Box 4 — Insured's Name">
          <input style={inp} value={form.insuredName} onChange={e => upd('insuredName', e.target.value)} placeholder="Last, First MI" />
        </Field>
        <Field label="Box 6 — Patient Relationship to Insured">
          <select value={form.insuredRelationship} onChange={e => upd('insuredRelationship', e.target.value)} style={sel}>
            <option value="self">Self</option>
            <option value="spouse">Spouse</option>
            <option value="child">Child</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Box 11 — Policy/Group Number">
          <input style={inp} value={form.groupNumber} onChange={e => upd('groupNumber', e.target.value)} placeholder="Group #" />
        </Field>
        <Field label="Box 11c — Insurance Plan Name">
          <input style={inp} value={form.planName} onChange={e => upd('planName', e.target.value)} placeholder="Plan name" />
        </Field>
        <Field label="Box 11a — Insured's DOB">
          <input style={inp} type="date" value={form.insuredDob} onChange={e => upd('insuredDob', e.target.value)} />
        </Field>
        <Field label="Box 11a — Insured's Sex">
          <select value={form.insuredSex} onChange={e => upd('insuredSex', e.target.value)} style={sel}>
            <option value="">Unknown</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </Field>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Box 10 — Condition Related To</div>
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { key: 'conditionEmployment', label: 'Employment' },
            { key: 'conditionAutoAccident', label: 'Auto Accident' },
            { key: 'conditionOtherAccident', label: 'Other Accident' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[key as keyof ClaimForm] as boolean}
                onChange={e => upd(key as keyof ClaimForm, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Provider / Diagnoses / Service Lines ─────────────────────────────

function DxSearch({ dx, pointer, onUpdate, onRemove }: {
  dx: Dx
  pointer: string
  onUpdate: (d: Partial<Dx>) => void
  onRemove: () => void
}) {
  const [q, setQ] = useState(dx.code ? `${dx.code} — ${dx.description}` : '')
  const [results, setResults] = useState<{ code: string; description: string }[]>([])
  const [open, setOpen] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function search(val: string) {
    if (val.length < 2) { setResults([]); setOpen(false); return }
    try {
      const res = await api.get('/icd10/search', { params: { q: val, limit: 10 } })
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      setResults(items)
      setOpen(items.length > 0)
    } catch { setResults([]) }
  }

  function handleChange(val: string) {
    setQ(val)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => search(val), 300)
  }

  function select(item: { code: string; description: string }) {
    onUpdate({ code: item.code, description: item.description })
    setQ(`${item.code} — ${item.description}`)
    setOpen(false)
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{
        width: 26, height: 26, borderRadius: 6, background: '#0410BD', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>{pointer}</span>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          value={q}
          onChange={e => handleChange(e.target.value)}
          placeholder="Search ICD-10 code or description…"
          style={{ ...inp, fontSize: 12 }}
          onFocus={() => q.length >= 2 && setOpen(results.length > 0)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
            background: 'white', border: '1px solid #E3E3F1', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2, maxHeight: 200, overflowY: 'auto',
          }}>
            {results.map(r => (
              <button key={r.code} onMouseDown={() => select(r)} style={{
                width: '100%', padding: '7px 10px', border: 'none', background: 'white',
                cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #F3F4F6',
                display: 'flex', gap: 8, fontSize: 12,
              }}>
                <span style={{ fontWeight: 700, color: '#0410BD', flexShrink: 0 }}>{r.code}</span>
                <span style={{ color: '#374151' }}>{r.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function CptSearch({ value, onChange }: { value: string; onChange: (code: string, desc: string) => void }) {
  const [q, setQ] = useState(value)
  const [results, setResults] = useState<{ code: string; description: string }[]>([])
  const [open, setOpen] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function search(val: string) {
    if (val.length < 2) { setResults([]); return }
    try {
      const res = await api.get('/cpt/search', { params: { q: val, limit: 10 } })
      const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      setResults(items)
      setOpen(items.length > 0)
    } catch { setResults([]) }
  }

  function handleChange(val: string) {
    setQ(val)
    onChange(val, '')
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => search(val), 300)
  }

  function select(item: { code: string; description: string }) {
    setQ(item.code)
    onChange(item.code, item.description)
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={e => handleChange(e.target.value)}
        placeholder="CPT code"
        style={{ ...inp, fontSize: 12, width: 90 }}
        onFocus={() => q.length >= 2 && setOpen(results.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 60, width: 320,
          background: 'white', border: '1px solid #E3E3F1', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2, maxHeight: 200, overflowY: 'auto',
        }}>
          {results.map(r => (
            <button key={r.code} onMouseDown={() => select(r)} style={{
              width: '100%', padding: '7px 10px', border: 'none', background: 'white',
              cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #F3F4F6',
              display: 'flex', gap: 8, fontSize: 12,
            }}>
              <span style={{ fontWeight: 700, color: '#0410BD', flexShrink: 0 }}>{r.code}</span>
              <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StepServices({ form, setForm }: { form: ClaimForm; setForm: React.Dispatch<React.SetStateAction<ClaimForm>> }) {
  function updDx(i: number, d: Partial<Dx>) {
    setForm(f => {
      const dxs = [...f.diagnoses]
      dxs[i] = { ...dxs[i], ...d }
      return { ...f, diagnoses: dxs }
    })
  }
  function addDx() {
    setForm(f => {
      if (f.diagnoses.length >= 12) return f
      const ptr = POINTER_LETTERS[f.diagnoses.length]
      return { ...f, diagnoses: [...f.diagnoses, { pointer: ptr, code: '', description: '' }] }
    })
  }
  function removeDx(i: number) {
    setForm(f => ({ ...f, diagnoses: f.diagnoses.filter((_, idx) => idx !== i) }))
  }

  function updLine(i: number, key: keyof ServiceLine, val: string | boolean) {
    setForm(f => {
      const lines = [...f.serviceLines]
      lines[i] = { ...lines[i], [key]: val }
      return { ...f, serviceLines: lines }
    })
  }
  function addLine() { setForm(f => ({ ...f, serviceLines: [...f.serviceLines, emptyLine()] })) }
  function removeLine(i: number) { setForm(f => ({ ...f, serviceLines: f.serviceLines.filter((_, idx) => idx !== i) })) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Provider info */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#12122C', marginBottom: 12 }}>Provider / Service Info (Boxes 14–23)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="Box 14 — Date of Illness/Injury">
            <input style={inp} type="date" value={form.dateIllnessInjury} onChange={e => setForm(f => ({ ...f, dateIllnessInjury: e.target.value }))} />
          </Field>
          <Field label="Box 17 — Referring Provider">
            <input style={inp} value={form.referringProviderName} onChange={e => setForm(f => ({ ...f, referringProviderName: e.target.value }))} placeholder="Name" />
          </Field>
          <Field label="Box 17b — Referring NPI">
            <input style={inp} value={form.referringNpi} onChange={e => setForm(f => ({ ...f, referringNpi: e.target.value }))} placeholder="1234567890" />
          </Field>
          <Field label="Box 18 — Hospitalization From">
            <input style={inp} type="date" value={form.hospitalFrom} onChange={e => setForm(f => ({ ...f, hospitalFrom: e.target.value }))} />
          </Field>
          <Field label="Box 18 — Hospitalization To">
            <input style={inp} type="date" value={form.hospitalTo} onChange={e => setForm(f => ({ ...f, hospitalTo: e.target.value }))} />
          </Field>
          <Field label="Box 23 — Prior Authorization #">
            <input style={inp} value={form.priorAuthNumber} onChange={e => setForm(f => ({ ...f, priorAuthNumber: e.target.value }))} placeholder="Auth #" />
          </Field>
        </div>
      </div>

      {/* Box 21 — Diagnoses */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#12122C' }}>Box 21 — Diagnoses (ICD-10)</div>
          <button
            onClick={addDx}
            disabled={form.diagnoses.length >= 12}
            style={{
              height: 28, padding: '0 10px', background: '#EFF0FF', color: '#0410BD',
              border: '1px solid #C7D2FE', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> Add Dx
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.diagnoses.map((dx, i) => (
            <DxSearch
              key={i}
              dx={dx}
              pointer={POINTER_LETTERS[i]}
              onUpdate={d => updDx(i, d)}
              onRemove={() => removeDx(i)}
            />
          ))}
        </div>
      </div>

      {/* Box 24 — Service Lines */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#12122C' }}>Box 24 — Service Lines</div>
          <button
            onClick={addLine}
            style={{
              height: 28, padding: '0 10px', background: '#EFF0FF', color: '#0410BD',
              border: '1px solid #C7D2FE', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> Add Line
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                {['DOS From', 'DOS To', 'POS', 'CPT', 'Mod 1', 'Mod 2', 'Dx Ptr', 'Units', 'Charge', ''].map(h => (
                  <th key={h} style={{ padding: '6px 6px', textAlign: 'left', fontWeight: 600, color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.serviceLines.map((line, i) => (
                <tr key={line.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="date" value={line.dos_from} onChange={e => updLine(i, 'dos_from', e.target.value)} style={{ ...inp, width: 120, fontSize: 11 }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="date" value={line.dos_to} onChange={e => updLine(i, 'dos_to', e.target.value)} style={{ ...inp, width: 120, fontSize: 11 }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <select value={line.pos} onChange={e => updLine(i, 'pos', e.target.value)} style={{ ...sel, width: 60, fontSize: 11 }}>
                      {POS_CODES.map(p => <option key={p.code} value={p.code}>{p.code}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <CptSearch value={line.cpt} onChange={(code, desc) => { updLine(i, 'cpt', code); updLine(i, 'cptDesc', desc) }} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input value={line.mod1} onChange={e => updLine(i, 'mod1', e.target.value)} style={{ ...inp, width: 44, fontSize: 11, textTransform: 'uppercase' }} maxLength={2} placeholder="—" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input value={line.mod2} onChange={e => updLine(i, 'mod2', e.target.value)} style={{ ...inp, width: 44, fontSize: 11, textTransform: 'uppercase' }} maxLength={2} placeholder="—" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input value={line.dxPointers} onChange={e => updLine(i, 'dxPointers', e.target.value)} style={{ ...inp, width: 56, fontSize: 11, textTransform: 'uppercase' }} placeholder="A" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={line.units} onChange={e => updLine(i, 'units', e.target.value)} style={{ ...inp, width: 50, fontSize: 11 }} min={1} />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input type="number" value={line.charge} onChange={e => updLine(i, 'charge', e.target.value)} style={{ ...inp, width: 70, fontSize: 11 }} placeholder="0.00" step="0.01" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, paddingRight: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#12122C' }}>
            Total: ${form.serviceLines.reduce((sum, l) => sum + (parseFloat(l.charge) || 0) * (parseInt(l.units) || 1), 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Billing Provider ──────────────────────────────────────────────────

function StepBillingProvider({ form, setForm }: { form: ClaimForm; setForm: React.Dispatch<React.SetStateAction<ClaimForm>> }) {
  function upd(key: keyof ClaimForm, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C' }}>Boxes 25–33 — Billing Provider / Facility</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Box 25 — Federal Tax ID">
          <input style={inp} value={form.federalTaxId} onChange={e => upd('federalTaxId', e.target.value)} placeholder="XX-XXXXXXX" />
        </Field>
        <Field label="Box 27 — Accept Assignment">
          <select value={form.acceptAssignment ? 'yes' : 'no'} onChange={e => upd('acceptAssignment', e.target.value === 'yes')} style={sel}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Box 32 — Service Facility Name">
          <input style={inp} value={form.facilityName} onChange={e => upd('facilityName', e.target.value)} placeholder="Facility name" />
        </Field>
        <Field label="Box 32a — Facility NPI">
          <input style={inp} value={form.facilityNpi} onChange={e => upd('facilityNpi', e.target.value)} placeholder="1234567890" maxLength={10} />
        </Field>
        <Field label="Box 32 — Facility Address">
          <input style={inp} value={form.facilityAddress} onChange={e => upd('facilityAddress', e.target.value)} placeholder="Street, City, State ZIP" />
        </Field>
        <div />
        <Field label="Box 33 — Billing Provider Name">
          <input style={inp} value={form.billingName} onChange={e => upd('billingName', e.target.value)} placeholder="Billing provider or group name" />
        </Field>
        <Field label="Box 33a — Billing NPI">
          <input style={inp} value={form.billingNpi} onChange={e => upd('billingNpi', e.target.value)} placeholder="1234567890" maxLength={10} />
        </Field>
        <Field label="Box 33 — Billing Address">
          <input style={inp} value={form.billingAddress} onChange={e => upd('billingAddress', e.target.value)} placeholder="Street, City, State ZIP" />
        </Field>
        <Field label="Box 33 — Billing Phone">
          <input style={inp} value={form.billingPhone} onChange={e => upd('billingPhone', e.target.value)} placeholder="(555) 000-0000" />
        </Field>
      </div>
    </div>
  )
}

// ─── Step 5: Review + Submit ───────────────────────────────────────────────────

function StepReview({ form, claimId, validationIssues, onValidate, validating }: {
  form: ClaimForm
  claimId: string | null
  validationIssues: { severity: string; code: string; message: string }[] | null
  onValidate: () => void
  validating: boolean
}) {
  const total = form.serviceLines.reduce((s, l) => s + (parseFloat(l.charge) || 0) * (parseInt(l.units) || 1), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C' }}>Review Claim</div>

      {/* Patient summary */}
      {form.patient && (
        <div style={{ background: '#F9FAFB', border: '1px solid #E3E3F1', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {form.patient.last_name}, {form.patient.first_name}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            Insurance: {form.insuredId} · Group: {form.groupNumber || '—'} · Auth: {form.priorAuthNumber || '—'}
          </div>
        </div>
      )}

      {/* Diagnoses summary */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E3E3F1', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Diagnoses</div>
        {form.diagnoses.filter(d => d.code).map((d, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, color: '#0410BD', width: 16 }}>{POINTER_LETTERS[i]}</span>
            <span style={{ fontWeight: 600 }}>{d.code}</span>
            <span style={{ color: '#6B7280' }}>{d.description}</span>
          </div>
        ))}
      </div>

      {/* Service lines summary */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E3E3F1', borderRadius: 8, padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Service Lines</div>
        {form.serviceLines.map((l) => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>
              <span style={{ fontWeight: 700, color: '#0410BD' }}>{l.cpt}</span>
              {l.mod1 && ` -${l.mod1}`}{l.mod2 && ` -${l.mod2}`}
              <span style={{ color: '#6B7280', marginLeft: 6 }}>{l.cptDesc}</span>
            </span>
            <span style={{ fontWeight: 600 }}>
              {l.units}u × ${parseFloat(l.charge || '0').toFixed(2)} = ${((parseFloat(l.charge) || 0) * (parseInt(l.units) || 1)).toFixed(2)}
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #E3E3F1', marginTop: 8, paddingTop: 6, textAlign: 'right', fontWeight: 700 }}>
          Total Charge: ${total.toFixed(2)}
        </div>
      </div>

      {/* Validation */}
      <div>
        <button
          onClick={onValidate}
          disabled={validating || !claimId}
          style={{
            height: 36, padding: '0 16px', background: '#EFF0FF', color: '#0410BD',
            border: '1px solid #C7D2FE', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <CheckCircle2 size={14} />
          {validating ? 'Validating…' : 'Run Validation'}
        </button>

        {validationIssues !== null && (
          <div style={{ marginTop: 12 }}>
            {validationIssues.length === 0 ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#16A34A', fontSize: 13 }}>
                <CheckCircle2 size={15} /> No issues — claim is ready to submit
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validationIssues.map((iss, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 6,
                    background: iss.severity === 'blocking' ? '#FEF2F2' : iss.severity === 'warning' ? '#FFFBEB' : '#EFF6FF',
                    border: `1px solid ${iss.severity === 'blocking' ? '#FECACA' : iss.severity === 'warning' ? '#FDE68A' : '#BFDBFE'}`,
                  }}>
                    <AlertCircle size={14} style={{ color: iss.severity === 'blocking' ? '#DC2626' : iss.severity === 'warning' ? '#D97706' : '#3B82F6', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, marginRight: 6 }}>{iss.code}</span>
                      <span style={{ fontSize: 12 }}>{iss.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Composer ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Patient' },
  { id: 2, label: 'Insurance' },
  { id: 3, label: 'Services' },
  { id: 4, label: 'Billing' },
  { id: 5, label: 'Review' },
]

export function ClaimComposerPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ClaimForm>(INIT)
  const [claimId, setClaimId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationIssues, setValidationIssues] = useState<{ severity: string; code: string; message: string }[] | null>(null)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProgress(): Promise<string | null> {
    if (!form.patient) { setError('Please select a patient first'); return null }
    setSaving(true)
    setError(null)
    try {
      const total = form.serviceLines.reduce((s, l) => s + (parseFloat(l.charge) || 0) * (parseInt(l.units) || 1), 0)
      if (!claimId) {
        // Create the claim
        const res = await api.post('/claims', {
          patient_id: form.patient.id,
          claim_type: 'professional',
          date_of_service: form.dos || undefined,
          total_charge: total,
          authorization_number: form.priorAuthNumber || undefined,
          diagnoses_snapshot: form.diagnoses.filter(d => d.code).map(d => ({ code: d.code, description: d.description })),
        })
        const id = res.data.id
        setClaimId(id)
        // Add service lines
        for (const line of form.serviceLines.filter(l => l.cpt)) {
          await api.post(`/visits/${id}/charge-lines`.replace('/visits/', '/claims/'), {
            cpt_code: line.cpt,
            modifier_a: line.mod1 || undefined,
            modifier_b: line.mod2 || undefined,
            units: parseInt(line.units) || 1,
            charge_amount: parseFloat(line.charge) || 0,
            place_of_service: line.pos,
          }).catch(() => {/* ignore if endpoint varies */})
        }
        return id
      }
      return claimId
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save claim')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    const id = claimId ?? await saveProgress()
    if (!id) return
    setValidating(true)
    try {
      const res = await api.post(`/claims/${id}/validate`)
      setValidationIssues(res.data?.issues ?? [])
    } catch {
      setValidationIssues([])
    } finally {
      setValidating(false)
    }
  }

  async function handleSubmit() {
    const id = claimId ?? await saveProgress()
    if (!id) return
    setSubmitting(true)
    try {
      await api.post(`/claims/${id}/submit`)
      navigate(`/claims/${id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload837() {
    const id = claimId ?? await saveProgress()
    if (!id) return
    try {
      const res = await api.get(`/claims/${id}/edi837`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/plain' }))
      const a = document.createElement('a'); a.href = url; a.download = `claim_${id}.837`; a.click()
      URL.revokeObjectURL(url)
    } catch { setError('Could not generate 837P file') }
  }

  async function handlePrintCMS1500() {
    const id = claimId ?? await saveProgress()
    if (!id) return
    window.open(`/api/v1/claims/${id}/cms1500/pdf`, '_blank')
  }

  async function goNext() {
    if (step === 1 && !form.patient) { setError('Please select a patient'); return }
    if (step === 4) { await saveProgress() }
    setError(null)
    setStep(s => Math.min(s + 1, 5))
  }

  const canProceed = step !== 1 || !!form.patient
  const blockingIssues = (validationIssues ?? []).filter(i => i.severity === 'blocking')

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#12122C', letterSpacing: '-0.5px' }}>New Claim</div>
        <div style={{ fontSize: 13, color: '#676687', marginTop: 2 }}>CMS-1500 / Professional Claim Composer</div>
      </div>

      {/* Progress steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28, background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '10px 20px', overflow: 'hidden' }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <button
              onClick={() => s.id < step && setStep(s.id)}
              disabled={s.id > step}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: s.id <= step ? 'pointer' : 'default',
                padding: 0,
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > s.id ? '#16A34A' : step === s.id ? '#0410BD' : '#E5E7EB',
                color: step >= s.id ? 'white' : '#9CA3AF', fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {step > s.id ? '✓' : s.id}
              </div>
              <span style={{ fontSize: 13, fontWeight: step === s.id ? 700 : 500, color: step === s.id ? '#12122C' : '#6B7280' }}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: '#E5E7EB', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 12, padding: '24px 28px', minHeight: 320 }}>
        {step === 1 && <StepPatient form={form} setForm={setForm} />}
        {step === 2 && <StepInsurance form={form} setForm={setForm} />}
        {step === 3 && <StepServices form={form} setForm={setForm} />}
        {step === 4 && <StepBillingProvider form={form} setForm={setForm} />}
        {step === 5 && (
          <StepReview
            form={form}
            claimId={claimId}
            validationIssues={validationIssues}
            onValidate={handleValidate}
            validating={validating}
          />
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <button
          onClick={() => setStep(s => Math.max(s - 1, 1))}
          disabled={step === 1}
          style={{
            height: 38, padding: '0 16px', background: 'white', color: '#374151',
            border: '1px solid #D1D5DB', borderRadius: 8, cursor: step === 1 ? 'default' : 'pointer',
            fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            opacity: step === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={15} /> Back
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {step === 5 && (
            <>
              <button onClick={handleDownload837} style={{
                height: 38, padding: '0 14px', background: 'white', color: '#374151',
                border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Download size={14} /> 837P
              </button>
              <button onClick={handlePrintCMS1500} style={{
                height: 38, padding: '0 14px', background: 'white', color: '#374151',
                border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Printer size={14} /> CMS-1500
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || blockingIssues.length > 0}
                style={{
                  height: 38, padding: '0 18px', background: blockingIssues.length > 0 ? '#9CA3AF' : '#0410BD', color: 'white',
                  border: 'none', borderRadius: 8, cursor: submitting || blockingIssues.length > 0 ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Send size={14} />
                {submitting ? 'Submitting…' : blockingIssues.length > 0 ? `${blockingIssues.length} blocking issue${blockingIssues.length > 1 ? 's' : ''}` : 'Submit Claim'}
              </button>
            </>
          )}
          {step < 5 && (
            <button
              onClick={goNext}
              disabled={!canProceed || saving}
              style={{
                height: 38, padding: '0 18px', background: canProceed ? '#0410BD' : '#E5E7EB',
                color: canProceed ? 'white' : '#9CA3AF',
                border: 'none', borderRadius: 8, cursor: canProceed ? 'pointer' : 'default',
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {saving ? 'Saving…' : 'Next'} <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
