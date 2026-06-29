import { create } from 'zustand'
import { apiClient as api } from '../services/api'

export interface UserContext {
  id: string
  email: string
  name: string
  role: string  // global role name
  // Org context — populated after login
  clinicId?: string
  clinicRole?: string
  billingCompanyId?: string
  billingRole?: string
  managementGroupId?: string
  mgmtRole?: string
  permissions: string[]
  // What clinics this user can access (for billing/mgmt users who span multiple)
  accessibleClinicIds?: string[]
}

interface AuthState {
  user: UserContext | null
  isAuthenticated: boolean
  // Active clinic context (billing/mgmt users can switch)
  activeClinicId: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setActiveClinic: (clinicId: string) => void
  hasPermission: (perm: string) => boolean
  refreshUser: () => Promise<void>
}

function loadUser(): UserContext | null {
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? (JSON.parse(raw) as UserContext) : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: loadUser(),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  activeClinicId: localStorage.getItem('active_clinic_id'),

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, refresh_token, user } = res.data
    localStorage.setItem('auth_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    if (user.clinicId) localStorage.setItem('active_clinic_id', user.clinicId)
    set({ user, isAuthenticated: true, activeClinicId: user.clinicId ?? null })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('active_clinic_id')
    set({ user: null, isAuthenticated: false, activeClinicId: null })
    window.location.href = '/login'
  },

  setActiveClinic: (clinicId: string) => {
    if (clinicId) {
      localStorage.setItem('active_clinic_id', clinicId)
      set({ activeClinicId: clinicId })
    } else {
      localStorage.removeItem('active_clinic_id')
      set({ activeClinicId: null })
    }
  },

  hasPermission: (perm: string) => {
    const { user } = get()
    if (!user) return false
    return user.permissions.includes(perm)
  },

  refreshUser: async () => {
    try {
      const res = await api.get('/auth/me')
      localStorage.setItem('auth_user', JSON.stringify(res.data))
      set({ user: res.data })
    } catch {
      // token expired — stay logged in but with stale user
    }
  },
}))
