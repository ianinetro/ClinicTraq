import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Activity, Pencil, CheckCircle, AlertCircle } from 'lucide-react'
import { apiClient } from '../../services/api'

interface VitalsData {
  height_ft?: number
  height_in?: number
  weight_lbs?: number
  bmi?: number
  bp_systolic?: number
  bp_diastolic?: number
  heart_rate?: number
  respiratory_rate?: number
  temperature_f?: number
  o2_saturation?: number
  pain_scale?: number
  chief_complaint?: string
  recorded_at?: string
}

function calcBMI(weightLbs: number, heightFt: number, heightIn: number): number | null {
  const totalInches = heightFt * 12 + heightIn
  if (totalInches <= 0 || weightLbs <= 0) return null
  return Math.round((weightLbs / (totalInches * totalInches)) * 703 * 10) / 10
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-[--bb-status-warning]' }
  if (bmi < 25) return { label: 'Normal', color: 'text-[--bb-status-success]' }
  if (bmi < 30) return { label: 'Overweight', color: 'text-[--bb-status-warning]' }
  return { label: 'Obese', color: 'text-[--bb-status-danger]' }
}

const FIELD_LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] mb-1'
const INPUT_CLASS =
  'w-full rounded-md border border-[--bb-border] bg-[--bb-surface-card] px-3 py-2 text-sm text-[--bb-text-primary] placeholder:text-[--bb-text-secondary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue] focus:border-transparent transition'

