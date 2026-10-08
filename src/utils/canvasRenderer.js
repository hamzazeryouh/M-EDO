import { transitionSeconds } from '../constants'

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t))
}

function easeInOut(t) {
  const x = clamp01(t)
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2
}

function easeInOutCubic(t) {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2
}

export function getAnimationTransform(animation, progress) {
  const t = easeInOut(Math.min(1, Math.max(0, progress)))

  switch (animation) {
    case 'kenBurnsIn':
      return { scale: lerp(1, 1.18, t), offsetX: lerp(0, -0.06, t), offsetY: lerp(0, -0.04, t), opacity: 1 }
    case 'kenBurnsOut':
      return { scale: lerp(1.18, 1, t), offsetX: lerp(-0.06, 0, t), offsetY: lerp(-0.04, 0, t), opacity: 1 }
    case 'zoomIn':
      return { scale: lerp(1, 1.25, t), offsetX: 0, offsetY: 0, opacity: 1 }
    case 'zoomOut':
      return { scale: lerp(1.25, 1, t), offsetX: 0, offsetY: 0, opacity: 1 }
    case 'panLeft':
      return { scale: 1.12, offsetX: lerp(0.08, -0.08, t), offsetY: 0, opacity: 1 }
    case 'panRight':
      return { scale: 1.12, offsetX: lerp(-0.08, 0.08, t), offsetY: 0, opacity: 1 }
    case 'panUp':
      return { scale: 1.12, offsetX: 0, offsetY: lerp(0.08, -0.08, t), opacity: 1 }
    case 'panDown':
      return { scale: 1.12, offsetX: 0, offsetY: lerp(-0.08, 0.08, t), opacity: 1 }
    case 'fadeIn':
      return { scale: 1.05, offsetX: 0, offsetY: 0, opacity: lerp(0, 1, Math.min(1, t * 2)) }
    case 'static':
    default:
      return { scale: 1, offsetX: 0, offsetY: 0, opacity: 1 }
  }
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = testLine
    }
  }
  if (line) {
    lines.push(line)
  }
  return lines
}

