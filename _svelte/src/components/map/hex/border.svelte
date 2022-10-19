<script>

   /**
   * Hex with border
   */

	import Hex from './base.svelte';
  import Polygon from '../polygon.svelte';
  export let name = ''
</script>

<Hex class={ `border ${$$props.class || ''}` } {name}>
  <Polygon/>
  <slot/>
</Hex>