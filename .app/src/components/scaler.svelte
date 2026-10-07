<script>
  import { zoom } from '@stores/zoom'
  import { effects } from '@stores/effects'

  // rumble on a rocket launch, quake on an impact
  const shake = effects.shake;
</script>

<div class={ `scaler scale-${ $zoom.toFixed( 1 ) } ${ $shake ? `shake-${ $shake }` : '' }` } style={ `--scale: ${ $zoom } `}>
  <slot/>
</div>
