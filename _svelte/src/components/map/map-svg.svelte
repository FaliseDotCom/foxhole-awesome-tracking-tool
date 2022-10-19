<script>
	import { grid } from '@stores/grid'
  import SvgFilters from '../svg/filters.svelte';
	import Icons from '../svg/icons.svelte';
</script>

<svg 
  class={ `map  ${$$props.class || ''}` }
  width={ grid.width } 
  height={ grid.height } 
  viewBox={ `0 0  ${grid.width} ${grid.height}` } 
  preserveAspectRatio="xMinYMid meet" xmlns="http://www.w3.org/2000/svg"
>
  <slot/>
</svg>