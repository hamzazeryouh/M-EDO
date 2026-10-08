import { useCallback, useEffect, useMemo, useState } from 'react'
import { PRESETS, applyPreset, applyRandomMix, createShot } from '../constants'
import { useHistoryState } from './useHistoryState'
import { duplicateShot, setShotDuration, splitShotsAtTime } from '../utils/clipOps'
import { getShotStarts } from '../utils/timeline'
import { applyPlatformTemplateToShots, getPlatformTemplate } from '../platformTemplates'

export function useTimelineState({ notify }) {
  const { value: shots, set: setShots, assign: assignShots, replace: replaceShots, undo, redo, canUndo, canRedo } = useHistoryState([])
  const [selectedId, setSelectedId] = useState(null)
  const [clipMenu, setClipMenu] = useState(null)
  const [dragFromIndex, setDragFromIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [timelineZoom, setTimelineZoom] = useState(1)

  const selectedShot = useMemo(
    () => shots.find((shot) => shot.id === selectedId) ?? null,
    [shots, selectedId],
  )
  const selectedIndex = shots.findIndex((shot) => shot.id === selectedId)
  const duration = useMemo(() => shots.reduce((sum, shot) => sum + shot.duration, 0), [shots])
  const audioCount = shots.filter((shot) => shot.audioSrc).length
  const readyCount = shots.filter((shot) => !shot.missingImage).length
  const missingCount = shots.filter((shot) => shot.missingImage).length
  const shotsWithVoice = shots.filter((shot) => shot.voice?.trim()).length

  useEffect(() => {
    if (currentTime > duration) {
      setCurrentTime(duration)
    }
  }, [duration, currentTime])

  const togglePlay = useCallback(() => {
    if (shots.length === 0) {
      return
    }
    setPlaying((value) => !value)
  }, [shots.length])

  const goToStart = useCallback(() => {
    setCurrentTime(0)
    setPlaying(false)
  }, [])

  const goToPrevShot = useCallback(() => {
    const segments = getShotStarts(shots)
    const currentIndex = segments.findIndex(({ start, end }) => currentTime >= start && currentTime < end)
    const target = currentIndex > 0 ? segments[currentIndex - 1] : segments[0]
    if (target) {
      setSelectedId(target.shot.id)
      setCurrentTime(target.start)
      setPlaying(false)
    }
  }, [shots, currentTime])

  const goToNextShot = useCallback(() => {
    const segments = getShotStarts(shots)
    const currentIndex = segments.findIndex(({ start, end }) => currentTime >= start && currentTime < end)
    const target = currentIndex >= 0 && currentIndex < segments.length - 1 ? segments[currentIndex + 1] : segments.at(-1)
    if (target) {
      setSelectedId(target.shot.id)
      setCurrentTime(target.start)
      setPlaying(false)
    }
  }, [shots, currentTime])

  const updateShot = useCallback((id, patch) => {
    setShots((current) => current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)))
  }, [setShots])

  const changeShotDuration = useCallback((id, seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0.5) {
      return
    }
    setShots((current) => setShotDuration(current, id, seconds))
  }, [setShots])

  const splitAtPlayhead = useCallback(() => {
    const result = splitShotsAtTime(shots, currentTime)
    if (result.error) {
      notify(result.error)
      return
    }
    setShots(result.shots)
    setSelectedId(result.selectedId)
    setCurrentTime(result.seekTime)
    setPlaying(false)
    notify('Clip split at playhead.')
  }, [shots, currentTime, setShots, notify])

  const duplicateSelectedShot = useCallback(() => {
    if (!selectedId) {
      return
    }
    setShots((current) => duplicateShot(current, selectedId))
    notify('Clip duplicated.')
  }, [selectedId, setShots, notify])

  const openClipMenu = useCallback((event, shotId) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedId(shotId)
    const menuWidth = 248
    const menuHeight = 320
    setClipMenu({
      shotId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    })
  }, [])

  const renameShot = useCallback((id, name) => {
    updateShot(id, { name })
    notify(`Renamed clip to "${name}".`)
  }, [updateShot, notify])

  const duplicateShotById = useCallback((id) => {
    setShots((current) => duplicateShot(current, id))
    notify('Clip duplicated.')
  }, [setShots, notify])

  const clearShotAudio = useCallback((id) => {
    setShots((current) => current.map((shot) => {
      if (shot.id !== id) {
        return shot
      }
      if (shot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(shot.audioSrc)
      }
      return { ...shot, audioSrc: null, audioName: '' }
    }))
    notify('Narration removed from clip.')
  }, [setShots, notify])

  const removeShot = useCallback((id) => {
    setShots((current) => {
      const removed = current.find((shot) => shot.id === id)
      if (removed?.audioSrc) {
        URL.revokeObjectURL(removed.audioSrc)
      }
      const next = current.filter((shot) => shot.id !== id)
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null)
      }
      return next
    })
  }, [selectedId, setShots])

  const reorderShots = useCallback((toIndex) => {
    if (dragFromIndex === null || dragFromIndex === toIndex) {
      setDragFromIndex(null)
      setDragOverIndex(null)
      return
    }
    setShots((current) => {
      const next = [...current]
      const [moved] = next.splice(dragFromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setDragFromIndex(null)
    setDragOverIndex(null)
  }, [dragFromIndex, setShots])

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      notify('No image files found.')
      return
    }
    const nextShots = files
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((file) => createShot(file))
    setShots((current) => [...current, ...nextShots])
    setSelectedId((current) => current ?? nextShots[0]?.id ?? null)
    notify(`Added ${nextShots.length} image${nextShots.length === 1 ? '' : 's'}.`)
  }, [setShots, notify])

  const applyAnimationToAll = useCallback((animation) => {
    setShots((current) => current.map((shot) => ({ ...shot, animation })))
    notify(`Applied "${animation}" to all shots.`)
  }, [setShots, notify])

  const applyDurationToAll = useCallback((seconds) => {
    setShots((current) => current.map((shot) => ({ ...shot, duration: seconds })))
    notify(`Set ${seconds}s duration on all shots.`)
  }, [setShots, notify])

  const applySelectedPreset = useCallback((presetId) => {
    setShots((current) => applyPreset(current, presetId))
    notify(`Applied "${PRESETS.find((item) => item.id === presetId)?.label ?? presetId}" preset.`)
  }, [setShots, notify])

  const applyPlatformToShots = useCallback((templateId) => {
    setShots((current) => applyPlatformTemplateToShots(current, templateId))
  }, [setShots])

  const randomizeMix = useCallback(() => {
    setShots((current) => applyRandomMix(current))
    notify('Random animation & transition applied.')
  }, [setShots, notify])

  const selectShot = useCallback((id) => {
    setSelectedId(id)
    const segment = getShotStarts(shots).find((item) => item.shot.id === id)
    if (segment) {
      setCurrentTime(segment.start)
      setPlaying(false)
    }
  }, [shots])

  const resetTimeline = useCallback(() => {
    replaceShots([])
    setSelectedId(null)
    setCurrentTime(0)
    setPlaying(false)
  }, [replaceShots])

  return {
    shots,
    setShots,
    assignShots,
    replaceShots,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedId,
    setSelectedId,
    clipMenu,
    setClipMenu,
    dragFromIndex,
    setDragFromIndex,
    dragOverIndex,
    setDragOverIndex,
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    timelineZoom,
    setTimelineZoom,
    selectedShot,
    selectedIndex,
    duration,
    audioCount,
    readyCount,
    missingCount,
    shotsWithVoice,
    togglePlay,
    goToStart,
    goToPrevShot,
    goToNextShot,
    updateShot,
    changeShotDuration,
    splitAtPlayhead,
    duplicateSelectedShot,
    openClipMenu,
    renameShot,
    duplicateShotById,
    clearShotAudio,
    removeShot,
    reorderShots,
    addFiles,
    applyAnimationToAll,
    applyDurationToAll,
    applySelectedPreset,
    applyPlatformToShots,
    randomizeMix,
    selectShot,
    resetTimeline,
    getPlatformTemplate,
  }
}
