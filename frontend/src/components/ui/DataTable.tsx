import React from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{
            height: 14, borderRadius: 4,
            background: 'linear-gradient(90deg, var(--bb-border) 25%, var(--bb-surface-app) 50%, var(--bb-border) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            width: `${60 + Math.random() * 30}%`,
          }} />
        </td>
      ))}
    </tr>
  )
}

export function DataTable<T extends Record<string, unknown>>({ columns, data, isLoading, emptyMessage = 'No data found' }: DataTableProps<T>) {
  return (
    <>
      <style>{`
        @keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
      `}</style>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--bb-border)' }}>
              {columns.map(col => (
                <th key={col.key} style={{
                  padding: '10px 16px', textAlign: 'left',
                  fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--bb-text-secondary)',
                  whiteSpace: 'nowrap',
                }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={columns.length} />)
              : data.length === 0
              ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--bb-text-secondary)' }}>
                    {emptyMessage}
                  </td>
                </tr>
              )
              : data.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--bb-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bb-surface-app)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '12px 16px', color: 'var(--bb-text-primary)' }}>
                      {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </>
  )
}
