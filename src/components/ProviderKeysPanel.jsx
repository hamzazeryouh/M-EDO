import { useState } from 'react'
import { AI_PROVIDERS, IMAGE_PROVIDERS, TTS_PROVIDERS } from '../providers'
import { testAiProvider, testAllProviders, testTtsProvider } from '../utils/aiAgent'
import { testImageProvider } from '../utils/imageGenerator'
import { updateProviderKey } from '../utils/agentSettings'

function ProviderCard({ provider, kind, config, onUpdate, onSave }) {
  const [showSecrets, setShowSecrets] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  async function handleTest() {
    onSave?.()
    setTesting(true)
    setTestResult('')
    try {
      const settings = {
        aiProvider: kind === 'ai' ? provider.id : 'openai',
        ttsProvider: kind === 'tts' ? provider.id : 'edge',
        imageProvider: kind === 'image' ? provider.id : 'openaiImage',
        providerKeys: { [provider.id]: config },
      }
      const message = kind === 'ai'
        ? await testAiProvider(settings, provider.id)
        : kind === 'image'
          ? await testImageProvider(settings, provider.id)
          : await testTtsProvider(settings, provider.id)
      setTestResult(`✓ ${message}`)
    } catch (error) {
      setTestResult(`✗ ${error instanceof Error ? error.message : 'Failed'}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className={`provider-card ${kind}`}>
      <div className="provider-card-head">
        <div>
          <strong>{provider.label}</strong>
          <span className="muted">{provider.description}</span>
        </div>
        <button type="button" className="tool-btn" disabled={testing} onClick={handleTest}>
          {testing ? 'Testing…' : 'Test'}
        </button>
      </div>
      <form className="provider-fields" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
        {provider.fields.map((field) => (
          <label key={field.id} className="tool-field agent-field">
            <span>{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea
                rows={2}
                value={config[field.id] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => onUpdate(field.id, event.target.value)}
                onBlur={() => onSave?.()}
              />
            ) : (
              <input
                type={field.type === 'password' && !showSecrets ? 'password' : 'text'}
                value={config[field.id] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) => onUpdate(field.id, event.target.value)}
                onBlur={() => onSave?.()}
              />
            )}
            {field.hint ? <span className="hint provider-field-hint">{field.hint}</span> : null}
          </label>
        ))}
      </form>
      {provider.fields.some((field) => field.type === 'password') ? (
        <button type="button" className="tool-btn show-secrets-btn" onClick={() => setShowSecrets((value) => !value)}>
          {showSecrets ? 'Hide secrets' : 'Show secrets'}
        </button>
      ) : null}
      {testResult ? <p className={`provider-test-result ${testResult.startsWith('✓') ? 'ok' : 'err'}`}>{testResult}</p> : null}
    </div>
  )
}

export default function ProviderKeysPanel({ settings, onChange, onSaveSettings }) {
  const [testingAll, setTestingAll] = useState(false)
  const [allResults, setAllResults] = useState([])

  function updateKey(providerId, field, value) {
    onChange(updateProviderKey(settings, providerId, field, value))
  }

  function copyOpenAiKeyToProvider(targetId, activeField) {
    const openAiKey = settings.providerKeys.openai?.apiKey?.trim()
    if (!openAiKey) {
      return
    }
    onChange({
      ...settings,
      [activeField]: targetId,
      providerKeys: {
        ...settings.providerKeys,
        [targetId]: {
          ...settings.providerKeys[targetId],
          apiKey: openAiKey,
          baseUrl: settings.providerKeys.openai?.baseUrl || settings.providerKeys[targetId]?.baseUrl,
        },
      },
    })
    onSaveSettings()
  }

  async function handleTestAll() {
    setTestingAll(true)
    onSaveSettings()
    try {
      const results = await testAllProviders(settings)
      setAllResults(results)
    } finally {
      setTestingAll(false)
    }
  }

  return (
    <div className="provider-keys-panel">
      <div className="provider-keys-head">
        <div>
          <span className="panel-kicker">Provider keys</span>
          <strong>AI + Speech APIs</strong>
        </div>
        <button type="button" className="tool-btn accent" disabled={testingAll} onClick={handleTestAll}>
          {testingAll ? 'Testing all…' : 'Test all keys'}
        </button>
      </div>
      <p className="hint provider-keys-hint">Keys stay in your browser. Dev server proxies requests — restart `npm run dev` after changes.</p>

      <div className="provider-group">
        <h3 className="provider-group-title">AI agents</h3>
        <label className="tool-field agent-field">
          <span>Active AI provider</span>
          <select
            value={settings.aiProvider}
            onChange={(event) => {
              onChange({ ...settings, aiProvider: event.target.value })
              onSaveSettings()
            }}
          >
            {AI_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        {AI_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            kind="ai"
            provider={provider}
            config={settings.providerKeys[provider.id] ?? provider.defaults}
            onUpdate={(field, value) => updateKey(provider.id, field, value)}
            onSave={onSaveSettings}
          />
        ))}
      </div>

      <div className="provider-group">
        <div className="provider-group-head">
          <h3 className="provider-group-title">Text to speech</h3>
          <button type="button" className="tool-btn" onClick={() => copyOpenAiKeyToProvider('openaiTts', 'ttsProvider')}>
            Copy OpenAI key → TTS
          </button>
        </div>
        <p className="hint provider-keys-hint">
          OpenAI TTS uses the same sk-proj-… key. Model: gpt-4o-mini-tts with 13 voices (marin, cedar recommended).
        </p>
        <label className="tool-field agent-field">
          <span>Active TTS provider</span>
          <select
            value={settings.ttsProvider}
            onChange={(event) => {
              onChange({ ...settings, ttsProvider: event.target.value })
              onSaveSettings()
            }}
          >
            {TTS_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        {TTS_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            kind="tts"
            provider={provider}
            config={settings.providerKeys[provider.id] ?? provider.defaults}
            onUpdate={(field, value) => updateKey(provider.id, field, value)}
            onSave={onSaveSettings}
          />
        ))}
      </div>

      <div className="provider-group">
        <div className="provider-group-head">
          <h3 className="provider-group-title">Image generation</h3>
          <button type="button" className="tool-btn" onClick={() => copyOpenAiKeyToProvider('openaiImage', 'imageProvider')}>
            Copy OpenAI key → Images
          </button>
        </div>
        <p className="hint provider-keys-hint">
          Yes — same API key as ChatGPT developers API (sk-proj-… from platform.openai.com). Requires billing enabled. Run via npm run dev.
        </p>
        <label className="tool-field agent-field">
          <span>Active image provider</span>
          <select
            value={settings.imageProvider}
            onChange={(event) => {
              onChange({ ...settings, imageProvider: event.target.value })
              onSaveSettings()
            }}
          >
            {IMAGE_PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        {IMAGE_PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            kind="image"
            provider={provider}
            config={settings.providerKeys[provider.id] ?? provider.defaults}
            onUpdate={(field, value) => updateKey(provider.id, field, value)}
            onSave={onSaveSettings}
          />
        ))}
      </div>

      {allResults.length > 0 ? (
        <div className="provider-test-all">
          <strong>Test all results</strong>
          <ul>
            {allResults.map((item) => (
              <li key={`${item.kind}-${item.id}`} className={item.status}>
                [{item.kind.toUpperCase()}] {item.label}: {item.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
