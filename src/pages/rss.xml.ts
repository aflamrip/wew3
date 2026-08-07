// src/pages/rss.xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getPrefix, getFullSiteUrl, CDN_URLS, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const [moviesRaw, tvRaw] = await Promise.all([
    getSitemapData('movie', 5),
    getSitemapData('tv', 5),
  ]);

  // Merge and sort by publish date (newest first), cap at 100 items
  type FeedItem = {
    id: string;
    type: 'movie' | 'tv';
    title: string;
    arabicTitle: string;
    slug: string;
    year: string;
    overview: string;
    genres: string[];
    lang: string;
    pubDate: Date;
    imageUrl: string;
    pageUrl: string;
  };

  const toFeedItem = (item: any, type: 'movie' | 'tv'): FeedItem | null => {
    const slug = item.data?.slug;
    if (!slug) return null;

    const id     = item.id;
    const prefix = getPrefix(id);

    const rawTs = item.data?.publish_date_timestamp;
    let pubDate = new Date();
    if (rawTs) {
      const ts = Number(rawTs) > 9999999999 ? Number(rawTs) / 1000 : Number(rawTs);
      pubDate = new Date(ts * 1000);
    }

    const dirType = type === 'movie' ? 'movies' : 'tv';

    return {
      id,
      type,
      title:       item.data?.title || '',
      arabicTitle: item.data?.arabic_title || item.data?.['title-ar'] || item.data?.title || '',
      slug,
      year:        item.data?.year || '2026',
      overview:    (item.data?.overview || '').substring(0, 300),
      genres:      Array.isArray(item.data?.genres) ? item.data.genres : [],
      lang:        item.data?.lang || 'ar',
      pubDate,
      imageUrl:    `${CDN_URLS.STATIC}/${dirType}/${prefix}/${id}/${id}.webp`,
      pageUrl:     `${siteUrl}/${type}/${slug}`,
    };
  };

  const feedItems: FeedItem[] = [
    ...moviesRaw.map(i => toFeedItem(i, 'movie')),
    ...tvRaw.map(i => toFeedItem(i, 'tv')),
  ]
    .filter((i): i is FeedItem => i !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 100);

  const itemsXml = feedItems.map(item => {
    const isArabic  = item.lang === 'ar';
    const typeLabel = item.type === 'movie' ? 'فيلم' : 'مسلسل';
    const suffix    = isArabic ? 'كامل HD' : 'مترجم';
    const title     = `${typeLabel} ${item.arabicTitle} ${item.year} ${suffix}`;
    const categories = item.genres.map(g => `      <category>${escapeXml(g)}</category>`).join('\n');

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(item.pageUrl)}</link>
      <guid isPermaLink="true">${escapeXml(item.pageUrl)}</guid>
      <description>${escapeXml(item.overview || `مشاهدة ${typeLabel} ${item.arabicTitle} ${item.year} ${suffix} على معاك سيما`)}</description>
      <pubDate>${item.pubDate.toUTCString()}</pubDate>
      <enclosure url="${escapeXml(item.imageUrl)}" type="image/webp" length="0" />
${categories}
      <media:content url="${escapeXml(item.imageUrl)}" medium="image" />
      <media:thumbnail url="${escapeXml(item.imageUrl)}" />
      <dc:creator>معاك سيما</dc:creator>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>معاك سيما - أحدث الأفلام والمسلسلات</title>
    <link>${siteUrl}</link>
    <description>استمتع بمشاهدة أحدث الأفلام والمسلسلات العربية والأجنبية المترجمة بجودة عالية على معاك سيما</description>
    <language>ar</language>
    <lastBuildDate>${now}</lastBuildDate>
    <managingEditor>info@ma3ak.top (معاك سيما)</managingEditor>
    <webMaster>webmaster@ma3ak.top (معاك سيما)</webMaster>
    <ttl>60</ttl>
    <image>
      <url>${siteUrl}/favicon.svg</url>
      <title>معاك سيما</title>
      <link>${siteUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <atom:link href="${siteUrl}/atom.xml" rel="alternate" type="application/atom+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      'X-Robots-Tag': 'noindex',
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
