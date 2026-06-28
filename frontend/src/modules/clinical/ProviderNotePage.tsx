import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileText, CheckCircle, AlertCircle, PenLine } from 'lucide-react'
import { apiClient } from '../../services/api'

type NoteType = 'soap' | 'hpi' | 'assessment' | 'plan' | 'progress'

interface NoteRecord {
  id: string
  note_type: NoteType
  note: string
  author: string
  signed_at?: string
  created_at: string
}

interface SOAPForm {
  note_type: NoteType
  author: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  soap: 'SOAP Note',
  hpi: 'HPI',
  assessment: 'Assessment',
  plan: 'Plan',
  progress: 'Progress Note',
}

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-[--bb-text-secondary]'
const TEXTAREA_CLASS =
  'w-full rounded-md border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm text-[--bb-text-primary] placeholder:text-[--bb-text-secondary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue] focus:border-transparent transition resize-none'
const INPUT_CLASS =
  'w-full rounded-md border border-[--bb-border] bg-[--bb-surface-card] px-3 py-2 text-sm text-[--bb-text-primary] placeholder:text-[--bb-text-secondary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue] focus:border-transparent transition'

const SOAP_SECTIONS: { key: keyof Pick<SOAPForm, 'subjective' | 'objective' | 'assessment' | 'plan'>; label: string; hint: string }[] = [
  { key: 'subjective', label: 'Subjective', hint: "Patient's reported symptoms, history of present illness, and chief complaint in their own words…" },
  { key: 'objective', label: 'Objective', hint: 'Measurable findings: physical exam, lab results, vitals, observations…' },
  { key: 'assessment', label: 'Assessment', hint: 'Diagnosis or differential diagnoses based on subjective and objective data…' },
  { key: 'plan', label: 'Plan', hint: 'Treatment plan, medications, referrals, follow-up instructions, patient education…' },
]

function buildNoteContent(form: SOAPForm): string {
  if (form.note_type !== 'soap') {
    return [form.subjective, form.objective, form.assessment, form.plan].filter(Boolean).join('\n\n')
  }
  const parts = []
  if (form.subjective) parts.push(`SUBJECTIVE:\n${form.subjective}`)
  if (form.objective) parts.push(`OBJECTIVE:\n${form.objective}`)
  if (form.assessment) parts.push(`ASSESSMENT:\n${form.assessment}`)
  if (form.plan) parts.push(`PLAN:\n${form.plan}`)
  return parts.join('\n\n')
}

export function ProviderNotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [saved, setSaved] = useState<'draft' | 'signed' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<SOAPForm>({
    note_type: 'soap',
    author: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  })

  const { data: notes = [], isLoading } = useQuery<NoteRecord[]>({
    queryKey: ['notes', id],
    queryFn: async () => {
      const res = await apiClient.get(`/visits/${id}/notes`)
      return res.data
    },
  })

  const mutation = useMutation({
    mutationFn: async ({ signed }: { signed: boolean }) => {
      const payload: Record<string, unknown> = {
        note_type: form.note_type,
        author: form.author,
        note: buildNoteContent(form),
      }
      if (signed) payload.signed_at = new Date().toISOString()
      const res = await apiClient.post(`/visits/${id}/notes`, payload)
      return res.data
    },
    onSuccess: (_data, variables) => {
      setSaved(variables.signed ? 'signed' : 'draft')
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['notes', id] })
      setTimeout(() => setSaved(null), 4000)
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save note'
      setError(msg)
    },
  })

  function handleField(field: keyof SOAPForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-5 w-32 rounded bg-[--bb-border]" />
        <div className="h-8 w-56 rounded bg-[--bb-border]" />
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-32 rounded-xl bg-[--bb-border]" />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--bb-surface-app] p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <button
          onClick={() => navigate(`/visits/${id}`)}
          className="flex items-center gap-1.5 text-sm text-[--bb-text-secondary] hover:text-[--bb-brand-ink] transition"
        >
          <ArrowLeft size={14} />
          Back to Visit
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[--bb-brand-blue] flex items-center justify-center">
            <FileText size={15} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-[--bb-brand-ink]">Clinical Note</h1>
        </div>

        {/* Banners */}
        {saved === 'draft' && (
          <div className="flex items-center gap-2 rounded-lg bg-[--bb-status-success]/10 border border-[--bb-status-success]/30 px-4 py-3">
            <CheckCircle size={15} className="text-[--bb-status-success]" />
            <span className="text-sm font-medium text-[--bb-status-success]">Draft saved.</span>
          </div>
        )}
        {saved === 'signed' && (
          <div className="flex items-center gap-2 rounded-lg bg-[--bb-brand-blue]/10 border border-[--bb-brand-blue]/30 px-4 py-3">
            <PenLine size={15} className="text-[--bb-brand-blue]" />
            <span className="text-sm font-medium text-[--bb-brand-blue]">Note signed and saved.</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[--bb-status-danger]/10 border border-[--bb-status-danger]/30 px-4 py-3">
            <AlertCircle size={15} className="text-[--bb-status-danger]" />
            <span className="text-sm font-medium text-[--bb-status-danger]">{error}</span>
          </div>
        )}

        {/* Meta fields */}
        <div className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`${SECTION_LABEL} block mb-1`}>Note Type</label>
              <select
                className={INPUT_CLASS}
                value={form.note_type}
                onChange={(e) => handleField('note_type', e.target.value as NoteType)}
              >
                {(Object.entries(NOTE_TYPE_LABELS) as [NoteType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`${SECTION_LABEL} block mb-1`}>Author</label>
              <input
                type="text"
                className={INPUT_CLASS}
                placeholder="Dr. Jane Smith"
                value={form.author}
                onChange={(e) => handleField('author', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SOAP sections */}
        {SOAP_SECTIONS.map(({ key, label, hint }) => (
          <div key={key} className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold bg-[--bb-brand-blue]/10 text-[--bb-brand-blue]">
                {label[0]}
              </span>
              <p className={SECTION_LABEL}>{label}</p>
            </div>
            <textarea
              rows={4}
              className={TEXTAREA_CLASS}
              placeholder={hint}
              value={form[key]}
              onChange={(e) => handleField(key, e.target.value)}
            />
          </div>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ signed: false })}
            className="px-5 py-2 rounded-lg border border-[--bb-brand-blue] text-[--bb-brand-blue] text-sm font-semibold hover:bg-[--bb-brand-blue]/5 disabled:opacity-50 transition"
          >
            {mutation.isPending ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ signed: true })}
            className="px-5 py-2 rounded-lg bg-[--bb-brand-blue] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1.5"
          >
            <PenLine size={13} />
            {mutation.isPending ? 'Signing…' : 'Sign Note'}
          </button>
        </div>

        {/* Existing notes */}
        {notes.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className={`${SECTION_LABEL} px-1`}>Previous Notes</p>
            {notes.map((note) => (
              <div key={note.id} className="bg-[--bb-surface-card] rounded-xl border border-[--bb-border] p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[--bb-brand-blue]/10 text-[--bb-brand-blue]">
                      {NOTE_TYPE_LABELS[note.note_type] ?? note.note_type}
                    </span>
                    {note.signed_at && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[--bb-status-success]/10 text-[--bb-status-success]">
                        Signed
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[--bb-text-secondary] tabular-nums shrink-0">
                    {new Date(note.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {note.author && (
                  <p className="text-[11px] text-[--bb-text-secondary]">{note.author}</p>
                )}
                <p className="text-sm text-[--bb-text-primary] line-clamp-2">
                  {note.note.length > 100 ? `${note.note.slice(0, 100)}…` : note.note}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
