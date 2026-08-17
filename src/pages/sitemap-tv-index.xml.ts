// src/pages/sitemap-tv-index.xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

/** Shows processed per episode-sitemap page (must match sitemap-episodes-[page].xml.ts) */
const SHOWS_PER_EPISODE_PAGE = 20;
/** Threshold for TV pagination */
const ITEMS_PER_SITEMAP = 500;

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const tvData = await getSitemapData('tv', 45);

  const tvPages = Math.max(1, Math.ceil(tvData.length / ITEMS_PER_SITEMAP));
  const episodePages = Math.max(1, Math.ceil(tvData.length / SHOWS_PER_EPISODE_PAGE));

  const entries: string[] = [];

  // 1. TV show detail pages (paginated)
  for (let i = 1; i <= tvPages; i++) {
    entries.push(`  <sitemap>\n    <loc>${siteUrl}/sitemap-tv-${i}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`);
  }

  // 2. TV Episodes - watch pages (paginated)
  for (let i = 1; i <= episodePages; i++) {
    entries.push(`  <sitemap>\n    <loc>${siteUrl}/sitemap-episodes-${i}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
    },
  });
};
