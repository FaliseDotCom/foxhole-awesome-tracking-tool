import { updated } from '$app/state';
import { version } from '$app/env';

/**
 * Reload the page when a new version of F.A.T.T. is online, so a map left open does not keep
 * running old code. SvelteKit compares the version this page was built with against
 * _app/version.json; it also checks when the tab becomes visible or gets focus. The view is
 * in the address and the settings in localStorage, so a reload keeps both.
 */

/**
 * Time between version checks, in ms.
 * @type {number}
 */
const check_interval = 60 * 1000;

/**
 * Wait after a new version is found before reloading, in ms, so an upload in progress can
 * finish first.
 * @type {number}
 */
const reload_delay = 30 * 1000;

/**
 * sessionStorage key of the version this tab reloaded away from. When the reload still brings
 * that version (a cached page, an unfinished upload), it does not reload again.
 * @type {string}
 */
const reloaded_key = 'fatt-reloaded-from';

/**
 * Whether a reload is already planned.
 * @type {boolean}
 */
let reloading = false;

/**
 * Whether this tab already reloaded away from this version once.
 *
 * @returns {boolean} True when it did.
 */
const reloadedBefore = () =>
{
  try
  {
    return window.sessionStorage.getItem( reloaded_key ) === version;
  }
  catch
  {
    return false;
  }
};

/**
 * Note the version this tab reloads away from.
 *
 * @returns {void}
 */
const rememberReload = () =>
{
  try
  {
    window.sessionStorage.setItem( reloaded_key, version );
  }
  catch
  {
    // storage can be unavailable (private mode); then a stale page may reload again later
  }
};

/**
 * Check for a new version and plan a reload when there is one.
 *
 * @returns {Promise<void>}
 */
const check = async () =>
{
  if ( reloading || !await updated.check() || reloadedBefore() ) return;
  reloading = true;
  setTimeout( () =>
  {
    rememberReload();
    window.location.reload();
  }, reload_delay );
};

/**
 * Start checking for new versions: on an interval and whenever the tab becomes visible.
 *
 * @returns {void}
 */
export const watchVersion = () =>
{
  setInterval( check, check_interval );
  document.addEventListener( 'visibilitychange', () =>
  {
    if ( document.visibilityState === 'visible' ) check();
  } );
};
