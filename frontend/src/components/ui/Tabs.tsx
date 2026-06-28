import { createContext, useContext, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'

type TabsVariant = 'underline' | 'pill'

interface TabsContextValue {
  activeTab: string
  setActiveTab: (id: string) => void
  variant: TabsVariant
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within Tabs')
  return ctx
}

interface TabsProps {
  defaultTab: string
  value?: string
  variant?: TabsVariant
  children: ReactNode
  className?: string
  onChange?: (tab: string) => void
}

export function Tabs({ defaultTab, value, variant = 'underline', children, className, onChange }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab)
  const activeTab = value ?? internalTab
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: (id) => { setInternalTab(id); onChange?.(id) }, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabListProps {
  children: ReactNode
  className?: string
}

export function TabList({ children, className }: TabListProps) {
  const { variant } = useTabs()
  return (
    <div
      role="tablist"
      className={clsx(
        'flex items-center',
        variant === 'underline' && 'border-b border-[#E3E3F1] gap-0',
        variant === 'pill' && 'gap-1 bg-[#F2F2F8] p-1 rounded-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface TabProps {
  id: string
  children: ReactNode
  disabled?: boolean
}

export function Tab({ id, children, disabled }: TabProps) {
  const { activeTab, setActiveTab, variant } = useTabs()
  const isActive = activeTab === id

  return (
    <button
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !disabled && setActiveTab(id) }
      }}
      className={clsx(
        'text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#3F4CFF] focus-visible:ring-offset-1 rounded-sm',
        variant === 'underline' && [
          'px-4 py-2.5 -mb-px border-b-2',
          isActive
            ? 'border-[#0410BD] text-[#0410BD]'
            : 'border-transparent text-[#676687] hover:text-[#12122C]',
          disabled && 'opacity-40 cursor-not-allowed',
        ],
        variant === 'pill' && [
          'px-3 py-1.5 rounded-md',
          isActive
            ? 'bg-white text-[#0410BD] shadow-sm'
            : 'text-[#676687] hover:text-[#12122C]',
          disabled && 'opacity-40 cursor-not-allowed',
        ],
      )}
    >
      {children}
    </button>
  )
}

interface TabPanelProps {
  id: string
  children: ReactNode
  className?: string
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  const { activeTab } = useTabs()
  if (activeTab !== id) return null
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}
