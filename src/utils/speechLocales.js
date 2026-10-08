export const SPEECH_LOCALES = [
  { id: 'ar-MA', language: 'Arabic', accent: 'Moroccan', edgeVoice: 'ar-MA-MounaNeural' },
  { id: 'ar-SA', language: 'Arabic', accent: 'Saudi', edgeVoice: 'ar-SA-HamedNeural' },
  { id: 'ar-EG', language: 'Arabic', accent: 'Egyptian', edgeVoice: 'ar-EG-SalmaNeural' },
  { id: 'ar-AE', language: 'Arabic', accent: 'Emirati', edgeVoice: 'ar-AE-FatimaNeural' },
  { id: 'en-US', language: 'English', accent: 'American', edgeVoice: 'en-US-JennyNeural' },
  { id: 'en-GB', language: 'English', accent: 'British', edgeVoice: 'en-GB-SoniaNeural' },
  { id: 'fr-FR', language: 'French', accent: 'France', edgeVoice: 'fr-FR-DeniseNeural' },
  { id: 'es-ES', language: 'Spanish', accent: 'Spain', edgeVoice: 'es-ES-ElviraNeural' },
  { id: 'es-MX', language: 'Spanish', accent: 'Mexican', edgeVoice: 'es-MX-DaliaNeural' },
]

export function speechLanguages() {
  return [...new Set(SPEECH_LOCALES.map((item) => item.language))]
}

export function accentsForLanguage(language) {
  return SPEECH_LOCALES.filter((item) => item.language === language)
}

export function localeById(id) {
  return SPEECH_LOCALES.find((item) => item.id === id) ?? SPEECH_LOCALES[0]
}

export function localeFromVoice(voiceId) {
  if (!voiceId) {
    return SPEECH_LOCALES[0]
  }
  return SPEECH_LOCALES.find((item) => item.edgeVoice === voiceId)
    ?? SPEECH_LOCALES.find((item) => String(voiceId).startsWith(item.id))
    ?? SPEECH_LOCALES[0]
}

export function localeFromInstructions(text) {
  const lower = String(text || '').toLowerCase()
  return SPEECH_LOCALES.find((item) => (
    lower.includes(item.accent.toLowerCase()) && lower.includes(item.language.toLowerCase())
  )) ?? SPEECH_LOCALES[0]
}

export function speechInstruction(locale, delivery = 'human') {
  const tone = delivery === 'flat'
    ? 'Use a steady, clear documentary tone.'
    : 'Warm documentary narration — clear, engaging, cinematic pacing, with natural breaths and varied pitch.'
  return `Speak in ${locale.language} with a natural ${locale.accent} accent. ${tone}`
}
