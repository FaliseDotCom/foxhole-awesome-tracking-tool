<script>

  /**
   * Hex with dynamically updated data, as shown zoomed out: victory towns, rocket sites and
   * scorched structures. Hovering the hex shows its details (hex-info.js).
   */
  
	import { beforeUpdate, onDestroy } from 'svelte';
	import DataHex from './data.svelte'
  import Icon from '../icon.svelte';
  import Polygon from '../polygon.svelte';
  import { icons } from "@stores/icons"
  import { tooltip } from '@stores/tooltip'
  import { hexInfo } from '@stores/hex-info'
  import { stats } from '@stores/stats'

  // keep the statistics loaded while zoomed out, for the casualties in the hex details
  onDestroy( stats.subscribe( () => {} ) );

  /**
   * Show the details of this hex next to the pointer.
   *
   * @param {PointerEvent} e Pointer event.
   * @returns {void}
   */
  const onEnter = e =>
  {
    const info = hexInfo.describe( name );
    tooltip.show( info.title, info.lines, e );
  };

  export let name = '';

      // data will change as its loaded from server
  let data = null,
      // hex version
      version = 0,
      // icons to display in summary
      list = []

  beforeUpdate( () =>
  {
    if ( data && data.v !== version )
    {
      const victory = data.d.filter( icons.isVictoryBase ),
            rocket = data.d.filter( icons.isRocket ),
            scorced = data.d.filter( icons.isScorched )

      // merge
      list = [ ...victory, ...rocket, ...scorced ];

      // remove duplicates
      const keys = []
      list = list.filter( item => {
        const exists = keys.includes( item.key );
        if ( !exists) keys.push( item.key );
        return !exists;
      });

      // update version
      version = data.v;
    }
  })

</script>

<DataHex bind:data={ data } { name } class={ `summary ${$$props.class || ''}` }>
  <!-- under the icons, which keep their own tooltip -->
  <Polygon class="hex-hover" on:pointerenter={ onEnter } on:pointermove={ tooltip.move } on:pointerleave={ tooltip.hide }/>
  {#each list as item ( item.key ) }
    <Icon data={ item } {name}/>
  {/each}
</DataHex>