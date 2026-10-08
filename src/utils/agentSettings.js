import { buildDefaultProviderKeys } from '../providers'
import {
  DEFAULT_PLATFORM_TEMPLATE,
  DEFAULT_SCRIPT_LANGUAGE,
  MIN_OPENAI_IMAGE_DEFAULTS,
  QUALITY_TTS_PROVIDER,
} from './modelDefaults'
import { MOROCCAN_DOCUMENTARY_INSTRUCTIONS } from './ttsDefaults'
import { buildDefaultWorkflow, normalizeWorkflow, syncStepsFromWorkflow, workflowFromLegacySteps } from './workflowSteps'

export const DEFAULT_AGENT_SETTINGS = {
  aiProvider: 'openai',
  ttsProvider: QUALITY_TTS_PROVIDER,
  imageProvider: 'openaiImage',
  costMode: 'quality',
  providerKeys: buildDefaultProviderKeys(),
  projectBrief: '',
  scriptLanguage: DEFAULT_SCRIPT_LANGUAGE,
  scriptBatchSize: 10,
  scriptMaxShots: 60,
  maxImages: 20,
  targetMinutes: 20,
  targetSeconds: 0,
  maxShots: 0,
  platformTemplateId: DEFAULT_PLATFORM_TEMPLATE,
  stylePresetId: 'documentary',
  audioMatchMode: 'loopRandom',
  audioMatchShotDuration: 0,
  workflow: buildDefaultWorkflow(),
  steps: syncStepsFromWorkflow(buildDefaultWorkflow()),
  useAiPlan: false,
}

const STORAGE_KEY = 'iv-agent-settings'

function migrateLegacySettings(parsed) {
  const defaults = DEFAULT_AGENT_SETTINGS
  const providerKeys = {
    ...buildDefaultProviderKeys(),
    ...(parsed.providerKeys ?? {}),
  }

  if (parsed.apiKey && !providerKeys.openai?.apiKey) {
    providerKeys.openai = {
      ...providerKeys.openai,
      apiKey: parsed.apiKey,
      baseUrl: parsed.apiBaseUrl || providerKeys.openai.baseUrl,
      model: parsed.model || providerKeys.openai.model,
    }
  }

  const sharedOpenAiKey = providerKeys.openai?.apiKey?.trim()
    || providerKeys.openaiImage?.apiKey?.trim()
    || providerKeys.openaiTts?.apiKey?.trim()

  if (sharedOpenAiKey) {
    providerKeys.openai = {
      ...providerKeys.openai,
      apiKey: providerKeys.openai?.apiKey?.trim() ? providerKeys.openai.apiKey : sharedOpenAiKey,
      baseUrl: providerKeys.openai?.baseUrl || providerKeys.openaiImage?.baseUrl || providerKeys.openaiTts?.baseUrl || providerKeys.openai.baseUrl,
    }
    providerKeys.openaiImage = {
      ...providerKeys.openaiImage,
      apiKey: providerKeys.openaiImage?.apiKey?.trim() ? providerKeys.openaiImage.apiKey : sharedOpenAiKey,
      baseUrl: providerKeys.openaiImage?.baseUrl || providerKeys.openai.baseUrl || providerKeys.openaiImage.baseUrl,
    }
    providerKeys.openaiTts = {
      ...providerKeys.openaiTts,
      apiKey: providerKeys.openaiTts?.apiKey?.trim() ? providerKeys.openaiTts.apiKey : sharedOpenAiKey,
      baseUrl: providerKeys.openaiTts?.baseUrl || providerKeys.openai.baseUrl || providerKeys.openaiTts.baseUrl,
    }
  }

  for (const id of Object.keys(providerKeys)) {
    providerKeys[id] = {
      ...buildDefaultProviderKeys()[id],
      ...providerKeys[id],
    }
  }

  if (!providerKeys.openaiTts?.instructions?.trim()) {
    providerKeys.openaiTts = {
      ...providerKeys.openaiTts,
      instructions: MOROCCAN_DOCUMENTARY_INSTRUCTIONS,
    }
  }
  if (!providerKeys.openaiTts?.testPhrase?.trim()) {
    providerKeys.openaiTts = {
      ...providerKeys.openaiTts,
      testPhrase: providerKeys.openaiTts?.testPhrase || 'مرحباً، هذا اختبار للتعليق الصوتي الوثائقي بلهجة مغربية.',
    }
  }
  if (providerKeys.edge?.voice === 'ar-SA-HamedNeural') {
    providerKeys.edge = {
      ...providerKeys.edge,
      voice: 'ar-MA-MounaNeural',
    }
  }

  const imageConfig = providerKeys.openaiImage ?? {}
  const legacyModel = String(imageConfig.model ?? '').trim()
  const retiredImageModel = !legacyModel || legacyModel === 'dall-e-2' || legacyModel === 'dall-e-3'
  if (retiredImageModel) {
    providerKeys.openaiImage = {
      ...imageConfig,
      ...MIN_OPENAI_IMAGE_DEFAULTS,
    }
  }

  const workflow = parsed.workflow
    ? normalizeWorkflow(parsed.workflow)
    : workflowFromLegacySteps(parsed.steps)

  return {
    ...defaults,
    ...parsed,
    providerKeys,
    workflow,
    steps: syncStepsFromWorkflow(workflow),
    useAiPlan: workflow.some((item) => item.id === 'aiPlan' && item.enabled),
  }
}

