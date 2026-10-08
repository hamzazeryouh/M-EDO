import { calculateShotCount } from './scriptGenerator'
import {
  MIN_CHAT_MODEL,
  MIN_OPENAI_IMAGE_DEFAULTS,
  MIN_TTS_PROVIDER,
} from './modelDefaults'
import { applyWorkflowPreset, getEnabledWorkflowSteps, syncStepsFromWorkflow } from './workflowSteps'
import { getMaxImages } from './agentSettings'

/** Rough USD estimates for planning — not billing quotes. */
export const COST_RATES = {
  scriptBatchGpt4oMini: 0.02,
  scriptBatchGpt4o: 0.08,
  imageStandard1024: 0.04,
  imageStandardWide: 0.08,
  imageHd: 0.12,
  ttsOpenAiPer1kChars: 0.015,
  ttsElevenLabsPer1kChars: 0.18,
  aiPlan: 0.01,
}

export const COST_MODES = {
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    hint: 'Script + free Edge speech, no AI images, ≤8 shots (~$0.05)',
    workflowPreset: 'minimalCost',
    settings: {
      costMode: 'minimal',
      ttsProvider: MIN_TTS_PROVIDER,
      aiProvider: 'openai',
      imageProvider: 'openaiImage',
      targetMinutes: 1,
      targetSeconds: 0,
      maxShots: 8,
      scriptMaxShots: 8,
      scriptBatchSize: 8,
    },
    providerPatches: {
      openai: { model: MIN_CHAT_MODEL },
      openaiImage: { ...MIN_OPENAI_IMAGE_DEFAULTS },
    },
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    hint: '≤12 shots, standard images, free speech (~$0.50)',
    workflowPreset: 'lowCostVideo',
    settings: {
      costMode: 'balanced',
      ttsProvider: MIN_TTS_PROVIDER,
      aiProvider: 'openai',
      imageProvider: 'openaiImage',
      targetMinutes: 3,
      targetSeconds: 0,
      maxShots: 12,
      scriptMaxShots: 12,
      scriptBatchSize: 12,
    },
    providerPatches: {
      openai: { model: MIN_CHAT_MODEL },
      openaiImage: { ...MIN_OPENAI_IMAGE_DEFAULTS, quality: 'medium' },
    },
  },
  quality: {
    id: 'quality',
    label: 'Quality',
    hint: 'Full pipeline, HD/wide images, OpenAI speech (higher cost)',
    workflowPreset: 'fullCreate',
    settings: {
      costMode: 'quality',
      ttsProvider: 'openaiTts',
      aiProvider: 'openai',
      imageProvider: 'openaiImage',
      targetMinutes: 10,
      targetSeconds: 0,
      maxShots: 0,
      scriptMaxShots: 40,
      scriptBatchSize: 10,
    },
    providerPatches: {
      openai: { model: MIN_CHAT_MODEL },
      openaiImage: { model: 'gpt-image-1', size: '1536x1024', quality: 'medium' },
      openaiTts: {
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        instructions: 'Speak in Arabic with a natural Moroccan accent. Warm documentary narration for action and history films.',
      },
    },
  },
}

function patchProviderKeys(settings, patches = {}) {
  const providerKeys = { ...settings.providerKeys }
  for (const [providerId, fields] of Object.entries(patches)) {
    providerKeys[providerId] = {
      ...providerKeys[providerId],
      ...fields,
    }
  }
  return providerKeys
}

export function applyCostMode(settings, modeId) {
  const mode = COST_MODES[modeId] ?? COST_MODES.balanced
  const workflow = applyWorkflowPreset(mode.workflowPreset)
  const maxImages = getMaxImages(settings) || Number(settings.maxImages) || 20
  return {
    ...settings,
    ...mode.settings,
    maxImages,
    providerKeys: patchProviderKeys(settings, mode.providerPatches),
    workflow,
    steps: syncStepsFromWorkflow(workflow),
    useAiPlan: false,
  }
}

