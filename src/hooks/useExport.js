import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_FPS } from '../constants'
import { getActiveImageConfig } from '../utils/agentSettings'
import { generateImage } from '../utils/imageGenerator'
import { downloadBlob, exportVideo, supportsMp4Export } from '../utils/videoExport'

export function useExport({
  shots,
  selectedShot,
  updateShot,
  platformTemplate,
  masterAudio,
  setPlaying,
  agentSettings,
  notify,
  setExportDialogOpen,
}) {
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [mp4Ready, setMp4Ready] = useState(false)

  useEffect(() => {
    supportsMp4Export(platformTemplate.width, platformTemplate.height).then(setMp4Ready)
  }, [platformTemplate.width, platformTemplate.height])

  const handleExport = useCallback(async ({ filename = 'video', maxShots = null } = {}) => {
    const exportShots = maxShots ? shots.slice(0, maxShots) : shots
    if (exportShots.length === 0) {
      return
    }
    setExporting(true)
    setExportProgress(0)
    setPlaying(false)
    try {
      let usedWebmFallback = false
      const blob = await exportVideo(exportShots, {
        fps: platformTemplate.fps ?? DEFAULT_FPS,
        width: platformTemplate.width,
        height: platformTemplate.height,
        format: 'mp4',
        masterAudioSrc: masterAudio?.src ?? null,
        onProgress: setExportProgress,
        onFallback: () => {
          usedWebmFallback = true
        },
      })
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const safeName = filename.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'video'
      downloadBlob(blob, `${safeName}.${extension}`)
      setExportDialogOpen(false)
      notify(
        usedWebmFallback
          ? `Export complete — ${safeName}.webm downloaded (MP4 needs Chrome/Edge with WebCodecs).`
          : `Export complete — ${safeName}.${extension} downloaded.`,
      )
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }, [shots, platformTemplate, masterAudio, setPlaying, notify, setExportDialogOpen])

  const regenerateImageForSelectedShot = useCallback(async () => {
    if (!selectedShot) {
      return
    }
    if (!selectedShot.imagePrompt?.trim()) {
      notify('Add an image prompt in the Image tab first.')
      return
    }
    const { config } = getActiveImageConfig(agentSettings)
    if (!config.apiKey?.trim()) {
      notify('Add an image provider API key in Agent → Provider keys.')
      return
    }
    setGeneratingImage(true)
    try {
      const src = await generateImage(selectedShot.imagePrompt, agentSettings, {
        width: platformTemplate.width,
        height: platformTemplate.height,
      })
      if (selectedShot.src?.startsWith('blob:')) {
        URL.revokeObjectURL(selectedShot.src)
      }
      updateShot(selectedShot.id, { src, missingImage: false, file: null })
      notify(`Generated image for ${selectedShot.name}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Image generation failed.')
    } finally {
      setGeneratingImage(false)
    }
  }, [selectedShot, agentSettings, platformTemplate, updateShot, notify])

  return {
    exporting,
    exportProgress,
    generatingImage,
    mp4Ready,
    handleExport,
    regenerateImageForSelectedShot,
    setExporting,
  }
}
