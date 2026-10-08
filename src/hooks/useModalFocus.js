import { useEffect, useRef } from 'react'

function getFocusable(container) {
  if (!container) {
    return []
  }
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ))
}

export function useModalFocus(open, onClose) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const previousFocus = document.activeElement

    function focusFirst() {
      const focusable = getFocusable(dialogRef.current)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        dialogRef.current?.focus()
      }
    }

    const focusTimer = window.setTimeout(focusFirst, 0)

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }
      const focusable = getFocusable(dialogRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [open, onClose])

  return dialogRef
}
