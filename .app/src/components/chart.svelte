<script>

  /**
   * Small line chart of values over time, scaled to fill its box; one line per series. Styled
   * by .chart in stats.css, the line colour by each series' class.
   */

  /**
   * Lines to draw: points [ time, value ], oldest first, and a class for the colour.
   * @type {{ points: number[][], class: string }[]}
   */
  export let lines = [];

  /**
   * Accessible description of what the chart shows.
   * @type {string}
   */
  export let label = '';

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

  $: all = lines.flatMap( line => line.points );
  $: first = all.length ? Math.min( ...all.map( point => point[ 0 ] ) ) : 0;
  $: last = all.length ? Math.max( ...all.map( point => point[ 0 ] ) ) : 1;
  $: top = all.length ? Math.max( 1, ...all.map( point => point[ 1 ] ) ) : 1;
  $: bottom = zero || !all.length ? 0 : Math.min( ...all.map( point => point[ 1 ] ) );

  /**
   * Points of a line as an svg points attribute.
   *
   * @param {number[][]} points [ time, value ] pairs.
   * @returns {string} "x,y x,y …".
   */
  const toPoints = points => points
    .map( ( [ time, value ] ) => `${ ( ( time - first ) / Math.max( 1, last - first ) * width ).toFixed( 1 ) },${ ( height - ( value - bottom ) / Math.max( 1, top - bottom ) * ( height - 4 ) - 2 ).toFixed( 1 ) }` )
    .join( ' ' );

</script>

<svg class="chart" viewBox={ `0 0 ${ width } ${ height }` } preserveAspectRatio="none" role="img" aria-label={ label }>
  {#each lines as line ( line.class )}
    {#if line.points.length > 1}
      <polyline class={ `chart-line ${ line.class }` } points={ toPoints( line.points ) } vector-effect="non-scaling-stroke"/>
    {/if}
  {/each}
</svg>
