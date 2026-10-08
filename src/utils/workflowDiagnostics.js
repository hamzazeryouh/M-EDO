import { getActiveAiConfig, getActiveImageConfig, getActiveTtsConfig } from './agentSettings'
import { getPlatformTemplate } from '../platformTemplates'
import { getImageProvider, getTtsProvider } from '../providers'
import {
  DEFAULT_WORKFLOW_ORDER,
  getEnabledWorkflowSteps,
  getWorkflowDef,
} from './workflowSteps'
import { countShotsNeedingImages } from './shotImages'

/**
 * @param {object} settings agent settings
 * @param {object} state project + timeline snapshot
 * @returns {Array<{ stepId, def, isEnabled, status, reason, category }>}
 * status: disabled | ready | skip | blocked
 */
export function diagnoseWorkflowSteps(settings, state) {
  const enabled = new Set(getEnabledWorkflowSteps(settings))
  const {
    shots = [],
    readyCount = 0,
    missingCount = 0,
    shotsWithVoice = 0,
    audioCount = 0,
    masterAudio = null,
  } = state

  const aiKey = getActiveAiConfig(settings).config.apiKey?.trim()
  const imageKey = getActiveImageConfig(settings).config.apiKey?.trim()
  const ttsProvider = settings.ttsProvider
  const ttsKey = getActiveTtsConfig(settings).config.apiKey?.trim()
  const needsImages = countShotsNeedingImages(shots)

  function row(stepId, check) {
    const def = getWorkflowDef(stepId)
    const isEnabled = enabled.has(stepId)
    if (!isEnabled) {
      return {
        stepId,
        def,
        isEnabled: false,
        status: 'disabled',
        reason: 'Turn on this step in the workflow below, or apply the Full video pipeline preset.',
        category: def?.category ?? 'edit',
      }
    }
    return { stepId, def, isEnabled: true, category: def?.category ?? 'edit', ...check() }
  }

  return DEFAULT_WORKFLOW_ORDER.map((stepId) => {
    switch (stepId) {
      case 'generateScript':
        return row(stepId, () => {
          if (!settings.projectBrief?.trim()) {
            return { status: 'blocked', reason: 'Add a video topic/brief in Agent settings.' }
          }
          if (!aiKey) {
            return { status: 'blocked', reason: 'OpenAI API key required for script generation.' }
          }
          return { status: 'ready', reason: 'Will write script + image prompts from your brief.' }
        })

      case 'generateImages':
        return row(stepId, () => {
          if (shots.length === 0) {
            return { status: 'blocked', reason: 'Load a project or generate a script first.' }
          }
          if (!imageKey) {
            return {
              status: 'blocked',
              reason: `Add OpenAI API key under Provider keys → Images (gpt-image-1-mini). ${needsImages} shot(s) waiting for images.`,
            }
          }
          if (needsImages === 0) {
            return {
              status: 'skip',
              reason: `All ${shots.length} shots already have generated images.`,
            }
          }
          return {
            status: 'ready',
            reason: `Will generate ${needsImages} AI image(s) — prompts ready, files not on disk yet.`,
          }
        })

      case 'loadProject':
        return row(stepId, () => {
          if (shots.length > 0) {
            return { status: 'skip', reason: 'Timeline already has shots — load step is skipped.' }
          }
          return { status: 'ready', reason: 'Will import the Korea documentary manifest.' }
        })

      case 'limitShots':
        return row(stepId, () => {
          if (settings.maxShots <= 0 || shots.length <= settings.maxShots) {
            return { status: 'skip', reason: 'Max shots not set or timeline already within limit.' }
          }
          return { status: 'ready', reason: `Will trim to first ${settings.maxShots} shots.` }
        })

      case 'applyTemplate':
        return row(stepId, () => {
          const template = getPlatformTemplate(settings.platformTemplateId)
          return {
            status: 'ready',
            reason: `Applies ${template.label} (${template.width}×${template.height}, ${template.fps} fps) + style preset.`,
          }
        })

      case 'fitTargetDuration':
        return row(stepId, () => ({
          status: shots.length > 0 ? 'ready' : 'blocked',
          reason: shots.length > 0
            ? 'Splits target duration evenly across all shots.'
            : 'Need shots on the timeline first.',
        }))

      case 'aiPlan':
        return row(stepId, () => {
          if (!aiKey) {
            return { status: 'skip', reason: 'No AI key — pacing tips skipped.' }
          }
          return { status: 'ready', reason: 'Optional GPT pacing advice before speech.' }
        })

      case 'generateNarration':
        return row(stepId, () => {
          const missing = shots.filter((s) => !s.voice?.trim() && s.imagePrompt?.trim()).length
          if (missing === 0) {
            return { status: 'skip', reason: 'All shots already have narration text.' }
          }
          if (settings.costMode === 'quality' && aiKey) {
            return { status: 'ready', reason: `AI narration for ${missing} shots (Quality cost mode).` }
          }
          return {
            status: 'ready',
            reason: `Free narration from image prompts for ${missing} shots (no GPT tokens).`,
          }
        })

      case 'generateTts':
        return row(stepId, () => {
          const withVoice = shots.filter((s) => s.voice?.trim()).length
          if (withVoice === 0 && shots.every((s) => !s.imagePrompt?.trim())) {
            return { status: 'blocked', reason: 'No voice text or image prompts on shots.' }
          }
          if (ttsProvider !== 'edge' && !ttsKey) {
            return { status: 'blocked', reason: `${getTtsProvider(ttsProvider).label} needs an API key, or switch to Edge TTS (free).` }
          }
          return {
            status: 'ready',
            reason: `Speech for ${withVoice || 'all'} shots via ${getTtsProvider(ttsProvider).label}.`,
          }
        })

      case 'spliceMaster':
        return row(stepId, () => {
          if (audioCount === 0) {
            return { status: 'blocked', reason: 'No per-shot audio yet — run Generate speech first.' }
          }
          return { status: 'ready', reason: `Combines ${audioCount} clip(s) into one master track.` }
        })

      case 'fitToAudio':
        return row(stepId, () => {
          if (!masterAudio) {
            return { status: 'blocked', reason: 'No master audio — run Splice master first.' }
          }
          return { status: 'ready', reason: 'Syncs shot durations to narration length.' }
        })

      case 'exportVideo':
        return row(stepId, () => {
          if (shots.length === 0) {
            return { status: 'blocked', reason: 'Add shots before export.' }
          }
          if (readyCount === 0 && needsImages > 0) {
            return {
              status: 'waiting',
              reason: `Waiting on Generate images (${needsImages} pending) — export runs after images exist.`,
            }
          }
          if (readyCount === 0) {
            return { status: 'blocked', reason: 'No images on timeline — import or generate images first.' }
          }
          const template = getPlatformTemplate(settings.platformTemplateId)
          return {
            status: 'ready',
            reason: `Renders ${template.label} video (${template.width}×${template.height}).`,
          }
        })

      default:
        return row(stepId, () => ({ status: 'ready', reason: def?.description ?? '' }))
    }
  })
}

export function summarizeWorkflowIssues(diagnostics) {
  const disabled = diagnostics.filter((item) => !item.isEnabled)
  const blocked = diagnostics.filter((item) => item.isEnabled && item.status === 'blocked')
  const waiting = diagnostics.filter((item) => item.isEnabled && item.status === 'waiting')
  const ready = diagnostics.filter((item) => item.isEnabled && (item.status === 'ready' || item.status === 'waiting'))
  return { disabled, blocked, waiting, ready, enabledCount: ready.length + blocked.length }
}
