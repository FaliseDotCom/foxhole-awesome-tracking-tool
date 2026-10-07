/**
 * Compare two versions of the map items in one hex and list what changed. Pure: no stores, no
 * browser, so it runs in Node tests and can be ported to PHP for a server-side log.
 *
 * Items are { x, y, t, i, f }: position (0–1 in the hex), team ('W', 'C' or ''), icon type,
 * and flags. They have no id, so they are matched by position.
 */

/**
 * Flag bit for a scorched structure, as in the War API.
 * @type {number}
 */
const SCORCHED = 0x10;

/**
 * Key for matching an item between versions: its position.
 *
 * @param {object} item Map item.
 * @returns {string} Position key.
 */
const positionKey = item => `${ item.x }|${ item.y }`;

/**
 * Group items by position; several items can share one.
 *
 * @param {object[]} items Map items.
 * @returns {Map<string, object[]>} Items per position.
 */
const byPosition = items =>
{
  const map = new Map();
  for ( const item of items )
  {
    const key = positionKey( item );
    if ( !map.has( key ) ) map.set( key, [] );
    map.get( key ).push( item );
  }
  return map;
};

/**
 * Take the best previous item for a new one from the same position: the same type first,
 * otherwise any (a type change such as a town hall upgrade).
 *
 * @param {object[]} candidates Unmatched previous items at the position; one is removed.
 * @param {object} item New item.
 * @returns {object|null} The matching previous item.
 */
const takeMatch = ( candidates, item ) =>
{
  if ( !candidates || !candidates.length ) return null;
  const index = candidates.findIndex( candidate => candidate.i === item.i );
  return candidates.splice( index >= 0 ? index : 0, 1 )[ 0 ];
};

/**
 * Changes between two versions of a hex's items.
 *
 * Kinds: built, destroyed, upgraded (type changed), captured (team gained, from neutral or the
 * other team), lost (team gone), scorched. Each change is { kind, item, previous } where item
 * is the new version (the old one for destroyed) and previous the old one (null for built).
 *
 * @param {object[]} previous Items before.
 * @param {object[]} next     Items after.
 * @param {{ ignore?: function(number): boolean }} options `ignore( iconType )` skips types
 *   that never change in a meaningful way, such as resource fields.
 * @returns {object[]} Changes.
 */
export const diffHex = ( previous, next, options = {} ) =>
{
  const ignore = options.ignore || ( () => false );
  const unmatched = byPosition( previous.filter( item => !ignore( item.i ) ) );
  const changes = [];

  for ( const item of next )
  {
    if ( ignore( item.i ) ) continue;

    const before = takeMatch( unmatched.get( positionKey( item ) ), item );
    if ( !before )
    {
      changes.push( { kind: 'built', item, previous: null } );
      continue;
    }

    if ( before.i !== item.i ) changes.push( { kind: 'upgraded', item, previous: before } );

    if ( before.t !== item.t )
    {
      changes.push( { kind: item.t ? 'captured' : 'lost', item, previous: before } );
    }

    if ( !( before.f & SCORCHED ) && ( item.f & SCORCHED ) )
    {
      changes.push( { kind: 'scorched', item, previous: before } );
    }
  }

  for ( const items of unmatched.values() )
  {
    for ( const item of items ) changes.push( { kind: 'destroyed', item, previous: item } );
  }

  return changes;
};
