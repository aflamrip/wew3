// src/pages/sitemap-episodes-[page].xml.ts
/**
 * Dynamic Sitemap for TV Episodes
 *
 * Strategy:
 *  1. Fetch all TV shows from the index (up to 45 pages ≈ thousands of shows).
 *  2. For each show, discover available seasons via R2/KV (seasonExists).
 *  3. For each season, fetch the episode list via fetchSeasonNdjson.
 *  4. Build one URL per episode: /watch/tv/{slug}/s{SS}/e{N}
 *  5. Paginate at EPISODES_PER_SITEMAP entries per XML file.
 *
 * Because this involves many R2/KV calls we:
 *  - Cap season discovery at MAX_SEASONS_CHECK (10).
 *  - Process shows in parallel batches of BATCH_SIZE to stay within
 *    Cloudflare Workers subrequest limits (~50 per request).
 *  - Each sitemap page processes only a SLICE of shows so the Worker
 *    never times out.
 *
 * Route: /sitemap-episodes-[page].xml
 * e.g.  /sitemap-episodes-1.xml, /sitemap-episodes-2.xml, …
 */

import type { APIRoute } from 'astro';
import {
  getSitemapData,
  getPrefix,
  getFullSiteUrl,
  CDN_URLS,
  seasonExists,
  fetchSeasonNdjson,
  formatDateWithOffset,
} from '../lib/constants';

// ─── Tuneable constants ───────────────────────────────────────────────────────
/** Max seasons we check per show (s01 → s{MAX}) */
const MAX_SEASONS_CHECK = 10;
/** How many shows to process concurrently inside one sitemap page */
const BATCH_SIZE = 8;
/** How many TV shows to cover per sitemap page.
 *  Lower = faster response; higher = fewer sitemap files.
 *  At ~15 eps/season × 3 seasons = ~45 URLs per show → 22 shows ≈ ~1 000 URLs/file */
const SHOWS_PER_PAGE = 20;
/** Max episodes per sitemap XML (Google recommends ≤ 50 000, we stay well under) */
const MAX_EPISODES_PER_SITEMAP = 2000;

// ─── Types ────────────────────────────────────────────────────────────────────
interface EpisodeUrl {
  loc: string;
  lastmod: string;
  imageUrl: string;
  showTitle: string;
  season: number;
  episode: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lastmodFromItem(item: any): string {
  const rawTs = item?.data?.publish_date_timestamp;
  if (rawTs) {
    const ts = Number(rawTs) > 9_999_999_999 ? Number(rawTs) / 1000 : Number(rawTs);
    return formatDateWithOffset(ts * 1000);
  }
  return formatDateWithOffset();
}

/**
 * For a single TV show, discover seasons and return all episode URLs.
 */
async function collectShowEpisodes(
  show: any,
  siteUrl: string
): Promise<EpisodeUrl[]> {
  const id     = show.id;
  const prefix = getPrefix(id);
  const slug   = show.data?.slug || id;
  const title  = show.data?.title || show.data?.['title-ar'] || show.data?.arabic_title || '';
  const imageBase = show.data?.poster || `${siteUrl}/cdn-cgi/image/width=240,quality=45,format=auto/cdn/tv/${prefix}/${id}/${id}.webp`;
  const lastmod   = lastmodFromItem(show);

  // ── 1. Discover seasons in parallel ──────────────────────────────────────
  const seasonChecks = Array.from({ length: MAX_SEASONS_CHECK }, (_, i) => {
    const s = pad(i + 1);
    return seasonExists(prefix, id, s)
      .then(exists => (exists ? i + 1 : null))
      .catch(() => null);
  });

  const seasonResults = await Promise.all(seasonChecks);
  const availableSeasons = seasonResults.filter((n): n is number => n !== null);

  if (availableSeasons.length === 0) return [];

  // ── 2. Fetch episodes for each season ────────────────────────────────────
  const episodeUrls: EpisodeUrl[] = [];

  for (const seasonNum of availableSeasons) {
    const sPadded = pad(seasonNum);
    try {
      const text = await fetchSeasonNdjson(prefix, id, sPadded);
      if (!text) continue;

      const lines = text
        .split('\n')
        .filter(l => l.trim().length > 0)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);

      for (const ep of lines) {
        const epNum = ep?.episode;
        if (!epNum && epNum !== 0) continue;

        episodeUrls.push({
          loc:       `${siteUrl}/watch/tv/${slug}/s${sPadded}/e${epNum}`,
          lastmod,
          imageUrl:  imageBase,
          showTitle: title,
          season:    seasonNum,
          episode:   Number(epNum),
        });
      }
    } catch {
      // season fetch failed – skip
    }
  }

  return episodeUrls;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export const GET: APIRoute = async (context) => {
  const { page } = context.params;
  const pageNum  = parseInt(page || '1', 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return new Response('Not Found', { status: 404 });
  }

  const siteUrl = getFullSiteUrl(context);

  // All TV shows (index-only, fast)
  const allShows = await getSitemapData('tv', 45);

  if (allShows.length === 0) {
    return new Response('Not Found', { status: 404 });
  }

  const totalShowPages = Math.max(1, Math.ceil(allShows.length / SHOWS_PER_PAGE));
  if (pageNum > totalShowPages) {
    return new Response('Not Found', { status: 404 });
  }

  // Slice of shows to process for this sitemap page
  const start  = (pageNum - 1) * SHOWS_PER_PAGE;
  const shows  = allShows.slice(start, start + SHOWS_PER_PAGE);

  // Process shows in batches to respect subrequest limits
  const allEpisodeUrls: EpisodeUrl[] = [];

  for (let i = 0; i < shows.length; i += BATCH_SIZE) {
    const batch   = shows.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(show => collectShowEpisodes(show, siteUrl))
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEpisodeUrls.push(...result.value);
      }
    }
  }

  // Cap to avoid oversized XML
  const capped = allEpisodeUrls.slice(0, MAX_EPISODES_PER_SITEMAP);

  if (capped.length === 0) {
    // Return valid empty sitemap rather than 404 so Google doesn't complain
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
</urlset>`;
    return new Response(emptyXml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
      },
    });
  }

  // Build URL entries with Video sitemap extensions
  const urlEntries = capped.map(ep => {
    const seasonStr  = pad(ep.season);
    const episodeNum = ep.episode;
    const titleAr    = `مشاهدة مسلسل ${escapeXml(ep.showTitle)} الموسم ${ep.season} الحلقة ${episodeNum}`;
    const description = escapeXml(
      `مشاهدة الحلقة ${episodeNum} من الموسم ${ep.season} من مسلسل ${ep.showTitle} أون لاين على معاك سيما`
    );

      return `  <url>
    <loc>${escapeXml(ep.loc)}</loc>
    <lastmod>${ep.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>${escapeXml(ep.imageUrl)}</image:loc>
      <image:title>${titleAr}</image:title>
      <image:caption>${description}</image:caption>
    </image:image>
    <video:video>
      <video:thumbnail_loc>${escapeXml(ep.imageUrl)}</video:thumbnail_loc>
      <video:title>${titleAr}</video:title>
      <video:description>${description}</video:description>
      <video:content_loc>${escapeXml(ep.loc)}</video:content_loc>
      <video:player_loc>${escapeXml(ep.loc)}</video:player_loc>
      <video:publication_date>${ep.lastmod}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
    },
  });
};
