/** Cheapest OpenAI chat model for scripts / narration planning. */
export const MIN_CHAT_MODEL = 'gpt-4o-mini'

/** Cheapest GPT Image model (replaces retired dall-e-3). */
export const MIN_IMAGE_MODEL = 'gpt-image-1-mini'

/** Lowest-cost image size for GPT Image models. */
export const MIN_IMAGE_SIZE = '1024x1024'

/** Lowest-cost image quality for GPT Image models. */
export const MIN_IMAGE_QUALITY = 'low'

/** Free speech — no API tokens. */
export const MIN_TTS_PROVIDER = 'edge'

/** OpenAI ChatGPT TTS — Arabic documentary default in this app. */
export const QUALITY_TTS_PROVIDER = 'openaiTts'

/** Standard YouTube 16:9 export. */
export const DEFAULT_PLATFORM_TEMPLATE = 'youtube-hd'

/** Default narration language for this app. */
export const DEFAULT_SCRIPT_LANGUAGE = 'ar'

export const QUALITY_IMAGE_MODEL = 'gpt-image-1'
export const QUALITY_IMAGE_SIZE = '1536x1024'
export const QUALITY_IMAGE_QUALITY = 'medium'

export const MIN_OPENAI_IMAGE_DEFAULTS = {
  model: MIN_IMAGE_MODEL,
  size: MIN_IMAGE_SIZE,
  quality: MIN_IMAGE_QUALITY,
}

export const QUALITY_OPENAI_IMAGE_DEFAULTS = {
  model: QUALITY_IMAGE_MODEL,
  size: QUALITY_IMAGE_SIZE,
  quality: QUALITY_IMAGE_QUALITY,
}

export const MIN_OPENAI_CHAT_DEFAULTS = {
  model: MIN_CHAT_MODEL,
}

/** AI-written narration costs ~1 GPT call per scriptBatchSize shots — skip unless quality mode. */
export function shouldUseAiNarration(settings) {
  if (settings?.scriptLanguage === 'ar' && settings?.ttsProvider === QUALITY_TTS_PROVIDER) {
    return true
  }
  return settings?.costMode === 'quality'
}
