export const WORKFLOW_STEP_DEFS = {
  generateScript: {
    id: 'generateScript',
    label: 'Generate script',
    shortLabel: 'Script',
    description: 'AI writes narration + image prompts per shot',
    category: 'create',
  },
  generateImages: {
    id: 'generateImages',
    label: 'Generate images',
    shortLabel: 'Images',
    description: 'Create AI visuals for each shot',
    category: 'create',
  },
  loadProject: {
    id: 'loadProject',
    label: 'Load project',
    shortLabel: 'Load',
    description: 'Import Korea documentary assets if timeline is empty',
    category: 'input',
  },
  limitShots: {
    id: 'limitShots',
    label: 'Limit shots',
    shortLabel: 'Trim',
    description: 'Cap timeline to max shots setting',
    category: 'edit',
  },
  applyTemplate: {
    id: 'applyTemplate',
    label: 'Apply template',
    shortLabel: 'Format',
    description: 'Platform size + style preset',
    category: 'edit',
  },
  fitTargetDuration: {
    id: 'fitTargetDuration',
    label: 'Fit target duration',
    shortLabel: 'Duration',
    description: 'Split target length evenly across shots',
    category: 'edit',
  },
  aiPlan: {
    id: 'aiPlan',
    label: 'AI pacing tips',
    shortLabel: 'Plan',
    description: 'Optional AI advice before TTS',
    category: 'ai',
  },
  generateNarration: {
    id: 'generateNarration',
    label: 'Write narration',
    shortLabel: 'Narrate',
    description: 'Fill voice lines from image prompts (for loaded projects)',
    category: 'create',
  },
  generateTts: {
    id: 'generateTts',
    label: 'Generate speech',
    shortLabel: 'Speech',
    description: 'Text-to-speech for all voice lines',
    category: 'audio',
  },
  spliceMaster: {
    id: 'spliceMaster',
    label: 'Splice master audio',
    shortLabel: 'Splice',
    description: 'Combine per-shot audio into one track',
    category: 'audio',
  },
  fitToAudio: {
    id: 'fitToAudio',
    label: 'Match shots to audio',
    shortLabel: 'Sync',
    description: 'Adjust shot length to narration',
    category: 'edit',
  },
  exportVideo: {
    id: 'exportVideo',
    label: 'Export MP4',
    shortLabel: 'Export',
    description: 'Render and download finished video',
    category: 'output',
  },
}

export const DEFAULT_WORKFLOW_ORDER = [
  'generateScript',
  'generateImages',
  'loadProject',
  'limitShots',
  'applyTemplate',
  'fitTargetDuration',
  'aiPlan',
  'generateNarration',
  'generateTts',
  'spliceMaster',
  'fitToAudio',
  'exportVideo',
]

