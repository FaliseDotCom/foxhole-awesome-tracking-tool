<script>
  //export const prerender = true;
	import Logo from "@components/logo.svelte";
	import HexMap from "@components/map/hex-map.svelte";
	import Shard from "@components/shard.svelte";
	import Zoom from "@components/zoom.svelte";
  import Clear from '@components/hotreload-clearconsole.svelte';
</script>

<Clear/>
<Logo/>
<Shard/>
<!--<Zoom/>-->
<HexMap/>