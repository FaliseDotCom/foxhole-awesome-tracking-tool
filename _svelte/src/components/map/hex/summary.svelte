<script>

  /**
   * Hex with dynamically updated data
   */
  
	import { afterUpdate, beforeUpdate } from 'svelte';
	import DataHex from './data.svelte'
  import Icon from '../icon.svelte';
  import { icons } from "@stores/icons"

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
            // get all victory towns in this hex
      const victory = data.d.filter( icons.isVictoryBase ),
            // which one of those are scorched?
            scorched = victory.filter( icons.isScorched ),
            // which on of those are claimed?
            claimed = victory.filter( icons.isTownClaimed ),
            // get rockets in this hex
            rockets = data.d.filter( icons.isRocket )

      // add icons to the list
      list = [ victory[ 0 ] ]
      if ( rockets.length ) list.push( rockets[ 0 ] )

      // update version
      version = data.v;
    }
  })

</script>

<DataHex bind:data={ data } { name } class={ `summary ${$$props.class || ''}` }>
  { #each list as item ( `${item.x}-${item.y}-${item.i}` ) }
    <Icon data={ item } {name}/>
  { /each }
</DataHex>