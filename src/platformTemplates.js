export const PLATFORM_GROUPS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'shortform', label: 'TikTok & Shorts' },
  { id: 'social', label: 'Social & Other' },
]

export const PLATFORM_TEMPLATES = [
  {
    id: 'youtube-hd',
    group: 'youtube',
    label: 'YouTube Video',
    platform: 'YouTube',
    width: 1920,
    height: 1080,
    aspect: '16:9',
    fps: 30,
    maxDuration: null,
    defaultShotDuration: 5,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Standard HD landscape for YouTube uploads.',
  },
  {
    id: 'youtube-4k',
    group: 'youtube',
    label: 'YouTube 4K',
    platform: 'YouTube',
    width: 3840,
    height: 2160,
    aspect: '16:9',
    fps: 30,
    maxDuration: null,
    defaultShotDuration: 5,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Ultra HD landscape for premium YouTube content.',
  },
  {
    id: 'youtube-shorts',
    group: 'youtube',
    label: 'YouTube Shorts',
    platform: 'YouTube',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 2.5,
    animation: 'zoomIn',
    transition: 'cut',
    description: 'Vertical short-form, up to 60 seconds.',
  },
  {
    id: 'instagram-reels',
    group: 'instagram',
    label: 'Instagram Reels',
    platform: 'Instagram',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 90,
    defaultShotDuration: 2,
    animation: 'zoomIn',
    transition: 'cut',
    description: 'Vertical reels, fast cuts, up to 90 seconds.',
  },
  {
    id: 'instagram-story',
    group: 'instagram',
    label: 'Instagram Story',
    platform: 'Instagram',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 3,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Full-screen vertical stories.',
  },
  {
    id: 'instagram-square',
    group: 'instagram',
    label: 'Instagram Feed (Square)',
    platform: 'Instagram',
    width: 1080,
    height: 1080,
    aspect: '1:1',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 3.5,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Square feed posts and carousel clips.',
  },
  {
    id: 'instagram-portrait',
    group: 'instagram',
    label: 'Instagram Feed (Portrait)',
    platform: 'Instagram',
    width: 1080,
    height: 1350,
    aspect: '4:5',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 4,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Portrait feed format (4:5).',
  },
  {
    id: 'tiktok',
    group: 'shortform',
    label: 'TikTok',
    platform: 'TikTok',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 180,
    defaultShotDuration: 2,
    animation: 'zoomIn',
    transition: 'cut',
    description: 'Vertical TikTok, up to 3 minutes.',
  },
  {
    id: 'facebook-reels',
    group: 'shortform',
    label: 'Facebook Reels',
    platform: 'Facebook',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 90,
    defaultShotDuration: 2.5,
    animation: 'zoomIn',
    transition: 'cut',
    description: 'Vertical reels for Facebook.',
  },
  {
    id: 'snapchat',
    group: 'shortform',
    label: 'Snapchat',
    platform: 'Snapchat',
    width: 1080,
    height: 1920,
    aspect: '9:16',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 2.5,
    animation: 'panUp',
    transition: 'slideLeft',
    description: 'Vertical Snapchat spotlight and stories.',
  },
  {
    id: 'linkedin',
    group: 'social',
    label: 'LinkedIn',
    platform: 'LinkedIn',
    width: 1920,
    height: 1080,
    aspect: '16:9',
    fps: 30,
    maxDuration: 600,
    defaultShotDuration: 4,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Professional landscape for LinkedIn feed.',
  },
  {
    id: 'twitter',
    group: 'social',
    label: 'X / Twitter',
    platform: 'X',
    width: 1280,
    height: 720,
    aspect: '16:9',
    fps: 30,
    maxDuration: 140,
    defaultShotDuration: 3,
    animation: 'static',
    transition: 'cut',
    description: 'Landscape posts for X (Twitter).',
  },
  {
    id: 'facebook-feed',
    group: 'social',
    label: 'Facebook Feed',
    platform: 'Facebook',
    width: 1280,
    height: 720,
    aspect: '16:9',
    fps: 30,
    maxDuration: 240,
    defaultShotDuration: 4,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Landscape video for Facebook timeline.',
  },
  {
    id: 'pinterest',
    group: 'social',
    label: 'Pinterest Pin',
    platform: 'Pinterest',
    width: 1000,
    height: 1500,
    aspect: '2:3',
    fps: 30,
    maxDuration: 60,
    defaultShotDuration: 3.5,
    animation: 'kenBurnsOut',
    transition: 'fade',
    description: 'Vertical pin video (2:3).',
  },
  {
    id: 'documentary',
    group: 'social',
    label: 'Documentary (16:9)',
    platform: 'General',
    width: 1920,
    height: 1080,
    aspect: '16:9',
    fps: 30,
    maxDuration: null,
    defaultShotDuration: 5,
    animation: 'kenBurnsIn',
    transition: 'crossfade',
    description: 'Long-form documentary style (16:9).',
  },
]

export const DEFAULT_PLATFORM_TEMPLATE_ID = 'documentary'

export function getPlatformTemplate(templateId) {
  return PLATFORM_TEMPLATES.find((item) => item.id === templateId)
    ?? PLATFORM_TEMPLATES.find((item) => item.id === DEFAULT_PLATFORM_TEMPLATE_ID)
}

export function getPreviewCanvasSize(exportWidth, exportHeight, maxEdge = 960) {
  if (exportWidth >= exportHeight) {
    const width = maxEdge
    return {
      width,
      height: Math.max(2, Math.round((maxEdge * exportHeight) / exportWidth)),
    }
  }
  const height = maxEdge
  return {
    width: Math.max(2, Math.round((maxEdge * exportWidth) / exportHeight)),
    height,
  }
}

export function applyPlatformTemplateToShots(shots, templateId, { adjustDurations = true } = {}) {
  const template = getPlatformTemplate(templateId)
  if (!template || shots.length === 0) {
    return shots
  }

  return shots.map((shot, index) => ({
    ...shot,
    duration: adjustDurations ? template.defaultShotDuration : shot.duration,
    animation: template.animation ?? shot.animation,
    transition: index === shots.length - 1 ? shot.transition : (template.transition ?? shot.transition),
  }))
}

export function formatMaxDuration(seconds) {
  if (!seconds) {
    return 'No limit'
  }
  if (seconds < 60) {
    return `${seconds}s max`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s max` : `${mins} min max`
}

export function getTemplatesByGroup() {
  return PLATFORM_GROUPS.map((group) => ({
    ...group,
    templates: PLATFORM_TEMPLATES.filter((item) => item.group === group.id),
  }))
}
