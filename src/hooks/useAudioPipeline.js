import { useCallback, useState } from 'react'
import { buildSplicedMasterUrl, getAudioDuration } from '../utils/audioMixer'
import { getAudioMatchSlotDuration, matchShotsToAudio } from '../utils/matchShotsToAudio'
import { generateTTSForShots, synthesizeText } from '../utils/textToSpeech'
import { getActiveTtsConfig } from '../utils/agentSettings'

export function useAudioPipeline({
  shots,
  setShots,
  updateShot,
  selectedShot,
  shotsWithVoice,
  agentSettings,
  notify,
}) {
  const [audioTracks, setAudioTracks] = useState([])
  const [masterAudio, setMasterAudio] = useState(null)
  const [splicing, setSplicing] = useState(false)
  const [audioDragFromIndex, setAudioDragFromIndex] = useState(null)
  const [audioDragOverIndex, setAudioDragOverIndex] = useState(null)
  const [ttsVoice, setTtsVoice] = useState('ar-MA-MounaNeural')
  const [ttsRate, setTtsRate] = useState('+0%')
  const [ttsDelivery, setTtsDelivery] = useState('human')
  const [ttsMatchDuration, setTtsMatchDuration] = useState(true)
  const [generatingTTS, setGeneratingTTS] = useState(false)
  const [ttsProgress, setTtsProgress] = useState(0)

  const revokeMasterAudio = useCallback(() => {
    if (masterAudio?.src) {
      URL.revokeObjectURL(masterAudio.src)
    }
  }, [masterAudio])

  const clearAllAudio = useCallback(() => {
    audioTracks.forEach((track) => {
      if (track.src) {
        URL.revokeObjectURL(track.src)
      }
    })
    revokeMasterAudio()
    setAudioTracks([])
    setMasterAudio(null)
    notify('Cleared all audio tracks.')
  }, [audioTracks, revokeMasterAudio, notify])

  const getTtsOptions = useCallback((overrides = {}) => {
    const { provider, config } = getActiveTtsConfig(agentSettings)
    return {
      provider,
      config,
      voice: ttsVoice,
      rate: ttsRate,
      delivery: ttsDelivery,
      ...overrides,
    }
  }, [agentSettings, ttsVoice, ttsRate, ttsDelivery])

  const spliceAudioTracksNow = useCallback(async (tracks = audioTracks) => {
    if (tracks.length === 0) {
      revokeMasterAudio()
      setMasterAudio(null)
      return
    }
    setSplicing(true)
    try {
      revokeMasterAudio()
      const spliced = await buildSplicedMasterUrl(tracks)
      setMasterAudio(spliced)
      notify(`Master audio ready: ${spliced.name}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Audio splice failed.')
    } finally {
      setSplicing(false)
    }
  }, [audioTracks, revokeMasterAudio, notify])

  const addAudioTracks = useCallback(async (fileList) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('audio/'))
    if (files.length === 0) {
      notify('No audio files found.')
      return
    }
    const nextTracks = await Promise.all(
      files.map(async (file) => {
        const src = URL.createObjectURL(file)
        return { id: crypto.randomUUID(), name: file.name, src, duration: await getAudioDuration(src).catch(() => 0) }
      }),
    )
    setAudioTracks((current) => [...current, ...nextTracks])
    notify(`Imported ${nextTracks.length} audio file${nextTracks.length === 1 ? '' : 's'}. Drag ↑↓ to reorder, then Splice.`)
  }, [notify])

  const removeAudioTrack = useCallback((id) => {
    setAudioTracks((current) => {
      const removed = current.find((track) => track.id === id)
      if (removed?.src) {
        URL.revokeObjectURL(removed.src)
      }
      return current.filter((track) => track.id !== id)
    })
    revokeMasterAudio()
    setMasterAudio(null)
    notify('Audio removed. Click Splice again after reordering.')
  }, [revokeMasterAudio, notify])

  const reorderAudioTracks = useCallback((toIndex) => {
    if (audioDragFromIndex === null || audioDragFromIndex === toIndex) {
      setAudioDragFromIndex(null)
      setAudioDragOverIndex(null)
      return
    }
    setAudioTracks((current) => {
      const next = [...current]
      const [moved] = next.splice(audioDragFromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    revokeMasterAudio()
    setMasterAudio(null)
    notify('Audio order updated. Click Splice to rebuild master track.')
    setAudioDragFromIndex(null)
    setAudioDragOverIndex(null)
  }, [audioDragFromIndex, revokeMasterAudio, notify])

  const moveAudioTrack = useCallback((index, direction) => {
    const target = index + direction
    setAudioTracks((current) => {
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
    revokeMasterAudio()
    setMasterAudio(null)
    notify('Audio order updated. Click Splice to rebuild master track.')
  }, [revokeMasterAudio, notify])

  const generateTTSForAllShots = useCallback(async () => {
    if (shotsWithVoice === 0) {
      notify('No voice text found on shots.')
      return
    }
    setGeneratingTTS(true)
    setTtsProgress(0)
    try {
      const updated = await generateTTSForShots(shots, {
        ...getTtsOptions(),
        matchDuration: ttsMatchDuration,
        onProgress: setTtsProgress,
      })
      setShots(updated)
      notify(`Generated TTS for ${shotsWithVoice} shots.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'TTS generation failed.')
    } finally {
      setGeneratingTTS(false)
      setTtsProgress(0)
    }
  }, [shots, shotsWithVoice, getTtsOptions, ttsMatchDuration, setShots, notify])

  const generateTTSForSelectedShot = useCallback(async () => {
    if (!selectedShot?.voice?.trim()) {
      notify('Selected shot has no voice text.')
      return
    }
    setGeneratingTTS(true)
    try {
      if (selectedShot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedShot.audioSrc)
      }
      const result = await synthesizeText(selectedShot.voice, getTtsOptions())
      updateShot(selectedShot.id, {
        audioSrc: result.src,
        audioName: `TTS ${selectedShot.name}`,
        duration: ttsMatchDuration
          ? Math.max(0.5, Math.round((result.duration + 0.25) * 10) / 10)
          : selectedShot.duration,
      })
      notify(`TTS generated for ${selectedShot.name}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'TTS generation failed.')
    } finally {
      setGeneratingTTS(false)
    }
  }, [selectedShot, getTtsOptions, ttsMatchDuration, updateShot, notify])

  const synthesizePreview = useCallback((text, overrides = {}) => {
    return synthesizeText(text, getTtsOptions(overrides))
  }, [getTtsOptions])

  const generatePreviewOnShot = useCallback(async (text, overrides = {}) => {
    if (!selectedShot) {
      throw new Error('Select a shot first.')
    }
    const trimmed = text.trim()
    if (!trimmed) {
      throw new Error('Type narration text first.')
    }
    setGeneratingTTS(true)
    try {
      if (selectedShot.audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedShot.audioSrc)
      }
      const result = await synthesizeText(trimmed, getTtsOptions(overrides))
      updateShot(selectedShot.id, {
        voice: trimmed,
        audioSrc: result.src,
        audioName: `TTS ${selectedShot.name}`,
        duration: ttsMatchDuration
          ? Math.max(0.5, Math.round((result.duration + 0.25) * 10) / 10)
          : selectedShot.duration,
      })
      notify(`Audio added to ${selectedShot.name}.`)
      return result
    } catch (error) {
      notify(error instanceof Error ? error.message : 'TTS generation failed.')
      throw error
    } finally {
      setGeneratingTTS(false)
    }
  }, [selectedShot, getTtsOptions, ttsMatchDuration, updateShot, notify])

  const spliceShotsAudioToMaster = useCallback(async () => {
    const withAudio = shots.filter((shot) => shot.audioSrc)
    if (withAudio.length === 0) {
      notify('Generate or upload per-shot audio first.')
      return
    }
    setSplicing(true)
    try {
      const tracks = await Promise.all(
        withAudio.map(async (shot) => ({
          id: shot.id,
          name: shot.audioName || shot.name,
          src: shot.audioSrc,
          duration: await getAudioDuration(shot.audioSrc).catch(() => shot.duration),
        })),
      )
      setAudioTracks(tracks)
      await spliceAudioTracksNow(tracks)
      notify(`Spliced ${tracks.length} clips into master track.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Splice failed.')
    } finally {
      setSplicing(false)
    }
  }, [shots, spliceAudioTracksNow, notify])

  const fitShotsToMasterAudio = useCallback(() => {
    if (!masterAudio) {
      notify('Splice audio first, then fit shots.')
      return
    }
    const slotDuration = getAudioMatchSlotDuration(agentSettings)
    setShots((current) => matchShotsToAudio(current, masterAudio.duration, {
      mode: agentSettings.audioMatchMode ?? 'loopRandom',
      perShotDuration: slotDuration,
      stylePresetId: agentSettings.stylePresetId,
      randomize: true,
    }))
    notify(
      agentSettings.audioMatchMode === 'stretch'
        ? 'Shot lengths stretched to master audio.'
        : 'Images looped & mixed randomly to match long audio.',
    )
  }, [masterAudio, agentSettings, setShots, notify])

  return {
    audioTracks,
    setAudioTracks,
    masterAudio,
    setMasterAudio,
    splicing,
    setSplicing,
    audioDragFromIndex,
    setAudioDragFromIndex,
    audioDragOverIndex,
    setAudioDragOverIndex,
    ttsVoice,
    setTtsVoice,
    ttsRate,
    setTtsRate,
    ttsDelivery,
    setTtsDelivery,
    ttsMatchDuration,
    setTtsMatchDuration,
    generatingTTS,
    setGeneratingTTS,
    ttsProgress,
    revokeMasterAudio,
    clearAllAudio,
    getTtsOptions,
    spliceAudioTracksNow,
    addAudioTracks,
    removeAudioTrack,
    reorderAudioTracks,
    moveAudioTrack,
    generateTTSForAllShots,
    generateTTSForSelectedShot,
    synthesizePreview,
    generatePreviewOnShot,
    spliceShotsAudioToMaster,
    fitShotsToMasterAudio,
    buildSplicedMasterUrl,
    getAudioDuration,
  }
}
