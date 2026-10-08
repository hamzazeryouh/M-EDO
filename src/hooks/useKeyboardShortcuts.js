import { useEffect } from 'react'

export function useKeyboardShortcuts({
  togglePlay,
  goToPrevShot,
  goToNextShot,
  goToStart,
  splitAtPlayhead,
  removeShot,
  undo,
  redo,
  saveCurrentProject,
  selectedId,
}) {
  useEffect(() => {
    function onKeyDown(event) {
      const tag = event.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return
      }
      const mod = event.ctrlKey || event.metaKey
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay?.()
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault()
        goToPrevShot?.()
      } else if (event.code === 'ArrowRight') {
        event.preventDefault()
        goToNextShot?.()
      } else if (event.code === 'Home') {
        event.preventDefault()
        goToStart?.()
      } else if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveCurrentProject?.()
      } else if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo?.()
      } else if (mod && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo?.()
      } else if ((event.code === 'KeyS' || event.key === 's') && !mod) {
        event.preventDefault()
        splitAtPlayhead?.()
      } else if (event.code === 'Delete' && selectedId) {
        event.preventDefault()
        removeShot?.(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    togglePlay,
    goToPrevShot,
    goToNextShot,
    goToStart,
    splitAtPlayhead,
    removeShot,
    undo,
    redo,
    saveCurrentProject,
    selectedId,
  ])
}
