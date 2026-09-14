/**
 * productImageResolver.ts — Local per-product asset resolver
 *
 * No product photography has been supplied yet for the Rice n' Rooster
 * menu, so this always returns null (the caller in
 * productImages.ts falls through to the admin-uploaded image, then the
 * branded placeholder).
 *
 * How to add a real product photo once you have one:
 *   1. Drop the image file under public/assets/products/.
 *   2. Add an entry to PRODUCT_MAP below: 'exact product name (lowercase)': 'filename.jpg'
 */

const BASE = '/assets/products/'

// Product-level: "productkey" → filename
const PRODUCT_MAP: Record<string, string> = {
  // e.g. 'blouse with aari laces': 'Blouse-Aari-Laces.jpg',
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

/** Resolve a product name to a local image URL.
 *  Returns null when no local image found; caller should use the next fallback. */
export function resolveProductImage(productName: string, _variantName?: string | null): string | null {
  const pKey = norm(productName)

  if (PRODUCT_MAP[pKey]) return BASE + PRODUCT_MAP[pKey]

  for (const [key, filename] of Object.entries(PRODUCT_MAP)) {
    if (pKey.includes(key)) return BASE + filename
  }

  return null
}
