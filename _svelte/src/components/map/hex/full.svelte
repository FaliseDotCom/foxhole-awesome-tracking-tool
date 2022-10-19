<script>

  /**
   * One hex to rule them all; contains all hexes
   */

    import HexBorder from '@components/map/hex/border.svelte'
    import HexBackground from '@components/map/hex/background.svelte';
    import HexStatic from '@components/map/hex/static.svelte';
    import HexDynamic from '@components/map/hex/dynamic.svelte';
    import HexAreas from '@components/map/hex/areas.svelte';
    import HexPoints from '@components/map/hex/points.svelte';

    export let name = '';

    const show_points = !true;
</script>

<HexBackground {name}/>
<HexBorder {name}/>
<HexAreas {name}/>
<HexDynamic {name}/>
<HexStatic {name}/>
{#if show_points}
<HexPoints {name}/>
{/if}
