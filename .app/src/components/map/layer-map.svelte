<script>  

  /**
   * Map build up with layers
   */

  import PanZoom from '@components/panzoom.svelte'
  import SvgMap from '@components/map/map-svg.svelte'
  import Layer from '@components/map/layer.svelte'
  import HexBorder from '@components/map/hex/border.svelte'
  import HexBackground from '@components/map/hex/background.svelte';
  import HexMajor from '@components/map/hex/labels-major.svelte';
  import HexMinor from '@components/map/hex/labels-minor.svelte';
  import HexDynamic from '@components/map/hex/dynamic.svelte';
  import HexSummary from '@components/map/hex/summary.svelte'
  import HexAreas from '@components/map/hex/areas.svelte';
  import HexShade from '@components/map/hex/shade.svelte';
  import HexPoints from '@components/map/hex/points.svelte';
  import Marker from '@components/map/marker.svelte';
  import Arcs from '@components/map/arcs.svelte';
  import Route from '@components/map/route.svelte';
  import Roads from '@components/map/roads.svelte';
  import Effects from '@components/map/effects.svelte';
  import { config } from '@stores/config.js'
  import { zoom } from '@stores/zoom'
  import { settings } from '@stores/settings'
  import { route } from '@stores/route'
	import Scaler from '../scaler.svelte';
	import Polygon from './polygon.svelte';

  /**
   * Whether a route has something to draw on the map.
   * @type {import('svelte/store').Readable<boolean>}
   */
  const routeShown = route.shown;
</script>

<Scaler>
  <PanZoom>
    <SvgMap>
      <clipPath id="clipPoly"><Polygon/></clipPath>
      <Layer class="backgrounds" component={ HexBackground } show={ true }/>
      <Layer class="areas" component={ HexAreas } show={ true }/>   
      <Layer class="shades" component={ HexShade } show={ $settings.shading !== 'none' }/>
      <Layer class="borders" component={ HexBorder } show={ true }/>
      {#if $settings.roads}
        <Roads/>
      {/if}
      <!-- the route's lines above the regions and roads, below the icons; only while a route
           has a place, so the map does not load what routes need -->
      {#if $routeShown}
        <Route part="lines"/>
      {/if}
      <Layer class="summaries" component={ HexSummary } show={ $zoom.toFixed( 1 ) < .4 }/>
      <Layer class="dynamics" component={ HexDynamic } show={ $zoom.toFixed( 1 ) >= .4 }/>
      <Layer class="labels-major" component={ HexMajor } show={  $zoom >= .6 }/> 
      <Layer class="labels-minor" component={ HexMinor } show={ $zoom >= .8 }/> 
      {#if config.tools.points }
        <Layer class="points" component={ HexPoints } show={ true }/>
      {/if}
      {#if $settings.rockets}
        <Arcs/>
      {/if}
      <!-- the route's places on top, and the cover that takes a click picking one -->
      {#if $routeShown}
        <Route part="places"/>
      {/if}
      <Effects/>
      <Marker/>
    </SvgMap>
  </PanZoom>
</Scaler>