import { useEffect, useRef, useState } from 'react'
import { formatTime } from '../constants'
import { IconSpeech } from './Icons'
import { TTS_PROVIDERS } from '../providers'
import { MOROCCAN_DOCUMENTARY_INSTRUCTIONS } from '../utils/ttsDefaults'
import { downloadBlob } from '../utils/videoExport'
import { OPENAI_TTS_VOICES, TTS_DELIVERIES, TTS_RATES, TTS_VOICES } from '../utils/textToSpeech'
import {
  accentsForLanguage,
  localeById,
  localeFromInstructions,
  localeFromVoice,
  speechInstruction,
  speechLanguages,
} from '../utils/speechLocales'

function SpeechStudio({
  selectedVoice,
  selectedAudioSrc,
  onSynthesize,
  onGenerateOnShot,
  hasShot,
  disabled,
  localeId,
  onLocaleChange,
  overridesFor,
}) {
  const audioRef = useRef(null)
  const ownedSrcRef = useRef(null)
  const pendingPlayRef = useRef(false)
  const [draft, setDraft] = useState(selectedVoice ?? '')
  const [clip, setClip] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [busy, setBusy] = useState(false)
  const [savingShot, setSavingShot] = useState(false)
  const [error, setError] = useState('')
  const [destination, setDestination] = useState('timeline')

  const locale = localeById(localeId)
  const accents = accentsForLanguage(locale.language)
  const working = busy || savingShot

  function releaseOwned() {
    if (ownedSrcRef.current) {
      URL.revokeObjectURL(ownedSrcRef.current)
      ownedSrcRef.current = null
    }
  }

  useEffect(() => {
    setDraft(selectedVoice ?? '')
    pendingPlayRef.current = false
    setError('')
    setPlaying(false)
    setTime(0)
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
    }
    releaseOwned()
    if (selectedAudioSrc) {
      setClip({ src: selectedAudioSrc, duration: 0, text: (selectedVoice ?? '').trim(), label: 'On timeline' })
    } else {
      setClip(null)
    }
  }, [selectedVoice, selectedAudioSrc])

  useEffect(() => () => releaseOwned(), [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !clip?.src) {
      return undefined
    }
    audio.src = clip.src
    const onTime = () => setTime(audio.currentTime || 0)
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setClip((current) => (current ? { ...current, duration: audio.duration } : current))
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      setTime(audio.duration || 0)
    }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false
      audio.play().catch(() => setPlaying(false))
    }
    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [clip?.src])

  function rememberClip(result, text, label) {
    releaseOwned()
    ownedSrcRef.current = result.src
    pendingPlayRef.current = true
    setTime(0)
    setClip({ src: result.src, blob: result.blob, duration: result.duration, text, label })
  }

  async function playExisting() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.currentTime = audio.ended ? 0 : audio.currentTime
      await audio.play()
    } else {
      audio.pause()
    }
  }

  async function generate() {
    const text = draft.trim()
    if (!text || working) return
    if (destination === 'timeline' && !hasShot) {
      setError('Select a shot on the timeline first.')
      return
    }
    setError('')
    const overrides = overridesFor(locale)
    if (destination === 'download') {
      setBusy(true)
      try {
        const result = await onSynthesize(text, overrides)
        rememberClip(result, text, 'Download')
        if (result.blob) {
          downloadBlob(result.blob, `speech-${locale.id}.mp3`)
        }
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : 'Could not generate audio.')
      } finally {
        setBusy(false)
      }
      return
    }

    setSavingShot(true)
    try {
      const result = await onGenerateOnShot(text, overrides)
      if (result?.src) {
        rememberClip(result, text, 'On timeline')
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not add audio to the timeline.')
    } finally {
      setSavingShot(false)
    }
  }

  async function downloadCurrent() {
    if (!clip?.src) return
    try {
      const blob = clip.blob ?? await fetch(clip.src).then((response) => response.blob())
      downloadBlob(blob, `speech-${locale.id}.mp3`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed.')
    }
  }

  function seek(nextTime) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = nextTime
    setTime(nextTime)
  }

  const duration = clip?.duration || audioRef.current?.duration || 0
  const sameText = clip?.text === draft.trim() && Boolean(clip?.src)

  return (
    <div className="speech-studio">
      <div className="speech-studio-head">
        <span className="panel-kicker">Text</span>
        <span className="muted">{draft.trim().length} characters</span>
      </div>
      <textarea
        className="speech-studio-text"
        dir="auto"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        rows={6}
        value={draft}
        placeholder="Type what the voice should say…"
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="speech-studio-row">
        <label className="tool-field">
          <span>Language</span>
          <select
            value={locale.language}
            onChange={(event) => {
              const next = accentsForLanguage(event.target.value)[0]
              onLocaleChange(next)
            }}
          >
            {speechLanguages().map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>
        <label className="tool-field">
          <span>Accent</span>
          <select
            value={locale.id}
            onChange={(event) => onLocaleChange(localeById(event.target.value))}
          >
            {accents.map((item) => (
              <option key={item.id} value={item.id}>{item.accent}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="speech-destination" role="group" aria-label="Where to put the audio">
        <button
          type="button"
          className={destination === 'timeline' ? 'active' : ''}
          onClick={() => setDestination('timeline')}
        >
          Timeline
        </button>
        <button
          type="button"
          className={destination === 'download' ? 'active' : ''}
          onClick={() => setDestination('download')}
        >
          Download
        </button>
      </div>
      <p className="speech-destination-note">
        {destination === 'timeline'
          ? 'Generate, then put this line on the selected shot.'
          : 'Generate, then save an MP3.'}
      </p>
      <button
        type="button"
        className="audio-splice-btn primary speech-generate"
        disabled={disabled || working || !draft.trim() || (destination === 'timeline' && !hasShot)}
        onClick={generate}
      >
        {working ? 'Generating…' : destination === 'timeline' ? 'Generate to timeline' : 'Generate and download'}
      </button>
      <audio ref={audioRef} preload="metadata" />
      {sameText ? (
        <div className="speech-player">
          <div className="speech-player-row">
            <button type="button" className="tool-btn accent" onClick={playExisting}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" className="tool-btn" onClick={downloadCurrent}>Download</button>
            <span className="muted">{clip?.label}</span>
            <span className="tts-preview-time">{formatTime(time)} / {formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.05"
            value={Math.min(time, duration || 0)}
            disabled={!duration}
            aria-label="Speech position"
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
      ) : null}
      {error ? <p className="voice warn">{error}</p> : null}
    </div>
  )
}
export default function TTSPanel({
  settings,
  onSettingsChange,
  onSaveSettings,
  voice,
  rate,
  delivery,
  matchDuration,
  generating,
  progress,
  shotsWithVoice,
  onVoiceChange,
  onRateChange,
  onDeliveryChange,
  onMatchDurationChange,
  onGenerateAll,
  onGenerateSelected,
  onSynthesizePreview,
  onGenerateOnShot,
  onSpliceToMaster,
  selectedHasVoice,
  hasSelectedShot,
  selectedVoice,
  selectedAudioSrc,
}) {
  const activeProvider = TTS_PROVIDERS.find((item) => item.id === settings.ttsProvider) ?? TTS_PROVIDERS[0]
  const providerConfig = settings.providerKeys[settings.ttsProvider] ?? {}
  const activeVoice = TTS_VOICES.find((item) => item.id === voice)
  const openAiVoice = OPENAI_TTS_VOICES.find((item) => item.id === providerConfig.voice)
  const initialLocale = settings.ttsProvider === 'edge'
    ? localeFromVoice(voice)
    : localeFromInstructions(settings.providerKeys?.openaiTts?.instructions)
  const [localeId, setLocaleId] = useState(initialLocale.id)

  useEffect(() => {
    if (settings.ttsProvider === 'edge') {
      setLocaleId(localeFromVoice(voice).id)
    }
  }, [settings.ttsProvider, voice])

  function overridesFor(locale, nextDelivery = delivery) {
    if (settings.ttsProvider === 'openaiTts') {
      return {
        config: {
          ...providerConfig,
          instructions: speechInstruction(locale, nextDelivery),
        },
      }
    }
    if (settings.ttsProvider === 'edge') {
      return {
        voice: locale.edgeVoice,
        config: { ...providerConfig, voice: locale.edgeVoice },
      }
    }
    return {}
  }

  function applyLocale(locale, nextDelivery = delivery) {
    setLocaleId(locale.id)
    if (settings.ttsProvider === 'edge') {
      onVoiceChange(locale.edgeVoice)
      return
    }
    if (settings.ttsProvider === 'openaiTts') {
      const next = {
        ...settings,
        providerKeys: {
          ...settings.providerKeys,
          openaiTts: {
            ...settings.providerKeys.openaiTts,
            instructions: speechInstruction(locale, nextDelivery),
          },
        },
      }
      onSettingsChange(next)
      onSaveSettings(next)
    }
  }

  function updateProviderField(field, value) {
    onSettingsChange({
      ...settings,
      providerKeys: {
        ...settings.providerKeys,
        [settings.ttsProvider]: {
          ...settings.providerKeys[settings.ttsProvider],
          [field]: value,
        },
      },
    })
  }

  return (
    <section className="tts-panel">
      <div className="tts-hero">
        <div className="tts-hero-icon">
          <IconSpeech size={26} />
        </div>
        <div>
          <strong>Text to speech</strong>
          <p className="muted">
            Type a line, choose the language and accent, then add it to the timeline or download it.
          </p>
        </div>
      </div>

      <SpeechStudio
        selectedVoice={selectedVoice}
        selectedAudioSrc={selectedAudioSrc}
        disabled={generating}
        hasShot={hasSelectedShot}
        localeId={localeId}
        onLocaleChange={applyLocale}
        overridesFor={overridesFor}
        onSynthesize={onSynthesizePreview}
        onGenerateOnShot={onGenerateOnShot}
      />

      <div className="audio-stats-row">
        <div className="audio-stat-card">
          <span className="stat-label">Shots</span>
          <strong>{shotsWithVoice}</strong>
          <span className="muted">with voice text</span>
        </div>
        <div className="audio-stat-card">
          <span className="stat-label">Provider</span>
          <strong>{activeProvider.label.split(' ')[0]}</strong>
          <span className="muted">
            {settings.ttsProvider === 'edge'
              ? activeVoice?.label
              : settings.ttsProvider === 'openaiTts'
                ? openAiVoice?.label || providerConfig.voice || 'marin'
                : providerConfig.voice || providerConfig.voiceId || 'configured'}
          </span>
        </div>
        <div className={`audio-stat-card ${generating ? 'ready' : ''}`}>
          <span className="stat-label">Status</span>
          <strong>{generating ? `${Math.round(progress * 100)}%` : 'Idle'}</strong>
          <span className="muted">{generating ? 'generating' : 'ready'}</span>
        </div>
      </div>

      <div className="tts-settings-card">
        <span className="panel-kicker">Speech provider</span>
        <label className="tool-field">
          <span>TTS engine</span>
          <select
            value={settings.ttsProvider}
            onChange={(event) => {
              onSettingsChange({ ...settings, ttsProvider: event.target.value })
              onSaveSettings()
            }}
          >
            {TTS_PROVIDERS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        {settings.ttsProvider === 'edge' ? (
          <div className="tts-settings-grid">
            <label className="tool-field">
              <span>Voice</span>
              <select value={voice} onChange={(event) => onVoiceChange(event.target.value)}>
                {TTS_VOICES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>Speed</span>
              <select value={rate} onChange={(event) => onRateChange(event.target.value)}>
                {TTS_RATES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : settings.ttsProvider === 'openaiTts' ? (
          <div className="tts-settings-grid">
            <label className="tool-field">
              <span>Voice</span>
              <select
                value={providerConfig.voice || 'marin'}
                onChange={(event) => {
                  updateProviderField('voice', event.target.value)
                  onSaveSettings()
                }}
              >
                {OPENAI_TTS_VOICES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>Model</span>
              <input
                value={providerConfig.model ?? 'gpt-4o-mini-tts'}
                placeholder="gpt-4o-mini-tts"
                onChange={(event) => updateProviderField('model', event.target.value)}
                onBlur={() => onSaveSettings?.()}
              />
            </label>
            <label className="tool-field tts-instructions-field">
              <span>Instructions (optional)</span>
              <textarea
                rows={2}
                value={providerConfig.instructions ?? ''}
                placeholder={MOROCCAN_DOCUMENTARY_INSTRUCTIONS}
                onChange={(event) => updateProviderField('instructions', event.target.value)}
                onBlur={() => onSaveSettings?.()}
              />
            </label>
          </div>
        ) : (
          <form className="tts-settings-grid" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            {activeProvider.fields.map((field) => (
              <label key={field.id} className="tool-field">
                <span>{field.label}</span>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  autoComplete={field.type === 'password' ? 'off' : undefined}
                  value={providerConfig[field.id] ?? ''}
                  placeholder={field.placeholder}
                  onChange={(event) => updateProviderField(field.id, event.target.value)}
                  onBlur={() => onSaveSettings?.()}
                />
              </label>
            ))}
          </form>
        )}

        <label className="tool-field">
          <span>Delivery</span>
          <select
            value={delivery}
            onChange={(event) => {
              const nextDelivery = event.target.value
              onDeliveryChange(nextDelivery)
              if (settings.ttsProvider === 'openaiTts') {
                applyLocale(localeById(localeId), nextDelivery)
              }
            }}
          >
            {TTS_DELIVERIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="checkbox-label tts-match-toggle">
          <input
            type="checkbox"
            checked={matchDuration}
            onChange={(event) => onMatchDurationChange(event.target.checked)}
          />
          Match shot duration to audio
        </label>
      </div>

      <div className="audio-panel-actions tts-actions">
        <button
          type="button"
          className="audio-splice-btn primary"
          disabled={generating || shotsWithVoice === 0}
          onClick={onGenerateAll}
        >
          {generating ? `Generating ${Math.round(progress * 100)}%` : `Generate with ${activeProvider.label}`}
        </button>
        <button type="button" className="tool-btn" disabled={generating || !selectedHasVoice} onClick={onGenerateSelected}>
          Selected shot
        </button>
        <button type="button" className="tool-btn accent" disabled={generating} onClick={onSpliceToMaster}>
          Splice → master
        </button>
      </div>

      <p className="hint tts-hint">
        {shotsWithVoice === 0
          ? 'Generate all stays off until shots already have narration text.'
          : 'Generate all speaks every shot that already has narration text.'}
      </p>
    </section>
  )
}
