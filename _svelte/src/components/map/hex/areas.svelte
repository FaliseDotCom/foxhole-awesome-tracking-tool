<script>

  /**
   * Hex with sub areas
   */

	import DataHex from './data.svelte';
  import { grid } from '@stores/grid';
  import { icons } from '@stores/icons';
	import Polygon from '../polygon.svelte';
	import { afterUpdate, onMount } from 'svelte';

  export let name = ''

  let data = null;

        // get polygon details by name
  const details = grid.getDetails( name ),
        // is data valid?
        is_valid = details && typeof details === 'object' && Object.keys( details );

  afterUpdate( () => {
    if ( data && 'mapItems' in data && is_valid )
    {      
      // get region bases for this hex
      const region_bases = data.mapItems.filter( item => item.teamId !== 'NONE' && icons.isRegionBase( item.iconType ) )
      // go over each area
      for ( const [ key, detail ] of Object.entries( details ) )
      {
        // find based per area, should be ONE, could be NONE
        const area_bases = region_bases.filter( item => grid.areaContains( name, key, item ) )
        details[ key ].team = area_bases.length ? area_bases[ 0 ].teamId : 'NONE';
      }
    }  
  } );

</script>

{#if is_valid }
  <DataHex bind:data={ data } class={ `areas ${$$props.class || ''}` } { name }>    
    <clipPath id="clip{name}">
      <Polygon/>
    </clipPath>
    {#each Object.entries( details ) as [ key, detail ] }
      <polygon points={ detail.poly } title={ key } class={ 'area team-' + detail.team } clip-path="url(#clip{ name })" />
    {/each}  
  </DataHex>
{/if}