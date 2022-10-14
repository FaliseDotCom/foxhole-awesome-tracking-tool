<script>
  import { zoom } from '@stores/zoom.js'

  let z = 1;

  zoom.subscribe( value =>
  {
    z = value;
  })

  const onChange = e =>
  {
    zoom.set( parseFloat( e.target.value ) )
  }

</script>

<div class="zoom">
  <input type="range" min={ zoom.min } max={ zoom.max } on:change={ onChange } bind:value={ z } />
</div>

<style>
  .zoom
  {
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 6px 12px;
    border-radius: 10px 0 0 0;
    background-color: rgba( 255, 255, 255, .5 );
    z-index: 999;
  }
</style>