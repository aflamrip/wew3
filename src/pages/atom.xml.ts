// src/pages/atom.xml.ts
import type { APIRoute } from 'astro';
import { getSitemapData, getPrefix, getFullSiteUrl, CDN_URLS, formatDateWithOffset } from '../lib/constants';

export const GET: APIRoute = async (context) => {
  const siteUrl = getFullSiteUrl(context);
  const now = formatDateWithOffset();

  const [moviesRaw, tvRaw] = await Promise.all([
    getSitemapData('movie', 5),
    getSitemapData('tv', 5),
  ]);

  type AtomEntry = {
    id: string;
    type: 'movie' | 'tv';
    title: string;
    arabicTitle: string;
    slug: string;
    year: string;
    overview: string;
    genres: string[];
    lang: string;
    director: string;
    cast: string[];
    pubDate: Date;
    updatedDate: Date;
    imageUrl: string;
    pageUrl: string;
    watchUrl: string;
  };

  const toEntry = (item: any, type: 'movie' | 'tv'): AtomEntry | null => {
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
      overview:    (item.data?.overview || '').substring(0, 500),
      genres:      Array.isArray(item.data?.genres) ? item.data.genres : [],
      lang:        item.data?.lang || 'ar',
      director:    item.data?.director || '',
      cast:        Array.isArray(item.data?.cast) ? item.data.cast.slice(0, 5) : [],
      pubDate,
      updatedDate: pubDate,
      imageUrl:    `${CDN_URLS.STATIC}/${dirType}/${prefix}/${id}/${id}.webp`,
      pageUrl:     `${siteUrl}/${type}/${slug}`,
      watchUrl:    `${siteUrl}/watch/${type}/${slug}`,
    };
  };

  const entries: AtomEntry[] = [
    ...moviesRaw.map(i => toEntry(i, 'movie')),
    ...tvRaw.map(i => toEntry(i, 'tv')),
  ]
    .filter((e): e is AtomEntry => e !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 100);

  const entriesXml = entries.map(entry => {
    const isArabic  = entry.lang === 'ar';
    const typeLabel = entry.type === 'movie' ? 'فيلم' : 'مسلسل';
    const suffix    = isArabic ? 'كامل HD' : 'مترجم';
    const entryTitle = `${typeLabel} ${entry.arabicTitle} ${entry.year} ${suffix} - معاك سيما`;

    const categories = entry.genres
      .map(g => `    <category term="${escapeXml(g)}" label="${escapeXml(g)}" />`)
      .join('\n');

    const castLines = entry.cast
      .map(actor => `      <span class="cast">${escapeXml(actor)}</span>`)
      .join(', ');

    const summary = entry.overview
      ? escapeXml(entry.overview)
      : escapeXml(`مشاهدة ${typeLabel} ${entry.arabicTitle} ${entry.year} ${suffix} أون لاين بجودة عالية على معاك سيما`);

    const contentHtml = `<![CDATA[
      <div dir="rtl" lang="ar">
        <img src="${entry.imageUrl}" alt="${entry.arabicTitle}" width="300" height="450" />
        <h2>${escapeXml(entryTitle)}</h2>
        <p>${escapeXml(entry.overview || summary)}</p>
        ${entry.director ? `<p><strong>إخراج:</strong> ${escapeXml(entry.director)}</p>` : ''}
        ${entry.cast.length ? `<p><strong>بطولة:</strong> ${castLines}</p>` : ''}
        <p><strong>التصنيفات:</strong> ${entry.genres.map(g => escapeXml(g)).join(' - ')}</p>
        <p><a href="${entry.watchUrl}">مشاهدة ${typeLabel} ${entry.arabicTitle} الآن</a></p>
      </div>
    ]]>`;

    return `  <entry>
    <id>${escapeXml(entry.pageUrl)}</id>
    <title type="text">${escapeXml(entryTitle)}</title>
    <link rel="alternate" type="text/html" href="${escapeXml(entry.pageUrl)}" />
    <link rel="related" type="text/html" href="${escapeXml(entry.watchUrl)}" title="مشاهدة الآن" />
    <published>${formatDateWithOffset(entry.pubDate)}</published>
    <updated>${formatDateWithOffset(entry.updatedDate)}</updated>
    <summary type="text">${summary}</summary>
    <content type="html">${contentHtml}</content>
    <author>
      <name>معاك سيما</name>
      <uri>${siteUrl}</uri>
    </author>
${categories}
    <media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="${escapeXml(entry.imageUrl)}" />
    <media:content xmlns:media="http://search.yahoo.com/mrss/" url="${escapeXml(entry.imageUrl)}" medium="image" type="image/webp" />
  </entry>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:media="http://search.yahoo.com/mrss/"
      xml:lang="ar"
      dir="rtl">

  <id>${siteUrl}/atom.xml</id>
  <title type="text">معاك سيما - أحدث الأفلام والمسلسلات</title>
  <subtitle type="text">استمتع بمشاهدة أحدث الأفلام والمسلسلات العربية والأجنبية المترجمة بجودة عالية</subtitle>
  <link rel="self"      type="application/atom+xml" href="${siteUrl}/atom.xml" />
  <link rel="alternate" type="text/html"            href="${siteUrl}" />
  <link rel="related"   type="application/rss+xml"  href="${siteUrl}/rss.xml" title="RSS Feed" />
  <updated>${now}</updated>
  <author>
    <name>معاك سيما</name>
    <uri>${siteUrl}</uri>
    <email>info@ma3ak.top</email>
  </author>
  <generator uri="${siteUrl}" version="1.0">معاك سيما</generator>
  <icon>${siteUrl}/favicon.svg</icon>
  <logo>${siteUrl}/favicon.svg</logo>
  <rights type="text">© ${new Date().getFullYear()} معاك سيما. جميع الحقوق محفوظة.</rights>

${entriesXml}
</feed>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
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
