<script>

  /**
   * The map search at the top: a place field whose choice moves the map there. "/" anywhere on
   * the page jumps to it.
   */

  import { search } from '@stores/search'
  import PlaceField from '@components/place-field.svelte'

  /**
   * The place field, for focusing it.
   * @type {PlaceField|null}
   */
  let place = null;

  /**
   * "/" anywhere outside a form field jumps to the search field.
   *
   * @param {KeyboardEvent} e Key event.
   * @returns {void}
   */
  const onWindowKeydown = e =>
  {
    if ( e.key !== '/' || e.target.closest( 'input, textarea, select, [contenteditable]' ) ) return;
    e.preventDefault();
    place.focus();
  };

</script>

<svelte:window on:keydown={ onWindowKeydown }/>

<div class="search" data-track="Search">
  <PlaceField bind:this={ place } field={ search } go/>
</div>
