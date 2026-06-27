import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Patient, Claim, WorkItem, WorkQueueSummary } from '../types'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string
  type: 'patient' | 'claim' | 'visit' | 'payment'
  title: string
  subtitle?: string
  path: string
}

interface SearchResponse {
  results: SearchResult[]
}

async function fetchSearch(query: string): Promise<SearchResponse> {
  const token = localStorage.getItem('ct_token')
  const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Search failed')
  return res.json()
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => fetchSearch(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('ct_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

interface PatientsParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function usePatients(params: PatientsParams = {}) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  return useQuery<PaginatedResponse<Patient>>({
    queryKey: ['patients', params],
    queryFn: () => apiFetch(`/api/v1/patients?${qs}`),
  })
}

export function usePatient(id: string) {
  return useQuery<Patient>({
    queryKey: ['patients', id],
    queryFn: () => apiFetch(`/api/v1/patients/${id}`),
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

interface ClaimsParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export function useClaims(params: ClaimsParams = {}) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  return useQuery<PaginatedResponse<Claim>>({
    queryKey: ['claims', params],
    queryFn: () => apiFetch(`/api/v1/claims?${qs}`),
  })
}

export function useClaim(id: string) {
  return useQuery<Claim>({
    queryKey: ['claims', id],
    queryFn: () => apiFetch(`/api/v1/claims/${id}`),
    enabled: !!id,
  })
}

export function useValidateClaim() {
  const queryClient = useQueryClient()
  return useMutation<Claim, Error, string>({
    mutationFn: (id: string) => apiPost(`/api/v1/claims/${id}/validate`),
    onSuccess: (data) => {
      queryClient.setQueryData(['claims', data.id], data)
    },
  })
}

export function useSubmitClaim() {
  const queryClient = useQueryClient()
  return useMutation<Claim, Error, string>({
    mutationFn: (id: string) => apiPost(`/api/v1/claims/${id}/submit`),
    onSuccess: (data) => {
      queryClient.setQueryData(['claims', data.id], data)
      void queryClient.invalidateQueries({ queryKey: ['claims'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Work Queue
// ---------------------------------------------------------------------------

interface WorkQueueParams {
  type?: string
  page?: number
  pageSize?: number
}

export function useWorkQueue(params: WorkQueueParams = {}) {
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  if (params.page) qs.set('page', String(params.page))
  if (params.pageSize) qs.set('pageSize', String(params.pageSize))
  return useQuery<PaginatedResponse<WorkItem>>({
    queryKey: ['work-queue', params],
    queryFn: () => apiFetch(`/api/v1/work-queue?${qs}`),
  })
}

export function useWorkQueueSummary() {
  return useQuery<WorkQueueSummary>({
    queryKey: ['work-queue-summary'],
    queryFn: () => apiFetch('/api/v1/work-queue/summary'),
    staleTime: 60_000,
  })
}
