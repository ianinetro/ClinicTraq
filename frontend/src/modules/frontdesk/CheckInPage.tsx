import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Search, User, Calendar, CreditCard, CheckCircle2,
  Printer, AlertCircle, Clock, ShieldCheck, X,
} from 'lucide-react'
import { apiClient } from '../../services/api'
import { format } from 'date-fns'

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  mrn: string
  phone?: string
  primary_insurance?: string
}

interface Appointment {
  id: string
  patient_id: string
  patient_name: string
  provider_name: string
  appointment_type: string
  start_time: string
  end_time: string
  status: string
  chief_complaint?: string
  copay_amount?: number
}

const APPT_TYPE_LABELS: Record<string, string> = {
  office_visit: 'Office Visit',
  new_patient: 'New Patient',
  follow_up: 'Follow-Up',
  telehealth: 'Telehealth',
  procedure: 'Procedure',
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info' | 'error'; onClose: () => void }) {
  const colors = {
    success: { bg: '#ECFDF5', border: '#BBF7D0', color: '#16A34A', Icon: CheckCircle2 },
    info: { bg: '#EFF0FF', border: '#C7D2FE', color: '#0410BD', Icon: AlertCircle },
    error: { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', Icon: AlertCircle },
  }
  const { bg, border, color, Icon } = colors[type]
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      background: bg, border: `1px solid ${border}`, borderRadius: 10,
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 280, maxWidth: 380,
    }}>
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#12122C', flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  )
}

