const defaults = { size: 16, strokeWidth: 1.75 }

function Svg({ size, children, viewBox = '0 0 24 24' }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

function strokeProps(width) {
  return {
    stroke: 'currentColor',
    strokeWidth: width,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
}

export function IconPlay({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconPause({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M9 6v12M15 6v12" />
    </Svg>
  )
}

export function IconSkipStart({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M6 6v12M10 12l8-6v12z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconSkipPrev({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M11 6l-7 6 7 6V6zM18 6v12" />
    </Svg>
  )
}

export function IconSkipNext({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M13 6l7 6-7 6V6zM6 6v12" />
    </Svg>
  )
}

export function IconUndo({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M9 7H5v4M5 11a7 7 0 1 0 1.5 4.5" />
    </Svg>
  )
}

export function IconRedo({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M15 7h4v4M19 11a7 7 0 1 1-1.5 4.5" />
    </Svg>
  )
}

export function IconSplit({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M12 4v16M6 8l6-4 6 4M6 16l6 4 6-4" />
    </Svg>
  )
}

export function IconDuplicate({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="8" y="8" width="11" height="11" rx="1.5" />
      <path {...s} d="M5 16V5a1.5 1.5 0 0 1 1.5-1.5H16" />
    </Svg>
  )
}

export function IconMedia({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="3" y="5" width="18" height="14" rx="2" />
      <path {...s} d="M8 11l3 2.5L16 10l5 4" />
    </Svg>
  )
}

export function IconAudio({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
    </Svg>
  )
}

export function IconSpeech({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path {...s} d="M8 14a4 4 0 0 0 8 0M12 18v3" />
    </Svg>
  )
}

export function IconPanelLeft({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="3" y="4" width="18" height="16" rx="2" />
      <path {...s} d="M9 4v16" />
    </Svg>
  )
}

export function IconPanelRight({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="3" y="4" width="18" height="16" rx="2" />
      <path {...s} d="M15 4v16" />
    </Svg>
  )
}

export function IconExport({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M12 4v10M8 10l4 4 4-4M5 18h14" />
    </Svg>
  )
}

export function IconImport({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M12 14V4M8 8l4-4 4 4M5 18h14" />
    </Svg>
  )
}

export function IconFolder({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M4 7h5l2 2h9v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

export function IconZoomIn({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <circle {...s} cx="11" cy="11" r="6" />
      <path {...s} d="M16 16l4 4M8 11h6M11 8v6" />
    </Svg>
  )
}

export function IconZoomOut({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <circle {...s} cx="11" cy="11" r="6" />
      <path {...s} d="M16 16l4 4M8 11h6" />
    </Svg>
  )
}

export function IconChevronLeft({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M14 6l-6 6 6 6" />
    </Svg>
  )
}

export function IconChevronRight({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M10 6l6 6-6 6" />
    </Svg>
  )
}

export function IconChat({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <path {...s} d="M6 16.5V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v6A2.5 2.5 0 0 1 15.5 16H9l-3 3v-2.5z" />
    </Svg>
  )
}

export function IconAgent({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="5" y="8" width="14" height="11" rx="2" />
      <path {...s} d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path {...s} d="M12 14v2M9 14h6" />
      <circle {...s} cx="9.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle {...s} cx="14.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function IconTemplate({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <rect {...s} x="4" y="4" width="7" height="7" rx="1" />
      <rect {...s} x="13" y="4" width="7" height="7" rx="1" />
      <rect {...s} x="4" y="13" width="7" height="7" rx="1" />
      <rect {...s} x="13" y="13" width="7" height="7" rx="1" />
    </Svg>
  )
}

export function IconScissors({ size = defaults.size, strokeWidth = defaults.strokeWidth }) {
  const s = strokeProps(strokeWidth)
  return (
    <Svg size={size}>
      <circle {...s} cx="6" cy="7" r="2.5" />
      <circle {...s} cx="6" cy="17" r="2.5" />
      <path {...s} d="M8.5 8.5L20 18M8.5 15.5L20 6" />
    </Svg>
  )
}
