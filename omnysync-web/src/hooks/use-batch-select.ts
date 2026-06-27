'use client'

import { useState, useCallback, useMemo } from 'react'

export function useBatchSelect<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)))
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isAllSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items, selectedIds]
  )

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  )

  return {
    selectedIds,
    selectedItems,
    selectedCount: selectedIds.size,
    isAllSelected,
    toggle,
    selectAll,
    clearSelection,
  }
}
