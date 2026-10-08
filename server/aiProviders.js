function extractOpenAiContent(data) {
  return data.choices?.[0]?.message?.content ?? ''
}

export async function chatWithProvider(provider, config, messages) {
  switch (provider) {
    case 'openai':
      return chatOpenAi(config, messages)
    case 'claude':
      return chatClaude(config, messages)
    case 'gemini':
      return chatGemini(config, messages)
    case 'azureOpenAI':
      return chatAzureOpenAi(config, messages)
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}

async function chatOpenAi(config, messages) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('OpenAI API key is required')
  }
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.4,
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(payload || 'OpenAI request failed')
  }
  return extractOpenAiContent(JSON.parse(payload))
}

async function chatClaude(config, messages) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('Claude API key is required')
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      messages: messages.map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      })),
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(payload || 'Claude request failed')
  }
  const data = JSON.parse(payload)
  const block = data.content?.find((item) => item.type === 'text')
  return block?.text ?? ''
}

async function chatGemini(config, messages) {
  const apiKey = config.apiKey?.trim()
  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }
  const model = config.model || 'gemini-2.0-flash'
  const prompt = messages.map((message) => `${message.role}: ${message.content}`).join('\n')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(payload || 'Gemini request failed')
  }
  const data = JSON.parse(payload)
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function chatAzureOpenAi(config, messages) {
  const apiKey = config.apiKey?.trim()
  const endpoint = config.endpoint?.trim()?.replace(/\/$/, '')
  const deployment = config.deployment?.trim()
  if (!apiKey || !endpoint || !deployment) {
    throw new Error('Azure OpenAI key, endpoint, and deployment are required')
  }
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-02-15-preview`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      temperature: 0.4,
    }),
  })
  const payload = await response.text()
  if (!response.ok) {
    throw new Error(payload || 'Azure OpenAI request failed')
  }
  return extractOpenAiContent(JSON.parse(payload))
}

export async function testAiProvider(provider, config) {
  const content = await chatWithProvider(provider, config, [
    { role: 'user', content: 'Reply with exactly: OK' },
  ])
  if (!content.toUpperCase().includes('OK')) {
    return content.trim().slice(0, 120) || 'Connected'
  }
  return 'OK'
}
