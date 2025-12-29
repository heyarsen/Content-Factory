import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { PanelType } from '../types/avatar'

interface AvatarWorkspaceContextValue {
  // Selection state
  selectedAvatarId: string | null
  selectedLooks: Set<string>
  setSelectedAvatarId: (id: string | null) => void
  toggleLookSelection: (lookId: string) => void
  clearLookSelection: () => void

  // Panel state
  panelType: PanelType
  panelData: any
  openPanel: (type: PanelType, data?: any) => void
  closePanel: () => void

  // View state
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
}

const AvatarWorkspaceContext = createContext<AvatarWorkspaceContextValue | null>(null)

export function AvatarWorkspaceProvider({ children }: { children: ReactNode }) {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [selectedLooks, setSelectedLooks] = useState<Set<string>>(new Set())
  const [panelType, setPanelType] = useState<PanelType>(null)
  const [panelData, setPanelData] = useState<any>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const toggleLookSelection = useCallback((lookId: string) => {
    setSelectedLooks(prev => {
      const next = new Set(prev)
      if (next.has(lookId)) {
        next.delete(lookId)
      } else {
        next.add(lookId)
      }
      return next
    })
  }, [])

  const clearLookSelection = useCallback(() => {
    setSelectedLooks(new Set())
  }, [])

  const openPanel = useCallback((type: PanelType, data?: any) => {
    setPanelType(type)
    setPanelData(data || null)
  }, [])

  const closePanel = useCallback(() => {
    setPanelType(null)
    setPanelData(null)
  }, [])

  return (
    <AvatarWorkspaceContext.Provider
      value={{
        selectedAvatarId,
        selectedLooks,
        setSelectedAvatarId,
        toggleLookSelection,
        clearLookSelection,
        panelType,
        panelData,
        openPanel,
        closePanel,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </AvatarWorkspaceContext.Provider>
  )
}

export function useAvatarWorkspace() {
  const context = useContext(AvatarWorkspaceContext)
  if (!context) {
    throw new Error('useAvatarWorkspace must be used within AvatarWorkspaceProvider')
  }
  return context
}

