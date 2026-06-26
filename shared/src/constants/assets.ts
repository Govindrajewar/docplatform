export const ASSET_TYPES = ['logo', 'icon', 'image', 'font', 'signature'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const PAPER_SIZES = ['A4', 'LETTER', 'LEGAL'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

/** MIME allow-list per asset type — enforced again server-side via magic-byte sniffing, see PRD 08 §8.3. */
export const ALLOWED_MIME_TYPES_BY_ASSET_TYPE: Record<AssetType, readonly string[]> = {
  logo: ['image/png', 'image/jpeg', 'image/svg+xml'],
  icon: ['image/png', 'image/jpeg', 'image/svg+xml'],
  image: ['image/png', 'image/jpeg', 'image/svg+xml'],
  font: ['font/ttf', 'font/otf', 'application/font-sfnt', 'application/x-font-ttf'],
  signature: ['image/png', 'image/jpeg'],
};

export const MAX_ASSET_SIZE_BYTES_BY_TYPE: Record<AssetType, number> = {
  logo: 5 * 1024 * 1024,
  icon: 2 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  font: 10 * 1024 * 1024,
  signature: 2 * 1024 * 1024,
};
