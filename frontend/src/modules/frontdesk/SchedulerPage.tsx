import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Search, User,
} from 'lucide-react'
import { apiClient } from '../../services/api'
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay,
  parseISO, setHours, setMinutes, differenceInMinutes,
} from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string
  patient_id: string
  patient_name: string
  provider_name: string
  appointment_type: AppointmentType
  start_time: string
  end_time: string
  status: string
  chief_complaint?: string
}

type AppointmentType = 'office_visit' | 'new_patient' | 'follow_up' | 'telehealth' | 'procedure'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  mrn: string
  phone?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APPT_COLORS: Record<AppointmentType, { bg: string; border: string; text: string; dot: string }> = {
  office_visit: { bg: '#EFF0FF', border: '#A5B4FC', text: '#3730A3', dot: '#0410BD' },
  new_patient:  { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', dot: '#16A34A' },
  follow_up:    { bg: '#F5F3FF', border: '#C4B5FD', text: '#4C1D95', dot: '#7C3AED' },
  telehealth:   { bg: '#F0FDFA', border: '#99F6E4', text: '#134E4A', dot: '#0D9488' },
  procedure:    { bg: '#FFF7ED', border: '#FED7AA', text: '#7C2D12', dot: '#EA580C' },
}

const APPT_TYPE_LABELS: Record<AppointmentType, string> = {
  office_visit: 'Office Visit',
  new_patient: 'New Patient',
  follow_up: 'Follow-Up',
  telehealth: 'Telehealth',
  procedure: 'Procedure',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  scheduled: { bg: '#F3F4F6', color: '#6B7280' },
  confirmed: { bg: '#EFF0FF', color: '#0410BD' },
  checked_in: { bg: '#ECFDF5', color: '#16A34A' },
  roomed: { bg: '#FFF7ED', color: '#D97706' },
  in_exam: { bg: '#FFF1F2', color: '#BE185D' },
  checked_out: { bg: '#F0FDF4', color: '#166534' },
  no_show: { bg: '#FEF2F2', color: '#DC2626' },
  cancelled: { bg: '#F9FAFB', color: '#9CA3AF' },
}

interface Provider { id: string; name: string }

// Grid constants
const HOUR_START = 7   // 7am
const HOUR_END   = 19  // 7pm
const SLOT_HEIGHT = 48 // px per 30 min slot

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToTop(date: Date): number {
  const mins = (date.getHours() - HOUR_START) * 60 + date.getMinutes()
  return Math.max(0, (mins / 30) * SLOT_HEIGHT)
}

function timeToHeight(start: Date, end: Date): number {
  const mins = Math.max(30, differenceInMinutes(end, start))
  return (mins / 30) * SLOT_HEIGHT
}

function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

function slotTimes(): { label: string; hour: number; min: number }[] {
  const slots = []
  for (let h = HOUR_START; h < HOUR_END; h++) {
    slots.push({ label: format(setMinutes(setHours(new Date(), h), 0), 'h:mm a'), hour: h, min: 0 })
    slots.push({ label: format(setMinutes(setHours(new Date(), h), 30), 'h:mm a'), hour: h, min: 30 })
  }
  return slots
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppointmentBlock({
  appt,
  onClick,
  dayIndex: _dayIndex,
}: {
  appt: Appointment
  onClick: (appt: Appointment, e: React.MouseEvent) => void
  dayIndex: number
}) {
  const start = appt.start_time ? parseISO(appt.start_time) : new Date()
  const end = appt.end_time ? parseISO(appt.end_time) : new Date(start.getTime() + 30 * 60000)
  const top = timeToTop(start)
  const height = timeToHeight(start, end)
  const colors = APPT_COLORS[appt.appointment_type] ?? APPT_COLORS.office_visit
  const isShort = height <= SLOT_HEIGHT

  return (
    <button
      onClick={e => onClick(appt, e)}
      title={`${appt.patient_name} — ${APPT_TYPE_LABELS[appt.appointment_type]}`}
      style={{
        position: 'absolute',
        top: top + 1,
        left: 2,
        right: 2,
        height: height - 2,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderLeft: `3px solid ${colors.dot}`,
        borderRadius: 5,
        padding: isShort ? '2px 6px' : '4px 7px',
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.95)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
    >
      <div style={{ fontSize: isShort ? 10 : 11, fontWeight: 700, color: colors.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {appt.patient_name}
      </div>
      {!isShort && (
        <div style={{ fontSize: 10, color: colors.text, opacity: 0.75, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {appt.start_time ? format(start, 'h:mm') : '—'} · {APPT_TYPE_LABELS[appt.appointment_type]}
        </div>
      )}
    </button>
  )
}

function AppointmentPopover({
  appt,
  anchorRect,
  onClose,
  onStatusChange,
}: {
  appt: Appointment
  anchorRect: DOMRect
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const colors = APPT_COLORS[appt.appointment_type] ?? APPT_COLORS.office_visit
  const statusCol = STATUS_COLORS[appt.status] ?? STATUS_COLORS.scheduled

  // Position to the right of the block, or left if not enough room
  const left = anchorRect.right + 8
  const top = Math.min(anchorRect.top, window.innerHeight - 280)

  return (
    <div
      style={{
        position: 'fixed', top, left, zIndex: 1000,
        background: 'white', border: '1px solid #E0E0EF', borderRadius: 10,
        boxShadow: '0 8px 32px rgba(18,18,44,0.14)', width: 260, padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#12122C' }}>{appt.patient_name}</div>
          <div style={{ fontSize: 11, color: '#676687', marginTop: 1 }}>
            {appt.start_time ? format(parseISO(appt.start_time), 'h:mm a') : '—'} – {appt.end_time ? format(parseISO(appt.end_time), 'h:mm a') : '—'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
          {APPT_TYPE_LABELS[appt.appointment_type]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: statusCol.bg, color: statusCol.color }}>
          {appt.status.replace('_', ' ')}
        </span>
      </div>

      {appt.chief_complaint && (
        <div style={{ fontSize: 12, color: '#676687', marginBottom: 10, background: '#F2F2F8', borderRadius: 6, padding: '6px 8px' }}>
          {appt.chief_complaint}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
        Quick Update
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {['checked_in', 'roomed', 'in_exam', 'checked_out', 'no_show', 'cancelled'].map(s => (
          <button
            key={s}
            onClick={() => { onStatusChange(appt.id, s); onClose() }}
            disabled={appt.status === s}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6,
              border: `1px solid ${appt.status === s ? STATUS_COLORS[s]?.color ?? '#9CA3AF' : '#E0E0EF'}`,
              background: appt.status === s ? (STATUS_COLORS[s]?.bg ?? '#F3F4F6') : 'white',
              color: appt.status === s ? (STATUS_COLORS[s]?.color ?? '#374151') : '#374151',
              cursor: appt.status === s ? 'default' : 'pointer',
            }}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}

interface NewApptForm {
  patientSearch: string
  patientId: string
  patientName: string
  providerId: string
  appointmentType: AppointmentType
  date: string
  startTime: string
  duration: 30 | 45 | 60
  chiefComplaint: string
}

function NewAppointmentModal({
  prefillDate,
  prefillTime,
  onClose,
  onCreated,
  providers,
}: {
  prefillDate?: string
  prefillTime?: string
  onClose: () => void
  onCreated: () => void
  providers: Provider[]
}) {
  const defaultProviderId = providers[0]?.id ?? ''
  const [form, setForm] = useState<NewApptForm>({
    patientSearch: '',
    patientId: '',
    patientName: '',
    providerId: defaultProviderId,
    appointmentType: 'office_visit',
    date: prefillDate ?? format(new Date(), 'yyyy-MM-dd'),
    startTime: prefillTime ?? '09:00',
    duration: 30,
    chiefComplaint: '',
  })
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const [error, setError] = useState('')
  const patientRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(form.patientSearch), 300)
    return () => clearTimeout(t)
  }, [form.patientSearch])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: patients, isFetching: searchingPatients } = useQuery<Patient[]>({
    queryKey: ['modal-patient-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return []
      try {
        const res = await apiClient.get('/patients', { params: { search: debouncedSearch, limit: 8 } })
        return Array.isArray(res.data) ? res.data : res.data?.items ?? []
      } catch { return [] }
    },
    enabled: debouncedSearch.length >= 2,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.date || !form.startTime) throw new Error('Date and time are required')
      const startDt = new Date(`${form.date}T${form.startTime}:00`)
      if (isNaN(startDt.getTime())) throw new Error('Invalid date/time')
      const endDt = new Date(startDt.getTime() + form.duration * 60 * 1000)
      await apiClient.post('/appointments', {
        patient_id: form.patientId,
        provider_id: form.providerId,
        appointment_type: form.appointmentType,
        start_time: startDt.toISOString(),
        end_time: endDt.toISOString(),
        chief_complaint: form.chiefComplaint || undefined,
      })
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: () => setError('Failed to create appointment. Please try again.'),
  })

  function set<K extends keyof NewApptForm>(key: K, val: NewApptForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #E0E0EF', borderRadius: 8,
    padding: '8px 11px', fontSize: 13, color: '#12122C',
    outline: 'none', background: '#F2F2F8', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase',
    letterSpacing: '0.04em', display: 'block', marginBottom: 5,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(18,18,44,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 480,
        margin: '0 16px', boxShadow: '0 20px 60px rgba(18,18,44,0.2)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #E0E0EF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#12122C' }}>New Appointment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Patient search */}
          <div>
            <label style={labelStyle}>Patient</label>
            <div ref={patientRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #E0E0EF', borderRadius: 8, padding: '0 11px', background: form.patientId ? '#EFF0FF' : '#F2F2F8' }}>
                {form.patientId ? <User size={13} style={{ color: '#0410BD', flexShrink: 0 }} /> : <Search size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} />}
                <input
                  value={form.patientSearch}
                  onChange={e => { set('patientSearch', e.target.value); set('patientId', ''); setShowPatientDropdown(true) }}
                  onFocus={() => form.patientSearch.length >= 2 && setShowPatientDropdown(true)}
                  placeholder="Search by name or MRN…"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#12122C', padding: '9px 0' }}
                  autoComplete="off"
                />
                {searchingPatients && <div style={{ width: 12, height: 12, border: '2px solid #E0E0EF', borderTopColor: '#0410BD', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
              </div>
              {showPatientDropdown && patients && patients.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #E0E0EF', borderRadius: 8, marginTop: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  {patients.map(p => (
                    <button key={p.id} onClick={() => { set('patientId', p.id); set('patientName', `${p.first_name} ${p.last_name}`); set('patientSearch', `${p.first_name} ${p.last_name}`); setShowPatientDropdown(false) }}
                      style={{ width: '100%', padding: '9px 12px', background: 'white', border: 'none', borderBottom: '1px solid #F2F2F8', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <User size={13} style={{ color: '#0410BD', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#12122C' }}>{p.first_name} {p.last_name}</div>
                        <div style={{ fontSize: 11, color: '#676687' }}>DOB: {format(new Date(p.date_of_birth), 'MM/dd/yyyy')} · {p.mrn}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Provider + Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Provider</label>
              <select value={form.providerId} onChange={e => set('providerId', e.target.value)} style={inputStyle}>
                {providers.length > 0
                  ? providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                  : <option value="">No providers available</option>
                }
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.appointmentType} onChange={e => set('appointmentType', e.target.value as AppointmentType)} style={inputStyle}>
                {(Object.entries(APPT_TYPE_LABELS) as [AppointmentType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Time + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Duration</label>
              <select value={form.duration} onChange={e => set('duration', parseInt(e.target.value) as 30 | 45 | 60)} style={inputStyle}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          {/* Chief complaint */}
          <div>
            <label style={labelStyle}>Chief Complaint <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              value={form.chiefComplaint}
              onChange={e => set('chiefComplaint', e.target.value)}
              placeholder="e.g. Annual physical, follow-up on labs…"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '9px 12px', fontSize: 12, color: '#DC2626' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 40, background: 'white', border: '1px solid #E0E0EF', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Cancel
            </button>
            <button
              onClick={() => { void createMutation.mutateAsync() }}
              disabled={!form.patientId || createMutation.isPending}
              style={{
                flex: 2, height: 40, background: !form.patientId ? '#E0E0EF' : '#0410BD',
                color: !form.patientId ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8,
                cursor: !form.patientId ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {createMutation.isPending ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Scheduling…
                </>
              ) : (
                'Schedule Appointment'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SchedulerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const today = new Date()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }))
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null)
  const [popover, setPopover] = useState<{ appt: Appointment; rect: DOMRect } | null>(null)
  const [singleDayMode, setSingleDayMode] = useState(false)
  const [activeDayIndex, setActiveDayIndex] = useState(() => {
    const d = today.getDay()
    return d === 0 ? 6 : d - 1 // Mon=0
  })

  const days = weekDays(weekStart)
  const slots = slotTimes()

  const dateFrom = format(days[0], 'yyyy-MM-dd')
  const dateTo = format(days[6], 'yyyy-MM-dd')

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/providers', { params: { limit: 100 } })
        const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
        return items.map((p: { id: string; first_name?: string; last_name?: string; full_name?: string }) => ({
          id: p.id,
          name: p.full_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        }))
      } catch { return [] }
    },
    staleTime: 5 * 60_000,
  })

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments-week', dateFrom, dateTo],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/appointments', { params: { date_from: dateFrom, date_to: dateTo, limit: 500 } })
        return Array.isArray(res.data) ? res.data : res.data?.items ?? []
      } catch { return [] }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/appointments/${id}`, { status })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['appointments-week', dateFrom, dateTo] }),
  })

  // Detect small screens
  useEffect(() => {
    function check() { setSingleDayMode(window.innerWidth < 640) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function apptsByDay(day: Date): Appointment[] {
    return appointments.filter(a => {
      try { return isSameDay(parseISO(a.start_time), day) } catch { return false }
    })
  }

  function handleSlotClick(day: Date, hour: number, min: number) {
    setSelectedSlot({
      date: format(day, 'yyyy-MM-dd'),
      time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    })
    setPopover(null)
  }

  function handleApptClick(appt: Appointment, e: React.MouseEvent) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopover({ appt, rect })
  }

  const displayDays = singleDayMode ? [days[activeDayIndex]] : days

  const totalRows = (HOUR_END - HOUR_START) * 2 // 30-min slots
  const gridHeight = totalRows * SLOT_HEIGHT

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/frontdesk')}
          style={{ width: 34, height: 34, borderRadius: 8, background: 'white', border: '1px solid #E0E0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B6B8A', flexShrink: 0 }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#12122C', letterSpacing: '-0.4px' }}>Scheduler</div>
          <div style={{ fontSize: 13, color: '#676687', marginTop: 1 }}>
            {format(days[0], 'MMM d')} – {format(days[6], 'MMM d, yyyy')}
          </div>
        </div>
        {/* Week nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} style={{ width: 32, height: 32, borderRadius: 7, background: 'white', border: '1px solid #E0E0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B6B8A' }}>
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }))}
            style={{ height: 32, padding: '0 12px', background: isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 })) ? '#0410BD' : 'white', color: isSameDay(weekStart, startOfWeek(today, { weekStartsOn: 1 })) ? 'white' : '#374151', border: '1px solid #E0E0EF', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Today
          </button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} style={{ width: 32, height: 32, borderRadius: 7, background: 'white', border: '1px solid #E0E0EF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B6B8A' }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={() => setSelectedSlot({ date: format(today, 'yyyy-MM-dd'), time: '09:00' })}
          style={{ height: 34, padding: '0 14px', background: '#0410BD', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Single-day tabs on mobile */}
      {singleDayMode && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
          {days.map((d, i) => {
            const isToday = isSameDay(d, today)
            const isActive = i === activeDayIndex
            return (
              <button key={i} onClick={() => setActiveDayIndex(i)} style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 7, border: '1px solid #E0E0EF',
                background: isActive ? '#0410BD' : isToday ? '#EFF0FF' : 'white',
                color: isActive ? 'white' : isToday ? '#0410BD' : '#374151',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                {format(d, 'EEE d')}
              </button>
            )
          })}
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ background: 'white', border: '1px solid #E0E0EF', borderRadius: 10, overflow: 'hidden', flex: 1 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)`, borderBottom: '1px solid #E0E0EF' }}>
          <div style={{ padding: '8px 0', borderRight: '1px solid #E0E0EF' }} />
          {displayDays.map((d, i) => {
            const isToday = isSameDay(d, today)
            return (
              <div key={i} style={{
                padding: '8px 6px', textAlign: 'center',
                background: isToday ? '#EFF0FF' : 'white',
                borderRight: i < displayDays.length - 1 ? '1px solid #E0E0EF' : 'none',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#0410BD' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {format(d, 'EEE')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? '#0410BD' : '#12122C', lineHeight: 1.3 }}>
                  {format(d, 'd')}
                </div>
              </div>
            )
          })}
        </div>

        {/* Scrollable time grid */}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${displayDays.length}, 1fr)`, position: 'relative' }}>
            {/* Time labels */}
            <div style={{ borderRight: '1px solid #E0E0EF', position: 'relative', height: gridHeight }}>
              {slots.map((s, i) => (
                <div key={i} style={{
                  position: 'absolute', top: i * SLOT_HEIGHT - 7, left: 0, right: 0,
                  padding: '0 6px', textAlign: 'right',
                }}>
                  {s.min === 0 && (
                    <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {s.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {displayDays.map((day, di) => {
              const isToday = isSameDay(day, today)
              const dayAppts = apptsByDay(day)
              return (
                <div
                  key={di}
                  style={{
                    position: 'relative', height: gridHeight,
                    background: isToday ? 'rgba(4,16,189,0.015)' : 'white',
                    borderRight: di < displayDays.length - 1 ? '1px solid #E0E0EF' : 'none',
                  }}
                >
                  {/* Slot rows (clickable) */}
                  {slots.map((s, si) => (
                    <div
                      key={si}
                      onClick={() => handleSlotClick(day, s.hour, s.min)}
                      style={{
                        position: 'absolute', top: si * SLOT_HEIGHT, left: 0, right: 0,
                        height: SLOT_HEIGHT,
                        borderBottom: `1px solid ${s.min === 0 ? '#E0E0EF' : '#F2F2F8'}`,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(4,16,189,0.03)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isToday && (() => {
                    const now = new Date()
                    const top = timeToTop(now)
                    if (top < 0 || top > gridHeight) return null
                    return (
                      <div style={{ position: 'absolute', left: 0, right: 0, top, zIndex: 3, pointerEvents: 'none' }}>
                        <div style={{ height: 2, background: '#DC2626', position: 'relative' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', position: 'absolute', left: 0, top: -3 }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Appointments */}
                  {dayAppts.map(appt => (
                    <AppointmentBlock key={appt.id} appt={appt} onClick={handleApptClick} dayIndex={di} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>TYPE</span>
        {(Object.entries(APPT_COLORS) as [AppointmentType, typeof APPT_COLORS[AppointmentType]][]).map(([type, c]) => (
          <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.dot, display: 'inline-block' }} />
            {APPT_TYPE_LABELS[type]}
          </span>
        ))}
      </div>

      {/* Popover */}
      {popover && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setPopover(null)} />
          <AppointmentPopover
            appt={popover.appt}
            anchorRect={popover.rect}
            onClose={() => setPopover(null)}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          />
        </>
      )}

      {/* New appointment modal */}
      {selectedSlot && (
        <NewAppointmentModal
          prefillDate={selectedSlot.date}
          prefillTime={selectedSlot.time}
          onClose={() => setSelectedSlot(null)}
          onCreated={() => void queryClient.invalidateQueries({ queryKey: ['appointments-week', dateFrom, dateTo] })}
          providers={providers}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
