/**
 * The viewer id that open maps send with their requests for map data, so the server can count
 * viewers (.api/lib/viewers.php). Pure apart from the storage it is given, for world.js.
 *
 * The id is random and kept in localStorage while it is in use, so a reload or a second tab in
 * the same browser sends the same id and counts once. It is renewed when it was last used
 * longer ago than the server counts a viewer, so it never ties one stretch of watching to the
 * next. Without storage (blocked, private mode) it lasts for the page load.
 */

/**
 * localStorage key of the id and when it was last used: { id, used }.
 * @type {string}
 */
const storage_key = 'fatt-viewer';

/**
 * How long an unused id is kept, in ms: as long as the server counts a viewer
 * (VIEWERS_ACTIVE_MINUTES), after which it has forgotten the id too.
 * @type {number}
 */
export const VIEWER_ID_LIFETIME = 5 * 60 * 1000;

/**
 * A new random id: 32 hex characters, the form the server accepts.
 *
 * @returns {string} Id.
 */
const newId = () => Array.from( crypto.getRandomValues( new Uint8Array( 16 ) ), byte => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );

/**
 * Whether a stored value is a usable { id, used }.
 *
 * @param {*} value Parsed stored value.
 * @returns {boolean} True when it is.
 */
const isEntry = value => Boolean( value ) && typeof value.id === 'string' && /^[0-9a-f]{32}$/.test( value.id ) && Number.isFinite( value.used );

/**
 * Make a viewer id source.
 *
 * @param {() => Storage|undefined} getStorage Returns the storage to keep the id in; may throw
 *                                             or return nothing when there is none.
 * @returns {( now?: number ) => string} Returns the id to send now, and marks it used.
 */
export const viewerIds = getStorage =>
{
  // this page's own copy, for when storage fails
  let memory = null;

  /**
   * The stored id, or null when there is none or no storage.
   *
   * @returns {{ id: string, used: number }|null} Stored id and when it was last used.
   */
  const read = () =>
  {
    try
    {
      const value = JSON.parse( getStorage()?.getItem( storage_key ) || 'null' );
      return isEntry( value ) ? value : null;
    }
    catch
    {
      return null;
    }
  };

  /**
   * Store the id and when it was used.
   *
   * @param {{ id: string, used: number }} entry Id and time.
   * @returns {void}
   */
  const write = entry =>
  {
    try
    {
      getStorage()?.setItem( storage_key, JSON.stringify( entry ) );
    }
    catch
    {
      // no storage: the page keeps its own copy
    }
  };

  return ( now = Date.now() ) =>
  {
    // the most recently used id, from this page or another tab in the same browser
    const saved = read(),
          latest = saved && ( !memory || saved.used >= memory.used ) ? saved : memory;
    memory = { id: latest && now - latest.used < VIEWER_ID_LIFETIME ? latest.id : newId(), used: now };
    write( memory );
    return memory.id;
  };
};

/**
 * The viewer id of this browser, kept in localStorage.
 * @type {( now?: number ) => string}
 */
export const viewerId = viewerIds( () => globalThis.localStorage );
