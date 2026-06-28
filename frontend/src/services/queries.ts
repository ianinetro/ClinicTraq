import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Patient, Claim, WorkItem, WorkQueueSummary, Visit, Payment, ERAFile } from '../types'

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

// The backend returns raw arrays; wrap them so the frontend's PaginatedResponse shape works.
async function apiFetchList<T>(url: string, page: number, pageSize: number): Promise<PaginatedResponse<T>> {
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  const data = await res.json()
  // If the backend ever returns a paginated envelope, pass it through unchanged.
  if (data && typeof data === 'object' && 'items' in data) return data as PaginatedResponse<T>
  const items = Array.isArray(data) ? data : []
  return { items, total: items.length, page, pageSize }
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
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<Patient>>({
    queryKey: ['patients', params],
    queryFn: () => apiFetchList(`/api/v1/patients?${qs}`, page, pageSize),
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
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<Claim>>({
    queryKey: ['claims', params],
    queryFn: () => apiFetchList(`/api/v1/claims?${qs}`, page, pageSize),
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
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  if (params.type) qs.set('type', params.type)
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<WorkItem>>({
    queryKey: ['work-queue', params],
    queryFn: () => apiFetchList(`/api/v1/work-queue?${qs}`, page, pageSize),
  })
}

export function useWorkQueueSummary() {
  return useQuery<WorkQueueSummary>({
    queryKey: ['work-queue-summary'],
    queryFn: () => apiFetch('/api/v1/work-queue/summary'),
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

interface VisitsParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

export function useVisits(params: VisitsParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<Visit>>({
    queryKey: ['visits', params],
    queryFn: () => apiFetchList(`/api/v1/visits?${qs}`, page, pageSize),
  })
}

export function useVisit(id: string) {
  return useQuery<Visit>({
    queryKey: ['visits', id],
    queryFn: () => apiFetch(`/api/v1/visits/${id}`),
    enabled: !!id,
  })
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

interface PaymentsParams {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}

interface ERAFilesParams {
  page?: number
  pageSize?: number
}

export function usePayments(params: PaymentsParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.status) qs.set('status', params.status)
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<Payment>>({
    queryKey: ['payments', params],
    queryFn: () => apiFetchList(`/api/v1/payments?${qs}`, page, pageSize),
  })
}

export function useERAFiles(params: ERAFilesParams = {}) {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const qs = new URLSearchParams()
  qs.set('skip', String((page - 1) * pageSize))
  qs.set('limit', String(pageSize))
  return useQuery<PaginatedResponse<ERAFile>>({
    queryKey: ['era-files', params],
    queryFn: () => apiFetchList(`/api/v1/payments/era?${qs}`, page, pageSize),
  })
}