export function VitalsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<VitalsData>({
    height_ft: undefined,
    height_in: undefined,
    weight_lbs: undefined,
    bp_systolic: undefined,
    bp_diastolic: undefined,
    heart_rate: undefined,
    respiratory_rate: undefined,
    temperature_f: undefined,
    o2_saturation: undefined,
    pain_scale: undefined,
    chief_complaint: '',
  })

  const { data: existing, isLoading } = useQuery<VitalsData>({
    queryKey: ['vitals', id],
    queryFn: async () => {
      const res = await apiClient.get(`/visits/${id}/vitals`)
      return res.data
    },
    retry: false,
  })

  useEffect(() => {
    if (existing) {
      setForm(existing)
    } else if (!isLoading) {
      setEditing(true)
    }
  }, [existing, isLoading])

  const bmi =
    form.weight_lbs && form.height_ft !== undefined && form.height_in !== undefined
      ? calcBMI(form.weight_lbs, form.height_ft ?? 0, form.height_in ?? 0)
      : null

  const mutation = useMutation({
    mutationFn: async (payload: VitalsData) => {
      const res = await apiClient.post(`/visits/${id}/vitals`, payload)
      return res.data
    },
    onSuccess: () => {
      setSaved(true)
      setEditing(false)
      setError(null)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save vitals'
      setError(msg)
    },
  })

  function handleChange(field: keyof VitalsData, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value === '' ? undefined : isNaN(Number(value)) ? value : Number(value),
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ ...form, bmi: bmi ?? undefined })
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-5 w-32 rounded bg-[--bb-border]" />
        <div className="h-8 w-56 rounded bg-[--bb-border]" />
        <div className="h-48 rounded-xl bg-[--bb-border]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--bb-surface-app] p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back nav */}
        <button
          onClick={() => navigate(`/visits/${id}`)}
          className="flex items-center gap-1.5 text-sm text-[--bb-text-secondary] hover:text-[--bb-brand-ink] transition"
        >
          <ArrowLeft size={14} />
          Back to Visit
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[--bb-brand-blue] flex items-center justify-center">
              <Activity size={15} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[--bb-brand-ink]">Record Vitals</h1>
          </div>
          {existing && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-[--bb-brand-blue] hover:opacity-80 transition"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        {/* Success banner */}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg bg-[--bb-status-success]/10 border border-[--bb-status-success]/30 px-4 py-3">
            <CheckCircle size={15} className="text-[--bb-status-success]" />
            <span className="text-sm font-medium text-[--bb-status-success]">Vitals saved successfully.</span>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[--bb-status-danger]/10 border border-[--bb-status-danger]/30 px-4 py-3">
            <AlertCircle size={15} className="text-[--bb-status-danger]" />
            <span className="text-sm font-medium text-[--bb-status-danger]">{error}</span>
          </div>
        )}

        {/* Read-only summary */}
        {existing && !editing && (
          <div className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">
              Recorded{' '}
              {existing.recorded_at
                ? new Date(existing.recorded_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'on file'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Height', value: existing.height_ft != null ? `${existing.height_ft}′ ${existing.height_in ?? 0}″` : '—' },
                { label: 'Weight', value: existing.weight_lbs != null ? `${existing.weight_lbs} lbs` : '—' },
                { label: 'BMI', value: existing.bmi != null ? String(existing.bmi) : '—' },
                { label: 'Blood Pressure', value: existing.bp_systolic != null ? `${existing.bp_systolic}/${existing.bp_diastolic}` : '—' },
                { label: 'Heart Rate', value: existing.heart_rate != null ? `${existing.heart_rate} bpm` : '—' },
                { label: 'Resp. Rate', value: existing.respiratory_rate != null ? `${existing.respiratory_rate} /min` : '—' },
                { label: 'Temperature', value: existing.temperature_f != null ? `${existing.temperature_f}°F` : '—' },
                { label: 'O₂ Saturation', value: existing.o2_saturation != null ? `${existing.o2_saturation}%` : '—' },
                { label: 'Pain Scale', value: existing.pain_scale != null ? `${existing.pain_scale}/10` : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">{label}</p>
                  <p className="mt-0.5 text-sm font-medium text-[--bb-text-primary] tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            {existing.chief_complaint && (
              <div className="pt-3 border-t border-[--bb-border]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary] mb-1">Chief Complaint</p>
                <p className="text-sm text-[--bb-text-primary]">{existing.chief_complaint}</p>
              </div>
            )}
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Anthropometrics */}
            <div className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">Anthropometrics</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={FIELD_LABEL}>Height — ft</label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    className={INPUT_CLASS}
                    placeholder="5"
                    value={form.height_ft ?? ''}
                    onChange={(e) => handleChange('height_ft', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Height — in</label>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    className={INPUT_CLASS}
                    placeholder="8"
                    value={form.height_in ?? ''}
                    onChange={(e) => handleChange('height_in', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Weight (lbs)</label>
                  <input
                    type="number"
                    min={0}
                    className={INPUT_CLASS}
                    placeholder="160"
                    value={form.weight_lbs ?? ''}
                    onChange={(e) => handleChange('weight_lbs', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>BMI (calculated)</label>
                  <div className="flex items-center gap-2 h-[38px] px-3 rounded-md border border-[--bb-border] bg-[--bb-surface-app]">
                    {bmi != null ? (
                      <>
                        <span className="text-sm font-semibold text-[--bb-text-primary] tabular-nums">{bmi}</span>
                        <span className={`text-xs font-medium ${bmiCategory(bmi).color}`}>{bmiCategory(bmi).label}</span>
                      </>
                    ) : (
                      <span className="text-sm text-[--bb-text-secondary]">—</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vitals */}
            <div className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]">Vital Signs</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={FIELD_LABEL}>BP Systolic (mmHg)</label>
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    placeholder="120"
                    value={form.bp_systolic ?? ''}
                    onChange={(e) => handleChange('bp_systolic', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>BP Diastolic (mmHg)</label>
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    placeholder="80"
                    value={form.bp_diastolic ?? ''}
                    onChange={(e) => handleChange('bp_diastolic', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Heart Rate (bpm)</label>
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    placeholder="72"
                    value={form.heart_rate ?? ''}
                    onChange={(e) => handleChange('heart_rate', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Respiratory Rate (/min)</label>
                  <input
                    type="number"
                    className={INPUT_CLASS}
                    placeholder="16"
                    value={form.respiratory_rate ?? ''}
                    onChange={(e) => handleChange('respiratory_rate', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    className={INPUT_CLASS}
                    placeholder="98.6"
                    value={form.temperature_f ?? ''}
                    onChange={(e) => handleChange('temperature_f', e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>O₂ Saturation (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={INPUT_CLASS}
                    placeholder="98"
                    value={form.o2_saturation ?? ''}
                    onChange={(e) => handleChange('o2_saturation', e.target.value)}
                  />
                </div>
              </div>

              {/* Pain scale */}
              <div>
                <label className={FIELD_LABEL}>Pain Scale (0 – 10)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    className="flex-1 accent-[--bb-brand-blue]"
                    value={form.pain_scale ?? 0}
                    onChange={(e) => handleChange('pain_scale', e.target.value)}
                  />
                  <span className="w-7 text-center text-sm font-semibold tabular-nums text-[--bb-text-primary]">
                    {form.pain_scale ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Chief complaint */}
            <div className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5">
              <label className={FIELD_LABEL}>Chief Complaint</label>
              <textarea
                rows={3}
                className={INPUT_CLASS + ' resize-none'}
                placeholder="Describe the patient's primary reason for the visit…"
                value={form.chief_complaint ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, chief_complaint: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-5 py-2 rounded-lg bg-[--bb-brand-blue] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {mutation.isPending ? 'Saving…' : 'Save Vitals'}
              </button>
              {existing && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setError(null) }}
                  className="px-4 py-2 rounded-lg border border-[--bb-border] text-sm text-[--bb-text-secondary] hover:text-[--bb-text-primary] transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
