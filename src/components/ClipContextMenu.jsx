import { useEffect, useRef, useState } from 'react'

export default function ClipContextMenu({
  x,
  y,
  shot,
  canSplit,
  onClose,
  onRename,
  onDuplicate,
  onSplit,
  onClearAudio,
  onDelete,
}) {
  const menuRef = useRef(null)
  const [name, setName] = useState(shot.name)

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  function commitRename(event) {
    event.preventDefault()
    const next = name.trim()
    if (next && next !== shot.name) {
      onRename(shot.id, next)
    }
    onClose()
  }

  async function copyName() {
    try {
      await navigator.clipboard.writeText(shot.name)
    } catch {
      // Clipboard can be blocked; the name is still in the field above.
    }
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="clip-context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      <form className="clip-menu-rename" onSubmit={commitRename}>
        <label>
          <span>Name</span>
          <input
            value={name}
            autoFocus
            aria-label="Clip name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </label>
      </form>
      <button type="button" role="menuitem" onClick={commitRename}>
        <span>Rename</span>
        <kbd>Enter</kbd>
      </button>
      <button type="button" role="menuitem" onClick={copyName}>
        <span>Copy name</span>
      </button>
      <div className="clip-menu-sep" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDuplicate(shot.id)
          onClose()
        }}
      >
        <span>Duplicate</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canSplit}
        title={canSplit ? 'Split this clip at the playhead' : 'Move the playhead inside this clip'}
        onClick={() => {
          onSplit()
          onClose()
        }}
      >
        <span>Split at playhead</span>
        <kbd>S</kbd>
      </button>
      {shot.audioSrc ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClearAudio(shot.id)
            onClose()
          }}
        >
          <span>Clear narration</span>
        </button>
      ) : null}
      <div className="clip-menu-sep" />
      <button
        type="button"
        role="menuitem"
        className="danger"
        onClick={() => {
          onDelete(shot.id)
          onClose()
        }}
      >
        <span>Delete</span>
        <kbd>Del</kbd>
      </button>
    </div>
  )
}
