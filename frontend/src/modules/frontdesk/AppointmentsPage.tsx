import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, X, Search,
  CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react'
import { apiClient as api } from '../../services/api'
import { format, addDays, subDays, parseISO } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'roomed'
  | 'in_exam'
  | 'checked_out'
  | 'seen'
  | 'no_show'
  | 'cancelled'

type AppointmentType =
  | 'office_visit'
  | 'follow_up'
  | 'new_patient'
  | 'telehealth'
  | 'procedure'
  | 'other'

interface Appointment {
  id: string
  patient_id: string
  patient_name: string
  patient_dob?: string
  patient_mrn?: string
  provider_id?: string
  provider_name?: string
  office_id?: string
  office_name?: string
  start_time: string
  end_time: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  notes?: string
  chief_complaint?: string
  visit_id?: string
}

interface PatientSearchResult {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  mrn?: string
}

interface ProviderOption {
  id: string
  first_name: string
  last_name: string
  credentials?: string
}

interface OfficeOption {
  id: string
  name: string
}

interface NewAppointmentForm {
  patient_id: string
  patient_label: string
  date: string
  start_time: string
  duration: number
  provider_id: string
  appointment_type: AppointmentType
  office_id: string
  notes: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  roomed: 'Roomed',
  in_exam: 'In Exam',
  checked_out: 'Checked Out',
  seen: 'Seen',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<AppointmentStatus, { bg: string; color: string }> = {
  scheduled: { bg: '#F3F4F6', color: '#6B7280' },
  confirmed: { bg: '#EFF0FF', color: '#0410BD' },
  checked_in: { bg: '#FFFBEB', color: '#D97706' },
  roomed: { bg: '#FFF7ED', color: '#C2410C' },
  in_exam: { bg: '#F5F3FF', color: '#7C3AED' },
  checked_out: { bg: '#F0FDF4', color: '#16A34A' },
  seen: { bg: '#ECFDF5', color: '#16A34A' },
  no_show: { bg: '#FEF2F2', color: '#991B1B' },
  cancelled: { bg: '#F9FAFB', color: '#9CA3AF' },
}

const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  office_visit: 'Office Visit',
  follow_up: 'Follow-Up',
  new_patient: 'New Patient',
  telehealth: 'Telehealth',
  procedure: 'Procedure',
  other: 'Other',
}

