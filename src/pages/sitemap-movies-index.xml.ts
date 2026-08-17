// src/pages/sitemap-movies-index.xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

/** Threshold for movies pagination (must match sitemap-movie-[page].xml.ts) */
const ITEMS_PER_SITEMAP = 500;

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const movieData = await getSitemapData('movie', 45);
  const moviePages = Math.max(1, Math.ceil(movieData.length / ITEMS_PER_SITEMAP));

  const entries: string[] = [];

  for (let i = 1; i <= moviePages; i++) {
    entries.push(`  <sitemap>\n    <loc>${siteUrl}/sitemap-movie-${i}.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`);
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
