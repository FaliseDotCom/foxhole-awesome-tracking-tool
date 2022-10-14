<script>

  import { afterUpdate } from 'svelte';

  export let data = null,
             name = '';

  const icons = {
          5 : "Static base 1",
          6 : "Static base 2",
          7 : "Static base 3",

          8 : "Forward base 1",
          9 : "Forward base 2",
          10 : "Forward base 3",

          11 : "Hospital",
          12 : "Vehicle",
          13 : "Armory",
          14 : "Supply station",
          15 : "Workshop",
          16 : "Manufacturing plant",
          17 : "Refinery",
          18 : "Shipyard",
          19 : "Tech center",

          20 : "Salvage",
          21 : "Components",
          22 : "Fuel field",
          23 : "Sulfur",
          24 : "World map tent",
          25 : "Travel tent",
          26 : "Training area",
          27 : 'Keep', // "Special Base",
          28 : "Observation tower",
          29 : "Fort",
          30 : "Troop ship",

          32 : "Sulfur mine",
          33 : "Storage facility",
          34 : "Factory",
          35 : 'Safehouse', // "Garrison Station",
          36 : "Ammo factory",
          37 : "Rocket facility", // rocket site?
          38 : "Salvage mine",
          39 : "Construction yard",
          40 : "Component mine",
          41 : 'oil', // "Oil Well",

          45 : "Relic base", // 1
          46 : "Relic base", // 2
          47 : "Relic base", // 3

          51 : "Mass production factory",
          52 : "Seaport",
          53 : "Coastal gun",
          54 : "Soul factory",

          56 : "Town base tier 1",
          57 : "Town base tier 2",
          58 : "Town base tier 3",

          59 : "Storm cannon",
          60 : "Intel center",

          61 : "Coal field",
          62 : "Oil", // "Oil Field"
        };

  // get icon from ID
  const getIcon = id => ( id in icons )  ? `/icons/${ icons[ id ].replaceAll( ' ', '' ).toLowerCase() }.png` : '';

  // get name from ID
  const getName = id => ( id in icons ) ? icons[ id ] : '';

  let team = '',
      flags = 0,
      icon = '',
      json = '',
      href = data ? getIcon( data.iconType ) : '',
      title = data ? getName( data.iconType ) : '',
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
  {#if href }
    <image 
      { x }
      { y }
      class={ data.teamId + ( animate ? ' animate' : '' ) + ' icon-' + data.iconType }
      { href }
      { title }
    ></image>
  {:else}
    <text { x } { y } fill="red">No icon: { data.iconType }, { data.teamId }</text>
  {/if}
{/if}