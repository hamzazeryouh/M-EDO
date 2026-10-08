import { applyCostMode } from './costMode'
import {
  DEFAULT_PLATFORM_TEMPLATE,
  DEFAULT_SCRIPT_LANGUAGE,
  QUALITY_OPENAI_IMAGE_DEFAULTS,
  QUALITY_TTS_PROVIDER,
} from './modelDefaults'
import { MOROCCAN_DOCUMENTARY_INSTRUCTIONS } from './ttsDefaults'
import { applyWorkflowPreset, syncStepsFromWorkflow } from './workflowSteps'

/** Arabic + OpenAI TTS + YouTube HD + gpt-image-1 landscape — production pipeline. */
export function applyProductionDefaults(settings, { workflowPreset = 'fullVideo' } = {}) {
  const workflow = applyWorkflowPreset(workflowPreset)
  const withCost = applyCostMode(
    {
      ...settings,
      scriptLanguage: DEFAULT_SCRIPT_LANGUAGE,
      ttsProvider: QUALITY_TTS_PROVIDER,
      platformTemplateId: DEFAULT_PLATFORM_TEMPLATE,
      costMode: 'quality',
      workflow,
      steps: syncStepsFromWorkflow(workflow),
    },
    'quality',
  )

  return {
    ...withCost,
    scriptLanguage: DEFAULT_SCRIPT_LANGUAGE,
    ttsProvider: QUALITY_TTS_PROVIDER,
    platformTemplateId: DEFAULT_PLATFORM_TEMPLATE,
    providerKeys: {
      ...withCost.providerKeys,
      openaiImage: {
        ...withCost.providerKeys.openaiImage,
        ...QUALITY_OPENAI_IMAGE_DEFAULTS,
      },
      openaiTts: {
        ...withCost.providerKeys.openaiTts,
        voice: withCost.providerKeys.openaiTts?.voice || 'marin',
        instructions: MOROCCAN_DOCUMENTARY_INSTRUCTIONS,
      },
    },
    workflow,
    steps: syncStepsFromWorkflow(workflow),
  }
}

export function describeProductionSettings(settings) {
  const image = settings.providerKeys?.openaiImage ?? {}
  const tts = settings.providerKeys?.openaiTts ?? {}
  return {
    language: settings.scriptLanguage === 'ar' ? 'Arabic (ar)' : settings.scriptLanguage,
    tts: settings.ttsProvider === 'openaiTts' ? `OpenAI TTS (${tts.voice || 'marin'})` : settings.ttsProvider,
    template: settings.platformTemplateId,
    imageModel: image.model || 'gpt-image-1',
    imageSize: image.size || '1536x1024',
    imageQuality: image.quality || 'medium',
  }
}
