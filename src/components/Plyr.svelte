<script lang="ts">

  let { src, subtitle } = $props<{ src: string, subtitle?: string }>();
  let videoElement = $state<HTMLVideoElement>();
  
  $effect(() => {
    let player: Plyr | undefined;
    
    // Load Plyr base stylesheet dynamically to prevent critical render-blocking css
    const linkId = 'plyr-base-styles';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css';
      document.head.appendChild(link);
    }
    
    if (videoElement) {
      import('plyr').then((module) => {
        const PlyrClass = module.default;
        player = new PlyrClass(videoElement, {
          controls: [
            'play-large', 'play', 'progress', 'current-time', 'duration',
            'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
          ],
          settings: ['captions', 'speed', 'loop'],
          captions: { active: true, language: 'ar', update: true }
        });
      });
    }


    return () => {
      if (player) {
        player.destroy();
      }
    };
  });
</script>

<div class="h-full w-full">
  <video bind:this={videoElement} preload="none" playsinline controls crossorigin="anonymous" class="w-full h-auto">
    <!-- Using cross origin so we can load captions and track events properly if CORS is setup on CDN -->
    <source {src} type="video/mp4" />
    {#if subtitle}
      <track kind="captions" label="عربي" srclang="ar" src={subtitle} default />
    {/if}
  </video>
</div>


