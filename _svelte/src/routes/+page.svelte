<script>
  //export const prerender = true;
	import Logo from "@components/logo.svelte";
	//import HexMap from "@components/map/hex-map.svelte";
  import LayerMap from "@components/map/layer-map.svelte";
	import Shard from "@components/shard.svelte";
	import Zoom from "@components/zoom.svelte";
  import Clear from '@components/hotreload-clearconsole.svelte';
</script>

<Clear/>
<LayerMap/>
<Logo/>
<Shard/>
<!--<Zoom/>-->