import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, User, Shield, Phone, ArrowRight } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { apiClient as api } from '../../services/api'

const STEPS = [
  { id: 'demographics', label: 'Demographics', icon: User },
  { id: 'insurance', label: 'Insurance', icon: Shield },
  { id: 'contact', label: 'Contact', icon: Phone },
  { id: 'review', label: 'Review', icon: Check },
] as const
type StepId = typeof STEPS[number]['id']

interface PatientForm {
  // Demographics
  firstName: string
  lastName: string
  middleName: string
  dob: string
  sex: string
  ssn: string
  maritalStatus: string
  race: string
  ethnicity: string
  language: string
  // Insurance
  primaryPayer: string
  memberId: string
  groupNumber: string
  relationToInsured: string
  insuredName: string
  insuredDob: string
  planType: string
  effectiveDate: string
  copay: string
  deductible: string
  // Contact
  phone: string
  phoneType: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: string
}

const EMPTY: PatientForm = {
  firstName: '', lastName: '', middleName: '', dob: '', sex: '', ssn: '', maritalStatus: '', race: '', ethnicity: '', language: 'English',
  primaryPayer: '', memberId: '', groupNumber: '', relationToInsured: 'Self', insuredName: '', insuredDob: '', planType: 'PPO', effectiveDate: '', copay: '', deductible: '',
  phone: '', phoneType: 'Mobile', email: '', address: '', city: '', state: '', zip: '',
  emergencyName: '', emergencyPhone: '', emergencyRelation: '',
}

