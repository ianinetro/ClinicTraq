import { useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from './Button'

export interface ColumnDef<T> {
  id: string
  header: string
  accessor?: keyof T
  cell?: (row: T) => ReactNode
  sortable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

interface TableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  error?: string
  emptyIcon?: ReactNode
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: { label: string; onClick: () => void }
  toolbar?: ReactNode
  onRowClick?: (row: T) => void
  getRowId?: (row: T) => string
  selectedIds?: Set<string>
  onSelectionChange?: (ids: Set<string>) => void
  multiSelect?: boolean
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string, dir: 'asc' | 'desc') => void
  className?: string
  rowClassName?: (row: T) => string | undefined
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[#E3E3F1] rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
        </td>
      ))}
    </tr>
  )
}

export function Table<T extends Record<string, unknown>>({
  columns, data, loading, error,
  emptyIcon, emptyTitle = 'No data', emptyDescription, emptyAction,
  toolbar, onRowClick, getRowId, selectedIds, onSelectionChange, multiSelect,
  page = 1, pageSize = 25, total = 0, onPageChange, onPageSizeChange,
  sortKey, sortDir, onSort, className, rowClassName,
}: TableProps<T>) {
  const [localSort, setLocalSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const effectiveSortKey = sortKey ?? localSort?.key
  const effectiveSortDir = sortDir ?? localSort?.dir ?? 'asc'
  const totalPages = Math.ceil(total / pageSize)
  const allIds = data.map((row) => getRowId?.(row) ?? '')
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds?.has(id))

  function handleSort(col: ColumnDef<T>) {
    if (!col.sortable) return
    const newDir = effectiveSortKey === col.id && effectiveSortDir === 'asc' ? 'desc' : 'asc'
    if (onSort) {
      onSort(col.id, newDir)
    } else {
      setLocalSort({ key: col.id, dir: newDir })
    }
  }

  function toggleAll() {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(allIds))
    }
  }

  function toggleRow(id: string) {
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  return (
    <div className={clsx('bg-white border border-[#E3E3F1] rounded-lg overflow-hidden', className)}>
      {toolbar && (
        <div className="px-4 py-3 border-b border-[#E3E3F1] flex items-center gap-3 flex-wrap">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-[#F2F2F8] sticky top-0 z-10">
            <tr>
              {multiSelect && (
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-[#BABACE] text-[#0410BD]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col)}
                  style={{ width: col.width }}
                  className={clsx(
                    'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[#676687] whitespace-nowrap h-10',
                    col.sortable && 'cursor-pointer hover:text-[#12122C] select-none',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      effectiveSortKey === col.id ? (
                        effectiveSortDir === 'asc'
                          ? <ChevronUp size={12} />
                          : <ChevronDown size={12} />
                      ) : <ChevronsUpDown size={12} className="opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E3F1]">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <SkeletonRow key={i} cols={(multiSelect ? 1 : 0) + columns.length} />
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length + (multiSelect ? 1 : 0)} className="py-12 text-center">
                  <p className="text-sm text-[#B91C1C]">{error}</p>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (multiSelect ? 1 : 0)} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-[#BABACE]">{emptyIcon ?? <Inbox size={32} />}</span>
                    <div>
                      <p className="text-sm font-medium text-[#12122C]">{emptyTitle}</p>
                      {emptyDescription && <p className="text-xs text-[#676687] mt-1">{emptyDescription}</p>}
                    </div>
                    {emptyAction && (
                      <Button size="sm" variant="secondary" onClick={emptyAction.onClick}>
                        {emptyAction.label}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const rowId = getRowId?.(row) ?? String(rowIdx)
                const isSelected = selectedIds?.has(rowId)
                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={clsx(
                      'transition-colors h-[44px]',
                      onRowClick && 'cursor-pointer',
                      isSelected
                        ? 'bg-[#F2F2F8] border-l-[3px] border-l-[#0410BD]'
                        : 'hover:bg-[#F2F2F8]',
                      rowClassName?.(row),
                    )}
                  >
                    {multiSelect && (
                      <td className="w-10 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected ?? false}
                          onChange={() => toggleRow(rowId)}
                          className="rounded border-[#BABACE] text-[#0410BD]"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={clsx(
                          'px-4 py-2.5 text-sm text-[#12122C]',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                        )}
                      >
                        {col.cell ? col.cell(row) : col.accessor ? String(row[col.accessor] ?? '') : null}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {(onPageChange || total > 0) && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E3E3F1]">
          <div className="flex items-center gap-2 text-sm text-[#676687]">
            {onPageSizeChange && (
              <>
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="border border-[#BABACE] rounded text-sm px-1.5 py-0.5 text-[#12122C]"
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </>
            )}
            <span>{total > 0 ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : `${data.length} rows`}</span>
          </div>
          {totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-[#EFF0FF] disabled:opacity-30 disabled:cursor-not-allowed text-[#676687]"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-[#676687] px-2">{page} / {totalPages}</span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-[#EFF0FF] disabled:opacity-30 disabled:cursor-not-allowed text-[#676687]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