export function loadAgentSettings() {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_AGENT_SETTINGS, providerKeys: buildDefaultProviderKeys() }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_AGENT_SETTINGS, providerKeys: buildDefaultProviderKeys() }
    }
    return migrateLegacySettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_AGENT_SETTINGS, providerKeys: buildDefaultProviderKeys() }
  }
}

export function saveAgentSettings(settings) {
  if (typeof window === 'undefined' || !settings || typeof settings !== 'object') {
    return
  }
  if (settings.nodeType || settings.nativeEvent || settings.target) {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function getMaxImages(settings) {
  const value = Number(settings?.maxImages)
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  return Math.min(240, Math.floor(value))
}

export function getTargetDurationSeconds(settings) {
  const minutes = Number(settings.targetMinutes) || 0
  const seconds = Number(settings.targetSeconds) || 0
  return Math.max(5, minutes * 60 + seconds)
}

function resolveProviderConfig(settings, providerField, fallbackProvider) {
  const providerKeys = settings?.providerKeys ?? buildDefaultProviderKeys()
  const provider = settings?.[providerField] ?? fallbackProvider
  return {
    provider,
    config: providerKeys[provider] ?? buildDefaultProviderKeys()[provider] ?? {},
  }
}

export function getActiveAiConfig(settings) {
  return resolveProviderConfig(settings, 'aiProvider', 'openai')
}

export function getActiveTtsConfig(settings) {
  return resolveProviderConfig(settings, 'ttsProvider', 'edge')
}

export function getActiveImageConfig(settings) {
  return resolveProviderConfig(settings, 'imageProvider', 'openaiImage')
}

export function updateProviderKey(settings, providerId, field, value) {
  const providerKeys = settings?.providerKeys ?? buildDefaultProviderKeys()
  return {
    ...settings,
    providerKeys: {
      ...providerKeys,
      [providerId]: {
        ...providerKeys[providerId],
        [field]: value,
      },
    },
  }
}

export const DURATION_PRESETS = [
  { id: '60s', label: '60s Short', minutes: 0, seconds: 60 },
  { id: '3min', label: '3 min', minutes: 3, seconds: 0 },
  { id: '5min', label: '5 min', minutes: 5, seconds: 0 },
  { id: '10min', label: '10 min', minutes: 10, seconds: 0 },
  { id: '20min', label: '20 min', minutes: 20, seconds: 0 },
  { id: '30min', label: '30 min', minutes: 30, seconds: 0 },
]
