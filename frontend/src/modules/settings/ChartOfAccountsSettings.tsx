import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'

// ─── Note ─────────────────────────────────────────────────────────────────────
// Stored locally — sync to billing system manually.

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountType = 'revenue' | 'expense' | 'asset' | 'liability'

interface COAAccount {
  id: string
  code: string
  name: string
  account_type: AccountType
  notes?: string
}

type FormData = Omit<COAAccount, 'id'>

const EMPTY_FORM: FormData = {
  code: '',
  name: '',
  account_type: 'revenue',
  notes: '',
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  revenue: 'Revenue',
  expense: 'Expense',
  asset: 'Asset',
  liability: 'Liability',
}

const TYPE_BADGE_STYLES: Record<AccountType, string> = {
  revenue: 'bg-[--bb-status-success]/10 text-[--bb-status-success]',
  expense: 'bg-[--bb-status-danger]/10 text-[--bb-status-danger]',
  asset: 'bg-[--bb-brand-blue]/10 text-[--bb-brand-blue]',
  liability: 'bg-[--bb-status-warning]/10 text-[--bb-status-warning]',
}

const LS_KEY = 'ct_coa_accounts'

function loadAccounts(): COAAccount[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as COAAccount[]) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts: COAAccount[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(accounts))
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string
  form: FormData
  onChange: (f: FormData) => void
  onSave: () => void
  onClose: () => void
}

function AccountModal({ title, form, onChange, onSave, onClose }: ModalProps) {
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
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-[--bb-text-secondary] mb-1">
              Code <span className="text-[--bb-status-danger]">*</span>
            </label>
            <input
              className="w-full rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm font-mono text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
              value={form.code}
              onChange={(e) => onChange({ ...form, code: e.target.value })}
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
              value={form.account_type}
              onChange={(e) =>
                onChange({ ...form, account_type: e.target.value as AccountType })
              }
            >
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[--bb-text-secondary] mb-1">
              Notes
            </label>
            <input
              className="w-full rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
              value={form.notes ?? ''}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[--bb-text-secondary] border border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!form.code.trim() || !form.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-brand-blue] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Account
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChartOfAccountsSettings() {
  const [accounts, setAccounts] = useState<COAAccount[]>(loadAccounts)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; editing?: COAAccount } | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<COAAccount | null>(null)

  useEffect(() => {
    saveAccounts(accounts)
  }, [accounts])

  function openAdd() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'add' })
  }

  function openEdit(account: COAAccount) {
    setForm({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      notes: account.notes ?? '',
    })
    setModal({ mode: 'edit', editing: account })
  }

  function handleSave() {
    if (!form.code.trim() || !form.name.trim()) return
    if (modal?.mode === 'add') {
      const next: COAAccount = {
        id: crypto.randomUUID(),
        ...form,
        notes: form.notes?.trim() || undefined,
      }
      setAccounts((prev) => [...prev, next])
    } else if (modal?.mode === 'edit' && modal.editing) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === modal.editing!.id
            ? { ...a, ...form, notes: form.notes?.trim() || undefined }
            : a,
        ),
      )
    }
    setModal(null)
  }

  function handleDelete(account: COAAccount) {
    setAccounts((prev) => prev.filter((a) => a.id !== account.id))
    setDeleteTarget(null)
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
            Stored locally — sync to billing system manually.
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
        {accounts.length === 0 ? (
          <div className="py-16 text-center text-sm text-[--bb-text-secondary]">
            No accounts configured yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--bb-border] bg-[--bb-surface-app]">
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Account Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[--bb-text-secondary]">
                    Notes
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
                      {account.code}
                    </td>
                    <td className="px-4 py-3 text-[--bb-text-primary]">{account.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE_STYLES[account.account_type]}`}
                      >
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[--bb-text-secondary] max-w-xs truncate">
                      {account.notes || '—'}
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
                {deleteTarget.code} — {deleteTarget.name}
              </span>
              ? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[--bb-text-secondary] border border-[--bb-border] hover:bg-[--bb-surface-app] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[--bb-status-danger] text-white hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
