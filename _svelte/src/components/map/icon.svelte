<script>

  import { afterUpdate } from 'svelte';
  import { icons } from '@stores/icons.js'
  import { config } from '@stores/config.js'

  export let data = null,
             name = '';

  let team = '',
      flags = 0,
      icon = '',
      json = '',
      animate = false,
      x = data ? `${ data.x * 100 }%` : '',
      y = data ? `${ data.y * 100 }%` : '';

  const href = icons.getIcon( data.i, data.t ),
        title = icons.getName( data.i ),
        log = config.log.icon;

  afterUpdate( () =>
  {
    if ( data )
    {
      const str = JSON.stringify( data );
      let changed = false;

      // animate when both team and old_team or not empty but also differ
      if ( team && team !== data.t )
      {
        if ( log )
        {
          console.log( name + ', ' + title + ' team change from ' + team + ' to ' + data.t )      
        }

        animate = true

        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 1000 )
      }

      if ( flags !== data.f )
      {
        changed = true;
        if ( log )
        {
          console.log( name + ', ' + title + ' flags change from ' + flags + ' to ' + data.f );  
        }
      }

      if ( icon && data.i && icon !== data.i )
      {
        changed = true;
        if ( log )
        {
          console.log( name + ', ' + title + ' type change from ' + icon + ' to ' + data.i );  
        }
      }

      if ( !changed && json && str !== json )
      {
        if ( log )
        {
          console.log( name + ', ' + title + ' changed' )
        }
      }

      // always store old values
      team = data.t;
      flags = data.f;
      icon = data.i;
      json = str;
    }
  });

</script>
{#if data}
  <image { x } { y } { href } { title } class="icon"/>
{/if}