<script>
	import { grid } from '@stores/grid'
  export let name = ''
  const bounds = grid.bounds( name )
</script>

<svg {...bounds} class={ `hex ${name} ${$$props.class || ''}` }>
  <slot/>
</svg>