<script>
	import Hex from './hex.svelte';
  import Polygon from './polygon.svelte';
  export let name = ''
</script>

<Hex class={ `border ${$$props.class || ''}` } {name}>
  <Polygon/>
  <slot></slot>
</Hex>