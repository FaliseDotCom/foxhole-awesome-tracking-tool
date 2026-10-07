/**
 * Find rocket launches in war log entries: a Rocket Site With Rocket turning back into a Rocket
 * Site (the launch) paired with a Rocket Ground Zero appearing (the impact). Pure, so it runs in
 * Node tests. See .docs/plans/2026-10-07-rocket-arcs.md.
 *
 * The icon sequence comes from the War API documentation and has not been seen in a real launch
 * yet; adjust here once one is recorded.
 */

/**
 * War API icon types of the rocket.
 * @type {{ site: number, armed: number, target: number, impact: number }}
 */
export const ROCKET = {
  site: 37,
  armed: 72,
  target: 70,
  impact: 71
};

/**
 * Launch and impact must be at most this far apart in time to be paired, in ms.
 * @type {number}
 */
export const PAIR_WINDOW = 15 * 60 * 1000;

/**
 * Whether an entry is a launch: an armed rocket site turned back into an empty one.
 *
 * @param {object} entry War log entry ({ kind, item, iconFrom }).
 * @returns {boolean} True for a launch.
 */
export const isLaunch = entry =>
  entry.kind === 'upgraded' && entry.iconFrom === ROCKET.armed && entry.item && entry.item.i === ROCKET.site;

/**
 * Whether an entry is an impact: a Rocket Ground Zero appeared.
 *
 * @param {object} entry War log entry ({ kind, item }).
 * @returns {boolean} True for an impact.
 */
export const isImpact = entry => entry.kind === 'built' && entry.item && entry.item.i === ROCKET.impact;

/**
 * Pair launches with impacts. Each impact is paired with the unpaired launch closest to it in
 * time within PAIR_WINDOW, launches before the impact first. Unpaired launches and impacts are
 * returned with the other side missing.
 *
 * @param {object[]} entries War log entries with id, time, x, y (map pixels), team.
 * @returns {{ launch: object|null, impact: object|null }[]} Rockets, newest first.
 */
export const pairRockets = entries =>
{
  const launches = entries.filter( isLaunch ).sort( ( a, b ) => a.time - b.time );
  const impacts = entries.filter( isImpact ).sort( ( a, b ) => a.time - b.time );
  const used = new Set();
  const rockets = [];

  for ( const impact of impacts )
  {
    let best = null;
    let best_score = Infinity;
    for ( const launch of launches )
    {
      if ( used.has( launch.id ) ) continue;
      const gap = impact.time - launch.time;
      if ( Math.abs( gap ) > PAIR_WINDOW ) continue;
      // a launch shortly before the impact is the most likely; after it only when the hex
      // with the launch site updated later than the hex with the impact
      const score = gap >= 0 ? gap : PAIR_WINDOW + Math.abs( gap );
      if ( score < best_score )
      {
        best = launch;
        best_score = score;
      }
    }
    if ( best ) used.add( best.id );
    rockets.push( { launch: best, impact } );
  }

  for ( const launch of launches )
  {
    if ( !used.has( launch.id ) ) rockets.push( { launch, impact: null } );
  }

  const timeOf = rocket => ( rocket.impact || rocket.launch ).time;
  return rockets.sort( ( a, b ) => timeOf( b ) - timeOf( a ) );
};
