<script>
  import { onMount, beforeUpdate } from 'svelte';
	import DataHex from './data.svelte';
  export let name = ''
  let data = null
  const url = `worldconquest/maps/${name}/static`,
        time = 0
</script>

<DataHex bind:data={ data } { name } { url } { time } class={ `static ${$$props.class || ''}` }>
  { #if data }
    { #each data.mapTextItems as item }
      <text x={ `${ item.x * 100 }%` } y={ `${ item.y * 100 }%` } class={ item.mapMarkerType } dominant-baseline="middle" text-anchor="middle">{ item.text }</text>
    { /each }
  { /if }
</DataHex>