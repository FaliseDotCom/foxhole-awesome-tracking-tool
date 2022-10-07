<script>
	import { grid } from '@stores/grid'
  export let name = ''
  const bounds = grid.bounds( name )
</script>

<svg {...bounds} class={ `hex ${name} ${$$props.class || ''}` }>
  <!-- explicit set slot on svg otherwise children won't be added -->
  <slot></slot>
</svg>