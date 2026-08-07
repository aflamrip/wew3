// src/pages/sitemap-static.xml.ts
import type { APIRoute } from 'astro';
import { getFullSiteUrl, GENRES_LIST, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const staticPages = [
    { url: '/',           priority: '1.0', changefreq: 'daily'   },
    { url: '/movie',      priority: '0.9', changefreq: 'daily'   },
    { url: '/tv',         priority: '0.9', changefreq: 'daily'   },
    { url: '/search',     priority: '0.8', changefreq: 'weekly'  },
    { url: '/categories', priority: '0.8', changefreq: 'weekly'  },
  ];

  // Add genre pages for movies and TV
  for (const genre of GENRES_LIST) {
    staticPages.push({ url: `/movie/category/${genre.slug}`, priority: '0.7', changefreq: 'weekly'  });
    staticPages.push({ url: `/tv/category/${genre.slug}`,    priority: '0.7', changefreq: 'weekly'  });
  }

  const urlEntries = staticPages.map(page => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
};
