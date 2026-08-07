/**
 * src/lib/cf-bindings.ts
 *
 * Unified Cloudflare Bindings access layer.
 *
 * Strategy (priority order):
 *   1. R2 bucket — direct object storage read (zero egress cost within CF)
 *   2. HTTP fetch — legacy fallback when running outside CF (e.g. `astro preview`)
 *
 * Bindings (from wrangler.jsonc):
 *   R2      → CDN_STATIC bucket (static.ma3ak.top)
 *   ASSETS  → Static assets
 *   IMAGES  → Cloudflare Images
 */

import { env } from 'cloudflare:workers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Env bindings provided by wrangler.jsonc */
interface CFEnv {
  /** R2 bucket: static CDN (ndjson + poster webp) — binding name: "R2" */
  R2: R2Bucket;
  /** Assets binding (Cloudflare Workers Assets) */
  ASSETS: Fetcher;
  /** Cloudflare Images binding */
  IMAGES: ImagesBinding;
}

// Cast the opaque env to our typed interface.
const cfEnv = env as unknown as CFEnv;

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/**
 * Helper function to read a ReadableStream line by line (supporting Gzip DecompressionStream if compressed)
 */
async function readStreamLines(stream: ReadableStream<Uint8Array>, isGzip: boolean = false): Promise<string> {
  let decompressedStream = stream;
  if (isGzip && typeof DecompressionStream !== 'undefined') {
    decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  }
  
  const reader = decompressedStream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  let done = false;

  while (!done) {
    const { value, done: doneChunk } = await reader.read();
    done = doneChunk;
    if (value) {
      result += decoder.decode(value, { stream: !done });
    }
  }
  return result;
}

/** Read a text or gzipped stream object from R2. Returns null if not found. */
async function r2GetText(bucket: R2Bucket, key: string): Promise<string | null> {
  try {
    // Check if gzipped version exists first
    const gzObj = await bucket.get(`${key}.gz`);
    if (gzObj && gzObj.body) {
      return await readStreamLines(gzObj.body, true);
    }

    const obj = await bucket.get(key);
    if (!obj || !obj.body) return null;

    const isGzip = key.endsWith('.gz') || obj.httpMetadata?.contentEncoding === 'gzip';
    return await readStreamLines(obj.body, isGzip);
  } catch {
    return null;
  }
}

/**
 * Direct R2 text/stream read.
 * Reads R2, and falls back to HTTP fetch if R2 is unavailable.
 */
async function fetchText(
  r2Key: string,
  httpFallbackUrl: string
): Promise<string | null> {
  // 1. R2 read — uses R2 binding (maps to static.ma3ak.top)
  let text: string | null = null;
  try {
    if (cfEnv.R2) {
      text = await r2GetText(cfEnv.R2, r2Key);
    }
  } catch {
    // R2 not available — skip to HTTP
  }

  // 2. HTTP fallback (local dev / preview without real R2)
  if (text === null) {
    try {
      let res = await fetch(`${httpFallbackUrl}.gz`);
      let isGzip = true;
      if (!res.ok) {
        res = await fetch(httpFallbackUrl);
        isGzip = false;
      }
      if (res.ok && res.body) {
        text = await readStreamLines(res.body, isGzip || res.headers.get('content-encoding') === 'gzip');
      }
    } catch {
      return null;
    }
  }

  return text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const STATIC_BASE = 'https://static.ma3ak.top';
const VIDEO_BASE  = 'https://s002.mogcdn.com';

/**
 * Fetch a paginated ndjson index file.
 * R2 key pattern: `{type}/index.{page}.ndjson`
 */
export async function fetchIndexPage(
  type: 'movies' | 'tv',
  page: number
): Promise<string | null> {
  const r2Key   = `${type}/index.${page}.ndjson`;
  const httpUrl = `${STATIC_BASE}/${r2Key}`;
  return fetchText(r2Key, httpUrl);
}

/**
 * Fetch a detail ndjson for a specific item.
 * R2 key pattern: `{type}/{prefix}/{id}/{id}.ndjson`
 */
export async function fetchDetailNdjson(
  type: 'movies' | 'tv',
  prefix: string,
  id: string
): Promise<string | null> {
  const r2Key   = `${type}/${prefix}/${id}/${id}.ndjson`;
  const httpUrl = `${STATIC_BASE}/${r2Key}`;
  return fetchText(r2Key, httpUrl);
}

/**
 * Fetch a cdn.ndjson (video metadata) for a specific item.
 * R2 key pattern: `{type}/{prefix}/{id}/cdn.ndjson`
 */
export async function fetchCdnNdjson(
  type: 'movies' | 'tv',
  prefix: string,
  id: string
): Promise<string | null> {
  const r2Key   = `${type}/${prefix}/${id}/cdn.ndjson`;
  const httpUrl = `${STATIC_BASE}/${r2Key}`;
  return fetchText(r2Key, httpUrl);
}

/**
 * Fetch a season episode list ndjson.
 * R2 key pattern: `tv/{prefix}/{id}/cdn.s{season}.ndjson`
 */
export async function fetchSeasonNdjson(
  prefix: string,
  id: string,
  seasonPadded: string
): Promise<string | null> {
  const r2Key   = `tv/${prefix}/${id}/cdn.s${seasonPadded}.ndjson`;
  const httpUrl = `${STATIC_BASE}/${r2Key}`;
  return fetchText(r2Key, httpUrl);
}

/**
 * Check whether a season ndjson exists (HEAD-equivalent via R2).
 * Returns true if the object exists in R2 or if HTTP returns 200.
 */
export async function seasonExists(
  prefix: string,
  id: string,
  seasonPadded: string
): Promise<boolean> {
  // Try R2 first — uses R2 binding
  try {
    const head = await cfEnv.R2.head(
      `tv/${prefix}/${id}/cdn.s${seasonPadded}.ndjson`
    );
    if (head !== null) return true;
  } catch {
    // R2 unavailable — fall through to HTTP
  }
  // HTTP fallback
  try {
    const res = await fetch(
      `${STATIC_BASE}/tv/${prefix}/${id}/cdn.s${seasonPadded}.ndjson`,
      { method: 'HEAD' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Serve a poster image directly from R2.
 * R2 key pattern: `{type}/{prefix}/{id}/{id}.webp`
 */
export async function fetchPosterFromR2(
  type: 'movies' | 'tv',
  prefix: string,
  id: string
): Promise<Response | null> {
  try {
    const obj = await cfEnv.R2.get(`${type}/${prefix}/${id}/${id}.webp`);
    if (!obj) return null;
    const headers = new Headers();
    headers.set('Content-Type', 'image/webp');
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800');
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
    return new Response(obj.body, { headers });
  } catch {
    return null;
  }
}

/**
 * Invalidate a cached ndjson entry (Now a no-op as KV is removed).
 */
export async function invalidateCache(kvKey: string): Promise<void> {
  // no-op
}

/** Expose raw env for advanced use-cases. */
export { cfEnv };
