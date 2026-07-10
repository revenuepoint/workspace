import { useCallback, useSyncExternalStore } from 'react'

/**
 * True while `query` matches. Conditional-render companion to Tailwind's
 * responsive classes for cases where rendering BOTH layouts would duplicate
 * content (duplicate text breaks strict locators in tests, and duplicate DOM
 * costs on long lists). Returns false wherever matchMedia is unavailable
 * (jsdom) — tests exercise the default layout, e2e covers the narrow one.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onStoreChange)
      return () => mql.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot)
}
