<script lang="ts">
  /**
   * CastSearch.svelte
   * الإصلاح: أزرار الفلتر client-side بالكامل — بدون re-fetch
   */

  let {
    actorName = '',
    cdnBase   = '/cdn',
  } = $props<{ actorName: string; cdnBase?: string }>();

  type Item   = { id: string; slug: string; title: string; year: string; type: 'movie' | 'tv' };
  type Filter = 'all' | 'movie' | 'tv';

  let allItems     = $state<Item[]>([]);
  let loading      = $state(true);
  let error        = $state('');
  let activeFilter = $state<Filter>('all');

  // ─── Derived (zero fetch) ──────────────────────────────────────────────────
  let visibleItems = $derived<Item[]>(
    activeFilter === 'all' ? allItems : allItems.filter(i => i.type === activeFilter)
  );
  let movieCount = $derived(allItems.filter(i => i.type === 'movie').length);
  let tvCount    = $derived(allItems.filter(i => i.type === 'tv').length);

  // ─── Single fetch — movies + TV in parallel ───────────────────────────────
  $effect(() => {
    if (!actorName) return;
    let cancelled = false;
    loading = true; allItems = []; error = '';

    Promise.all([
      fetch(`/api/cast/movie?name=${encodeURIComponent(actorName)}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/cast/tv?name=${encodeURIComponent(actorName)}`).then(r => r.ok ? r.json() : []),
    ])
      .then(([md, td]: [Item[], Item[]]) => {
        if (!cancelled) {
          allItems = [
            ...md.map(i => ({ ...i, type: 'movie' as const })),
            ...td.map(i => ({ ...i, type: 'tv'    as const })),
          ];
        }
      })
      .catch(() => { if (!cancelled) error = 'حدث خطأ أثناء البحث، يرجى المحاولة لاحقاً.'; })
      .finally(() => { if (!cancelled) loading = false; });

    return () => { cancelled = true; };
  });

  function posterUrl(item: Item): string {
    const t   = item.type === 'movie' ? 'movies' : 'tv';
    return `${cdnBase}/${t}/${item.id.substring(0, 2)}/${item.id}/${item.id}.webp`;
  }

  function setFilter(f: Filter) { activeFilter = f; }
</script>

