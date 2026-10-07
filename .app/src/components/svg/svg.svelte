<script>

  export let x = 0,
             y = 0,
             width = 0,
             height = 0;

</script>

<svg 
  class={ `${$$props.class}` }
  style={ `${$$props.style}` }  
  { x }
  { y }
  { width } 
  { height } 
  viewBox={ `0 0  ${width} ${height}` } 
  preserveAspectRatio="xMinYMid meet" xmlns="http://www.w3.org/2000/svg"
>
  <!-- explicit set slot on svg otherwise children won't be added -->
  <slot></slot>
</svg>