// src/pages/sitemap-index.xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

/** Shows processed per episode-sitemap page (must match sitemap-episodes-[page].xml.ts) */
const SHOWS_PER_EPISODE_PAGE = 20;
/** Threshold for movies / TV / cast pagination */
const ITEMS_PER_SITEMAP = 500;

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const [movieData, tvData] = await Promise.all([
    getSitemapData('movie', 45),
    getSitemapData('tv',    45),
  ]);

  // ── Pagination counts ────────────────────────────────────────────────────
  const moviePages   = Math.max(1, Math.ceil(movieData.length / ITEMS_PER_SITEMAP));
  const tvPages      = Math.max(1, Math.ceil(tvData.length    / ITEMS_PER_SITEMAP));

  // Episodes: one sitemap page per slice of SHOWS_PER_EPISODE_PAGE shows
  const episodePages = Math.max(1, Math.ceil(tvData.length    / SHOWS_PER_EPISODE_PAGE));

  // ── Build entries ────────────────────────────────────────────────────────
  const entries: string[] = [];

  const addEntry = (loc: string) =>
    entries.push(`  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`);

  // 1. Static pages
  addEntry(`${siteUrl}/sitemap-static.xml`);

  // 2. Movies (paginated)
  for (let i = 1; i <= moviePages; i++) {
    addEntry(`${siteUrl}/sitemap-movie-${i}.xml`);
  }

  // 3. TV show detail pages (paginated)
  for (let i = 1; i <= tvPages; i++) {
    addEntry(`${siteUrl}/sitemap-tv-${i}.xml`);
  }

  // 4. TV Episodes - watch pages (paginated by show slice)
  for (let i = 1; i <= episodePages; i++) {
    addEntry(`${siteUrl}/sitemap-episodes-${i}.xml`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
    },
  });
};
