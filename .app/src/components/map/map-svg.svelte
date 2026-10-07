<script>
	import { grid } from '@stores/grid'
</script>

<svg 
  class={ `map  ${$$props.class || ''}` }
  width={ $$props.width || grid.width } 
  height={ $$props.height || grid.height } 
  x={ $$props.x || 0 }
  y={ $$props.y || 0 }
  viewBox={ `0 0  ${grid.width} ${grid.height}` } 
  preserveAspectRatio="xMinYMid meet" xmlns="http://www.w3.org/2000/svg"
>
  <slot/>
</svg>