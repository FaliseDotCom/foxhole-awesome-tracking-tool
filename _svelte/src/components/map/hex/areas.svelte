<script>

  /**
   * Hex with sub areas
   */

	import DataHex from './data.svelte';
  import { grid } from '@stores/grid'
	import Polygon from '../polygon.svelte';
	import { afterUpdate } from 'svelte';
  import intersector from 'robust-point-in-polygon'

  export let name = ''

  let data = null;

        // get polygons by name
  const details = grid.getDetails( name ),
        // uncountable icon ids
        not_countable = [ 41, 62, 23, 32, 61, 20, 38, 21, 40 ],
        is_valid = details && typeof details === 'object' && Object.keys( details );

  afterUpdate( () => 
  {
    if ( data && 'mapItems' in data && is_valid )
    {      
      Object.keys( details ).forEach( key =>
      {
        let colonials = 0,
            wardens = 0,
            team = '';

        data.mapItems.forEach( item => 
        {
          if ( item.teamId !== 'NONE' && !not_countable.includes( item.iconType ) )
          {
            const hit = intersector( details[ key ].arr, [ item.x * grid.w, item.y * grid.h ] );
            if ( hit <= 0 )
            {
              if ( item.teamId == 'WARDENS')    wardens++;
              if ( item.teamId == 'COLONIALS')  colonials++;
            }
          }
        } );

        if ( colonials || wardens ) 
        {
          if ( colonials > wardens )   team = 'colonial';
          if ( wardens > colonials )   team = 'warden';
        }

        details[ key ].team = team;
      } ); 
    }    
  }) 
</script>

{#if is_valid }
  <DataHex bind:data={ data } class={ `areas ${$$props.class || ''}` } { name }>    
    <clipPath id="clip{name}">
      <Polygon/>
    </clipPath>
    {#each Object.entries( details ) as [ key, detail ] }
      <polygon points={ detail.poly } title={ key } class={ 'area ' + detail.team } clip-path="url(#clip{ name })" />
    {/each}  
  </DataHex>
{/if}