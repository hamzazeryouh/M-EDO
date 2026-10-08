import { useRef } from 'react'
import { ANIMATIONS, TRANSITIONS, transitionSeconds } from '../constants'

export default function ShotEditor({ shot, onChange, isLast, onGenerateTTS, generatingTTS }) {
  const audioInputRef = useRef(null)

  if (!shot) {
    return (
      <div className="shot-editor empty">
        <p>Select a clip to edit image prompt, duration, motion, transitions, and narration.</p>
      </div>
    )
  }

  function update(field, value) {
    onChange(shot.id, { [field]: value })
  }

  function handleAudioUpload(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (shot.audioSrc) {
      URL.revokeObjectURL(shot.audioSrc)
    }
    onChange(shot.id, {
      audioSrc: URL.createObjectURL(file),
      audioName: file.name,
    })
    event.target.value = ''
  }

  function clearAudio() {
    if (shot.audioSrc) {
      URL.revokeObjectURL(shot.audioSrc)
    }
    onChange(shot.id, { audioSrc: null, audioName: '' })
  }

  return (
    <div className="shot-editor">
      <div className="editor-header">
        {shot.src && !shot.missingImage ? (
          <img src={shot.src} alt={shot.name} />
        ) : (
          <div className="editor-thumb-placeholder" aria-hidden="true">
            <span>No image</span>
          </div>
        )}
        <div>
          <h3>{shot.name}</h3>
          {shot.missingImage ? <p className="voice warn">Image not generated yet — placeholder shown in preview.</p> : null}
          {shot.voice ? <p className="voice">{shot.voice}</p> : null}
        </div>
      </div>

      <label>
        Image prompt
        <textarea
          rows={3}
          value={shot.imagePrompt ?? ''}
          onChange={(event) => update('imagePrompt', event.target.value)}
          placeholder="Describe the visual for this shot — used by AI image generation"
        />
        <span className="hint">Edit prompts after manifest import, or before running Generate images in the agent.</span>
      </label>

      <label>
        Duration (seconds)
        <input
          type="number"
          min="0.5"
          max="120"
          step="0.1"
          value={shot.duration}
          onChange={(event) => update('duration', Number(event.target.value))}
        />
        <span className="hint">Or drag the clip edge on the timeline · press S to split at playhead</span>
      </label>

      <label>
        Animation
        <select value={shot.animation} onChange={(event) => update('animation', event.target.value)}>
          {ANIMATIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <span className="hint">
          {ANIMATIONS.find((item) => item.id === shot.animation)?.description}
        </span>
      </label>

      {!isLast ? (
        <label>
          Transition to next
          <select value={shot.transition} onChange={(event) => update('transition', event.target.value)}>
            {TRANSITIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="hint">
            {TRANSITIONS.find((item) => item.id === shot.transition)?.description}
          </span>
        </label>
      ) : null}
      {!isLast && shot.transition !== 'cut' ? (
        <label>
          Transition length
          <input
            type="range"
            min="0.2"
            max="1.8"
            step="0.05"
            value={shot.transitionDuration ?? TRANSITIONS.find((item) => item.id === shot.transition)?.duration ?? 1}
            onChange={(event) => update('transitionDuration', Number(event.target.value))}
          />
          <span className="hint">{transitionSeconds(shot, { duration: shot.duration, transition: shot.transition }).toFixed(2)}s eased blend</span>
        </label>
      ) : null}
      {isLast ? <p className="hint">Last shot — no transition needed.</p> : null}

      <div className="audio-block">
        <span>Narration audio (synced to this shot)</span>
        <div className="audio-row">
          <button type="button" onClick={() => audioInputRef.current?.click()}>
            {shot.audioSrc ? 'Replace audio' : 'Upload audio'}
          </button>
          {shot.audioName ? <span className="audio-name">{shot.audioName}</span> : null}
          {shot.audioSrc ? (
            <button type="button" className="danger-text" onClick={clearAudio}>
              Remove
            </button>
          ) : null}
        </div>
        <span className="hint">MP3, WAV, or M4A — plays from the start of this shot</span>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={handleAudioUpload}
        />
      </div>

      <label>
        Voice / caption (text-to-speech source)
        <textarea
          rows={3}
          value={shot.voice}
          onChange={(event) => update('voice', event.target.value)}
          placeholder="Narration text for this shot — used by Generate TTS"
        />
      </label>
      {shot.voice?.trim() ? (
        <button type="button" className="accent" disabled={generatingTTS} onClick={onGenerateTTS}>
          {generatingTTS ? 'Generating…' : 'Generate TTS from text'}
        </button>
      ) : null}
    </div>
  )
}
