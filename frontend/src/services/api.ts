/// <reference types="vite/client" />
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(apiClient(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })
        const { access_token } = response.data
        localStorage.setItem('auth_token', access_token)

        refreshQueue.forEach((cb) => cb(access_token))
        refreshQueue = []
        isRefreshing = false

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }
        return apiClient(originalRequest)
      } catch {
        isRefreshing = false
        refreshQueue = []
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),
    logout: () => apiClient.post('/auth/logout'),
    me: () => apiClient.get('/auth/me'),
  },

  patients: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/patients', { params }),
    get: (id: string) => apiClient.get(`/patients/${id}`),
    create: (data: unknown) => apiClient.post('/patients', data),
    update: (id: string, data: unknown) => apiClient.put(`/patients/${id}`, data),
    delete: (id: string) => apiClient.delete(`/patients/${id}`),
    insurance: (id: string) => apiClient.get(`/patients/${id}/insurance`),
    bodyAnnotations: (id: string) => apiClient.get(`/patients/${id}/body-annotations`),
    addBodyAnnotation: (id: string, data: unknown) =>
      apiClient.post(`/patients/${id}/body-annotations`, data),
  },

  visits: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/visits', { params }),
    get: (id: string) => apiClient.get(`/visits/${id}`),
    create: (data: unknown) => apiClient.post('/visits', data),
    update: (id: string, data: unknown) => apiClient.put(`/visits/${id}`, data),
  },

  claims: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/claims', { params }),
    get: (id: string) => apiClient.get(`/claims/${id}`),
    create: (data: unknown) => apiClient.post('/claims', data),
    update: (id: string, data: unknown) => apiClient.put(`/claims/${id}`, data),
    validate: (id: string) => apiClient.post(`/claims/${id}/validate`),
    submit: (id: string) => apiClient.post(`/claims/${id}/submit`),
    batchSubmit: (ids: string[]) => apiClient.post('/claims/batch-submit', { ids }),
  },

  payments: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/payments', { params }),
    get: (id: string) => apiClient.get(`/payments/${id}`),
    eraFiles: (params?: Record<string, unknown>) =>
      apiClient.get('/payments/era-files', { params }),
    getEraFile: (id: string) => apiClient.get(`/payments/era-files/${id}`),
    postEraPayment: (eraPaymentId: string) =>
      apiClient.post(`/payments/era-files/payments/${eraPaymentId}/post`),
    skipEraPayment: (eraPaymentId: string, reason: string) =>
      apiClient.post(`/payments/era-files/payments/${eraPaymentId}/skip`, { reason }),
  },

  workQueue: {
    list: (params?: Record<string, unknown>) =>
      apiClient.get('/work-queue', { params }),
    summary: () => apiClient.get('/work-queue/summary'),
    assign: (id: string, userId: string) =>
      apiClient.post(`/work-queue/${id}/assign`, { userId }),
    snooze: (id: string, until: string, reason?: string) =>
      apiClient.post(`/work-queue/${id}/snooze`, { until, reason }),
    resolve: (id: string) => apiClient.post(`/work-queue/${id}/resolve`),
  },

  search: {
    global: (query: string) => apiClient.get('/search', { params: { q: query } }),
  },

  audit: {
    phiReveal: (patientId: string, fieldName: string) =>
      apiClient.post('/audit/phi-reveal', { patientId, fieldName }),
    list: (entityType: string, entityId: string) =>
      apiClient.get(`/audit/${entityType}/${entityId}`),
  },

  settings: {
    payers: {
      list: () => apiClient.get('/settings/payers'),
      update: (id: string, data: unknown) => apiClient.put(`/settings/payers/${id}`, data),
    },
    providers: {
      list: (params?: Record<string, unknown>) => apiClient.get('/settings/providers', { params }),
      create: (data: unknown) => apiClient.post('/settings/providers', data),
      update: (id: string, data: unknown) => apiClient.put(`/settings/providers/${id}`, data),
    },
    cptCodes: {
      list: (params?: Record<string, unknown>) => apiClient.get('/settings/cpt-codes', { params }),
    },
  },
}
