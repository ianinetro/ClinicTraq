import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, CheckCircle2, Clock, Calendar, Search,
  AlertCircle, ArrowRight, RefreshCw, Stethoscope,
  LogIn, ChevronRight,
} from 'lucide-react'
import { apiClient as api } from '../../services/api'
import { format } from 'date-fns'

interface Appointment {
  id: string
  patient_name: string
  patient_id: string
  provider_name: string
  appointment_type: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'roomed' | 'in_exam' | 'checked_out' | 'no_show' | 'cancelled'
  phone?: string
  insurance?: string
  chief_complaint?: string
}

interface Schedule {
  appointments: Appointment[]
  date: string
}

const STATUS_LABELS: Record<Appointment['status'], string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  roomed: 'Roomed',
  in_exam: 'In Exam',
  checked_out: 'Checked Out',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<Appointment['status'], { bg: string; color: string }> = {
  scheduled: { bg: '#F3F4F6', color: '#6B7280' },
  confirmed: { bg: '#EFF0FF', color: '#0410BD' },
  checked_in: { bg: '#ECFDF5', color: '#16A34A' },
  roomed: { bg: '#FFF7ED', color: '#D97706' },
  in_exam: { bg: '#FFF1F2', color: '#BE185D' },
  checked_out: { bg: '#F0FDF4', color: '#166534' },
  no_show: { bg: '#FEF2F2', color: '#DC2626' },
  cancelled: { bg: '#F9FAFB', color: '#9CA3AF' },
}

const NEXT_STATUS: Partial<Record<Appointment['status'], Appointment['status']>> = {
  scheduled: 'checked_in',
  confirmed: 'checked_in',
  checked_in: 'roomed',
  roomed: 'in_exam',
  in_exam: 'checked_out',
}

const NEXT_LABEL: Partial<Record<Appointment['status'], string>> = {
  scheduled: 'Check In',
  confirmed: 'Check In',
  checked_in: 'Room Patient',
  roomed: 'Start Exam',
  in_exam: 'Check Out',
}

