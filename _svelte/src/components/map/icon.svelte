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

  const href = icons.getIcon( data.iconType, data.teamId ),
        title = icons.getName( data.iconType ),
        log = config.log.icon;

  afterUpdate( () =>
  {
    if ( data )
    {
      const str = JSON.stringify( data );
      let changed = false;

      // animate when both team and old_team or not empty but also differ
      if ( team && data.teamId && team !== data.teamId )
      {
        if ( log )
        {
          console.log( name + ', ' + title + ' team change from ' + team + ' to ' + data.teamId )      
        }

        animate = true

        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 1000 )
      }

      if ( flags && data.flags && flags !== data.flags )
      {
        changed = true;
        if ( log )
        {
          console.log( name + ', ' + title + ' flags change from ' + flags + ' to ' + data.flags );  
        }
      }

      if ( icon && data.iconType && icon !== data.iconType )
      {
        changed = true;
        if ( log )
        {
          console.log( name + ', ' + title + ' type change from ' + icon + ' to ' + data.iconType );  
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
      team = data.teamId;
      flags = data.flags;
      icon = data.iconType;
      json = str;
    }
  });

</script>
{#if data}
    <image      
      { x } { y } 
      { href }
      { title }
      class={ `icon icon-${ data.iconType } team-${ data.teamId }` }
    />
{/if}