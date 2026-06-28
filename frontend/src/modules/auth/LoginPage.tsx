import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const FEATURES = [
  { title: 'HIPAA-Compliant EHR', desc: 'Encrypted PHI at rest and in transit, with full audit trails' },
  { title: 'Intelligent Billing', desc: 'Automated claim scrubbing, EDI 837/835 processing, ERA posting' },
  { title: 'Real-Time Eligibility', desc: 'Instant payer verification before every encounter' },
  { title: 'Multi-Tenant Architecture', desc: 'Isolated data per practice with role-based access control' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setServerError(null)
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch {
      setServerError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Left brand panel ─────────────────────────────────────────────── */}
      <div style={{
        display: 'none',
        width: '45%',
        background: 'var(--bb-brand-ink)',
        flexDirection: 'column',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left-panel">
        {/* Subtle background circles */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(4,16,189,0.15)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -120, left: -60,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(4,16,189,0.08)', pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 64 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--bb-brand-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                <path d="M10 2v12M3 6l7 4 7-4" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
              ClinicTraq
            </span>
          </div>

          <h1 style={{ color: 'white', fontSize: 32, fontWeight: 700, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Modern EHR for<br />modern practices
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, lineHeight: 1.6, marginBottom: 48 }}>
            Streamline clinical workflows, automate billing, and improve patient outcomes — all in one platform.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 2,
                  background: 'rgba(4,16,189,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bb-brand-blue)' }} />
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{f.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 48 }}>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            © {new Date().getFullYear()} ClinicTraq · HIPAA Compliant · SOC 2 Type II
          </p>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        background: 'var(--bb-surface-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          {/* Mobile logo */}
          <div className="login-mobile-logo" style={{ marginBottom: 32, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--bb-brand-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
                  <path d="M10 2v12M3 6l7 4 7-4" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ color: 'var(--bb-brand-ink)', fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px' }}>
                ClinicTraq
              </span>
            </div>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 8, letterSpacing: '-0.3px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: 'var(--bb-text-secondary)', lineHeight: 1.5 }}>
              Sign in to your ClinicTraq account to continue
            </p>
          </div>

          {/* Card */}
          <div style={{
            background: 'var(--bb-surface-card)',
            border: '1px solid var(--bb-border)',
            borderRadius: 16,
            padding: '32px',
            boxShadow: '0 1px 4px rgba(18,18,44,0.06)',
          }}>
            {serverError && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '12px 14px', marginBottom: 20,
                color: 'var(--bb-status-danger)', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@practice.com"
                  autoComplete="email"
                  {...register('email')}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 42, padding: '0 14px',
                    border: `1.5px solid ${errors.email ? 'var(--bb-status-danger)' : 'var(--bb-border)'}`,
                    borderRadius: 8, fontSize: 14,
                    color: 'var(--bb-text-primary)',
                    background: 'white',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = errors.email ? 'var(--bb-status-danger)' : 'var(--bb-border)' }}
                />
                {errors.email && (
                  <p style={{ marginTop: 5, fontSize: 12, color: 'var(--bb-status-danger)' }}>{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--bb-text-primary)', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      height: 42, padding: '0 44px 0 14px',
                      border: `1.5px solid ${errors.password ? 'var(--bb-status-danger)' : 'var(--bb-border)'}`,
                      borderRadius: 8, fontSize: 14,
                      color: 'var(--bb-text-primary)',
                      background: 'white',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--bb-brand-blue)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.password ? 'var(--bb-status-danger)' : 'var(--bb-border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--bb-text-secondary)', padding: 2,
                      display: 'flex', alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 5, fontSize: 12, color: 'var(--bb-status-danger)' }}>{errors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%', height: 44,
                  background: isSubmitting ? 'rgba(4,16,189,0.6)' : 'var(--bb-brand-blue)',
                  color: 'white', border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s',
                }}
              >
                {isSubmitting ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign in'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--bb-text-secondary)' }}>
            Need help?{' '}
            <a href="mailto:support@clinictraq.com" style={{ color: 'var(--bb-brand-blue)', textDecoration: 'none', fontWeight: 500 }}>
              Contact support
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .login-left-panel { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  )
}
