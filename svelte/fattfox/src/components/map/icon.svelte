<script>

  import { afterUpdate } from 'svelte';

  export let data = null,
             name = '';

  let team = '',
      flags = 0,
      icon = '',
      json = '',
      animate = false,
      x = data ? `${ data.x * 100 }%` : '',
      y = data ? `${ data.y * 100 }%` : '';

  afterUpdate( () =>
  {
    if ( data )
    {
      const str = JSON.stringify( data );
      let changed = false;

      // animate when both team and old_team or not empty but also differ
      if ( team && data.teamId && team !== data.teamId )
      {
        console.log( name + ', ' + title + ' team change from ' + team + ' to ' + data.teamId )      
        animate = true

        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 1000 )
      }

      if ( flags && data.flags && flags !== data.flags )
      {
        changed = true;
        console.log( name + ', ' + title + ' flags change from ' + flags + ' to ' + data.flags );  
      }

      if ( icon && data.iconType && icon !== data.iconType )
      {
        changed = true;
        console.log( name + ', ' + title + ' type change from ' + icon + ' to ' + data.iconType );  
      }

      if ( !changed && json && str !== json )
      {
        console.log( name + ', ' + title + ' changed' )
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
  <use href={ `#${ data.iconType }` } { x } { y } class={ `icon icon-${ data.iconType } team-${ data.teamId }` }/>
{/if}