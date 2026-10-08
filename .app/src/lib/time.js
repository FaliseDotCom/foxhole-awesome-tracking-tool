/**
 * How long ago something happened, in words. Pure, for the war log and the hex details.
 */

/**
 * How long ago something happened, roughly.
 *
 * @param {number} time Time in ms.
 * @param {number} current Current time in ms.
 * @returns {string} "just now", "5 min ago", "2 h ago".
 */
export const ago = ( time, current ) =>
{
  const minutes = Math.floor( ( current - time ) / 60000 );
  if ( minutes < 1 ) return 'just now';
  if ( minutes < 60 ) return `${ minutes } min ago`;
  return `${ Math.floor( minutes / 60 ) } h ago`;
};

/**
 * How long ago something was checked, to the second while recent.
 *
 * @param {number} time Time in ms.
 * @param {number} current Current time in ms.
 * @returns {string} "5s ago", or as ago() from a minute on.
 */
export const agoShort = ( time, current ) =>
{
  const seconds = Math.max( 0, Math.round( ( current - time ) / 1000 ) );
  return seconds < 60 ? `${ seconds }s ago` : ago( time, current );
};
