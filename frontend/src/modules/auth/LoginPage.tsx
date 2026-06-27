import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../hooks/useToast'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)
  const { error: toastError } = useToast()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch {
      toastError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left panel */}
      <div style={{
        width: '40%', background: 'var(--bb-brand-ink)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px', color: 'white',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12 }}>
            ClinicTraq
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            Modern EHR for modern practices
          </div>
        </div>
        <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {['HIPAA Compliant', 'Multi-Tenant Architecture', 'Real-time Claims Processing'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bb-brand-blue)', flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, background: 'var(--bb-surface-app)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--bb-text-primary)' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--bb-text-secondary)', marginBottom: 32, fontSize: 14 }}>
            Sign in to your ClinicTraq account
          </p>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Input
              label="Email address"
              type="email"
              placeholder="you@practice.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" variant="primary" size="lg" loading={isSubmitting} style={{ width: '100%', marginTop: 8 }}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
