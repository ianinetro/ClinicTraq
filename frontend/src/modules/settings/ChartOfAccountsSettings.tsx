import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = 'income' | 'expense' | 'asset' | 'liability'

interface COAAccount {
  id: string
  accountNumber: string
  name: string
  accountType: AccountType
  parentId?: string | null
}

type FormData = {
  accountNumber: string
  name: string
  accountType: AccountType
}

const EMPTY_FORM: FormData = {
  accountNumber: '',
  name: '',
  accountType: 'income',
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  income: 'Income',
  expense: 'Expense',
  asset: 'Asset',
  liability: 'Liability',
}

const TYPE_BADGE_STYLES: Record<AccountType, string> = {
  income: 'bg-[--bb-status-success]/10 text-[--bb-status-success]',
  expense: 'bg-[--bb-status-danger]/10 text-[--bb-status-danger]',
  asset: 'bg-[--bb-brand-blue]/10 text-[--bb-brand-blue]',
  liability: 'bg-[--bb-status-warning]/10 text-[--bb-status-warning]',
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchAccounts(): Promise<COAAccount[]> {
  const res = await apiClient.get('/chart-accounts')
  return res.data
}

async function createAccount(data: FormData): Promise<COAAccount> {
  const res = await apiClient.post('/chart-accounts', data)
  return res.data
}

async function updateAccount({ id, data }: { id: string; data: Partial<FormData> }): Promise<COAAccount> {
  const res = await apiClient.patch(`/chart-accounts/${id}`, data)
  return res.data
}

async function deleteAccount(id: string): Promise<void> {
  await apiClient.delete(`/chart-accounts/${id}`)
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="divide-y divide-[--bb-border]">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
          <div className="h-4 w-16 rounded bg-[--bb-border]" />
          <div className="h-4 w-48 rounded bg-[--bb-border]" />
          <div className="h-5 w-20 rounded-full bg-[--bb-border]" />
          <div className="ml-auto h-4 w-12 rounded bg-[--bb-border]" />
        </div>
      ))}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string
  form: FormData
  saving: boolean
  onChange: (f: FormData) => void
  onSave: () => void
  onClose: () => void
}

function AccountModal({ title, form, saving, onChange, onSave, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[--bb-brand-ink]/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md rounded-xl bg-[--bb-surface-card] shadow-xl border border-[--bb-border] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[--bb-text-primary] mb-5">
          {title}
        </h2>

        <div className="space-y-4">
          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-[--bb-text-secondary] mb-1">
              Account # <span className="text-[--bb-status-danger]">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm font-mono text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
              value={form.accountNumber}
              onChange={(e) => onChange({ ...form, accountNumber: e.target.value })}
              placeholder="e.g. 4000"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[--bb-text-secondary] mb-1">
              Account Name <span className="text-[--bb-status-danger]">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g. Patient Service Revenue"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-[--bb-text-secondary] mb-1">
              Account Type <span className="text-[--bb-status-danger]">*</span>
            </label>
            <select
              className="w-full rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
              value={form.accountType}
              onChange={(e) =>
                onChange({ ...form, accountType: e.target.value as AccountType })
              }
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[--bb-text-secondary] border border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!form.accountNumber.trim() || !form.name.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-brand-blue] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChartOfAccountsSettings() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; editing?: COAAccount } | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<COAAccount | null>(null)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['chart-accounts'],
    queryFn: fetchAccounts,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['chart-accounts'] })

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => { invalidate(); setDeleteTarget(null) },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'add' })
  }

  function openEdit(account: COAAccount) {
    setForm({
      accountNumber: account.accountNumber,
      name: account.name,
      accountType: account.accountType,
    })
    setModal({ mode: 'edit', editing: account })
  }

  function handleSave() {
    if (!form.accountNumber.trim() || !form.name.trim()) return
    if (modal?.mode === 'add') {
      createMutation.mutate(form)
    } else if (modal?.mode === 'edit' && modal.editing) {
      updateMutation.mutate({ id: modal.editing.id, data: { name: form.name, accountType: form.accountType } })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[--bb-text-primary]">
            Chart of Accounts
          </h1>
          <p className="mt-0.5 text-sm text-[--bb-text-secondary]">
            Manage your organization's chart of accounts.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-brand-blue] text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-[--bb-border] bg-[--bb-surface-card] overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : accounts.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4">
            <p className="text-sm text-[--bb-text-secondary]">No accounts yet.</p>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-brand-blue] text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--bb-border] bg-[--bb-surface-app]">
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Account #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-[--bb-text-secondary]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--bb-border]">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-[--bb-surface-app]/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-[--bb-text-primary]">
                      {account.accountNumber}
                    </td>
                    <td className="px-4 py-3 text-[--bb-text-primary]">{account.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_STYLES[account.accountType]}`}
                      >
                        {ACCOUNT_TYPE_LABELS[account.accountType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(account)}
                          className="p-1.5 rounded-md text-[--bb-text-secondary] hover:bg-[--bb-surface-app] hover:text-[--bb-brand-blue] transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(account)}
                          className="p-1.5 rounded-md text-[--bb-text-secondary] hover:bg-[--bb-surface-app] hover:text-[--bb-status-danger] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <AccountModal
          title={modal.mode === 'add' ? 'Add Account' : 'Edit Account'}
          form={form}
          saving={isSaving}
          onChange={setForm}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[--bb-brand-ink]/40"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-[--bb-surface-card] border border-[--bb-border] shadow-xl p-6">
            <h2 className="text-base font-semibold text-[--bb-text-primary] mb-2">
              Delete Account
            </h2>
            <p className="text-sm text-[--bb-text-secondary]">
              Are you sure you want to delete{' '}
              <span className="font-medium text-[--bb-text-primary]">
                {deleteTarget.accountNumber} — {deleteTarget.name}
              </span>
              ? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[--bb-text-secondary] border border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-status-danger] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
