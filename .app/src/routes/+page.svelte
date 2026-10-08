<script>
  import Logo from '@components/logo.svelte';
  import LayerMap from '@components/map/layer-map.svelte';
  import War from '@components/war.svelte';
  import Status from '@components/status.svelte';
  import HistoryBar from '@components/history-bar.svelte';
  import Appearance from '@components/appearance.svelte';
  import MapControls from '@components/map-controls.svelte';
  import Search from '@components/search.svelte';
  import Tabs from '@components/tabs.svelte';
  import Tooltip from '@components/tooltip.svelte';
  import Flash from '@components/flash.svelte';
  import Clear from '@components/hotreload-clearconsole.svelte';
  import { onMount } from 'svelte';
  import { analytics } from '@stores/analytics';

  onMount( () => analytics.start() );
</script>

<Clear/>
<Appearance/>
<LayerMap/>
<Logo/>
<Search/>
<Tabs/>
<War/>
<MapControls/>
<Status/>
<HistoryBar/>
<Tooltip/>
<Flash/>
