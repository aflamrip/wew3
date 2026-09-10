import type { APIRoute } from 'astro';
import { getSitemapData, getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  let movies: any[] = [];
  try {
    // Read movies index files: movies/index.1.ndjson, movies/index.2.ndjson, etc.
    movies = (await getSitemapData('movie', 25)) || [];
  } catch (e) {
    console.error('Error fetching dynamic movies index for sitemap:', e);
  }

  const urlsXml = movies
    .map((item) => {
      const slug = item.data?.slug;
      if (!slug) return '';
      return `  <url>
    <loc>${siteUrl}/movie/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${siteUrl}/watch/movie/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .filter(Boolean)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
    },
  });
};
