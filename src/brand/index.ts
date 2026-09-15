/**
 * Single source of truth for Mora’s identity.
 *
 * To swap the logo later:
 * 1. Replace `brand-src/mark-raw.png` and `brand-src/wordmark-raw.png`
 * 2. Run `python3 scripts/prepare-brand.py` (needs Pillow)
 *    — or drop already-transparent files into `public/brand/mark.png`
 *      and `public/brand/wordmark.png`. UI, particles, tabs and emails
 *      all read these paths. No other files need hand-edits.
 */
export const BRAND = {
  name: "Mora",
  tagline: "Un anillo. Un estado.",
  description:
    "Anillo inteligente de lujo en Colombia. Mora Aero en cerámica y Titan en titanio. Pulso, sueño y autonomía de días, sin pantalla que pida atención.",
  assets: {
    mark: "/brand/mark.png",
    wordmark: "/brand/wordmark.png",
    favicon: "/brand/favicon.png",
    apple: "/brand/apple-touch-icon.png",
    icon512: "/brand/icon-512.png",
  },
} as const;

export type BrandAsset = keyof typeof BRAND.assets;

export function brandPath(asset: BrandAsset) {
  return BRAND.assets[asset];
}

export function absoluteBrandUrl(asset: BrandAsset) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://mora.ring";
  return `${base}${BRAND.assets[asset]}`;
}

export function brandLockup() {
  return `${BRAND.name} · ${BRAND.tagline}`;
}
