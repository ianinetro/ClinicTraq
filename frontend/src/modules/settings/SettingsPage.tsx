import { useState } from 'react'
import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Building2, Users, MapPin, Shield, Stethoscope, FileCode, BookOpen, UserCog, Clock, TrendingDown } from 'lucide-react'
import { TFLSettings } from './TFLSettings'

interface SettingsSection {
  id: string
  label: string
  icon: React.ElementType
  group: string
  path: string
}

const sections: SettingsSection[] = [
  // Practice
  { id: 'practice-info', label: 'Practice Info', icon: Building2, group: 'Practice', path: 'practice/info' },
  { id: 'offices', label: 'Offices', icon: MapPin, group: 'Practice', path: 'practice/offices' },
  // Providers
  { id: 'rendering', label: 'Rendering Providers', icon: Stethoscope, group: 'Providers', path: 'providers/rendering' },
  { id: 'billing-providers', label: 'Billing Providers', icon: Stethoscope, group: 'Providers', path: 'providers/billing' },
  { id: 'referring', label: 'Referring Providers', icon: Stethoscope, group: 'Providers', path: 'providers/referring' },
  // Facilities
  { id: 'facilities', label: 'Facilities', icon: Building2, group: 'Facilities', path: 'facilities' },
  // Payers
  { id: 'payers', label: 'Payers & Insurance', icon: Shield, group: 'Payers & Insurance', path: 'payers' },
  // Codes
  { id: 'cpt-codes', label: 'CPT Codes', icon: FileCode, group: 'Codes', path: 'codes/cpt' },
  { id: 'icd-codes', label: 'Diagnosis Codes', icon: BookOpen, group: 'Codes', path: 'codes/icd' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen, group: 'Codes', path: 'codes/accounts' },
  // Users
  { id: 'users', label: 'Users & Roles', icon: UserCog, group: 'Users', path: 'users' },
  // Billing Rules
  { id: 'tfl', label: 'Timely Filing Limits', icon: Clock, group: 'Billing Rules', path: 'billing/tfl' },
  { id: 'deductible', label: 'Deductible Tracker', icon: TrendingDown, group: 'Billing Rules', path: 'billing/deductible' },
]

const groups = Array.from(new Set(sections.map(s => s.group)))

function GenericSettingsSection({ title }: { title: string }) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#12122C]">{title}</h2>
        <p className="text-sm text-[#676687] mt-1">
          Manage {title.toLowerCase()} settings for your practice.
        </p>
        <div className="mt-2 bg-[#D9FCFF] border border-[#94F2FA] rounded-lg px-3 py-2 text-xs text-[#007998]">
          Changes here affect billing workflows, claim generation, and downstream reporting.
        </div>
      </div>
      <div className="bg-white border border-[#E3E3F1] rounded-lg p-6 text-center">
        <p className="text-sm text-[#676687]">{title} configuration coming soon.</p>
      </div>
    </div>
  )
}

export function SettingsPage() {
  return (
    <div className="flex h-full">
      {/* Left settings nav */}
      <nav className="w-56 flex-shrink-0 border-r border-[#E3E3F1] bg-white py-4 overflow-y-auto">
        {groups.map(group => (
          <div key={group} className="mb-3">
            <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#BABACE]">
              {group}
            </p>
            {sections
              .filter(s => s.group === group)
              .map(section => {
                const Icon = section.icon
                return (
                  <NavLink
                    key={section.id}
                    to={`/settings/${section.path}`}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-[#EFF0FF] text-[#0410BD] font-medium border-l-[3px] border-l-[#0410BD] pl-[13px]'
                          : 'text-[#676687] hover:bg-[#F2F2F8] hover:text-[#12122C]',
                      )
                    }
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    {section.label}
                  </NavLink>
                )
              })}
          </div>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto bg-[#F2F2F8]">
        <Routes>
          <Route index element={<Navigate to="practice/info" replace />} />
          <Route path="practice/info" element={<GenericSettingsSection title="Practice Info" />} />
          <Route path="practice/offices" element={<GenericSettingsSection title="Offices" />} />
          <Route path="providers/rendering" element={<GenericSettingsSection title="Rendering Providers" />} />
          <Route path="providers/billing" element={<GenericSettingsSection title="Billing Providers" />} />
          <Route path="providers/referring" element={<GenericSettingsSection title="Referring Providers" />} />
          <Route path="facilities" element={<GenericSettingsSection title="Facilities" />} />
          <Route path="payers" element={<GenericSettingsSection title="Payers & Insurance" />} />
          <Route path="codes/cpt" element={<GenericSettingsSection title="CPT Codes" />} />
          <Route path="codes/icd" element={<GenericSettingsSection title="Diagnosis Codes" />} />
          <Route path="codes/accounts" element={<GenericSettingsSection title="Chart of Accounts" />} />
          <Route path="users" element={<GenericSettingsSection title="Users & Roles" />} />
          <Route path="billing/tfl" element={<TFLSettings />} />
          <Route path="billing/deductible" element={<GenericSettingsSection title="Deductible Tracker Settings" />} />
          <Route path="*" element={<Navigate to="practice/info" replace />} />
        </Routes>
      </div>
    </div>
  )
}