function inputStyle(): React.CSSProperties {
  return {
    height: 38, padding: '0 12px',
    border: '1px solid var(--bb-border)',
    borderRadius: 'var(--bb-radius)',
    fontSize: 13, background: 'white',
    color: 'var(--bb-text-primary)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  }
}

function selectStyle(): React.CSSProperties {
  return { ...inputStyle() }
}

function Field({ label, required, children, col2 }: { label: string; required?: boolean; children: React.ReactNode; col2?: boolean }) {
  return (
    <div style={{ gridColumn: col2 ? '1 / -1' : undefined, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{required && <span style={{ color: 'var(--bb-status-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function SectionHeading({ title }: { title: string }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)', gridColumn: '1 / -1', paddingBottom: 4, borderBottom: '1px solid var(--bb-border)', marginBottom: 4 }}>{title}</div>
}

export function NewPatientPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<StepId>('demographics')
  const [form, setForm] = useState<PatientForm>(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const set = (patch: Partial<PatientForm>) => setForm(f => ({ ...f, ...patch }))

  const stepIdx = STEPS.findIndex(s => s.id === step)

  const canAdvance = () => {
    if (step === 'demographics') return !!form.firstName && !!form.lastName && !!form.dob && !!form.sex
    if (step === 'insurance') return !!form.primaryPayer && !!form.memberId
    return true
  }

  const advance = () => { const n = STEPS[stepIdx + 1]; if (n) setStep(n.id) }
  const back = () => { const p = STEPS[stepIdx - 1]; if (p) setStep(p.id) }

  async function handleSave() {
    try {
      const payload = {
        first_name: form.firstName,
        last_name: form.lastName,
        middle_name: form.middleName || undefined,
        dob: form.dob || undefined,
        sex: form.sex || undefined,
        ssn: form.ssn || undefined,
        marital_status: form.maritalStatus || undefined,
        race: form.race || undefined,
        ethnicity: form.ethnicity || undefined,
        preferred_language: form.language || undefined,
        phone_cell: form.phone || undefined,
        email: form.email || undefined,
        address_line1: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
        emergency_contact: form.emergencyName ? {
          name: form.emergencyName,
          phone: form.emergencyPhone,
          relation: form.emergencyRelation,
        } : undefined,
      }
      await api.post('/patients', payload)
      setSubmitted(true)
      setTimeout(() => navigate('/patients'), 1800)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save patient'
      alert(msg)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 740 }}>
      <Button variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/patients')}>
        <ArrowLeft size={14} /> Patients
      </Button>

      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>New Patient</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bb-text-secondary)' }}>Register a new patient in the system</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
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
                }}>
                  {done ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? 'var(--bb-brand-blue)' : done ? 'var(--bb-status-success)' : 'var(--bb-text-secondary)', whiteSpace: 'nowrap' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? 'var(--bb-status-success)' : 'var(--bb-border)', marginBottom: 20 }} />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ background: 'var(--bb-surface-card)', border: '1px solid var(--bb-border)', borderRadius: 'var(--bb-radius-lg)', padding: 28, boxShadow: 'var(--bb-shadow-sm)' }}>

        {/* ── Demographics ── */}
        {step === 'demographics' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SectionHeading title="Personal Information" />
            <Field label="First Name" required>
              <input value={form.firstName} onChange={e => set({ firstName: e.target.value })} placeholder="First name" style={inputStyle()} />
            </Field>
            <Field label="Last Name" required>
              <input value={form.lastName} onChange={e => set({ lastName: e.target.value })} placeholder="Last name" style={inputStyle()} />
            </Field>
            <Field label="Middle Name">
              <input value={form.middleName} onChange={e => set({ middleName: e.target.value })} placeholder="Middle name" style={inputStyle()} />
            </Field>
            <Field label="Date of Birth" required>
              <input type="date" value={form.dob} onChange={e => set({ dob: e.target.value })} style={inputStyle()} />
            </Field>
            <Field label="Sex" required>
              <select value={form.sex} onChange={e => set({ sex: e.target.value })} style={selectStyle()}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other / Non-binary</option>
                <option value="unknown">Unknown</option>
              </select>
            </Field>
            <Field label="SSN (encrypted)">
              <input value={form.ssn} onChange={e => set({ ssn: e.target.value })} placeholder="XXX-XX-XXXX" maxLength={11} style={inputStyle()} />
            </Field>
            <Field label="Marital Status">
              <select value={form.maritalStatus} onChange={e => set({ maritalStatus: e.target.value })} style={selectStyle()}>
                <option value="">Select…</option>
                <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option><option>Other</option>
              </select>
            </Field>
            <Field label="Preferred Language">
              <select value={form.language} onChange={e => set({ language: e.target.value })} style={selectStyle()}>
                <option>English</option><option>Spanish</option><option>French</option><option>Mandarin</option><option>Other</option>
              </select>
            </Field>
            <SectionHeading title="Demographics (HIPAA)" />
            <Field label="Race">
              <select value={form.race} onChange={e => set({ race: e.target.value })} style={selectStyle()}>
                <option value="">Select…</option>
                <option>White</option><option>Black or African American</option><option>Asian</option>
                <option>American Indian or Alaska Native</option><option>Native Hawaiian / Pacific Islander</option>
                <option>Two or more races</option><option>Declined to specify</option>
              </select>
            </Field>
            <Field label="Ethnicity">
              <select value={form.ethnicity} onChange={e => set({ ethnicity: e.target.value })} style={selectStyle()}>
                <option value="">Select…</option>
                <option>Not Hispanic or Latino</option><option>Hispanic or Latino</option><option>Declined to specify</option>
              </select>
            </Field>
          </div>
        )}

        {/* ── Insurance ── */}
        {step === 'insurance' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SectionHeading title="Primary Insurance" />
            <Field label="Insurance / Payer" required>
              <select value={form.primaryPayer} onChange={e => set({ primaryPayer: e.target.value })} style={selectStyle()}>
                <option value="">Select payer…</option>
                <option>BlueCross BlueShield</option>
                <option>Aetna</option>
                <option>United Healthcare</option>
                <option>Cigna</option>
                <option>Medicare</option>
                <option>Medicaid IL</option>
                <option>Self-Pay</option>
              </select>
            </Field>
            <Field label="Plan Type">
              <select value={form.planType} onChange={e => set({ planType: e.target.value })} style={selectStyle()}>
                <option>PPO</option><option>HMO</option><option>EPO</option><option>POS</option><option>HDHP</option><option>Medicare Advantage</option><option>Straight Medicare</option>
              </select>
            </Field>
            <Field label="Member ID" required>
              <input value={form.memberId} onChange={e => set({ memberId: e.target.value })} placeholder="Member/Subscriber ID" style={inputStyle()} />
            </Field>
            <Field label="Group Number">
              <input value={form.groupNumber} onChange={e => set({ groupNumber: e.target.value })} placeholder="Group number" style={inputStyle()} />
            </Field>
            <Field label="Effective Date">
              <input type="date" value={form.effectiveDate} onChange={e => set({ effectiveDate: e.target.value })} style={inputStyle()} />
            </Field>
            <Field label="Relation to Insured">
              <select value={form.relationToInsured} onChange={e => set({ relationToInsured: e.target.value })} style={selectStyle()}>
                <option>Self</option><option>Spouse</option><option>Child</option><option>Other</option>
              </select>
            </Field>
            {form.relationToInsured !== 'Self' && (
              <>
                <Field label="Insured Name">
                  <input value={form.insuredName} onChange={e => set({ insuredName: e.target.value })} placeholder="Insured's full name" style={inputStyle()} />
                </Field>
                <Field label="Insured DOB">
                  <input type="date" value={form.insuredDob} onChange={e => set({ insuredDob: e.target.value })} style={inputStyle()} />
                </Field>
              </>
            )}
            <SectionHeading title="Cost Sharing" />
            <Field label="Copay ($)">
              <input value={form.copay} onChange={e => set({ copay: e.target.value })} placeholder="0.00" style={inputStyle()} />
            </Field>
            <Field label="Annual Deductible ($)">
              <input value={form.deductible} onChange={e => set({ deductible: e.target.value })} placeholder="0.00" style={inputStyle()} />
            </Field>
          </div>
        )}

        {/* ── Contact ── */}
        {step === 'contact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SectionHeading title="Contact Information" />
            <Field label="Phone" required>
              <input value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="(555) 000-0000" style={inputStyle()} />
            </Field>
            <Field label="Phone Type">
              <select value={form.phoneType} onChange={e => set({ phoneType: e.target.value })} style={selectStyle()}>
                <option>Mobile</option><option>Home</option><option>Work</option>
              </select>
            </Field>
            <Field label="Email" col2>
              <input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="patient@email.com" style={inputStyle()} />
            </Field>
            <Field label="Street Address" col2>
              <input value={form.address} onChange={e => set({ address: e.target.value })} placeholder="123 Main St" style={inputStyle()} />
            </Field>
            <Field label="City">
              <input value={form.city} onChange={e => set({ city: e.target.value })} placeholder="City" style={inputStyle()} />
            </Field>
            <Field label="State">
              <select value={form.state} onChange={e => set({ state: e.target.value })} style={selectStyle()}>
                <option value="">State…</option>
                {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="ZIP Code">
              <input value={form.zip} onChange={e => set({ zip: e.target.value })} placeholder="00000" maxLength={10} style={inputStyle()} />
            </Field>
            <SectionHeading title="Emergency Contact" />
            <Field label="Emergency Contact Name">
              <input value={form.emergencyName} onChange={e => set({ emergencyName: e.target.value })} placeholder="Full name" style={inputStyle()} />
            </Field>
            <Field label="Relationship">
              <select value={form.emergencyRelation} onChange={e => set({ emergencyRelation: e.target.value })} style={selectStyle()}>
                <option value="">Select…</option>
                <option>Spouse</option><option>Parent</option><option>Child</option><option>Sibling</option><option>Friend</option><option>Other</option>
              </select>
            </Field>
            <Field label="Emergency Phone" col2>
              <input value={form.emergencyPhone} onChange={e => set({ emergencyPhone: e.target.value })} placeholder="(555) 000-0000" style={inputStyle()} />
            </Field>
          </div>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          submitted ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={28} color="var(--bb-status-success)" />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Patient Created</h3>
              <p style={{ margin: 0, color: 'var(--bb-text-secondary)', fontSize: 14 }}>Redirecting to Patients…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Review Patient Information</h3>
              {[
                {
                  title: 'Demographics',
                  fields: [
                    { label: 'Name', value: `${form.firstName} ${form.middleName} ${form.lastName}`.replace(/\s+/g, ' ').trim() },
                    { label: 'DOB', value: form.dob },
                    { label: 'Sex', value: form.sex },
                    { label: 'SSN', value: form.ssn ? '***-**-' + form.ssn.slice(-4) : '—' },
                    { label: 'Language', value: form.language },
                  ],
                },
                {
                  title: 'Insurance',
                  fields: [
                    { label: 'Payer', value: form.primaryPayer || '—' },
                    { label: 'Member ID', value: form.memberId || '—' },
                    { label: 'Group #', value: form.groupNumber || '—' },
                    { label: 'Plan Type', value: form.planType },
                    { label: 'Copay', value: form.copay ? `$${form.copay}` : '—' },
                  ],
                },
                {
                  title: 'Contact',
                  fields: [
                    { label: 'Phone', value: form.phone || '—' },
                    { label: 'Email', value: form.email || '—' },
                    { label: 'Address', value: [form.address, form.city, form.state, form.zip].filter(Boolean).join(', ') || '—' },
                    { label: 'Emergency', value: form.emergencyName ? `${form.emergencyName} (${form.emergencyRelation}) — ${form.emergencyPhone}` : '—' },
                  ],
                },
              ].map(section => (
                <div key={section.title} style={{ background: 'var(--bb-surface-app)', borderRadius: 'var(--bb-radius)', padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bb-text-secondary)', marginBottom: 10 }}>{section.title}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {section.fields.map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 11, color: 'var(--bb-text-secondary)', fontWeight: 500 }}>{f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Navigation */}
      {!submitted && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="secondary" onClick={back} disabled={stepIdx === 0}>
            <ArrowLeft size={14} /> Back
          </Button>
          {step === 'review' ? (
            <Button variant="primary" onClick={handleSave}>
              <Check size={14} /> Save Patient
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
