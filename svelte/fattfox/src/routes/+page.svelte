<script>  
  import PanZoom from '@components/panzoom.svelte'
  import Map from '@components/map/map.svelte'
  import Layer from '@components/map/layer.svelte'
  import HexBorder from '@components/map/hex/border.svelte'
  import HexBackground from '@components/map/hex/background.svelte';
  import HexStatic from '@components/map/hex/static.svelte';
  import HexDynamic from '@components/map/hex/dynamic.svelte';
</script>

<PanZoom>
  <Map>
    <Layer class="backgrounds" component={ HexBackground }/>
    <Layer class="borders" component={ HexBorder }/>
    <Layer class="statics" component={ HexStatic }/>
    <Layer class="dynamics" component={ HexDynamic }/>
  </Map>
</PanZoom>

