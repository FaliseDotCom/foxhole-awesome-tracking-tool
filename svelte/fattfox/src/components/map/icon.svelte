<script>

  import { afterUpdate } from 'svelte';
  import Tooltip from '@components/tooltip.svg'

  export let  icon = 0,
              x = 0,
              y = 0,
              team = '',
              size = 25;

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
          //27 : "Special Base",
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

  let old_team = '',
      animate = false,
      href = getIcon( icon ),
      title = getName( icon )

  afterUpdate( () =>
  {
    if ( team && old_team && team !== old_team )
    {
      console.log( 'icon team change from ' + old_team + ' to ' + team )
      old_team = team
      animate = true

      // remove animation so it can run again
      setTimeout( () => {
        animate = false
      }, 1000 )
    }
  });

</script>

{#if href }
<image 
  style={ '--icon-size: ' + size +'px; --icon-offset: ' + ( size/-2 ) + 'px' }
  x={ `${ x * 100 }%` } 
  y={ `${ y * 100 }%` } 
  class={ team + ( animate ? ' animate' : '' ) + ' icon-' + icon }
  width={ size + 'px' }
  height={ size + 'px' }
  { href }
  { title }
></image>
{:else}
<text x={ `${ x * 100 }%` } y={ `${ y * 100 }%` }>No icon: { icon }, { team }</text>
{/if}