function useSchedule(date: string) {
  return useQuery<Schedule>({
    queryKey: ['schedule', date],
    queryFn: async () => {
      try {
        const res = await api.get('/appointments', { params: { date, limit: 100 } })
        const items = Array.isArray(res.data) ? res.data : res.data?.items ?? []
        return { appointments: items, date }
      } catch {
        return { appointments: [], date }
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

function StatusBadge({ status }: { status: Appointment['status'] }) {
  const { bg, color } = STATUS_COLORS[status]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: bg, color }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function AppointmentRow({ appt, onAdvance }: { appt: Appointment; onAdvance: (id: string, status: Appointment['status']) => void }) {
  const navigate = useNavigate()
  const nextStatus = NEXT_STATUS[appt.status]
  const nextLabel = NEXT_LABEL[appt.status]

  return (
    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>
          {format(new Date(appt.start_time), 'h:mm a')}
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
          {format(new Date(appt.end_time), 'h:mm a')}
        </div>
      </td>
      <td style={{ padding: '10px 16px' }}>
        <button
          onClick={() => navigate(`/patients/${appt.patient_id}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0410BD' }}>{appt.patient_name}</div>
          {appt.phone && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{appt.phone}</div>}
        </button>
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: '#374151' }}>{appt.provider_name}</td>
      <td style={{ padding: '10px 16px', fontSize: 12, color: '#6B7280' }}>{appt.appointment_type}</td>
      <td style={{ padding: '10px 16px' }}>
        {appt.insurance && <span style={{ fontSize: 11, color: '#6B7280' }}>{appt.insurance}</span>}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <StatusBadge status={appt.status} />
      </td>
      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
        {nextStatus && nextLabel && (
          <button
            onClick={() => onAdvance(appt.id, nextStatus)}
            style={{
              height: 30, padding: '0 10px', background: '#0410BD', color: 'white',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
          >
            {nextLabel} <ChevronRight size={12} />
          </button>
        )}
      </td>
    </tr>
  )
}

function RoomingQueue({ appointments }: { appointments: Appointment[] }) {
  const waiting = appointments.filter(a => a.status === 'checked_in')
  return (
    <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #E3E3F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#12122C', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={15} style={{ color: '#D97706' }} />
          Rooming Queue
        </div>
        <span style={{ fontSize: 12, background: waiting.length > 0 ? '#FFF7ED' : '#F3F4F6', color: waiting.length > 0 ? '#D97706' : '#9CA3AF', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>
          {waiting.length} waiting
        </span>
      </div>
      {waiting.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No patients waiting to be roomed</div>
      ) : (
        <div>
          {waiting.map(a => (
            <div key={a.id} style={{ padding: '10px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>{a.patient_name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {format(new Date(a.start_time), 'h:mm a')} · {a.appointment_type}
                  {a.chief_complaint && ` · ${a.chief_complaint}`}
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#D97706' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function FrontDeskDashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const { data, isLoading, refetch, isFetching } = useSchedule(today)

  const appointments = data?.appointments ?? []

  const advanceMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/appointments/${id}`, { status })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedule', today] })
    },
  })

  const filtered = appointments.filter(a =>
    !search || a.patient_name.toLowerCase().includes(search.toLowerCase()) || a.provider_name.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    scheduled: appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length,
    checked_in: appointments.filter(a => a.status === 'checked_in').length,
    in_exam: appointments.filter(a => ['roomed', 'in_exam'].includes(a.status)).length,
    checked_out: appointments.filter(a => a.status === 'checked_out').length,
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#12122C', letterSpacing: '-0.5px' }}>Front Desk</div>
          <div style={{ fontSize: 13, color: '#676687', marginTop: 2 }}>{format(new Date(today), 'EEEE, MMMM d, yyyy')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => refetch()}
            style={{ height: 36, padding: '0 12px', background: 'white', border: '1px solid #E3E3F1', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#374151' }}
          >
            <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => navigate('/patients/new')}
            style={{ height: 36, padding: '0 16px', background: '#0410BD', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          >
            <UserPlus size={14} /> Walk-In
          </button>
          <button
            onClick={() => navigate('/frontdesk/schedule')}
            style={{ height: 36, padding: '0 16px', background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
          >
            <Calendar size={14} /> Schedule
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: '#0410BD', bg: '#EFF0FF' },
          { label: 'Checked In', value: stats.checked_in, icon: LogIn, color: '#16A34A', bg: '#ECFDF5' },
          { label: 'In Exam', value: stats.in_exam, icon: Stethoscope, color: '#D97706', bg: '#FFF7ED' },
          { label: 'Checked Out', value: stats.checked_out, icon: CheckCircle2, color: '#6B7280', bg: '#F3F4F6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#12122C' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#676687' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        {/* Main schedule table */}
        <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E3E3F1', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Search size={14} style={{ color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient or provider…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#12122C' }}
            />
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filtered.length} appointments</span>
          </div>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading schedule…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Calendar size={32} style={{ color: '#E3E3F1', margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>No appointments today</div>
              <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Use the Schedule button to add appointments</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Time', 'Patient', 'Provider', 'Type', 'Insurance', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E3E3F1' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <AppointmentRow
                    key={a.id}
                    appt={a}
                    onAdvance={(id, status) => advanceMutation.mutate({ id, status })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RoomingQueue appointments={appointments} />

          {/* Quick actions */}
          <div style={{ background: 'white', border: '1px solid #E3E3F1', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#12122C', marginBottom: 12 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'New Patient', icon: UserPlus, action: () => navigate('/patients/new') },
                { label: 'Find Patient', icon: Search, action: () => navigate('/patients') },
                { label: 'New Visit', icon: Stethoscope, action: () => navigate('/visits/new') },
                { label: 'New Claim', icon: AlertCircle, action: () => navigate('/claims/new') },
              ].map(qa => (
                <button
                  key={qa.label}
                  onClick={qa.action}
                  style={{
                    height: 36, padding: '0 12px', background: '#F9FAFB', color: '#374151',
                    border: '1px solid #E3E3F1', borderRadius: 7, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500,
                    textAlign: 'left',
                  }}
                >
                  <qa.icon size={14} style={{ color: '#9CA3AF' }} />
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
