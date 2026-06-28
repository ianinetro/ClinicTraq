import { create } from 'zustand'
import { apiClient as api } from '../services/api'

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('auth_token'),
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const { access_token, refresh_token, user } = res.data
    localStorage.setItem('auth_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    set({ user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },
}))
