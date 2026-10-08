<script>

  /**
   * Small line chart of values over time, scaled to fill its box; one line per series. The
   * highest and lowest value are written on the left with the unit, the time span below, and
   * hovering shows the values at that moment. Styled by .chart in stats.css, the line colour by
   * each series' class.
   */

  import { tooltip } from '@stores/tooltip'
  import { ago } from '@lib/time'

  /**
   * Lines to draw: points [ time, value ], oldest first, a class for the colour, and a title
   * for the hover.
   * @type {{ points: number[][], class: string, title: string }[]}
   */
  export let lines = [];

  /**
   * Accessible description of what the chart shows.
   * @type {string}
   */
  export let label = '';

  /**
   * Unit after the numbers, such as "players" or "per hour".
   * @type {string}
   */
  export let unit = '';

  /**
   * Whether the scale starts at zero; otherwise it spans the lowest to the highest value, to
   * show the ups and downs of large numbers such as players.
   * @type {boolean}
   */
  export let zero = true;

  /**
   * Drawing size in user units; the svg scales to the width of its box.
   * @type {number}
   */
  const width = 300,
        height = 70;

  // time of the point under the pointer, or 0
  let hover = 0;

  $: all = lines.flatMap( line => line.points );
  $: first = all.length ? Math.min( ...all.map( point => point[ 0 ] ) ) : 0;
  $: last = all.length ? Math.max( ...all.map( point => point[ 0 ] ) ) : 1;
  $: top = all.length ? Math.max( 1, ...all.map( point => point[ 1 ] ) ) : 1;
  $: bottom = zero || !all.length ? 0 : Math.min( ...all.map( point => point[ 1 ] ) );

  const number = value => Math.round( value ).toLocaleString( 'en' );

  const toX = time => ( time - first ) / Math.max( 1, last - first ) * width;

  const toY = value => height - ( value - bottom ) / Math.max( 1, top - bottom ) * ( height - 4 ) - 2;

  /**
   * Points of a line as an svg points attribute.
   *
   * @param {number[][]} points [ time, value ] pairs.
   * @returns {string} "x,y x,y …".
   */
  const toPoints = points => points.map( ( [ time, value ] ) => `${ toX( time ).toFixed( 1 ) },${ toY( value ).toFixed( 1 ) }` ).join( ' ' );

  /**
   * Show the values at the sample nearest to the pointer.
   *
   * @param {PointerEvent} e Pointer event on the chart.
   * @returns {void}
   */
  const onMove = e =>
  {
    const box = e.currentTarget.getBoundingClientRect(),
          time = first + ( e.clientX - box.left ) / box.width * ( last - first ),
          times = [ ...new Set( all.map( point => point[ 0 ] ) ) ];
    if ( !times.length ) return;

    hover = times.reduce( ( best, candidate ) => Math.abs( candidate - time ) < Math.abs( best - time ) ? candidate : best );
    const values = lines
      .map( line => [ line.title, line.points.find( point => point[ 0 ] === hover ) ] )
      .filter( ( [ , point ] ) => point )
      .map( ( [ title, point ] ) => `${ title ? `${ title }: ` : '' }${ number( point[ 1 ] ) } ${ unit }` );
    const moment = new Date( hover ).toLocaleTimeString( 'en-GB', { hour: '2-digit', minute: '2-digit' } );
    tooltip.show( `${ moment } (${ ago( hover, Date.now() ) })`, values, e );
  };

  const onLeave = () =>
  {
    hover = 0;
    tooltip.hide();
  };

</script>

<div class="chart-box">
  <div class="chart-scale" aria-hidden="true">
    <span>{ number( top ) } { unit }</span>
    <span>{ number( bottom ) }</span>
  </div>
  <svg
    class="chart"
    viewBox={ `0 0 ${ width } ${ height }` }
    preserveAspectRatio="none"
    role="img"
    aria-label={ label }
    on:pointermove={ onMove }
    on:pointerleave={ onLeave }
  >
    {#each lines as line ( line.class )}
      {#if line.points.length > 1}
        <polyline class={ `chart-line ${ line.class }` } points={ toPoints( line.points ) } vector-effect="non-scaling-stroke"/>
      {/if}
    {/each}
    {#if hover}
      <line class="chart-hover" x1={ toX( hover ) } x2={ toX( hover ) } y1="0" y2={ height } vector-effect="non-scaling-stroke"/>
    {/if}
  </svg>
  <div class="chart-time" aria-hidden="true">
    <span>{ all.length ? ago( first, Date.now() ) : '' }</span>
    <span>now</span>
  </div>
</div>
