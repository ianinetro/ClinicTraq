import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Input } from '../../components/ui/Input'
import { Label } from '../../components/ui/Label'
import { Button } from '../../components/ui/Button'
import { ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Enter a valid email address, such as name@practice.com.'),
  password: z.string().min(1, 'Password is required.'),
})
type FormData = z.infer<typeof schema>

const FEATURES = [
  'HIPAA-compliant EHR with encrypted PHI at rest and in transit, full audit trails.',
  'Automated claim scrubbing, EDI 837/835 processing, and ERA auto-posting.',
  'Real-time payer eligibility verification before every patient encounter.',
]

function ClinicTraqLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-lg bg-[#0410BD]">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 2L3 6v8l7 4 7-4V6L10 2z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          <path d="M10 2v12M3 6l7 4 7-4" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <span className={`text-[18px] font-bold tracking-tight ${dark ? 'text-[#12122C]' : 'text-white'}`}>
        ClinicTraq
      </span>
    </div>
  )
}

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
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">

      {/* ── Left panel — brand ─────────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#12122C] p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3F4CFF 0%, rgba(63,76,255,0) 70%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-[360px] rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #00CBDE 0%, rgba(0,203,222,0) 70%)' }}
          aria-hidden
        />
        <ClinicTraqLogo />
        <div className="relative max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00CBDE]">
            ClinicTraq EHR
          </p>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.15] tracking-tight">
            Modern EHR for modern medical practices.
          </h1>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-white/80">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#00CBDE]" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">
          Access is restricted to authorized users. Sessions and PHI access are fully logged.
        </p>
      </aside>

      {/* ── Right panel ────────────────────────────────────────── */}
      <main className="flex items-center justify-center bg-[#F2F2F8] px-5 py-10">
        <div className="w-full max-w-[400px]">

          <div className="mb-8 lg:hidden">
            <ClinicTraqLogo dark />
          </div>

          <h2 className="text-2xl font-[650] tracking-tight text-[#12122C]">Sign in</h2>
          <p className="mt-1.5 text-sm text-[#676687]">
            Use your ClinicTraq account to access the platform.
          </p>

          <div className="mt-7 rounded-xl border border-[#E3E3F1] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  error={errors.email?.message}
                  placeholder="name@practice.com"
                  {...register('email')}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative flex items-center">
                  <Lock size={14} className="pointer-events-none absolute left-3 text-[#BABACE]" aria-hidden />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={[
                      'w-full rounded-[4px] border bg-white px-3 py-2 pl-9 pr-10 text-sm text-[#12122C] placeholder-[#BABACE]',
                      'focus:outline-none focus:ring-[3px] focus:ring-[#3F4CFF]/16 focus:border-[#3F4CFF]',
                      'transition-shadow transition-colors duration-100',
                      errors.password
                        ? 'border-[#DC2626] focus:ring-[#DC2626]/12 focus:border-[#DC2626]'
                        : 'border-[#BABACE]',
                    ].join(' ')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 text-[#BABACE] hover:text-[#676687] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>

              {serverError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {serverError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                className="w-full justify-center h-11 text-sm"
              >
                Sign in
              </Button>

            </form>
          </div>

          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="text-center text-xs text-[#9FA0BD]">
              Trouble signing in? Email us at{' '}
              <span className="font-medium text-[#676687] select-all">support@clinictraq.com</span>
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