function drawSpeechCaption(ctx, text, width, height) {
  const line = text?.trim()
  if (!line) {
    return
  }

  const fontSize = Math.max(18, Math.round(height * 0.032))
  const lineHeight = fontSize * 1.35
  const maxWidth = width * 0.84
  ctx.save()
  ctx.font = `600 ${fontSize}px "Segoe UI", Tahoma, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.direction = /[\u0600-\u06FF]/.test(line) ? 'rtl' : 'ltr'
  const lines = wrapLines(ctx, line, maxWidth).slice(0, 3)
  const padX = fontSize * 0.7
  const padY = fontSize * 0.45
  const boxHeight = lines.length * lineHeight + padY * 2
  const boxWidth = Math.min(maxWidth + padX * 2, width * 0.92)
  const boxX = (width - boxWidth) / 2
  const boxY = height - boxHeight - height * 0.055

  ctx.fillStyle = 'rgba(0, 0, 0, 0.62)'
  ctx.beginPath()
  ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 12)
  ctx.fill()
  ctx.fillStyle = '#f4f7fb'
  lines.forEach((item, index) => {
    ctx.fillText(item, width / 2, boxY + padY + index * lineHeight)
  })
  ctx.restore()
}

export function drawPlaceholder(ctx, shot, width, height) {
  ctx.fillStyle = '#0a0c10'
  ctx.fillRect(0, 0, width, height)

  const boxWidth = width * 0.72
  const boxHeight = height * 0.62
  const boxX = (width - boxWidth) / 2
  const boxY = (height - boxHeight) / 2

  ctx.fillStyle = '#171b24'
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight)
  ctx.strokeStyle = '#334'
  ctx.lineWidth = 2
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

  ctx.fillStyle = '#8ea0b8'
  ctx.font = `600 ${Math.round(height * 0.05)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(shot.name, width / 2, height * 0.38)

  ctx.fillStyle = '#667788'
  ctx.font = `${Math.round(height * 0.028)}px Segoe UI, sans-serif`
  ctx.fillText('Image pending', width / 2, height * 0.46)

  if (shot.voice) {
    ctx.fillStyle = '#99a8ba'
    ctx.font = `${Math.round(height * 0.026)}px Segoe UI, sans-serif`
    ctx.textAlign = 'center'
    const lines = wrapLines(ctx, shot.voice, boxWidth * 0.85)
    lines.forEach((item, index) => {
      ctx.fillText(item, width / 2, height * 0.54 + index * height * 0.04)
    })
  }
}

export function drawImageCover(ctx, img, width, height, transform) {
  const { scale, offsetX, offsetY, opacity } = transform
  const imgRatio = img.width / img.height
  const canvasRatio = width / height

  let drawWidth
  let drawHeight
  if (imgRatio > canvasRatio) {
    drawHeight = height * scale
    drawWidth = drawHeight * imgRatio
  } else {
    drawWidth = width * scale
    drawHeight = drawWidth / imgRatio
  }

  const x = (width - drawWidth) / 2 + offsetX * width
  const y = (height - drawHeight) / 2 + offsetY * height

  ctx.save()
  ctx.globalAlpha = opacity
  ctx.drawImage(img, x, y, drawWidth, drawHeight)
  ctx.restore()
}

export function findShotAtTime(shots, time) {
  let elapsed = 0
  for (let index = 0; index < shots.length; index += 1) {
    const shot = shots[index]
    if (time < elapsed + shot.duration) {
      return {
        index,
        shot,
        localTime: time - elapsed,
        progress: (time - elapsed) / shot.duration,
      }
    }
    elapsed += shot.duration
  }
  return null
}

export function renderFrame(ctx, shots, images, time, width, height, transitionDuration) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const current = findShotAtTime(shots, time)
  if (!current) {
    return
  }

  const { index, shot, localTime, progress } = current
  const currentImg = images.get(shot.id)
  const transform = getAnimationTransform(shot.animation, progress)
  const nextShot = shots[index + 1]
  const nextImg = nextShot ? images.get(nextShot.id) : null
  const timeLeft = shot.duration - localTime
  const preferredBlend = nextShot ? transitionSeconds(shot, nextShot) : 0
  const blendSeconds = nextShot && shot.transition !== 'cut'
    ? (preferredBlend > 0 ? preferredBlend : transitionDuration)
    : 0
  const inTransition = nextShot && shot.transition !== 'cut' && blendSeconds > 0 && timeLeft <= blendSeconds

  function drawShotVisual(targetShot, img, shotTransform, options = {}) {
    const alpha = options.alpha ?? 1
    const extraScale = options.extraScale ?? 1
    const blur = options.blur ?? 0
    const visual = {
      ...shotTransform,
      scale: shotTransform.scale * extraScale,
      opacity: Math.min(1, Math.max(0, (shotTransform.opacity ?? 1) * alpha)),
    }
    ctx.save()
    if (blur > 0.3) {
      ctx.filter = `blur(${blur.toFixed(2)}px)`
    }
    if (img && !targetShot.missingImage) {
      drawImageCover(ctx, img, width, height, visual)
    } else {
      ctx.globalAlpha = visual.opacity
      drawPlaceholder(ctx, targetShot, width, height)
    }
    ctx.restore()
  }

  if (!inTransition) {
    drawShotVisual(shot, currentImg, transform)
    drawSpeechCaption(ctx, shot.voice, width, height)
    return
  }

  const raw = 1 - timeLeft / blendSeconds
  const eased = easeInOutCubic(raw)
  const incoming = getAnimationTransform(nextShot.animation, 0)

  if (shot.transition === 'crossfade' || shot.transition === 'blur' || shot.transition === 'zoom') {
    const blur = shot.transition === 'blur' ? Math.sin(clamp01(raw) * Math.PI) * 14 : 0
    const outScale = shot.transition === 'zoom' ? lerp(1, 1.12, eased) : lerp(1, 1.035, eased)
    const inScale = shot.transition === 'zoom' ? lerp(1.16, 1, eased) : lerp(1.045, 1, eased)
    drawShotVisual(shot, currentImg, transform, { alpha: 1 - eased, extraScale: outScale, blur: blur * raw })
    drawShotVisual(nextShot, nextImg, incoming, { alpha: eased, extraScale: inScale, blur: blur * (1 - raw) })
    drawSpeechCaption(ctx, eased > 0.5 ? nextShot.voice : shot.voice, width, height)
    return
  }

  if (shot.transition === 'fade') {
    if (raw < 0.42) {
      drawShotVisual(shot, currentImg, transform, { alpha: 1 - easeInOut(raw / 0.42) })
    } else if (raw > 0.58) {
      drawShotVisual(nextShot, nextImg, incoming, { alpha: easeInOut((raw - 0.58) / 0.42) })
    }
    drawSpeechCaption(ctx, raw > 0.5 ? nextShot.voice : shot.voice, width, height)
    return
  }

  if (shot.transition === 'slideLeft' || shot.transition === 'slideRight') {
    const direction = shot.transition === 'slideLeft' ? -1 : 1
    ctx.save()
    ctx.translate(direction * eased * width, 0)
    drawShotVisual(shot, currentImg, transform)
    ctx.restore()

    const incomingX = direction * (eased - 1) * width
    ctx.save()
    ctx.translate(incomingX + direction * 2, 0)
    drawShotVisual(nextShot, nextImg, incoming)
    ctx.restore()

    ctx.save()
    if (direction < 0) {
      const edge = (1 - eased) * width
      const shade = ctx.createLinearGradient(edge - 80, 0, edge, 0)
      shade.addColorStop(0, 'rgba(0,0,0,0)')
      shade.addColorStop(1, 'rgba(0,0,0,0.4)')
      ctx.fillStyle = shade
      ctx.fillRect(edge - 80, 0, 80, height)
    } else {
      const edge = eased * width
      const shade = ctx.createLinearGradient(edge, 0, edge + 80, 0)
      shade.addColorStop(0, 'rgba(0,0,0,0.4)')
      shade.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = shade
      ctx.fillRect(edge, 0, 80, height)
    }
    ctx.restore()
    drawSpeechCaption(ctx, eased > 0.5 ? nextShot.voice : shot.voice, width, height)
    return
  }

  drawShotVisual(shot, currentImg, transform, { alpha: 1 - eased })
  drawShotVisual(nextShot, nextImg, incoming, { alpha: eased })
  drawSpeechCaption(ctx, eased > 0.5 ? nextShot.voice : shot.voice, width, height)
}

export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

export async function preloadImages(shots) {
  const map = new Map()
  await Promise.all(
    shots.map(async (shot) => {
      if (shot.missingImage) {
        return
      }
      try {
        const img = await loadImage(shot.src)
        map.set(shot.id, img)
      } catch {
        // Image was removed or failed to load — placeholder will be used.
      }
    }),
  )
  return map
}