export const WORKFLOW_PRESETS = {
  fullCreate: {
    id: 'fullCreate',
    label: 'Full AI create',
    description: 'Topic → script → images → speech → export',
    steps: ['generateScript', 'generateImages', 'applyTemplate', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  koreaDoc: {
    id: 'koreaDoc',
    label: 'Korea documentary',
    description: 'Load existing project → TTS → export',
    steps: ['loadProject', 'limitShots', 'applyTemplate', 'fitTargetDuration', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  voiceOnly: {
    id: 'voiceOnly',
    label: 'Voice + export',
    description: 'Speech and splice on existing shots',
    steps: ['generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  scriptAndVoice: {
    id: 'scriptAndVoice',
    label: 'Script + voice',
    description: 'Write script, narrate, export (no images)',
    steps: ['generateScript', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  minimalCost: {
    id: 'minimalCost',
    label: 'Minimal cost',
    description: 'Script + free speech only — no AI images',
    steps: ['generateScript', 'limitShots', 'applyTemplate', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  lowCostVideo: {
    id: 'lowCostVideo',
    label: 'Low cost video',
    description: 'Script + standard images + free speech',
    steps: ['generateScript', 'generateImages', 'limitShots', 'applyTemplate', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  vikingTest: {
    id: 'vikingTest',
    label: 'Viking test (10)',
    description: 'Generate 10 AI images + export MP4',
    steps: ['generateImages', 'applyTemplate', 'exportVideo'],
  },
  vikingFull: {
    id: 'vikingFull',
    label: 'Viking full',
    description: 'Images + narration + speech + sync + export',
    steps: ['generateImages', 'applyTemplate', 'generateNarration', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
  fullVideo: {
    id: 'fullVideo',
    label: 'Full video pipeline',
    description: 'AI images + template + narration + speech + sync + MP4',
    steps: ['generateImages', 'applyTemplate', 'generateNarration', 'generateTts', 'spliceMaster', 'fitToAudio', 'exportVideo'],
  },
}

export function buildDefaultWorkflow(enabledOverrides = {}) {
  const legacyEnabled = {
    generateScript: false,
    generateImages: false,
    loadProject: true,
    limitShots: true,
    applyTemplate: true,
    fitTargetDuration: true,
    aiPlan: false,
    generateTts: true,
    spliceMaster: true,
    fitToAudio: true,
    exportVideo: true,
    ...enabledOverrides,
  }

  return DEFAULT_WORKFLOW_ORDER.map((id) => ({
    id,
    enabled: legacyEnabled[id] ?? false,
  }))
}

export function workflowFromLegacySteps(steps = {}) {
  return DEFAULT_WORKFLOW_ORDER.map((id) => ({
    id,
    enabled: id === 'aiPlan'
      ? Boolean(steps.useAiPlan ?? false)
      : id === 'limitShots'
        ? true
        : Boolean(steps[id]),
  })).filter((item) => item.enabled || DEFAULT_WORKFLOW_ORDER.includes(item.id))
}

export function normalizeWorkflow(workflow) {
  if (!Array.isArray(workflow) || workflow.length === 0) {
    return buildDefaultWorkflow()
  }

  const seen = new Set()
  const normalized = []

  for (const item of workflow) {
    const id = item?.id
    if (!WORKFLOW_STEP_DEFS[id] || seen.has(id)) {
      continue
    }
    seen.add(id)
    normalized.push({ id, enabled: item.enabled !== false })
  }

  return normalized.length > 0 ? normalized : buildDefaultWorkflow()
}

export function syncStepsFromWorkflow(workflow) {
  const normalized = normalizeWorkflow(workflow)
  const steps = {}
  for (const id of DEFAULT_WORKFLOW_ORDER) {
    steps[id] = false
  }
  for (const item of normalized) {
    steps[item.id] = item.enabled
  }
  return steps
}

export function getEnabledWorkflowSteps(settings) {
  const workflow = normalizeWorkflow(settings.workflow)
  return workflow.filter((item) => item.enabled).map((item) => item.id)
}

export function applyWorkflowPreset(presetId) {
  const preset = WORKFLOW_PRESETS[presetId]
  if (!preset) {
    return buildDefaultWorkflow()
  }
  return preset.steps.map((id) => ({ id, enabled: true }))
}

export function reorderWorkflow(workflow, fromIndex, toIndex) {
  if (fromIndex === null || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return workflow
  }
  const next = [...workflow]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) {
    return workflow
  }
  next.splice(toIndex, 0, moved)
  return next
}

export function insertWorkflowStep(workflow, stepId, toIndex = workflow.length) {
  if (!WORKFLOW_STEP_DEFS[stepId]) {
    return workflow
  }
  if (workflow.some((item) => item.id === stepId)) {
    return workflow
  }
  const next = [...workflow]
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, { id: stepId, enabled: true })
  return next
}

export function removeWorkflowStep(workflow, index) {
  return workflow.filter((_, itemIndex) => itemIndex !== index)
}

export function toggleWorkflowStep(workflow, index, enabled) {
  return workflow.map((item, itemIndex) => (
    itemIndex === index ? { ...item, enabled } : item
  ))
}

export function getWorkflowDef(stepId) {
  return WORKFLOW_STEP_DEFS[stepId]
}