function PatientCard({ patient }: { patient: Patient }) {
  const age = patient.date_of_birth ? Math.floor(
    (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  ) : null
  return (
    <div style={{
      background: '#EFF0FF', border: '1px solid #C7D2FE', borderRadius: 10,
      padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: '#0410BD',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <User size={20} style={{ color: 'white' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#12122C', marginBottom: 2 }}>
          {patient.first_name} {patient.last_name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          <span style={{ fontSize: 12, color: '#676687' }}>DOB: {patient.date_of_birth ? format(new Date(patient.date_of_birth), 'MM/dd/yyyy') : '—'}{age !== null ? ` (${age} yrs)` : ''}</span>
          <span style={{ fontSize: 12, color: '#676687' }}>MRN: <strong style={{ color: '#12122C' }}>{patient.mrn}</strong></span>
          {patient.phone && <span style={{ fontSize: 12, color: '#676687' }}>{patient.phone}</span>}
        </div>
        {patient.primary_insurance && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheck size={12} style={{ color: '#16A34A' }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{patient.primary_insurance}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function CheckInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [copayAmount, setCopayAmount] = useState('')
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'check'>('card')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkedInAppt, setCheckedInAppt] = useState<Appointment | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: searchResults, isFetching: isSearching } = useQuery<Patient[]>({
    queryKey: ['patient-search', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return []
      try {
        const res = await apiClient.get('/patients', { params: { search: debouncedSearch, limit: 8 } })
        return Array.isArray(res.data) ? res.data : res.data?.items ?? []
      } catch { return [] }
    },
    enabled: debouncedSearch.length >= 2,
  })

  const { data: todayAppointments, isLoading: loadingAppts } = useQuery<Appointment[]>({
    queryKey: ['patient-appointments-today', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient) return []
      try {
        const res = await apiClient.get('/appointments', {
          params: { date: today, patient_id: selectedPatient.id },
        })
        return Array.isArray(res.data) ? res.data : res.data?.items ?? []
      } catch { return [] }
    },
    enabled: !!selectedPatient,
  })

  const appointment = todayAppointments?.[0] ?? null

  const checkInMutation = useMutation({
    mutationFn: async (apptId: string) => {
      await apiClient.patch(`/appointments/${apptId}`, { status: 'checked_in' })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['schedule', today] })
    },
  })

  const paymentMutation = useMutation({
    mutationFn: async (data: { patient_id: string; payment_type: string; amount: number; payment_date: string }) => {
      await apiClient.post('/payments', data)
    },
  })

  async function handleCheckIn() {
    if (!appointment || !selectedPatient) return
    try {
      await checkInMutation.mutateAsync(appointment.id)
      if (copayAmount && parseFloat(copayAmount) > 0) {
        await paymentMutation.mutateAsync({
          patient_id: selectedPatient.id,
          payment_type: paymentType,
          amount: parseFloat(copayAmount),
          payment_date: today,
        })
      }
      setCheckedIn(true)
      setCheckedInAppt(appointment)
    } catch {
      setToast({ message: 'Check-in failed. Please try again.', type: 'error' })
    }
  }

  function handleSelectPatient(p: Patient) {
    setSelectedPatient(p)
    setSearchTerm(`${p.first_name} ${p.last_name}`)
    setShowDropdown(false)
  }

  function handleReset() {
    setCheckedIn(false)
    setCheckedInAppt(null)
    setSelectedPatient(null)
    setSearchTerm('')
    setCopayAmount('')
    setPaymentType('card')
  }

  const isCheckedInAlready = appointment?.status === 'checked_in'
  const canCheckIn = !!appointment && !isCheckedInAlready && appointment.status !== 'checked_out'

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/frontdesk')}
          style={{
            width: 34, height: 34, borderRadius: 8, background: 'white',
            border: '1px solid #E0E0EF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: '#6B6B8A',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#12122C', letterSpacing: '-0.4px' }}>Patient Check-In</div>
          <div style={{ fontSize: 13, color: '#676687', marginTop: 1 }}>
            {format(new Date(), 'EEEE, MMMM d · h:mm a')}
          </div>
        </div>
      </div>

      {/* Success confirmation */}
      {checkedIn && checkedInAppt && selectedPatient ? (
        <div style={{
          background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 12,
          padding: '32px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#16A34A',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <CheckCircle2 size={28} style={{ color: 'white' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#12122C', marginBottom: 4 }}>
            Check-In Complete
          </div>
          <div style={{ fontSize: 15, color: '#374151', marginBottom: 2 }}>
            {selectedPatient.first_name} {selectedPatient.last_name}
          </div>
          <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600, marginBottom: 24 }}>
            {checkedInAppt.start_time ? format(new Date(checkedInAppt.start_time), 'h:mm a') : '—'} — {APPT_TYPE_LABELS[checkedInAppt.appointment_type] ?? checkedInAppt.appointment_type}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setToast({ message: 'Printing encounter form…', type: 'info' })}
              style={{
                height: 38, padding: '0 18px', background: 'white', color: '#374151',
                border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
              }}
            >
              <Printer size={14} /> Print Encounter Form
            </button>
            <button
              onClick={handleReset}
              style={{
                height: 38, padding: '0 18px', background: '#0410BD', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              Check In Another Patient
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Search */}
          <div style={{ background: 'white', border: '1px solid #E0E0EF', borderRadius: 10, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#12122C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={14} style={{ color: '#0410BD' }} />
              Find Patient
            </div>
            <div ref={searchRef} style={{ position: 'relative' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                border: '1px solid #E0E0EF', borderRadius: 8, padding: '0 12px',
                background: '#F2F2F8',
              }}>
                <Search size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                <input
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value)
                    setShowDropdown(true)
                    if (!e.target.value) setSelectedPatient(null)
                  }}
                  onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
                  placeholder="Search by name, phone, or date of birth…"
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 14, color: '#12122C', padding: '10px 0',
                  }}
                  autoComplete="off"
                />
                {isSearching && (
                  <div style={{
                    width: 14, height: 14, border: '2px solid #E0E0EF', borderTopColor: '#0410BD',
                    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                  }} />
                )}
              </div>
              {showDropdown && searchResults && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'white', border: '1px solid #E0E0EF', borderRadius: 8,
                  marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden',
                }}>
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      style={{
                        width: '100%', padding: '10px 14px', background: 'white',
                        border: 'none', borderBottom: '1px solid #F2F2F8', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F2F2F8')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', background: '#EFF0FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <User size={14} style={{ color: '#0410BD' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>
                          {p.first_name} {p.last_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#676687' }}>
                          DOB: {p.date_of_birth ? format(new Date(p.date_of_birth), 'MM/dd/yyyy') : '—'} · MRN: {p.mrn}
                          {p.phone && ` · ${p.phone}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && debouncedSearch.length >= 2 && !isSearching && searchResults?.length === 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'white', border: '1px solid #E0E0EF', borderRadius: 8,
                  marginTop: 4, padding: '16px', textAlign: 'center', color: '#676687', fontSize: 13,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                }}>
                  No patients found for "{debouncedSearch}"
                </div>
              )}
            </div>
          </div>

          {/* Patient card */}
          {selectedPatient && (
            <PatientCard patient={selectedPatient} />
          )}

          {/* Appointment section */}
          {selectedPatient && (
            <div style={{ background: 'white', border: '1px solid #E0E0EF', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#12122C', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: '#0410BD' }} />
                Today's Appointment
              </div>
              {loadingAppts ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Looking up appointments…</div>
              ) : !appointment ? (
                <div style={{
                  padding: '14px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#12122C' }}>No appointment found for today</div>
                    <div style={{ fontSize: 12, color: '#676687', marginTop: 1 }}>Patient may be a walk-in. Proceed to schedule if needed.</div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid #E0E0EF', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} style={{ color: '#0410BD' }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#12122C' }}>
                        {appointment.start_time ? format(new Date(appointment.start_time), 'h:mm a') : '—'}
                        {' – '}
                        {appointment.end_time ? format(new Date(appointment.end_time), 'h:mm a') : '—'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                      background: appointment.status === 'checked_in' ? '#ECFDF5' : '#EFF0FF',
                      color: appointment.status === 'checked_in' ? '#16A34A' : '#0410BD',
                    }}>
                      {appointment.status === 'checked_in' ? 'Checked In' : 'Scheduled'}
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</div>
                      <div style={{ fontSize: 13, color: '#12122C', marginTop: 2 }}>
                        {APPT_TYPE_LABELS[appointment.appointment_type] ?? appointment.appointment_type}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Provider</div>
                      <div style={{ fontSize: 13, color: '#12122C', marginTop: 2 }}>{appointment.provider_name}</div>
                    </div>
                    {appointment.chief_complaint && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chief Complaint</div>
                        <div style={{ fontSize: 13, color: '#12122C', marginTop: 2 }}>{appointment.chief_complaint}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Copay collection */}
          {selectedPatient && appointment && canCheckIn && (
            <div style={{ background: 'white', border: '1px solid #E0E0EF', borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#12122C', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={14} style={{ color: '#0410BD' }} />
                Copay Collection
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF', marginLeft: 4 }}>optional</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Amount
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9CA3AF', pointerEvents: 'none' }}>$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={copayAmount}
                      onChange={e => setCopayAmount(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%', border: '1px solid #E0E0EF', borderRadius: 8,
                        padding: '9px 12px 9px 24px', fontSize: 14, color: '#12122C',
                        outline: 'none', boxSizing: 'border-box', background: '#F2F2F8',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#676687', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                    Payment Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value as 'cash' | 'card' | 'check')}
                    style={{
                      width: '100%', border: '1px solid #E0E0EF', borderRadius: 8,
                      padding: '9px 12px', fontSize: 14, color: '#12122C',
                      outline: 'none', background: '#F2F2F8', cursor: 'pointer',
                    }}
                  >
                    <option value="card">Card</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {selectedPatient && (
            <div style={{ display: 'flex', gap: 10 }}>
              {isCheckedInAlready ? (
                <div style={{
                  flex: 1, padding: '12px 18px', background: '#ECFDF5',
                  border: '1px solid #BBF7D0', borderRadius: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
                    Patient is already checked in
                  </span>
                </div>
              ) : appointment && canCheckIn ? (
                <>
                  <button
                    onClick={() => setToast({ message: 'Printing encounter form…', type: 'info' })}
                    style={{
                      height: 42, padding: '0 16px', background: 'white', color: '#374151',
                      border: '1px solid #E0E0EF', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <Printer size={14} /> Print Form
                  </button>
                  <button
                    onClick={() => { void handleCheckIn() }}
                    disabled={checkInMutation.isPending || paymentMutation.isPending}
                    style={{
                      flex: 1, height: 42, padding: '0 18px',
                      background: checkInMutation.isPending ? '#6B7280' : '#0410BD',
                      color: 'white', border: 'none', borderRadius: 8, cursor: checkInMutation.isPending ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px',
                    }}
                  >
                    {checkInMutation.isPending ? (
                      <>
                        <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Checking In…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Complete Check-In
                      </>
                    )}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
