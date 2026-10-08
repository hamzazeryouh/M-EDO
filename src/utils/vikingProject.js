import {
  DEFAULT_PLATFORM_TEMPLATE,
  DEFAULT_SCRIPT_LANGUAGE,
  QUALITY_TTS_PROVIDER,
} from './modelDefaults'

export const VIKING_PROJECT_BASE = '/viking-project'

export const VIKING_VISUAL_STYLE = `Cinematic historical realism, 9th–11th century Europe, historically inspired Viking clothing and weapons, realistic human proportions, dramatic natural lighting, cold Nordic atmosphere, detailed wooden Viking longships, realistic shields and axes, muddy battlefields, cinematic depth of field, epic scale, realistic medieval environments, dark dramatic atmosphere, 16:9 YouTube frame, ultra detailed, photorealistic, no fantasy armor, no modern objects, no horned helmets. Keep the main Viking characters visually consistent between consecutive scenes.`

export const VIKING_PROJECT_BRIEF = `Epic English-language documentary: The Viking Age from Stamford Bridge opening through Lindisfarne, Paris raids, Alfred the Great, Norman transformation, Clontarf, Maldon, Canute's empire, Harald Hardrada, and the end at Hastings. Cinematic historical realism, dark Nordic atmosphere, consistent Viking characters across scenes.`

export const VIKING_AGENT_PRESET = {
  projectBrief: VIKING_PROJECT_BRIEF,
  scriptLanguage: DEFAULT_SCRIPT_LANGUAGE,
  platformTemplateId: DEFAULT_PLATFORM_TEMPLATE,
  stylePresetId: 'cinematic',
  targetMinutes: 25,
  targetSeconds: 0,
  maxShots: 10,
  scriptMaxShots: 10,
  audioMatchMode: 'loopRandom',
  costMode: 'quality',
  ttsProvider: QUALITY_TTS_PROVIDER,
}

export const VIKING_TEST_WORKFLOW = [
  { id: 'generateImages', enabled: true },
  { id: 'applyTemplate', enabled: true },
  { id: 'generateTts', enabled: false },
  { id: 'spliceMaster', enabled: false },
  { id: 'fitToAudio', enabled: false },
  { id: 'exportVideo', enabled: true },
]

export const VIKING_FULL_WORKFLOW = [
  { id: 'generateImages', enabled: true },
  { id: 'applyTemplate', enabled: true },
  { id: 'generateNarration', enabled: true },
  { id: 'generateTts', enabled: true },
  { id: 'spliceMaster', enabled: true },
  { id: 'fitToAudio', enabled: true },
  { id: 'exportVideo', enabled: true },
]
