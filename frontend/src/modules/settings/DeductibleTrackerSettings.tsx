import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResetPeriod = 'annual' | 'plan_year' | 'benefit_period'

type PayerTier = 'Primary' | 'Secondary'

interface PayerOverride {
  id: string
  payer_name: string
  reset_month: number
  tier: PayerTier
}

interface DeductibleSettings {
  reset_period: ResetPeriod
  alert_threshold: number
  payer_overrides: PayerOverride[]
}

const LS_KEY = 'ct_deductible_settings'

const DEFAULT_SETTINGS: DeductibleSettings = {
  reset_period: 'annual',
  alert_threshold: 80,
  payer_overrides: [],
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function loadSettings(): DeductibleSettings {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<DeductibleSettings>) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DeductibleTrackerSettings() {
  const [settings, setSettings] = useState<DeductibleSettings>(loadSettings)
  const [saved, setSaved] = useState(false)

  // Track new payer row inputs
  const [newPayer, setNewPayer] = useState<{ payer_name: string; reset_month: number; tier: PayerTier }>({
    payer_name: '',
    reset_month: 1,
    tier: 'Primary',
  })

  function handleSave() {
    localStorage.setItem(LS_KEY, JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addPayerOverride() {
    if (!newPayer.payer_name.trim()) return
    const entry: PayerOverride = {
      id: crypto.randomUUID(),
      ...newPayer,
      payer_name: newPayer.payer_name.trim(),
    }
    setSettings((prev) => ({ ...prev, payer_overrides: [...prev.payer_overrides, entry] }))
    setNewPayer({ payer_name: '', reset_month: 1, tier: 'Primary' })
  }

  function removePayerOverride(id: string) {
    setSettings((prev) => ({
      ...prev,
      payer_overrides: prev.payer_overrides.filter((p) => p.id !== id),
    }))
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[--bb-text-primary]">
          Deductible Tracker Settings
        </h1>
        <p className="mt-0.5 text-sm text-[--bb-text-secondary]">
          Configure how patient deductibles are tracked and alerted across your practice.
        </p>
      </div>

      {/* Card 1 — Auto-Reset Period */}
      <div className="rounded-xl border border-[--bb-border] bg-[--bb-surface-card] p-5">
        <h2 className="text-sm font-semibold text-[--bb-text-primary] mb-1">
          Auto-Reset Period
        </h2>
        <p className="text-xs text-[--bb-text-secondary] mb-4">
          Controls when patient deductibles reset to zero.
        </p>
        <div className="space-y-3">
          {(
            [
              { value: 'annual', label: 'Annual (Jan 1)' },
              { value: 'plan_year', label: 'Plan Year' },
              { value: 'benefit_period', label: 'Benefit Period' },
            ] as { value: ResetPeriod; label: string }[]
          ).map(({ value, label }) => (
            <label key={value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="reset_period"
                value={value}
                checked={settings.reset_period === value}
                onChange={() => setSettings((prev) => ({ ...prev, reset_period: value }))}
                className="accent-[--bb-brand-blue] w-4 h-4"
              />
              <span className="text-sm text-[--bb-text-primary] group-hover:text-[--bb-brand-blue] transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Card 2 — Alert Threshold */}
      <div className="rounded-xl border border-[--bb-border] bg-[--bb-surface-card] p-5">
        <h2 className="text-sm font-semibold text-[--bb-text-primary] mb-1">
          Alert Threshold
        </h2>
        <p className="text-xs text-[--bb-text-secondary] mb-4">
          Show alert when patient has met X% of deductible.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={100}
            value={settings.alert_threshold}
            onChange={(e) => {
              const val = Math.min(100, Math.max(0, Number(e.target.value)))
              setSettings((prev) => ({ ...prev, alert_threshold: val }))
            }}
            className="w-24 rounded-lg border border-[--bb-border] bg-[--bb-surface-app] px-3 py-2 text-sm text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
          />
          <span className="text-sm text-[--bb-text-secondary]">%</span>
          <div className="flex-1 h-2 rounded-full bg-[--bb-surface-app] border border-[--bb-border] overflow-hidden">
            <div
              className="h-full rounded-full bg-[--bb-brand-blue] transition-all"
              style={{ width: `${settings.alert_threshold}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card 3 — Payer Overrides */}
      <div className="rounded-xl border border-[--bb-border] bg-[--bb-surface-card] p-5">
        <h2 className="text-sm font-semibold text-[--bb-text-primary] mb-1">
          Payer Overrides
        </h2>
        <p className="text-xs text-[--bb-text-secondary] mb-4">
          Override the reset month and tier for specific payers.
        </p>

        <div className="overflow-x-auto rounded-lg border border-[--bb-border]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[--bb-surface-app] border-b border-[--bb-border]">
                <th className="px-3 py-2.5 text-left font-medium text-[--bb-text-secondary]">
                  Payer Name
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-[--bb-text-secondary]">
                  Reset Month
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-[--bb-text-secondary]">
                  Tier
                </th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[--bb-border]">
              {settings.payer_overrides.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-xs text-[--bb-text-secondary]"
                  >
                    No payer overrides added yet.
                  </td>
                </tr>
              )}
              {settings.payer_overrides.map((p) => (
                <tr key={p.id} className="hover:bg-[--bb-surface-app]/50 transition-colors">
                  <td className="px-3 py-2.5 text-[--bb-text-primary]">{p.payer_name}</td>
                  <td className="px-3 py-2.5 text-[--bb-text-secondary]">
                    {MONTH_NAMES[p.reset_month - 1]}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.tier === 'Primary'
                          ? 'bg-[--bb-brand-blue]/10 text-[--bb-brand-blue]'
                          : 'bg-[--bb-text-secondary]/10 text-[--bb-text-secondary]'
                      }`}
                    >
                      {p.tier}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => removePayerOverride(p.id)}
                      className="p-1 rounded text-[--bb-text-secondary] hover:text-[--bb-status-danger] hover:bg-[--bb-surface-app] transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {/* New row inputs */}
              <tr className="bg-[--bb-surface-app]/40">
                <td className="px-3 py-2">
                  <input
                    value={newPayer.payer_name}
                    onChange={(e) => setNewPayer((p) => ({ ...p, payer_name: e.target.value }))}
                    placeholder="Payer name"
                    className="w-full rounded-md border border-[--bb-border] bg-[--bb-surface-card] px-2 py-1.5 text-xs text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={newPayer.reset_month}
                    onChange={(e) =>
                      setNewPayer((p) => ({ ...p, reset_month: Number(e.target.value) }))
                    }
                    className="w-full rounded-md border border-[--bb-border] bg-[--bb-surface-card] px-2 py-1.5 text-xs text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={newPayer.tier}
                    onChange={(e) =>
                      setNewPayer((p) => ({ ...p, tier: e.target.value as PayerTier }))
                    }
                    className="w-full rounded-md border border-[--bb-border] bg-[--bb-surface-card] px-2 py-1.5 text-xs text-[--bb-text-primary] focus:outline-none focus:ring-2 focus:ring-[--bb-brand-blue]/40"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={addPayerOverride}
                    disabled={!newPayer.payer_name.trim()}
                    className="p-1 rounded text-[--bb-brand-blue] hover:bg-[--bb-brand-blue]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Add row"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          className="px-5 py-2 rounded-lg text-sm font-medium bg-[--bb-brand-blue] text-white hover:opacity-90 transition-opacity"
        >
          Save Settings
        </button>
        {saved && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[--bb-status-success]/10 text-[--bb-status-success]">
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
