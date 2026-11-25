<script>

  /**
   * The planned route on the map, in two parts drawn at different heights. The lines: the
   * road in pieces coloured by the territory they run through over a dark casing, and dashed
   * lines between each place and its road; drawn above the region colours and roads, below the
   * icons. The places: a marker per place (A, the stops, B), and while a place is picked on the
   * map, a cover over the whole map that takes the click; drawn on top. Sizes are divided by
   * --scale in route.css, so they stay the same on screen.
   */

  import { route } from '@stores/route'
  import { grid } from '@stores/grid'

  /**
   * Which part to draw: 'lines' or 'places'.
   * @type {string}
   */
  export let part = 'lines';

  /**
   * Places of the route, the point being picked on the map, and the planned route.
   * @type {import('svelte/store').Readable<*>}
   */
  const points = route.points,
        picking = route.picking,
        result = route.result;

  /**
   * Furthest the pointer may move between pressing and releasing for a pick, in screen pixels;
   * further is a drag of the map.
   * @type {number}
   */
  const click_slop = 6;

  /**
   * Where the pointer went down on the cover, null when it is not down.
   * @type {{ x: number, y: number }|null}
   */
  let down = null;

  /**
   * SVG points attribute of a list of points.
   *
   * @param {number[][]} list [ x, y ] points in map pixels.
   * @returns {string} Points attribute.
   */
  const toPoints = list => list.map( point => `${ point[ 0 ] },${ point[ 1 ] }` ).join( ' ' );

  /**
   * Every point of a leg in order, for its casing.
   *
   * @param {object} leg Leg of the route.
   * @returns {number[][]} Points.
   */
  const legPoints = leg => leg.pieces.flatMap( piece => piece.points );

  /**
   * Remember where the pointer went down on the cover.
   *
   * @param {PointerEvent} e Pointer event.
   * @returns {void}
   */
  const onDown = e =>
  {
    down = { x: e.clientX, y: e.clientY };
  };

  /**
   * A press and release on the same spot picks that map point; a drag only moves the map.
   *
   * @param {PointerEvent} e Pointer event.
   * @returns {void}
   */
  const onUp = e =>
  {
    const start = down;
    down = null;
    if ( !start || Math.hypot( e.clientX - start.x, e.clientY - start.y ) > click_slop ) return;

    const point = new DOMPoint( e.clientX, e.clientY ).matrixTransform( e.currentTarget.getScreenCTM().inverse() );
    route.pick( point.x, point.y );
  };

</script>

{#if part === 'lines' && $result && $result.ok}
  {#each $result.legs as leg, index ( index )}
    <g class="route-leg">
      <polyline class="route-access" points={ toPoints( [ [ leg.from.place.x, leg.from.place.y ], leg.start ] ) }/>
      <polyline class="route-access" points={ toPoints( [ leg.end, [ leg.to.place.x, leg.to.place.y ] ] ) }/>
      <polyline class="route-casing" points={ toPoints( legPoints( leg ) ) }/>
      {#each leg.pieces as piece, number ( number )}
        <polyline class={ `route-line route-${ piece.cls }` } points={ toPoints( piece.points ) }/>
      {/each}
    </g>
  {/each}
{/if}

{#if part === 'places'}
  {#each $points.filter( point => point.place ) as point ( point.id )}
    <g class="route-marker">
      <circle cx={ point.place.x } cy={ point.place.y }/>
      <text x={ point.place.x } y={ point.place.y }>{ point.label }</text>
    </g>
  {/each}
{/if}

{#if part === 'places' && $picking}
  <!-- takes the click that picks a place of the route; dragging still moves the map -->
  <rect
    class="route-pick"
    x="0"
    y="0"
    width={ grid.width }
    height={ grid.height }
    role="presentation"
    on:pointerdown={ onDown }
    on:pointerup={ onUp }
  />
{/if}
