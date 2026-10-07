<script>
  import Logo from '@components/logo.svelte';
  import LayerMap from '@components/map/layer-map.svelte';
  import Shard from '@components/shard.svelte';
  import War from '@components/war.svelte';
  import Status from '@components/status.svelte';
  import Menu from '@components/menu.svelte';
  import Search from '@components/search.svelte';
  import Tooltip from '@components/tooltip.svelte';
  import Warlog from '@components/warlog.svelte';
  import Flash from '@components/flash.svelte';
  import Clear from '@components/hotreload-clearconsole.svelte';
</script>

<Clear/>
<LayerMap/>
<Logo/>
<Shard/>
<Search/>
<Warlog/>
<War/>
<Status/>
<Menu/>
<Tooltip/>
<Flash/>
