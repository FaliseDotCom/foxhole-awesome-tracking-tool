<script>  

  /**
   * Map build up with layers
   */

  import PanZoom from '@components/panzoom.svelte'
  import SvgMap from '@components/map/map-svg.svelte'
  import Layer from '@components/map/layer.svelte'
  import HexBorder from '@components/map/hex/border.svelte'
  import HexBackground from '@components/map/hex/background.svelte';
  import HexStatic from '@components/map/hex/static.svelte';
  import HexMajor from '@components/map/hex/labels-major.svelte';
  import HexMinor from '@components/map/hex/labels-minor.svelte';
  //import HexStatic from '@components/map/hex/static.svelte';
  import HexDynamic from '@components/map/hex/dynamic.svelte';
  import HexAreas from '@components/map/hex/areas.svelte';
  import HexPoints from '@components/map/hex/points.svelte';
  import { config } from '@stores/config.js'
  import { zoom } from '@stores/zoom'
	import Scaler from '../scaler.svelte';
</script>

<Scaler>
  <PanZoom>
    <SvgMap>
      <Layer class="backgrounds" component={ HexBackground } show={ true }/>
      <Layer class="areas" component={ HexAreas } show={ true }/>   
      <Layer class="borders" component={ HexBorder } show={ true }/>
      <Layer class="dynamics" component={ HexDynamic } show={ $zoom.toFixed( 1 ) >= .4 }/>
      <Layer class="labels-major" component={ HexMajor } show={  $zoom >= .6 }/> 
      <Layer class="labels-minor" component={ HexMinor } show={ $zoom >= .8 }/> 
      {#if config.tools.points }
        <Layer class="points" component={ HexPoints } show={ true }/>
      {/if}
    </SvgMap>
  </PanZoom>
</Scaler>