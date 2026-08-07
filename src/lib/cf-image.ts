/**
 * src/lib/cf-image.ts
 *
 * Cloudflare Image Resizing — routes through:
 *   https://ma3ak.top/cdn-cgi/image/{options}/{original_url}
 */

export interface CfImageOptions {
  width?:   number;
  height?:  number;
  fit?:     'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number;
  format?:  'auto' | 'webp' | 'avif' | 'jpeg' | 'png';
  sharpen?: number;
  blur?:    number;
  dpr?:     number;
}

const SITE_ORIGIN   = 'https://ma3ak.top';
const CDN_CGI_BASE  = `${SITE_ORIGIN}/cdn-cgi/image`;

const STATIC_BASE   = '/cdn';

// ---------------------------------------------------------------------------

/** Build a Cloudflare Image Resizing URL */
export function cfImage(originalUrl: string, opts: CfImageOptions = {}): string {
  const params: string[] = [];

  if (opts.width)   params.push(`width=${opts.width}`);
  if (opts.height)  params.push(`height=${opts.height}`);
  if (opts.fit)     params.push(`fit=${opts.fit}`);
  if (opts.quality) params.push(`quality=${opts.quality}`);
  if (opts.sharpen) params.push(`sharpen=${opts.sharpen}`);
  if (opts.blur)    params.push(`blur=${opts.blur}`);
  if (opts.dpr)     params.push(`dpr=${opts.dpr}`);
  params.push(`format=${opts.format ?? 'auto'}`);

  return `${CDN_CGI_BASE}/${params.join(',')}/${originalUrl}`;
}

// ---------------------------------------------------------------------------
// Preset helpers
// ---------------------------------------------------------------------------

/** Poster grid card (2:3) */
export function posterUrl(originalUrl: string, width = 300): string {
  return cfImage(originalUrl, { width, height: Math.round(width * 1.5), fit: 'cover', quality: 80 });
}

/** Hero poster on detail page */
export function heroPosterUrl(originalUrl: string): string {
  return cfImage(originalUrl, { width: 400, height: 600, fit: 'cover', quality: 85 });
}

/** OG image 1200×630 */
export function ogImageUrl(originalUrl: string): string {
  return cfImage(originalUrl, { width: 1200, height: 630, fit: 'cover', quality: 85 });
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/** Standard poster: static.ma3ak.top/{type}/{prefix}/{id}/{id}.webp */
export function buildPosterUrl(type: 'movies' | 'tv', id: string): string {
  const prefix = id.toString().substring(0, 2);
  return `${STATIC_BASE}/${type}/${prefix}/${id}/${id}.webp`;
}

/**
 * Info image for social sharing:
 * static.ma3ak.top/{type}/{prefix}/{id}/{id}.info.webp
 *
 * @example
 * buildInfoImageUrl('tv', '2096819')
 * // → https://static.ma3ak.top/tv/20/2096819/2096819.info.webp
 */
export function buildInfoImageUrl(type: 'movies' | 'tv', id: string): string {
  const prefix = id.toString().substring(0, 2);
  return `${STATIC_BASE}/${type}/${prefix}/${id}/${id}.info.webp`;
}
