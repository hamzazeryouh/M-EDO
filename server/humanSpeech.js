import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const PITCH_CYCLE = ['-2Hz', '+0Hz', '-4Hz', '+1Hz', '-1Hz']
const RATE_OFFSETS = [-4, 0, -6, 2, -3]

export function parseRatePercent(rate) {
  const match = String(rate ?? '+0%').match(/([+-]?\d+)/)
  return match ? Number(match[1]) : 0
}

export function formatRate(percent) {
  const value = Math.max(-40, Math.min(40, Math.round(percent)))
  return `${value >= 0 ? '+' : ''}${value}%`
}

function pauseAfter(mark) {
  if (mark === '?' || mark === '؟') return 420
  if (mark === '!') return 360
  if (mark === '،' || mark === ',') return 160
  return 300
}

export function splitForSpeech(text) {
  const normalized = String(text)
    .replace(/\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return []

  const pieces = []
  let current = ''

  for (const char of normalized) {
    current += char
    const isStop = '.!?؟'.includes(char) || char === '…'
    const isComma = char === '،' || char === ','
    const longEnough = current.trim().length >= 72
    if (isStop || (isComma && longEnough)) {
      const spoken = current.trim()
      if (spoken.replace(/[.!?؟،,…]/g, '').trim()) {
        pieces.push({ text: spoken, pauseMs: pauseAfter(char) })
      }
      current = ''
    }
  }

  const tail = current.trim()
  if (tail.replace(/[.!?؟،,…]/g, '').trim()) {
    pieces.push({ text: tail, pauseMs: 0 })
  }

  return pieces.length > 0 ? pieces : [{ text: normalized, pauseMs: 0 }]
}

export function prosodyForPart(index, baseRate) {
  const center = parseRatePercent(baseRate) - 4
  return {
    rate: formatRate(center + RATE_OFFSETS[index % RATE_OFFSETS.length]),
    pitch: PITCH_CYCLE[index % PITCH_CYCLE.length],
    volume: '+0%',
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { windowsHide: true })
    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.slice(-400) || `ffmpeg exited ${code}`))
    })
  })
}

export async function joinSpeechParts(buffers, pausesMs) {
  if (buffers.length === 0) {
    throw new Error('No speech audio to join')
  }
  if (buffers.length === 1) {
    return buffers[0]
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tts-human-'))
  try {
    const files = []
    for (let index = 0; index < buffers.length; index += 1) {
      const file = path.join(dir, `part-${index}.mp3`)
      await fs.writeFile(file, buffers[index])
      files.push(file)
    }

    const filters = []
    const labels = []
    buffers.forEach((_, index) => {
      const pause = index < buffers.length - 1 ? ((pausesMs[index] ?? 280) / 1000).toFixed(3) : '0'
      if (pause === '0' || pause === '0.000') {
        filters.push(`[${index}:a]asetpts=PTS-STARTPTS[a${index}]`)
      } else {
        filters.push(`[${index}:a]apad=pad_dur=${pause},asetpts=PTS-STARTPTS[a${index}]`)
      }
      labels.push(`[a${index}]`)
    })
    filters.push(`${labels.join('')}concat=n=${buffers.length}:v=0:a=1[out]`)

    const out = path.join(dir, 'joined.mp3')
    const args = ['-y', '-hide_banner', '-loglevel', 'error']
    for (const file of files) {
      args.push('-i', file)
    }
    args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-codec:a', 'libmp3lame', '-q:a', '3', out)
    await runFfmpeg(args)
    return await fs.readFile(out)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}
