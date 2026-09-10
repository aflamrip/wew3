// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import tailwindcss from '@tailwindcss/vite';

async function fetchCustomPages() {
  const urls = [];
  const site = 'https://ma3ak.top';
  const cdn = 'https://static.ma3ak.top';

  const fetchNdjson = async (type, page) => {
    try {
      const res = await fetch(`${cdn}/${type}/index.${page}.ndjson`);
      if (!res.ok) return [];
      const text = await res.text();
      return text
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  try {
    const moviePromises = Array.from({ length: 15 }, (_, i) => fetchNdjson('movies', i + 1));
    const tvPromises = Array.from({ length: 15 }, (_, i) => fetchNdjson('tv', i + 1));

    const [movieResults, tvResults] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises),
    ]);

    for (const items of movieResults) {
      for (const item of items) {
        if (item && item.slug) {
          urls.push(`${site}/movie/${item.slug}`);
          urls.push(`${site}/watch/movie/${item.slug}`);
        }
      }
    }

    for (const items of tvResults) {
      for (const item of items) {
        if (item && item.slug) {
          urls.push(`${site}/tv/${item.slug}`);
          urls.push(`${site}/watch/tv/${item.slug}`);
        }
      }
    }
  } catch (e) {
    console.error('Error loading custom sitemap pages:', e);
  }

  return urls;
}

const customSitemapPages = await fetchCustomPages();

export default defineConfig({
  site: 'https://ma3ak.top',

  image: {
    domains: ['static.ma3ak.top'],
  },

  output: 'server',

  build: {
    inlineStylesheets: 'auto', 
  },

  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'cloudflare-binding' },
  }),

  integrations: [
    svelte(),
    sitemap({
      customPages: customSitemapPages,
      filter: (page) => !page.includes('/404') && !page.includes('/cdn/'),
      serialize(item) {
        if (item.url.includes('/movie') || item.url.includes('/movies')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        } else if (item.url.includes('/tv')) {
          item.changefreq = 'daily';
          item.priority = 0.9;
        } else if (item.url.includes('/watch')) {
          item.changefreq = 'daily';
          item.priority = 0.8;
        } else {
          item.changefreq = 'weekly';
          item.priority = 0.5;
        }
        item.lastmod = new Date().toISOString();
        return item;
      },
    }),
    partytown({
      config: {
        forward: ['dataLayer.push'],
        resolveUrl(url) {
          return url;
        },
        debug: false,
        lib: '~/partytown/',
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      external: [],
    },
    build: {
      assetsInlineLimit: 10240, // 10kb
      cssCodeSplit: true, 
      rollupOptions: {
        output: {
          assetFileNames: '_astro/[name].[hash][extname]',
          chunkFileNames: '_astro/[name].[hash].js',
          entryFileNames: '_astro/[name].[hash].js',
          manualChunks(id) {
            if (id.includes('node_modules/plyr')) return 'plyr';
            if (id.includes('node_modules/embla')) return 'embla';
            if (id.includes('node_modules/@orama')) return 'orama';
          },
        },
      },
    },
  },
});