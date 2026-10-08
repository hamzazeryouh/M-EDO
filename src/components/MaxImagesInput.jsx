import { useEffect, useState } from 'react'

export default function MaxImagesInput({
  value,
  disabled = false,
  onCommit,
  min = 1,
  max = 240,
}) {
  const [text, setText] = useState(String(value ?? ''))

  useEffect(() => {
    setText(String(value ?? ''))
  }, [value])

  function commit() {
    const parsed = Number(text)
    const next = Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, Math.floor(parsed)))
      : Math.max(min, Number(value) || min)
    setText(String(next))
    if (next !== Number(value)) {
      onCommit?.(next)
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={text}
      aria-label="Max images"
      title="How many images this video can generate. Edit the number, then click away to save."
      onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
