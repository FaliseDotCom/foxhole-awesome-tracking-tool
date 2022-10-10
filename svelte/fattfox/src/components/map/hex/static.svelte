<script>
  import { onMount, beforeUpdate } from 'svelte';
	import DataHex from './data.svelte';
  export let name = ''
  let data = null
</script>

<DataHex bind:data={ data } { name }  class={ `static ${$$props.class || ''}` }>
  { #if data && Array.isArray( data.mapTextItems ) }
    { #each data.mapTextItems as item }
      <text x={ `${ item.x * 100 }%` } y={ `${ item.y * 100 }%` } class={ item.mapMarkerType } dominant-baseline="middle" text-anchor="middle">{ item.text }</text>
    { /each }
  { /if }
</DataHex>