<script>

  /**
   * Small line chart of values over time, scaled to fill its box; one line per series. Every
   * chart of the Stats tab spans the same time (from, to), so they line up. Hovering one marks
   * that moment in all of them (the parent passes the hovered time back in as hover), and each
   * shows its own values then, with their unit. Styled by .chart in stats.css, the line colour
   * by each series' class.
   */

  import { createEventDispatcher } from 'svelte'
  import { ago } from '@lib/time'
  import { monotonePath } from '@lib/curve'

  /**
   * Lines to draw: points [ time, value ], oldest first, a class for the colour, and a title
   * for the values shown on hover.
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
   * Time span of the chart in ms, the same for every chart; 0 for the span of the points.
   * @type {number}
   */
  export let from = 0;
  export let to = 0;

  /**
   * Hovered moment in ms, in this chart or another one; 0 when none.
   * @type {number}
   */
  export let hover = 0;

  /**
   * Drawing size in user units; the svg scales to the width of its box.
   * @type {number}
   */
  const width = 300,
        height = 70;

  /**
   * Furthest a sample may be from the hovered moment to be shown, in ms: samples are 5 minutes
   * apart, further over long spans (the server keeps at most 300).
   * @type {number}
   */
  $: reach = Math.max( 10 * 60 * 1000, ( last - first ) / 150 );

  // over more than a day the hovered moment needs its date
  $: long = last - first > 26 * 3600000;

  const dispatch = createEventDispatcher();

  $: all = lines.flatMap( line => line.points );
  $: first = from || ( all.length ? Math.min( ...all.map( point => point[ 0 ] ) ) : 0 );
  $: last = to || ( all.length ? Math.max( ...all.map( point => point[ 0 ] ) ) : 1 );
  $: top = all.length ? Math.max( 1, ...all.map( point => point[ 1 ] ) ) : 1;
  $: bottom = zero || !all.length ? 0 : Math.min( ...all.map( point => point[ 1 ] ) );

  const number = value => Math.round( value ).toLocaleString( 'en' );

  const toX = time => ( time - first ) / Math.max( 1, last - first ) * width;

  const toY = value => height - ( value - bottom ) / Math.max( 1, top - bottom ) * ( height - 4 ) - 2;

  /**
   * A line as a smooth svg path through its points.
   *
   * @param {number[][]} points [ time, value ] pairs.
   * @returns {string} Path data.
   */
  const toPath = points => monotonePath( points.map( ( [ time, value ] ) => [ toX( time ), toY( value ) ] ) );

  /**
   * The sample of each line nearest to a moment, when it is close enough.
   *
   * @param {number} time Moment in ms.
   * @param {{ points: number[][], class: string, title: string }[]} series The lines.
   * @param {number} within Furthest a sample may be from the moment, in ms.
   * @returns {{ title: string, class: string, value: string }[]} Readout per line with a sample.
   */
  const valuesAt = ( time, series, within ) => series
    .map( line =>
    {
      const nearest = line.points.reduce( ( best, point ) => !best || Math.abs( point[ 0 ] - time ) < Math.abs( best[ 0 ] - time ) ? point : best, null );
      return nearest && Math.abs( nearest[ 0 ] - time ) <= within
        ? { title: line.title, class: line.class, value: `${ number( nearest[ 1 ] ) } ${ unit }` }
        : null;
    } )
    .filter( Boolean );

  /**
   * A moment in words: the time and how long ago, or with its date over long spans.
   *
   * @param {number} time Moment in ms.
   * @param {boolean} dated Whether to show the date instead of how long ago.
   * @returns {string} "14:35 (25 min ago)" or "Tue 6 Oct, 14:35".
   */
  const moment = ( time, dated ) => dated
    ? new Date( time ).toLocaleString( 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } )
    : `${ new Date( time ).toLocaleTimeString( 'en-GB', { hour: '2-digit', minute: '2-digit' } ) } (${ ago( time, Date.now() ) })`;

  // the value of each line at the hovered moment, and which side the readout goes
  $: values = hover ? valuesAt( hover, lines, reach ) : [];
  $: right = hover && toX( hover ) < width / 2;

  /**
   * Hover the moment under the pointer, in every chart.
   *
   * @param {PointerEvent} e Pointer event on the chart.
   * @returns {void}
   */
  const onMove = e =>
  {
    const box = e.currentTarget.getBoundingClientRect(),
          fraction = Math.min( 1, Math.max( 0, ( e.clientX - box.left ) / box.width ) );
    dispatch( 'hover', first + fraction * ( last - first ) );
  };

  const onLeave = () => dispatch( 'hover', 0 );

</script>

<div class="chart-box">
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
        <path class={ `chart-line ${ line.class }` } d={ toPath( line.points ) } vector-effect="non-scaling-stroke"/>
      {/if}
    {/each}
    {#if hover}
      <line class="chart-hover" x1={ toX( hover ) } x2={ toX( hover ) } y1="0" y2={ height } vector-effect="non-scaling-stroke"/>
    {/if}
  </svg>
  {#if hover}
    <!-- away from the hovered moment, so the line stays visible -->
    <p class="chart-readout" class:right>
      <span class="chart-time">{ moment( hover, long ) }</span>
      {#each values as value ( value.class )}
        <span class="chart-value">
          {#if value.title}<span class={ `stats-key ${ value.class }` }></span>{ `${ value.title } ` }{/if}{ value.value }
        </span>
      {:else}
        <span class="chart-value">no data</span>
      {/each}
    </p>
  {/if}
</div>