const STATUS_TABS: { value: AppointmentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'seen', label: 'Seen' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

const DURATIONS = [15, 30, 45, 60]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeRange(start: string, end: string): string {
  try {
    return `${format(parseISO(start), 'h:mm a')} – ${format(parseISO(end), 'h:mm a')}`
  } catch {
    return start
  }
}

function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { bg, color } = STATUS_STYLES[status] ?? STATUS_STYLES.scheduled
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 9px',
      borderRadius: 99, background: bg, color, whiteSpace: 'nowrap',
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1A1A2E', color: 'white', borderRadius: 10,
      padding: '12px 20px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <CheckCircle2 size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
      {message}
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Patient typeahead ────────────────────────────────────────────────────────

function PatientTypeahead({
  value,
  label,
  onChange,
}: {
  value: string
  label: string
  onChange: (id: string, label: string) => void
}) {
  const [q, setQ] = useState(label)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<PatientSearchResult[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleInput(val: string) {
    setQ(val)
    onChange('', val)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length < 2) { setResults([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/patients', { params: { search: val, limit: 10 } })
        const items: PatientSearchResult[] = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        setResults(items)
        setOpen(items.length > 0)
      } catch { setResults([]); setOpen(false) }
    }, 250)
  }

  function select(p: PatientSearchResult) {
    const lbl = `${p.first_name} ${p.last_name}`
    setQ(lbl)
    onChange(p.id, lbl)
    setOpen(false)
  }

  useEffect(() => { if (!value) setQ('') }, [value])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
        <input
          value={q}
          onChange={e => handleInput(e.target.value)}
          placeholder="Search patient name or MRN…"
          style={{
            width: '100%', boxSizing: 'border-box',
            height: 36, paddingLeft: 32, paddingRight: 10,
            border: '1px solid #E0E0EF', borderRadius: 7,
            fontSize: 13, color: '#12122C', outline: 'none',
            background: 'white',
          }}
        />
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid #E0E0EF',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: 2,
        }}>
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => select(p)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 14px',
                background: 'none', border: 'none', borderBottom: '1px solid #E0E0EF',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600, color: '#12122C' }}>{p.first_name} {p.last_name}</span>
              {p.date_of_birth && <span style={{ color: '#6B6B8A', marginLeft: 8 }}>DOB {p.date_of_birth}</span>}
              {p.mrn && <span style={{ color: '#6B6B8A', marginLeft: 8 }}>MRN {p.mrn}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── New Appointment Modal ────────────────────────────────────────────────────

const EMPTY_FORM: NewAppointmentForm = {
  patient_id: '',
  patient_label: '',
  date: toDateString(new Date()),
  start_time: '09:00',
  duration: 30,
  provider_id: '',
  appointment_type: 'office_visit',
  office_id: '',
  notes: '',
}

function NewAppointmentModal({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: string
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<NewAppointmentForm>({ ...EMPTY_FORM, date: initialDate })
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const { data: providers = [] } = useQuery<ProviderOption[]>({
    queryKey: ['providers-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/providers', { params: { status: 'active', limit: 100 } })
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      } catch { return [] }
    },
    staleTime: 300_000,
  })

  const { data: offices = [] } = useQuery<OfficeOption[]>({
    queryKey: ['offices-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/offices', { params: { limit: 100 } })
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      } catch { return [] }
    },
    staleTime: 300_000,
  })

  const createMutation = useMutation({
    mutationFn: async (f: NewAppointmentForm) => {
      const startDt = new Date(`${f.date}T${f.start_time}:00`)
      const endDt = new Date(startDt.getTime() + f.duration * 60_000)
      await api.post('/appointments', {
        patient_id: f.patient_id,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        appointment_type: f.appointment_type,
        provider_id: f.provider_id || undefined,
        office_id: f.office_id || undefined,
        notes: f.notes || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      onCreated()
    },
    onError: () => setError('Failed to create appointment. Please try again.'),
  })

  function set<K extends keyof NewAppointmentForm>(k: K, v: NewAppointmentForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.patient_id) { setError('Please select a patient.'); return }
    createMutation.mutate(form)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#6B6B8A', marginBottom: 4, display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', height: 36,
    border: '1px solid #E0E0EF', borderRadius: 7,
    padding: '0 10px', fontSize: 13, color: '#12122C',
    background: 'white', outline: 'none',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(18,18,44,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'white', borderRadius: 12,
        width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid #E0E0EF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C' }}>New Appointment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B8A', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Patient *</label>
            <PatientTypeahead
              value={form.patient_id}
              label={form.patient_label}
              onChange={(id, lbl) => { set('patient_id', id); set('patient_label', lbl) }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Start Time *</label>
              <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Duration</label>
              <select value={form.duration} onChange={e => set('duration', Number(e.target.value))} style={inputStyle}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Provider</label>
            <select value={form.provider_id} onChange={e => set('provider_id', e.target.value)} style={inputStyle}>
              <option value="">— Select provider —</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}{p.credentials ? `, ${p.credentials}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Appointment Type</label>
            <select
              value={form.appointment_type}
              onChange={e => set('appointment_type', e.target.value as AppointmentType)}
              style={inputStyle}
            >
              {(Object.keys(APPT_TYPE_LABELS) as AppointmentType[]).map(t => (
                <option key={t} value={t}>{APPT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Office / Clinic</label>
            <select value={form.office_id} onChange={e => set('office_id', e.target.value)} style={inputStyle}>
              <option value="">— Select office —</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Chief complaint or additional notes…"
              style={{ ...inputStyle, height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36, padding: '0 16px',
                background: '#F2F2F8', border: '1px solid #E0E0EF',
                borderRadius: 7, cursor: 'pointer', fontSize: 13, color: '#12122C', fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{
                height: 36, padding: '0 20px',
                background: '#0410BD', color: 'white',
                border: 'none', borderRadius: 7,
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600, opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? 'Saving…' : 'Save Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Cancel button with confirm ───────────────────────────────────────────────

function CancelButton({ apptId }: { apptId: string }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const cancelMutation = useMutation({
    mutationFn: async () => { await api.patch(`/appointments/${apptId}`, { status: 'cancelled' }) },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['appointments'] }) },
  })

  if (confirming) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => cancelMutation.mutate()}
          style={{ height: 28, padding: '0 8px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{ height: 28, padding: '0 8px', background: '#F2F2F8', color: '#6B6B8A', border: '1px solid #E0E0EF', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      style={{
        height: 28, padding: '0 10px',
        background: 'none', color: '#6B6B8A',
        border: '1px solid #E0E0EF', borderRadius: 6, cursor: 'pointer',
        fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
      }}
    >
      <XCircle size={11} /> Cancel
    </button>
  )
}

// ─── Appointment Row ──────────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  onCheckIn,
  checkingIn,
}: {
  appt: Appointment
  onCheckIn: (appt: Appointment) => void
  checkingIn: boolean
}) {
  const navigate = useNavigate()
  const canCheckIn = appt.status === 'scheduled' || appt.status === 'confirmed'

  return (
    <tr style={{ borderBottom: '1px solid #E0E0EF' }}>
      {/* Time */}
      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>
          {formatTimeRange(appt.start_time, appt.end_time)}
        </div>
      </td>

      {/* Patient */}
      <td style={{ padding: '12px 16px' }}>
        <button
          onClick={() => navigate(`/patients/${appt.patient_id}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0410BD' }}>{appt.patient_name}</div>
          <div style={{ fontSize: 11, color: '#6B6B8A', marginTop: 1, display: 'flex', gap: 8 }}>
            {appt.patient_dob && <span>DOB {appt.patient_dob}</span>}
            {appt.patient_mrn && <span>MRN {appt.patient_mrn}</span>}
          </div>
        </button>
      </td>

      {/* Provider */}
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#12122C' }}>
        {appt.provider_name ?? <span style={{ color: '#6B6B8A' }}>—</span>}
      </td>

      {/* Type */}
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B6B8A' }}>
        {APPT_TYPE_LABELS[appt.appointment_type] ?? appt.appointment_type}
      </td>

      {/* Office */}
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B6B8A', whiteSpace: 'nowrap' }}>
        {appt.office_name ?? '—'}
      </td>

      {/* Status */}
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={appt.status} />
      </td>

      {/* Actions */}
      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          {canCheckIn && (
            <button
              onClick={() => onCheckIn(appt)}
              disabled={checkingIn}
              style={{
                height: 28, padding: '0 10px',
                background: '#0410BD', color: 'white',
                border: 'none', borderRadius: 6,
                cursor: checkingIn ? 'not-allowed' : 'pointer',
                fontSize: 12, fontWeight: 600, opacity: checkingIn ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <CheckCircle2 size={12} /> Check In
            </button>
          )}

          {appt.visit_id && (
            <button
              onClick={() => navigate(`/visits/${appt.visit_id}`)}
              style={{
                height: 28, padding: '0 10px',
                background: '#F2F2F8', color: '#0410BD',
                border: '1px solid #E0E0EF', borderRadius: 6, cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <ExternalLink size={11} /> View Visit
            </button>
          )}

          {canCheckIn && !appt.visit_id && (
            <CancelButton apptId={appt.id} />
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Nav button style (defined outside component to avoid re-creation) ────────

const navBtnStyle: React.CSSProperties = {
  height: 34, padding: '0 10px', minWidth: 34,
  background: 'white', border: '1px solid #E0E0EF',
  borderRadius: 7, cursor: 'pointer',
  fontSize: 13, color: '#12122C',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AppointmentsPage() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [providerFilter, setProviderFilter] = useState('')
  const [statusTab, setStatusTab] = useState<AppointmentStatus | 'all'>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)

  const { data: providers = [] } = useQuery<ProviderOption[]>({
    queryKey: ['providers-list'],
    queryFn: async () => {
      try {
        const res = await api.get('/providers', { params: { status: 'active', limit: 100 } })
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      } catch { return [] }
    },
    staleTime: 300_000,
  })

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['appointments', selectedDate, providerFilter],
    queryFn: async () => {
      try {
        const params: Record<string, string> = { date: selectedDate, limit: '100' }
        if (providerFilter) params.provider_id = providerFilter
        const res = await api.get('/appointments', { params })
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      } catch { return [] }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const displayed = statusTab === 'all'
    ? appointments
    : appointments.filter(a => a.status === statusTab)

  async function handleCheckIn(appt: Appointment) {
    setCheckingInId(appt.id)
    try {
      await api.patch(`/appointments/${appt.id}`, { status: 'checked_in' })
      const visitRes = await api.post('/visits', {
        patient_id: appt.patient_id,
        appointment_id: appt.id,
        visit_date: selectedDate,
        provider_id: appt.provider_id,
      })
      const visitId: string = (visitRes.data?.id as string | undefined) ?? (visitRes.data?.visit_id as string | undefined) ?? ''
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setToast(`Checked in — Visit${visitId ? ` #${visitId.slice(0, 8)}` : ''} created`)
    } catch {
      setToast('Check-in failed. Please try again.')
    } finally {
      setCheckingInId(null)
    }
  }

  function prevDay() {
    setSelectedDate(d => toDateString(subDays(parseISO(d), 1)))
  }
  function nextDay() {
    setSelectedDate(d => toDateString(addDays(parseISO(d), 1)))
  }
  function goToday() { setSelectedDate(toDateString(new Date())) }

  const isToday = selectedDate === toDateString(new Date())
  let displayDate = selectedDate
  try { displayDate = format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy') } catch { /* noop */ }

  const tabCounts = STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = t.value === 'all'
      ? appointments.length
      : appointments.filter(a => a.status === t.value).length
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Page header */}
      <div style={{
        padding: '20px 0 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #E0E0EF', marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#12122C', letterSpacing: '-0.5px' }}>
            Appointments
          </div>
          <div style={{ fontSize: 13, color: '#6B6B8A', marginTop: 2 }}>{displayDate}</div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            height: 38, padding: '0 18px',
            background: '#0410BD', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, fontWeight: 600,
          }}
        >
          <Plus size={15} /> New Appointment
        </button>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={prevDay} style={navBtnStyle}>
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            style={{
              ...navBtnStyle,
              background: isToday ? '#0410BD' : 'white',
              color: isToday ? 'white' : '#12122C',
              borderColor: isToday ? '#0410BD' : '#E0E0EF',
              fontWeight: 500,
            }}
          >
            Today
          </button>
          <button onClick={nextDay} style={navBtnStyle}>
            <ChevronRight size={16} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              height: 34, padding: '0 10px',
              border: '1px solid #E0E0EF', borderRadius: 7,
              fontSize: 13, color: '#12122C', background: 'white', cursor: 'pointer',
            }}
          />
        </div>

        {/* Provider filter */}
        <select
          value={providerFilter}
          onChange={e => setProviderFilter(e.target.value)}
          style={{
            height: 34, padding: '0 10px',
            border: '1px solid #E0E0EF', borderRadius: 7,
            fontSize: 13, color: '#12122C', background: 'white', minWidth: 180,
          }}
        >
          <option value="">All Providers</option>
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </select>

        <div style={{ fontSize: 12, color: '#6B6B8A', marginLeft: 'auto' }}>
          {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Status tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #E0E0EF',
        overflowX: 'auto',
      }}>
        {STATUS_TABS.map(tab => {
          const active = statusTab === tab.value
          const count = tabCounts[tab.value] ?? 0
          return (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              style={{
                padding: '10px 16px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#0410BD' : '#6B6B8A',
                borderBottom: active ? '2px solid #0410BD' : '2px solid transparent',
                marginBottom: -2, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 99,
                  background: active ? '#0410BD' : '#F2F2F8',
                  color: active ? 'white' : '#6B6B8A',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{
        background: 'white', border: '1px solid #E0E0EF',
        borderTop: 'none', borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
        overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#6B6B8A' }}>Loading appointments…</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <Calendar size={36} style={{ color: '#E0E0EF', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#12122C' }}>
              {statusTab !== 'all'
                ? `No "${STATUS_LABELS[statusTab as AppointmentStatus]}" appointments`
                : 'No appointments for this day'}
            </div>
            <div style={{ fontSize: 13, color: '#6B6B8A', marginTop: 6 }}>
              Click "New Appointment" to schedule one.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr style={{ background: '#F2F2F8' }}>
                  {['Time', 'Patient', 'Provider', 'Type', 'Office', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: '#6B6B8A',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '1px solid #E0E0EF',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(appt => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onCheckIn={handleCheckIn}
                    checkingIn={checkingInId === appt.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Appointment Modal */}
      {showNewModal && (
        <NewAppointmentModal
          initialDate={selectedDate}
          onClose={() => setShowNewModal(false)}
          onCreated={() => { setShowNewModal(false); setToast('Appointment created') }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
