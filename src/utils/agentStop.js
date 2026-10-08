export function agentStoppedError() {
  const error = new Error('Agent stopped.')
  error.name = 'AgentStopped'
  return error
}

export function isAgentStop(error) {
  return error?.name === 'AgentStopped' || error?.name === 'AbortError'
}

export function throwIfStopped(signal) {
  if (signal?.aborted) {
    throw agentStoppedError()
  }
}

export function abortableDelay(ms, signal) {
  throwIfStopped(signal)
  if (!ms || ms <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(agentStoppedError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
