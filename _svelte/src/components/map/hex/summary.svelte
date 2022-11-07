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
  { #each list as item ( item.key ) }
    <Icon data={ item } {name}/>
  { /each }
</DataHex>