import type { APIRoute } from 'astro';
import { cfEnv } from '../../lib/cf-bindings';

export const GET: APIRoute = async ({ params }) => {
  const { path } = params;
  
  if (!path) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    if (!cfEnv || !cfEnv.R2) {
      // Fallback for local development if R2 binding is not available
      return Response.redirect(`https://static.ma3ak.top/${path}`, 302);
    }

    const obj = await cfEnv.R2.get(path);
    
    if (!obj) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    // Guess content type based on extension
    if (path.endsWith('.webp')) {
      headers.set('Content-Type', 'image/webp');
    } else if (path.endsWith('.ndjson')) {
      headers.set('Content-Type', 'application/x-ndjson');
    } else if (path.endsWith('.json')) {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }
    
    headers.set('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800');
    if (obj.httpEtag) {
      headers.set('ETag', obj.httpEtag);
    }

    return new Response(obj.body as any, { headers });
  } catch (error) {
    console.error('Error fetching from R2:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
