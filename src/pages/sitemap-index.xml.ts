// src/pages/sitemap-index.xml.ts
import type { APIRoute } from 'astro';
import { getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const entries: string[] = [
    `  <sitemap>\n    <loc>${siteUrl}/sitemap-static.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
    `  <sitemap>\n    <loc>${siteUrl}/sitemap-movies-index.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
    `  <sitemap>\n    <loc>${siteUrl}/sitemap-tv-index.xml</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`,
  ];

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
