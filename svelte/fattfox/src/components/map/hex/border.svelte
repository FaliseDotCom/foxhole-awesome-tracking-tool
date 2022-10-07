<script>
	import Hex from './hex.svelte';
  export let name = ''
</script>

<Hex class={ `border ${$$props.class || ''}` } {name}>
  <polygon points="255,0 770,0 1024,444 770,888 255,888 0,444"/>
  <!-- explicit set slot on svg otherwise children won't be added, probably no children in this component -->
  <slot></slot>
</Hex>