import { useEffect } from 'react'

/**
 * Locks background scroll while a modal/drawer/overlay is open.
 *
 * Without this, the page behind a `fixed` overlay can still scroll on iOS
 * Safari, which combined with iOS's viewport-resize-on-scroll quirks can
 * make other `fixed`/`sticky` elements (like a mobile header bar) briefly
 * repaint above the overlay instead of staying behind it.
 *
 * Every page shell in this app scrolls on its own inner container (class
 * `app-scroll-root`), not on `document.body` — Dashboard/Login's main panel,
 * Pos's root, DigitalInvoice's root all set their own `overflow-y-auto`.
 * Locking body alone would do nothing, so lock every `.app-scroll-root`
 * found in the page, plus body/html as a harmless fallback.
 */
export function useBodyScrollLock(open: boolean) {
  useEffect(() => {
    if (!open) return
    const targets = [
      document.body,
      document.documentElement,
      ...Array.from(document.querySelectorAll<HTMLElement>('.app-scroll-root')),
    ]
    const previous = targets.map((el) => el.style.overflow)
    targets.forEach((el) => { el.style.overflow = 'hidden' })
    return () => {
      targets.forEach((el, i) => { el.style.overflow = previous[i] })
    }
  }, [open])
}
