import {
  MIN_CHAT_MODEL,
  MIN_IMAGE_MODEL,
  MIN_IMAGE_QUALITY,
  MIN_IMAGE_SIZE,
  MIN_OPENAI_IMAGE_DEFAULTS,
} from './utils/modelDefaults'
import {
  DEFAULT_OPENAI_TTS_VOICE,
  DEFAULT_EDGE_TTS_VOICE,
  MOROCCAN_DOCUMENTARY_INSTRUCTIONS,
  MOROCCAN_TTS_TEST_PHRASE,
} from './utils/ttsDefaults'

export const AI_PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4o mini, compatible APIs',
    keyLabel: 'API key',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'sk-…' },
      { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.openai.com/v1' },
      { id: 'model', label: 'Model', type: 'text', placeholder: MIN_CHAT_MODEL },
    ],
    defaults: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: MIN_CHAT_MODEL,
    },
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    description: 'Claude 3.5 Haiku, Sonnet, Opus',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'sk-ant-…' },
      { id: 'model', label: 'Model', type: 'text', placeholder: 'claude-3-5-haiku-latest' },
    ],
    defaults: {
      apiKey: '',
      model: 'claude-3-5-haiku-latest',
    },
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini Flash and Pro',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'AIza…' },
      { id: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.0-flash' },
    ],
    defaults: {
      apiKey: '',
      model: 'gemini-2.0-flash',
    },
  },
  {
    id: 'azureOpenAI',
    label: 'Azure OpenAI',
    description: 'Azure-hosted GPT deployments',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'Azure key' },
      { id: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://YOUR.openai.azure.com' },
      { id: 'deployment', label: 'Deployment', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
    defaults: {
      apiKey: '',
      endpoint: '',
      deployment: 'gpt-4o-mini',
    },
  },
]

export const TTS_PROVIDERS = [
  {
    id: 'openaiTts',
    label: 'OpenAI TTS',
    description: 'Same sk-… API key as OpenAI / DALL·E — gpt-4o-mini-tts',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'sk-proj-… (same as OpenAI above)' },
      { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.openai.com/v1' },
      { id: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini-tts' },
      { id: 'voice', label: 'Voice', type: 'text', placeholder: 'marin' },
      {
        id: 'instructions',
        label: 'Voice style (accent & tone)',
        type: 'textarea',
        placeholder: 'Arabic, Moroccan accent, documentary tone…',
        hint: 'How to speak — not the narration text.',
      },
      {
        id: 'testPhrase',
        label: 'Test phrase (spoken when you click Test)',
        type: 'textarea',
        placeholder: 'Arabic sentence to speak on Test…',
        hint: 'This is the text OpenAI reads when you press Test.',
      },
      { id: 'responseFormat', label: 'Format', type: 'text', placeholder: 'mp3' },
    ],
    defaults: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini-tts',
      voice: DEFAULT_OPENAI_TTS_VOICE,
      instructions: MOROCCAN_DOCUMENTARY_INSTRUCTIONS,
      testPhrase: MOROCCAN_TTS_TEST_PHRASE,
      responseFormat: 'mp3',
    },
  },
  {
    id: 'edge',
    label: 'Edge TTS (free)',
    description: 'Microsoft Edge voices — no key required',
    noKey: true,
    fields: [
      { id: 'voice', label: 'Voice', type: 'text', placeholder: 'ar-MA-MounaNeural' },
      { id: 'rate', label: 'Rate', type: 'text', placeholder: '+0%' },
    ],
    defaults: {
      voice: DEFAULT_EDGE_TTS_VOICE,
      rate: '+0%',
    },
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    description: 'High-quality multilingual voices',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'xi-…' },
      { id: 'voiceId', label: 'Voice ID', type: 'text', placeholder: '21m00Tcm4TlvDq8ikWAM' },
      { id: 'modelId', label: 'Model', type: 'text', placeholder: 'eleven_multilingual_v2' },
    ],
    defaults: {
      apiKey: '',
      voiceId: 'pNInz6obpgDQGcFmaJgB',
      modelId: 'eleven_multilingual_v2',
    },
  },
  {
    id: 'azureTts',
    label: 'Azure Speech',
    description: 'Azure Cognitive Services TTS',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'Azure speech key' },
      { id: 'region', label: 'Region', type: 'text', placeholder: 'eastus' },
      { id: 'voice', label: 'Voice', type: 'text', placeholder: 'ar-SA-HamedNeural' },
    ],
    defaults: {
      apiKey: '',
      region: 'eastus',
      voice: 'ar-SA-HamedNeural',
    },
  },
  {
    id: 'googleTts',
    label: 'Google Cloud TTS',
    description: 'Google Text-to-Speech API',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'AIza…' },
      { id: 'languageCode', label: 'Language', type: 'text', placeholder: 'ar-XA' },
      { id: 'voice', label: 'Voice name', type: 'text', placeholder: 'ar-XA-Standard-A' },
    ],
    defaults: {
      apiKey: '',
      languageCode: 'ar-XA',
      voice: 'ar-XA-Standard-A',
    },
  },
]

export const IMAGE_PROVIDERS = [
  {
    id: 'openaiImage',
    label: 'OpenAI GPT Image',
    description: `Same sk-… API key — default ${MIN_IMAGE_MODEL} (lowest cost)`,
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'sk-proj-… (same as OpenAI above)' },
      { id: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://api.openai.com/v1' },
      { id: 'model', label: 'Model', type: 'text', placeholder: MIN_IMAGE_MODEL },
      { id: 'size', label: 'Size', type: 'text', placeholder: MIN_IMAGE_SIZE },
      { id: 'quality', label: 'Quality', type: 'text', placeholder: 'low, medium, or high' },
    ],
    defaults: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      ...MIN_OPENAI_IMAGE_DEFAULTS,
    },
  },
  {
    id: 'geminiImage',
    label: 'Google Gemini Image',
    description: 'Gemini native image generation',
    fields: [
      { id: 'apiKey', label: 'API key', type: 'password', placeholder: 'AIza…' },
      { id: 'model', label: 'Model', type: 'text', placeholder: 'gemini-2.0-flash-preview-image-generation' },
    ],
    defaults: {
      apiKey: '',
      model: 'gemini-2.0-flash-preview-image-generation',
    },
  },
]

export function getAiProvider(id) {
  return AI_PROVIDERS.find((item) => item.id === id) ?? AI_PROVIDERS[0]
}

export function getTtsProvider(id) {
  return TTS_PROVIDERS.find((item) => item.id === id) ?? TTS_PROVIDERS[0]
}

export function getImageProvider(id) {
  return IMAGE_PROVIDERS.find((item) => item.id === id) ?? IMAGE_PROVIDERS[0]
}

export function buildDefaultProviderKeys() {
  const keys = {}
  for (const provider of AI_PROVIDERS) {
    keys[provider.id] = { ...provider.defaults }
  }
  for (const provider of TTS_PROVIDERS) {
    keys[provider.id] = { ...provider.defaults }
  }
  for (const provider of IMAGE_PROVIDERS) {
    keys[provider.id] = { ...provider.defaults }
  }
  return keys
}
