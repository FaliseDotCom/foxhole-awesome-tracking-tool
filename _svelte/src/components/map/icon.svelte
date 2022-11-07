<script>

  import { afterUpdate } from 'svelte';
  import { icons } from '@stores/icons.js'
  import { config } from '@stores/config.js'
  import { fade } from 'svelte/transition';

  export let data = null;

  let team = '',
      //flags = -1,
      //icon = '',
      json = '',
      animate = false,
      // coordinates
      x = data ? `${ data.x * 100 }%` : '',
      y = data ? `${ data.y * 100 }%` : ''

  const href = icons.getIcon( data ),
        title = icons.getName( data.i )
        //log = config.log.icon;

  /*
  afterUpdate( () =>
  {
    const pre = `Icon: ${name}, ${name} at ${x}, ${y}`;
    // if ( log ) console.log( pre + ' update' )   

    if ( data )
    {
      const str = log ? JSON.stringify( data ) : '';
      let changed = false;

      // animate when both team and old_team or not empty but also differ
      if ( team && team !== data.t )
      {
        if ( log ) console.log( pre + ' team change from ' + team + ' to ' + data.t )      

        changed = true;
        animate = true;

        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 1000 )
      }

      if ( flags >= 0 && flags !== data.f )
      {               
        changed = true;
        if ( log ) console.log( pre + ' flags change from ' + flags + ' to ' + data.f );  
      }

      if ( icon && data.i && icon !== data.i )
      {
        changed = true;
        if ( log )  console.log( pre + ' type change from ' + icon + ' to ' + data.i );  
      }

      if ( !changed && json && str !== json )
      {
        if ( log )  console.log( pre + ' changed something', str, json )
      }

      // always store old values
      team = data.t;
      flags = data.f;
      icon = data.i;
      json = str;
    }
    
    css = icons.getClass( data );
    if ( animate ) icon += ' animate';
  });
  */

</script>
{#if data}
  <image { x } { y } { href } { title } class={ icons.getCss( data ) } transition:fade/>
{/if}