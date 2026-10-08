/**
 * Casualties per hour from running totals. Pure, for the stats store.
 */

/**
 * Time over which a running total is turned into a rate, in ms. The War API updates the hexes'
 * reports at their own pace, so between two samples 5 minutes apart some show nothing and the
 * next ones twice as much; over an hour that evens out.
 * @type {number}
 */
export const RATE_WINDOW = 3600000;

/**
 * Rates per hour of a running total: at each sample, the increase since the newest sample at
 * least RATE_WINDOW older (or the first sample, at the start), per hour.
 *
 * @param {number[][]} series Samples [ time, ...values ], oldest first; may start before from.
 * @param {number} index Which value of a sample.
 * @param {number} from Start of the chart in ms; earlier samples only serve as a base.
 * @returns {number[][]} [ time, per hour ] for each sample from the start of the chart.
 */
export const perHour = ( series, index, from ) =>
{
  const rates = [];
  let base = 0;
  series.forEach( ( sample, i ) =>
  {
    while ( base + 1 < i && sample[ 0 ] - series[ base + 1 ][ 0 ] >= RATE_WINDOW ) base++;
    const before = series[ base ],
          hours_between = ( sample[ 0 ] - before[ 0 ] ) / 3600000;
    if ( i === 0 || sample[ 0 ] < from || hours_between <= 0 ) return;
    rates.push( [ sample[ 0 ], Math.max( 0, sample[ index ] - before[ index ] ) / hours_between ] );
  } );
  return rates;
};
