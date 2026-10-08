import {
  applyPreset,
  fitShotsToAudioDuration,
  formatTime,
  shotsFromScript,
} from '../constants'
import { getAudioMatchSlotDuration, matchShotsToAudio } from './matchShotsToAudio'
import { applyPlatformTemplateToShots } from '../platformTemplates'
import { getActiveAiConfig, getMaxImages, getTargetDurationSeconds } from './agentSettings'
import { planVideoWithAi } from './aiAgent'
import { generateImagesForShots } from './imageGenerator'
import { countShotsNeedingImages } from './shotImages'
import { loadKoreaProject } from './loadKoreaProject'
import { shouldUseAiNarration } from './modelDefaults'
import { generateNarrationForShots, generateVideoScript } from './scriptGenerator'
import { generateTTSForShots } from './textToSpeech'
import { throwIfStopped } from './agentStop'

export async function executeAgentStep(stepId, ctx) {
  const {
    settings,
    template,
    workingShots,
    workingMaster,
    appendAgentLog,
    setAgentProgress,
    progressBase,
    progressSpan,
    getTtsOptions,
    setGeneratingTTS,
    setSplicing,
    setExporting,
    setShots,
    assignShots,
    setSelectedId,
    setCurrentTime,
    setProjectName,
    setPlatformTemplateId,
    setAudioTracks,
    setMasterAudio,
    revokeMasterAudio,
    buildSplicedMasterUrl,
    getAudioDuration,
    exportVideo,
    downloadBlob,
    DEFAULT_FPS,
    onImageReady,
    signal,
  } = ctx

  const report = (value) => setAgentProgress(progressBase + value * progressSpan)
  throwIfStopped(signal)

  switch (stepId) {
    case 'generateScript': {
      if (!settings.projectBrief?.trim()) {
        throw new Error('Enter a video topic/brief in the Agent panel first.')
      }
      const { config: aiConfig } = getActiveAiConfig(settings)
      if (!aiConfig.apiKey?.trim()) {
        throw new Error('AI provider API key required for script generation.')
      }
      appendAgentLog('Generating full video script with AI…')
      const script = await generateVideoScript(settings, {
        brief: settings.projectBrief,
        language: settings.scriptLanguage,
        platformLabel: template.label,
        onProgress: (value) => report(value),
        signal,
      })
      const nextShots = shotsFromScript(script.shots, settings.stylePresetId)
      setShots(nextShots)
      setSelectedId(nextShots[0]?.id ?? null)
      setCurrentTime(0)
      setProjectName(script.title || 'AI Generated Video')
      appendAgentLog(`✓ Script: ${nextShots.length} shots — "${script.title || 'Untitled'}"`)
      return { workingShots: nextShots, workingMaster }
    }

    case 'generateImages': {
      if (workingShots.length === 0) {
        throw new Error('No shots available for image generation.')
      }
      const needsImages = countShotsNeedingImages(workingShots)
      const maxImages = getMaxImages(settings)
      const planned = maxImages > 0 ? Math.min(needsImages, maxImages) : needsImages
      if (needsImages === 0) {
        appendAgentLog('✓ All shots already have generated images — skipping images')
        return { workingShots, workingMaster }
      }
      appendAgentLog(
        maxImages > 0 && needsImages > maxImages
          ? `Generating ${planned} AI images (max ${maxImages}, ${needsImages} shots need images)…`
          : `Generating AI images for ${planned} shots…`,
      )
      const nextShots = await generateImagesForShots(workingShots, settings, {
        width: template.width,
        height: template.height,
        onProgress: (value, info) => {
          report(value)
          if (!info?.shots) {
            return
          }
          const ready = info.shots.map((item) => ({ ...item }))
          assignShots(ready)
          appendAgentLog(`✓ Image ${info.done}/${info.total} — ${info.shot.name} added to Media`)
          onImageReady?.({
            done: info.done,
            total: info.total,
            images: ready
              .filter((item) => item.src && !item.missingImage)
              .map((item) => ({ id: item.id, name: item.name, src: item.src })),
          })
        },
        signal,
      })
      assignShots(nextShots)
      appendAgentLog('✓ Image generation complete — all new images are in Media')
      return { workingShots: nextShots, workingMaster }
    }

    case 'loadProject': {
      if (workingShots.length > 0) {
        appendAgentLog('✓ Timeline already has shots — skipping load')
        return { workingShots, workingMaster }
      }
      appendAgentLog('Loading Korea project…')
      const { shots: loadedShots } = await loadKoreaProject()
      const nextShots = applyPreset(loadedShots, settings.stylePresetId)
      setShots(nextShots)
      setSelectedId(nextShots[0]?.id ?? null)
      setCurrentTime(0)
      setProjectName('Korea Documentary')
      appendAgentLog(`✓ Loaded ${nextShots.length} shots`)
      return { workingShots: nextShots, workingMaster }
    }

    case 'limitShots': {
      if (settings.maxShots <= 0 || workingShots.length <= settings.maxShots) {
        appendAgentLog('✓ Shot limit not applied')
        return { workingShots, workingMaster }
      }
      const nextShots = workingShots.slice(0, settings.maxShots)
      setShots(nextShots)
      appendAgentLog(`✓ Limited to first ${nextShots.length} shots`)
      return { workingShots: nextShots, workingMaster }
    }

    case 'applyTemplate': {
      appendAgentLog('Applying platform and style presets…')
      let nextShots = applyPlatformTemplateToShots(workingShots, settings.platformTemplateId, { adjustDurations: true })
      nextShots = applyPreset(nextShots, settings.stylePresetId)
      setShots(nextShots)
      setPlatformTemplateId(settings.platformTemplateId)
      window.localStorage.setItem('iv-platform-template', settings.platformTemplateId)
      appendAgentLog(`✓ Format: ${template.label} (${template.width}×${template.height})`)
      report(1)
      return { workingShots: nextShots, workingMaster }
    }

    case 'fitTargetDuration': {
      const targetSeconds = getTargetDurationSeconds(settings)
      const nextShots = fitShotsToAudioDuration(workingShots, targetSeconds)
      setShots(nextShots)
      appendAgentLog(`✓ Target length ${formatTime(targetSeconds)} (~${(targetSeconds / nextShots.length).toFixed(1)}s per shot)`)
      report(1)
      return { workingShots: nextShots, workingMaster }
    }

    case 'aiPlan': {
      const targetSeconds = getTargetDurationSeconds(settings)
      const { config: aiConfig } = getActiveAiConfig(settings)
      if (!aiConfig.apiKey?.trim()) {
        appendAgentLog('✗ AI plan skipped — no API key')
        return { workingShots, workingMaster }
      }
      appendAgentLog('Asking AI for pacing tips…')
      try {
        const plan = await planVideoWithAi(settings, {
          shotCount: workingShots.length,
          targetSeconds,
          platformLabel: template.label,
        })
        plan.split('\n').filter(Boolean).forEach((line) => appendAgentLog(`• ${line.trim()}`))
      } catch (error) {
        appendAgentLog(`✗ AI plan skipped: ${error instanceof Error ? error.message : 'failed'}`)
      }
      report(1)
      return { workingShots, workingMaster }
    }

    case 'generateNarration': {
      const missingVoice = workingShots.filter((shot) => !shot.voice?.trim() && shot.imagePrompt?.trim()).length
      if (missingVoice === 0) {
        appendAgentLog('✓ All shots already have narration text')
        report(1)
        return { workingShots, workingMaster }
      }
      appendAgentLog(
        shouldUseAiNarration(settings)
          ? `Writing AI narration for ${missingVoice} shots…`
          : `Writing narration from prompts (free — no GPT tokens) for ${missingVoice} shots…`,
      )
      const nextShots = await generateNarrationForShots(workingShots, settings, {
        brief: settings.projectBrief,
        language: settings.scriptLanguage,
        onProgress: (value) => report(value),
        signal,
      })
      setShots(nextShots)
      const filled = nextShots.filter((shot) => shot.voice?.trim()).length
      appendAgentLog(`✓ Narration ready on ${filled} shots`)
      return { workingShots: nextShots, workingMaster }
    }

    case 'generateTts': {
      let shotsForTts = workingShots
      let voiceCount = shotsForTts.filter((shot) => shot.voice?.trim()).length
      if (voiceCount === 0) {
        const canNarrate = shotsForTts.some((shot) => shot.imagePrompt?.trim())
        if (canNarrate) {
          appendAgentLog('No voice text — generating narration from image prompts…')
          shotsForTts = await generateNarrationForShots(shotsForTts, settings, {
            brief: settings.projectBrief,
            language: settings.scriptLanguage,
            onProgress: (value) => report(value * 0.4),
          })
          setShots(shotsForTts)
          voiceCount = shotsForTts.filter((shot) => shot.voice?.trim()).length
        }
      }
      if (voiceCount === 0) {
        appendAgentLog('✗ No voice text on shots — skipping TTS')
        return { workingShots: shotsForTts, workingMaster }
      }
      appendAgentLog(`Generating TTS for ${voiceCount} shots…`)
      setGeneratingTTS(true)
      const nextShots = await generateTTSForShots(shotsForTts, {
        ...getTtsOptions(),
        matchDuration: true,
        onProgress: (value) => report(0.4 + value * 0.6),
        signal,
      })
      setShots(nextShots)
      setGeneratingTTS(false)
      appendAgentLog('✓ TTS generation complete')
      return { workingShots: nextShots, workingMaster }
    }

    case 'spliceMaster': {
      const withAudio = workingShots.filter((shot) => shot.audioSrc)
      if (withAudio.length === 0) {
        appendAgentLog('✗ No per-shot audio to splice')
        return { workingShots, workingMaster }
      }
      appendAgentLog(`Splicing ${withAudio.length} clips into master track…`)
      setSplicing(true)
      const tracks = await Promise.all(
        withAudio.map(async (shot) => ({
          id: shot.id,
          name: shot.audioName || shot.name,
          src: shot.audioSrc,
          duration: await getAudioDuration(shot.audioSrc).catch(() => shot.duration),
        })),
      )
      setAudioTracks(tracks)
      revokeMasterAudio()
      const nextMaster = await buildSplicedMasterUrl(tracks)
      setMasterAudio(nextMaster)
      setSplicing(false)
      appendAgentLog(`✓ Master audio: ${formatTime(nextMaster.duration)}`)
      report(1)
      return { workingShots, workingMaster: nextMaster }
    }

    case 'fitToAudio': {
      if (!workingMaster) {
        appendAgentLog('✗ No master audio — skipping sync')
        return { workingShots, workingMaster }
      }
      const withSpeech = workingShots.filter((shot) => shot.audioSrc).length
      if (withSpeech > 0) {
        appendAgentLog(`✓ Speech stays on ${withSpeech} shots for export (${formatTime(workingMaster.duration)})`)
        report(1)
        return { workingShots, workingMaster }
      }
      const slotDuration = getAudioMatchSlotDuration(settings)
      const nextShots = matchShotsToAudio(workingShots, workingMaster.duration, {
        mode: settings.audioMatchMode ?? 'loopRandom',
        perShotDuration: slotDuration,
        stylePresetId: settings.stylePresetId,
        randomize: true,
      })
      setShots(nextShots)
      const modeLabel = settings.audioMatchMode === 'stretch' ? 'stretched' : 'looped & mixed'
      appendAgentLog(`✓ ${nextShots.length} shots ${modeLabel} to audio (${formatTime(workingMaster.duration)})`)
      report(1)
      return { workingShots: nextShots, workingMaster }
    }

    case 'exportVideo': {
      const speechShots = workingShots.filter((shot) => shot.audioSrc || shot.voice?.trim()).length
      appendAgentLog(
        speechShots > 0
          ? `Exporting video with speech on ${speechShots} shots…`
          : 'Exporting video…',
      )
      setExporting(true)
      let usedFallback = false
      const blob = await exportVideo(workingShots, {
        fps: template.fps ?? DEFAULT_FPS,
        width: template.width,
        height: template.height,
        format: 'mp4',
        masterAudioSrc: workingMaster?.src ?? null,
        onProgress: (value) => report(value),
        onFallback: () => {
          usedFallback = true
        },
        signal,
      })
      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
      if (usedFallback) {
        appendAgentLog('ℹ WebCodecs unavailable — using WebM export (open in Chrome/Edge for MP4)')
      }
      const exportFilename = `agent-video-${Date.now()}.${extension}`
      const exportUrl = URL.createObjectURL(blob)
      downloadBlob(blob, exportFilename)
      setExporting(false)
      appendAgentLog(`✓ Export complete (${extension.toUpperCase()})`)
      appendAgentLog('View the finished video in Chat.')
      return { workingShots, workingMaster, exportUrl, exportFilename }
    }

    default:
      appendAgentLog(`✗ Unknown workflow step: ${stepId}`)
      return { workingShots, workingMaster }
  }
}

export function validateWorkflowBeforeRun(settings) {
  const enabled = settings.workflow?.filter((item) => item.enabled !== false) ?? []
  if (enabled.length === 0) {
    throw new Error('Add at least one enabled step to the workflow.')
  }
  const needsShots = enabled.some((item) => !['generateScript', 'loadProject'].includes(item.id))
  const createsShots = enabled.some((item) => ['generateScript', 'loadProject'].includes(item.id))
  if (needsShots && !createsShots) {
    return { warning: 'Workflow may need existing shots or a script/load step first.' }
  }
  return {}
}
