<script>
    import { zoom } from '@stores/zoom'
</script>

<div class={ `scaler scale-${ $zoom.toFixed( 1 ) }` } style={ `--scale: ${ $zoom } `}>
  <slot/>
</div>