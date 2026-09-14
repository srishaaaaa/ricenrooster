import { resolveProductImage } from './productImageResolver'
export { resolveProductImage }

/**
 * productImages.ts — Single source of truth for product image resolution
 *
 * Priority order:
 *   1. resolveProductImage — local per-product photo (see productImageResolver.ts)
 *   2. Admin-uploaded image — stored in Supabase Storage, or a local /assets path
 *   3. CATEGORY_MAP        — category-level placeholder
 *   4. PLACEHOLDER         — generic branded placeholder (never blank)
 *
 * How to add a real product image later:
 *   Add an entry to productImageResolver.ts's PRODUCT_MAP with the exact
 *   product name (lowercase), or upload the image via the admin dashboard
 *   so it lands in Supabase Storage.
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only for admin-uploaded images stored in Supabase Storage.
 *  These deserve the highest trust — the admin explicitly chose this image. */
const isStorageImage = (url: string | null | undefined): url is string =>
  !!url && url.includes('/storage/v1/object/') && url.startsWith('https://')

/** Returns true for local static assets served from the public folder. */
const isLocalAsset = (url: string | null | undefined): url is string =>
  !!url && url.startsWith('/assets/')

const preferWebpAsset = (url: string) => (url.match(/\.png$/i) ? url.replace(/\.png$/i, '.webp') : url)

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY_MAP — category-level fallback. No dedicated photography yet, so
// every Rice n' Rooster category currently points at the same branded placeholder.
// Swap individual entries for a real representative photo as they become available.
// ─────────────────────────────────────────────────────────────────────────────
export const CATEGORY_MAP: Record<string, string> = {
  'Fried Rice':                 '/product-placeholder.svg',
  'Specialty Chicken Combos':   '/product-placeholder.svg',
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — shown when nothing else matches
// ─────────────────────────────────────────────────────────────────────────────
export const PLACEHOLDER = '/product-placeholder.svg'

// ─────────────────────────────────────────────────────────────────────────────
// getProductImage — main resolver used everywhere
//
// size: 'card' (400px) | 'tile' (200px) | 'detail' (800px)
// ─────────────────────────────────────────────────────────────────────────────
export function getProductImage(
  name: string,
  category: string,
  dbUrl?: string | null,
  size: 'card' | 'tile' | 'detail' = 'card',
): string {
  const w = size === 'tile' ? 200 : size === 'detail' ? 800 : 400
  const q = size === 'tile' ? 70  : 80

  // 1. Local per-product resolver — set once real product photos are added
  const local = resolveProductImage(name)
  if (local) return local

  // 2. Admin-uploaded to Supabase Storage — actual uploaded files, not seeded URLs
  if (isStorageImage(dbUrl)) {
    return dbUrl.includes('?') ? dbUrl : `${dbUrl}?w=${w}&q=${q}`
  }

  // 3. Local static asset stored in public/assets
  if (isLocalAsset(dbUrl)) return preferWebpAsset(dbUrl)

  // 4. Category-level placeholder
  if (CATEGORY_MAP[category]) return CATEGORY_MAP[category]

  // 5. Generic branded placeholder — never blank
  return PLACEHOLDER
}

/** Stable onError handler — hides broken image, marks element so it never
 *  fires again (prevents infinite-error-loop). CSS background shows the slot. */
export function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  if (img.dataset.errored) return
  img.dataset.errored = '1'
  img.style.display = 'none'
}
