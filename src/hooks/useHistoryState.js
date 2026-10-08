import { useCallback, useState } from 'react'

export function useHistoryState(initialValue) {
  const [history, setHistory] = useState({
    past: [],
    present: initialValue,
    future: [],
  })

  const set = useCallback((value) => {
    setHistory((current) => {
      const next = typeof value === 'function' ? value(current.present) : value
      if (next === current.present) {
        return current
      }
      return {
        past: [...current.past, current.present],
        present: next,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) {
        return current
      }
      const previous = current.past[current.past.length - 1]
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) {
        return current
      }
      const next = current.future[0]
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      }
    })
  }, [])

  const replace = useCallback((value) => {
    setHistory({
      past: [],
      present: typeof value === 'function' ? value([]) : value,
      future: [],
    })
  }, [])

  const assign = useCallback((value) => {
    setHistory((current) => {
      const next = typeof value === 'function' ? value(current.present) : value
      if (next === current.present) {
        return current
      }
      return { ...current, present: next }
    })
  }, [])

  return {
    value: history.present,
    set,
    assign,
    replace,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
