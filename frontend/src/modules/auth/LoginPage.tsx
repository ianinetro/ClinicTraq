import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Label } from '../../components/ui/Label'

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      })

      if (!res.ok) {
        setServerError('Email or password is incorrect.')
        return
      }

      const json = await res.json() as {
        access_token: string
        refresh_token: string
        user: { id: string; email: string; first_name: string; last_name: string; role: string }
      }

      localStorage.setItem('ct_token', json.access_token)
      localStorage.setItem('ct_refresh', json.refresh_token)
      localStorage.setItem('ct_user', JSON.stringify(json.user))
      navigate('/dashboard', { replace: true })
    } catch {
      setServerError('Email or password is incorrect.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left dark panel */}
      <div className="hidden lg:flex lg:w-[52%] bg-[#12122C] flex-col p-10 relative overflow-hidden">
        {/* Gradient blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3F4CFF] opacity-20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00CBDE] opacity-15 blur-3xl rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        {/* Wordmark */}
        <div className="relative z-10">
          <span className="text-white font-bold text-2xl tracking-tight">
            Clinic<span className="text-[#00CBDE]">Traq</span>
          </span>
        </div>

        {/* Center content */}
        <div className="relative z-10 mt-auto mb-16">
          <p className="text-[#00CBDE] text-xs font-semibold uppercase tracking-widest mb-3">
            ClinicTraq EHR
          </p>
          <h1 className="text-[#FFFFFF] text-[32px] font-bold leading-tight mb-8 max-w-md">
            Streamlined billing, scheduling, and clinical operations for modern practices.
          </h1>
          <ul className="space-y-4">
            {[
              'HIPAA-aware multi-tenant access with full audit trails.',
              'Real-time work queues: claims, payments, ERA, and denials.',
              'Keyboard-first billing workflows for maximum throughput.',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <ShieldCheck size={18} className="text-[#00CBDE] flex-shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-white/30 text-xs">
          Access restricted to authorized users. All sessions and actions are logged.
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 bg-[#F2F2F8] flex flex-col items-center justify-center p-6">
        {/* Mobile wordmark */}
        <div className="lg:hidden mb-8">
          <span className="text-[#12122C] font-bold text-2xl tracking-tight">
            Clinic<span className="text-[#0410BD]">Traq</span>
          </span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h2 className="text-[24px] font-[650] text-[#12122C] leading-8">Sign in</h2>
            <p className="text-sm text-[#676687] mt-1">Enter your credentials to access ClinicTraq.</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-xl border border-[#E3E3F1] shadow-[0_8px_20px_rgba(18,18,44,0.10)] p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {serverError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {serverError}
                </div>
              )}

              {/* Email */}
              <div>
                <Label htmlFor="email" required>Email address</Label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@practice.com"
                  {...register('email')}
                  className={`w-full h-10 border rounded-[4px] text-sm text-[#12122C] px-3 placeholder-[#BABACE] outline-none transition-all ${
                    errors.email
                      ? 'border-[#DC2626] shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
                      : 'border-[#BABACE] focus:border-[#3F4CFF] focus:shadow-[0_0_0_3px_rgba(63,76,255,0.16)]'
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-[#B91C1C] mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password" required className="mb-0">Password</Label>
                  <a href="#" className="text-xs text-[#0410BD] hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#676687] pointer-events-none">
                    <Lock size={15} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...register('password')}
                    className={`w-full h-10 border rounded-[4px] text-sm text-[#12122C] pl-9 pr-10 placeholder-[#BABACE] outline-none transition-all ${
                      errors.password
                        ? 'border-[#DC2626] shadow-[0_0_0_3px_rgba(220,38,38,0.12)]'
                        : 'border-[#BABACE] focus:border-[#3F4CFF] focus:shadow-[0_0_0_3px_rgba(63,76,255,0.16)]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#676687] hover:text-[#12122C] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-[#B91C1C] mt-1">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting}
                className="w-full"
              >
                Sign in
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-[#9FA0BD] mt-4">
            Need access? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