function imageUnitCost(settings) {
  const config = settings.providerKeys?.[settings.imageProvider] ?? {}
  if (config.quality === 'hd' || config.quality === 'high') {
    return COST_RATES.imageHd
  }
  if (String(config.size ?? '').includes('1536') || String(config.size ?? '').includes('1792')) {
    return COST_RATES.imageStandardWide
  }
  return COST_RATES.imageStandard1024
}

function scriptBatchCost(settings) {
  const model = settings.providerKeys?.[settings.aiProvider]?.model ?? 'gpt-4o-mini'
  return model.includes('gpt-4o') && !model.includes('mini')
    ? COST_RATES.scriptBatchGpt4o
    : COST_RATES.scriptBatchGpt4oMini
}

function ttsCost(settings, voiceChars) {
  if (settings.ttsProvider === 'edge') {
    return 0
  }
  const rate = settings.ttsProvider === 'elevenlabs'
    ? COST_RATES.ttsElevenLabsPer1kChars
    : COST_RATES.ttsOpenAiPer1kChars
  return (voiceChars / 1000) * rate
}

export function estimateWorkflowCost(settings, options = {}) {
  const enabled = getEnabledWorkflowSteps(settings)
  const shots = options.shotsCount ?? calculateShotCount(settings)
  const voiceChars = options.voiceChars ?? shots * 120
  const breakdown = []
  let total = 0

  if (enabled.includes('generateScript')) {
    const batchSize = Math.max(1, settings.scriptBatchSize || 10)
    const batches = Math.ceil(shots / batchSize)
    const unit = scriptBatchCost(settings)
    const cost = batches * unit
    total += cost
    breakdown.push({ label: `Script (${batches} AI call${batches === 1 ? '' : 's'})`, cost })
  }

  if (enabled.includes('generateImages')) {
    const unit = imageUnitCost(settings)
    const cost = shots * unit
    total += cost
    breakdown.push({ label: `Images (${shots} × $${unit.toFixed(2)})`, cost })
  }

  if (enabled.includes('generateTts')) {
    const cost = ttsCost(settings, voiceChars)
    const label = settings.ttsProvider === 'edge'
      ? 'Speech (Edge — free)'
      : `Speech (${settings.ttsProvider})`
    total += cost
    breakdown.push({ label, cost })
  }

  if (enabled.includes('aiPlan')) {
    total += COST_RATES.aiPlan
    breakdown.push({ label: 'AI pacing tips', cost: COST_RATES.aiPlan })
  }

  return { total, breakdown, shots, enabled }
}

export function formatCost(usd) {
  if (usd <= 0) {
    return '$0'
  }
  if (usd < 0.01) {
    return '< $0.01'
  }
  if (usd < 1) {
    return `~$${usd.toFixed(2)}`
  }
  return `~$${usd.toFixed(2)}`
}

export function getCostSavingTips(settings) {
  const tips = []
  const enabled = getEnabledWorkflowSteps(settings)

  if (enabled.includes('generateImages')) {
    tips.push('Disable Generate images or use Minimal mode to skip GPT Image (~$0.04+ per shot).')
  }
  if (settings.ttsProvider !== 'edge' && enabled.includes('generateTts')) {
    tips.push('Switch speech to Edge TTS (free) in Provider keys.')
  }
  if (enabled.includes('aiPlan')) {
    tips.push('Turn off AI pacing tips — saves an extra GPT call.')
  }
  const config = settings.providerKeys?.[settings.imageProvider] ?? {}
  if (enabled.includes('generateImages') && (config.quality === 'hd' || config.quality === 'high' || String(config.size).includes('1536') || String(config.size).includes('1792'))) {
    tips.push('Use 1024×1024 medium quality for cheaper images.')
  }
  if ((settings.scriptMaxShots ?? 60) > 12 || (settings.maxShots ?? 0) > 12) {
    tips.push('Lower Max shots / Max AI shots to cap image + TTS costs.')
  }
  if ((settings.scriptBatchSize ?? 10) < 12) {
    tips.push('Raise Script batch size to reduce script API calls.')
  }

  return tips
}
