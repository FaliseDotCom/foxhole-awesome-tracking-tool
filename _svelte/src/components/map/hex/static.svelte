<script>
  
  /**
   * Hex with static data; area labels and general points of interest
   */

	import DataHex from './data.svelte';
  export let name = ''
  let data = null,
      once = true;
</script>

<DataHex bind:data={ data } { name } { once } class={ `static ${$$props.class || ''}` }>
  { #if data && Array.isArray( data.mapTextItems ) }
    { #each data.mapTextItems as item }
      <text x={ `${ item.x * 100 }%` } y={ `${ item.y * 100 }%` } class={ item.mapMarkerType }>{ item.text }</text>
    { /each }
  { /if }
</DataHex>