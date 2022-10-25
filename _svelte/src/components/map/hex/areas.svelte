<script>

  /**
   * Hex with sub areas
   */

	import DataHex from './data.svelte';
  import { grid } from '@stores/grid';
  import { icons } from '@stores/icons';
	import Polygon from '../polygon.svelte';
	import { afterUpdate } from 'svelte';
	import { onMount } from 'svelte/internal';
  import { config } from '@stores/config.js';

  export let name = ''

  let data = null,
      version = '',
      details = null,
      is_valid = false,
      animate = false,
      areas = {}

  const log = config.log.area;

  onMount( () =>
  {
    // get polygon details by name ONCE
    details = grid.getDetails( name ),
    // is data valid?
    is_valid = details && typeof details === 'object' && Object.keys( details );
    
    if ( is_valid ) 
    {
      // prefill areas with an empty string
      Object.keys( details ).forEach( key => areas[ key ] = '' )
    }   
  } )

  // check for area changes and flash are if needed
  const flashAreas = () =>
  {
    // reset animation state
    animate = false;

    // go over each area to look for changes
    Object.keys( details ).forEach( key => 
    {
      // get a list of icons in this area
      const items = [];
      data.d.forEach( item => 
      {
        if ( grid.areaContains( name, key, item ) )
        {
          items.push( item );
        }
      } );
      // get json so we can string compare
      const json = JSON.stringify( items ),
            differs = areas[ key ] && areas[ key ] !== json;
      // set flash state to true if json differs
      details[ key ].flash = differs
      // store the data 
      areas[ key ] = json     
      // set animate state to true if at least one area was changed
      if ( differs ) 
      {
        animate = true;
        if ( config.log.area )
        {
          console.log( 'Area changed', name, key );
        }
      }
    } );

    // clear animation after a while
    if ( animate )
    {
      setTimeout( () => {
        animate = false; 
        // force another update
        details = details
      }, 1000 );
    }
  }

  // set area colors based on owned bases
  const colorAreas = () =>
  {
    // get region bases for this hex
    const region_bases = data.d.filter( item => item.t && icons.isRegionBase( item.i ) )
    // go over each area
    Object.keys( details ).forEach( key =>
    {
      // find based per area, should be ONE, could be NONE
      const area_bases = region_bases.filter( item => grid.areaContains( name, key, item ) )
      // console.log( 'area bases', name, key, area_bases)
      details[ key ].team = area_bases.length ? area_bases[ 0 ].t : '';
      // force another update
      // details = details
    } );
  }

  // run after each data update
  afterUpdate( () => 
  { 
    if ( log ) console.log( 'Area: ' + name + ' update' );
    
    // only update areas if there are any changes
    if ( data && 'd' in data && is_valid && data.v !== version )
    {      
      if ( log ) console.log( 'Area: ' + name + ' version changed from ' + version + ' to ' + data.v );

      // check for area changes and set flash value in settings accordingly
      flashAreas();
      // check for team changes and set team value in settings accordingly
      colorAreas();    

      // store new version
      version = data.v;
    }  
  } );

  // get detail css classes
  const getDetailCSS = detail => 
  {
    let css = 'area team-' + detail.team ;
    if ( detail.flash ) css += ' flash';
    if ( animate ) css += ' animate';
    return css;
  }

  const getHexCss = () =>
  {
    let css = `areas ${$$props.class || ''}`
    if ( animate ) css += ' animate';
    return css;
  }

</script>

{#if is_valid }
  <DataHex bind:data={ data } class={ `areas ${$$props.class || ''}` } { name }>    
    <clipPath id="clip{name}">
      <Polygon/>
    </clipPath>
    {#each Object.entries( details ) as [ key, detail ] }
      <polygon points={ detail.poly } title={ key } class={ getDetailCSS( detail ) } clip-path="url(#clip{ name })" />
    {/each}  
  </DataHex>
{/if}