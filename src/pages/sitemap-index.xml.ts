import type { APIRoute } from 'astro';
import { getSitemapData, getFullSiteUrl, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  let movies: any[] = [];
  let series: any[] = [];

  try {
    const [movieRes, tvRes] = await Promise.all([
      getSitemapData('movie', 5),
      getSitemapData('tv', 5),
    ]);
    movies = movieRes || [];
    series = tvRes || [];
  } catch (e) {
    console.error('Error fetching dynamic sitemap data:', e);
  }

  const staticUrls = [
    { loc: `${siteUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${siteUrl}/movie`, priority: '0.9', changefreq: 'daily' },
    { loc: `${siteUrl}/tv`, priority: '0.9', changefreq: 'daily' },
    { loc: `${siteUrl}/categories`, priority: '0.8', changefreq: 'weekly' },
  ];

  const urlsXml = staticUrls
    .map(
      (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  const moviesXml = movies
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

  const seriesXml = series
    .map((item) => {
      const slug = item.data?.slug;
      if (!slug) return '';
      return `  <url>
    <loc>${siteUrl}/tv/${slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${siteUrl}/watch/tv/${slug}</loc>
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
${moviesXml}
${seriesXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=14400',
    },
  });
};
