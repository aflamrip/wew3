// src/pages/sitemap-movie-[page].xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getPrefix, getFullSiteUrl, CDN_URLS, formatDateWithOffset } from '../lib/constants';

const ITEMS_PER_SITEMAP = 500;

export const GET: APIRoute = async (context) => {
  const { page } = context.params;
  const pageNum = parseInt(page || '1', 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return new Response('Not Found', { status: 404 });
  }

  const siteUrl = getFullSiteUrl(context);
  const allMovies = await getSitemapData('movie', 45);

  const totalPages = Math.max(1, Math.ceil(allMovies.length / ITEMS_PER_SITEMAP));
  if (pageNum > totalPages) {
    return new Response('Not Found', { status: 404 });
  }

  const start = (pageNum - 1) * ITEMS_PER_SITEMAP;
  const slice = allMovies.slice(start, start + ITEMS_PER_SITEMAP);

  const urlEntries = slice.map(item => {
    const slug    = item.data?.slug || '';
    const id      = item.id;
    const prefix  = getPrefix(id);
    const year    = item.data?.year || '2026';
    const imageUrl = item.data?.poster || `${siteUrl}/cdn-cgi/image/width=240,quality=45,format=auto/cdn/movies/${prefix}/${id}/${id}.webp`;

    const rawTs = item.data?.publish_date_timestamp;
    let lastmod = formatDateWithOffset();
    if (rawTs) {
      const ts = Number(rawTs) > 9999999999 ? Number(rawTs) / 1000 : Number(rawTs);
      lastmod = formatDateWithOffset(ts * 1000);
    }

    return `  <url>
    <loc>${siteUrl}/movie/${slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${imageUrl}</image:loc>
      <image:title>${escapeXml(item.data?.title || '')}</image:title>
      <image:caption>${escapeXml(`فيلم ${item.data?.title || ''} ${year}`)}</image:caption>
    </image:image>
    <video:video>
      <video:thumbnail_loc>${imageUrl}</video:thumbnail_loc>
      <video:title>${escapeXml(`مشاهدة فيلم ${item.data?.title || ''} ${year} كامل`)}</video:title>
      <video:description>${escapeXml(item.data?.overview || `مشاهدة وتحميل فيلم ${item.data?.title || ''} ${year} اون لاين بجودة عالية HD`)}</video:description>
      <video:content_loc>${siteUrl}/watch/movie/${slug}</video:content_loc>
      <video:player_loc>${siteUrl}/watch/movie/${slug}</video:player_loc>
      <video:publication_date>${lastmod}</video:publication_date>
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
