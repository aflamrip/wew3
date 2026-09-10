// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ma3ak.top',

  image: {
    domains: ['static.ma3ak.top'],
  },

  output: 'server',

  // --- التعديل هنا: نمنع حقن التنسيقات إجبارياً واستخراجها في ملفات خارجية ---
  build: {
    // بدلاً من 'always' أو 'never'، نحدد حجماً بالبايت.
    // إذا كان الـ CSS الخاص بالصفحة أصغر من 10kb سيتم حقنه، وإذا كان أكبر سيخرج كملف خارجي
    inlineStylesheets: 'auto', 
  },
  // -----------------------------------------------------------------

  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'cloudflare-binding' },
  }),

  integrations: [
    svelte(),
    sitemap({
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
      // تفعيل تقسيم الكود لتقليل حجم ملف الـ CSS لكل صفحة
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