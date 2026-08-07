import type { APIRoute } from 'astro';
import { getPrefix } from '../../../lib/constants';
import { fetchIndexPage, fetchDetailNdjson } from '../../../lib/cf-bindings';

/**
 * GET /api/cast/[type]?name=<actorName>&both=true
 *
 * type  = "movie" | "tv" | "both"
 * name  = actor name (URL-encoded)
 * both  = "true" → search movies AND tv regardless of [type]
 *
 * Returns JSON array of matched items.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const { type }    = params;
  const actorName   = url.searchParams.get('name')?.trim();
  const searchBoth  = url.searchParams.get('both') === 'true';

  if (!actorName || !type) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Determine which types to search
  const typesToSearch: Array<'movies' | 'tv'> = [];

  if (searchBoth || type === 'both') {
    typesToSearch.push('movies', 'tv');
  } else {
    const isMovie = type === 'movie' || type === 'movies';
    typesToSearch.push(isMovie ? 'movies' : 'tv');
  }

  try {
    const allMatches: any[] = [];

    for (const pluralType of typesToSearch) {
      const matches = await searchCastInType(pluralType, actorName);
      allMatches.push(...matches);
    }

    return new Response(JSON.stringify(allMatches), {
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=14400',
      },
    });
  } catch (e) {
    console.error('Cast API error:', e);
    return new Response(JSON.stringify([]), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/**
 * Search for actor in all index pages of a given type.
 * Fetches up to 5 index pages (each ~50 items) then parallel-checks detail files.
 */
async function searchCastInType(
  pluralType: 'movies' | 'tv',
  actorName: string
): Promise<any[]> {
  const routeType = pluralType === 'movies' ? 'movie' : 'tv';

  // Step 1: Collect all index entries (up to 5 pages × ~50 items = 250 items)
  const pagePromises = Array.from({ length: 5 }, (_, i) =>
    fetchIndexPage(pluralType, i + 1).catch(() => null)
  );
  const pages = await Promise.all(pagePromises);

  const allEntries: any[] = [];
  for (const text of pages) {
    if (!text) continue;
    text
      .split('\n')
      .filter(l => l.trim().length > 0)
      .forEach(l => {
        try {
          const v = JSON.parse(l);
          if (v?.id) allEntries.push(v);
        } catch { /* skip */ }
      });
  }

  if (allEntries.length === 0) return [];

  // Step 2: Fetch detail files in parallel (cap at 50 to stay within CF subrequest limits)
  const entriesToCheck = allEntries.slice(0, 50);
  const matchedItems: any[] = [];

  const detailPromises = entriesToCheck.map(async (entry: any) => {
    try {
      const id     = entry.id.toString();
      const prefix = getPrefix(id);

      const detailText = await fetchDetailNdjson(pluralType, prefix, id);
      if (!detailText) return null;

      const lines = detailText
        .split('\n')
        .filter(l => l.trim().length > 0);
      if (lines.length === 0) return null;

      let d: any;
      try { d = JSON.parse(lines[0]); } catch { return null; }
      if (!d) return null;

      const raw = d.data && typeof d.data === 'object' ? { ...d, ...d.data } : d;

      // Check if actor is in the cast array
      if (
        Array.isArray(raw.cast) &&
        raw.cast.some((c: string) =>
          typeof c === 'string' && c.trim().toLowerCase() === actorName.toLowerCase()
        )
      ) {
        return {
          id,
          slug:  raw.slug  || entry.slug  || '',
          title: raw.title || entry.title || '',
          year:  raw.year  || entry.year  || '',
          lang:  raw.lang  || entry.lang  || 'ar',
          type:  routeType,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(detailPromises);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      matchedItems.push(r.value);
    }
  }

  return matchedItems;
}
