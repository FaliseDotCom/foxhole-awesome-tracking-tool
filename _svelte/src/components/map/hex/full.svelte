<script>

  /**
   * One hex to rule them all; contains all hexes
   */

    import HexBackground from '@components/map/hex/background.svelte';
    import HexStatic from '@components/map/hex/static.svelte';
    import HexDynamic from '@components/map/hex/dynamic.svelte';
    import HexAreas from '@components/map/hex/areas.svelte';
    import HexPoints from '@components/map/hex/points.svelte';
    import { config } from '@stores/config.js'

    export let name = '';
</script>

<HexBackground {name}/>
<HexAreas {name}/>
<HexDynamic {name}/>
<HexStatic {name}/>

{#if config.tools.points }
  <HexPoints {name}/>
{/if}