<div class="space-y-8">

  <!-- Loading -->
  {#if loading}
    <div class="bg-zinc-900/60 rounded-2xl p-6 border border-zinc-800 space-y-4">
      <div class="flex items-center gap-3 text-sm font-bold text-zinc-400">
        <span class="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
        جاري البحث عن أعمال {actorName}...
      </div>
      <div class="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div class="bg-gradient-to-l from-amber-500 to-orange-500 h-full w-2/3 rounded-full animate-pulse"></div>
      </div>
    </div>
  {/if}

  <!-- Error -->
  {#if error}
    <div class="text-center py-16 bg-red-950/20 rounded-3xl border border-red-900/50">
      <p class="text-red-400 font-bold">{error}</p>
    </div>
  {/if}

  <!-- Results -->
  {#if !loading && !error && allItems.length > 0}

    <!-- Filter buttons -->
    <div class="flex items-center gap-3 flex-wrap">
      <button
        onclick={() => setFilter('all')}
        class={`px-5 py-2.5 rounded-xl text-sm font-black transition duration-200 border
                ${activeFilter === 'all'
                  ? 'bg-white text-zinc-900 border-white shadow-lg scale-[1.04]'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white'}`}
      >
        الكل <span class="opacity-60 text-xs mr-1">({allItems.length})</span>
      </button>

      {#if movieCount > 0}
        <button
          onclick={() => setFilter('movie')}
          class={`px-5 py-2.5 rounded-xl text-sm font-black transition duration-200 border
                  ${activeFilter === 'movie'
                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30 scale-[1.04]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-primary/50 hover:text-primary'}`}
        >
          🎬 الأفلام فقط <span class="opacity-60 text-xs mr-1">({movieCount})</span>
        </button>
      {/if}

      {#if tvCount > 0}
        <button
          onclick={() => setFilter('tv')}
          class={`px-5 py-2.5 rounded-xl text-sm font-black transition duration-200 border
                  ${activeFilter === 'tv'
                    ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30 scale-[1.04]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-amber-500/50 hover:text-amber-400'}`}
        >
          📺 المسلسلات فقط <span class="opacity-60 text-xs mr-1">({tvCount})</span>
        </button>
      {/if}
    </div>

    <!-- Section label -->
    <div class="flex items-center gap-3 pb-2 border-b border-zinc-800">
      <span class="w-1.5 h-6 rounded-full {activeFilter === 'tv' ? 'bg-amber-500' : 'bg-primary'}"></span>
      <h2 class="text-lg font-black text-white">
        {activeFilter === 'all'
          ? `جميع أعمال ${actorName}`
          : activeFilter === 'movie'
            ? `أفلام ${actorName}`
            : `مسلسلات ${actorName}`}
      </h2>
      <span class="text-xs text-zinc-500">({visibleItems.length})</span>
    </div>

    <!-- Grid -->
    {#if visibleItems.length > 0}
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {#each visibleItems as item (item.id + item.type)}
          <a href={`/${item.type}/${item.slug}`} class="group block animate-card">
            <div class="aspect-[2/3] rounded-2xl overflow-hidden relative shadow-xl border border-zinc-800/60
                        transition duration-500
                        {item.type === 'movie' ? 'group-hover:border-primary/60' : 'group-hover:border-amber-500/60'}">
              <img
                src={posterUrl(item)}
                alt={item.title}
                loading="lazy"
                decoding="async"
                width="300"
                height="450"
                class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-70"></div>
              <span class="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded shadow
                           {item.type === 'movie' ? 'bg-primary/90 text-white' : 'bg-amber-500/90 text-black'}">
                {item.type === 'movie' ? 'فيلم' : 'مسلسل'}
              </span>
              <div class="absolute bottom-0 p-3 w-full translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                <span class="text-[10px] text-zinc-400 font-bold">{item.year}</span>
              </div>
            </div>
            <h3 class="mt-2 text-sm font-bold truncate transition-colors
                       {item.type === 'movie'
                         ? 'text-zinc-300 group-hover:text-primary'
                         : 'text-zinc-300 group-hover:text-amber-400'}">
              {item.title}
            </h3>
          </a>
        {/each}
      </div>
    {:else}
      <div class="text-center py-14 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
        <p class="text-zinc-500 font-bold">
          لا توجد {activeFilter === 'movie' ? 'أفلام' : 'مسلسلات'} لـ {actorName} حالياً.
        </p>
        <button
          onclick={() => setFilter('all')}
          class="mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-700 transition-colors border border-zinc-700"
        >
          عرض الكل
        </button>
      </div>
    {/if}

    <!-- Summary -->
    <div class="text-center py-2">
      <span class="bg-zinc-900 text-zinc-400 px-5 py-2 rounded-full text-sm font-bold border border-zinc-800">
        {#if activeFilter === 'all' && movieCount > 0 && tvCount > 0}
          {movieCount} فيلم · {tvCount} مسلسل
        {:else}
          {visibleItems.length} عمل لـ {actorName}
        {/if}
      </span>
    </div>
  {/if}

  <!-- Empty -->
  {#if !loading && !error && allItems.length === 0}
    <div class="text-center py-32 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
      <div class="text-6xl mb-6">🎭</div>
      <h2 class="text-2xl font-black text-zinc-400">لم نتمكن من العثور على أعمال لـ {actorName}</h2>
      <p class="mt-2 text-zinc-500">قد لا تتوفر البيانات التفصيلية حالياً.</p>
    </div>
  {/if}

</div>

<style>
  @keyframes card-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-card { animation: card-in .35s ease-out both; }
</style>
