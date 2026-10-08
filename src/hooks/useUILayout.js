import { useCallback, useEffect, useState } from 'react'

function readStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }
  return window.localStorage.getItem(key) ?? fallback
}

export function useUILayout() {
  const [message, setMessage] = useState('')
  const [sidebarTab, setSidebarTab] = useState(() => readStorage('iv-sidebar-tab', 'projects'))
  const [projectFocusMode, setProjectFocusMode] = useState(() => readStorage('iv-project-focus') === 'on')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => readStorage('iv-left-sidebar', 'open') !== 'closed')
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => readStorage('iv-right-sidebar', 'open') !== 'closed')
  const [timelineHeight, setTimelineHeight] = useState(() => {
    const saved = Number(readStorage('iv-timeline-height', '280'))
    return Number.isFinite(saved) && saved >= 180 ? saved : 280
  })
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [costModePrompt, setCostModePrompt] = useState(null)

  const notify = useCallback((text) => {
    setMessage(text)
  }, [])

  useEffect(() => {
    if (!message) {
      return undefined
    }
    const timer = window.setTimeout(() => setMessage(''), 5000)
    return () => window.clearTimeout(timer)
  }, [message])

  const handleSidebarTabChange = useCallback((tabId) => {
    setSidebarTab(tabId)
    window.localStorage.setItem('iv-sidebar-tab', tabId)
    setLeftSidebarOpen(true)
    window.localStorage.setItem('iv-left-sidebar', 'open')
  }, [])

  const handleProjectFocusChange = useCallback((enabled) => {
    setProjectFocusMode(enabled)
    window.localStorage.setItem('iv-project-focus', enabled ? 'on' : 'off')
    if (enabled) {
      setLeftSidebarOpen(true)
      window.localStorage.setItem('iv-left-sidebar', 'open')
    }
  }, [])

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen((open) => {
      const next = !open
      window.localStorage.setItem('iv-left-sidebar', next ? 'open' : 'closed')
      return next
    })
  }, [])

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen((open) => {
      const next = !open
      window.localStorage.setItem('iv-right-sidebar', next ? 'open' : 'closed')
      return next
    })
  }, [])

  const startTimelineResize = useCallback((event) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = timelineHeight

    function onMove(moveEvent) {
      const next = Math.max(180, Math.min(520, startHeight + (startY - moveEvent.clientY)))
      setTimelineHeight(next)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setTimelineHeight((height) => {
        window.localStorage.setItem('iv-timeline-height', String(height))
        return height
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [timelineHeight])

  return {
    message,
    notify,
    sidebarTab,
    projectFocusMode,
    leftSidebarOpen,
    rightSidebarOpen,
    timelineHeight,
    exportDialogOpen,
    setExportDialogOpen,
    costModePrompt,
    setCostModePrompt,
    handleSidebarTabChange,
    handleProjectFocusChange,
    toggleLeftSidebar,
    toggleRightSidebar,
    startTimelineResize,
  }
}
