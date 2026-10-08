import { config } from './config';

/**
 * Visitor statistics with Matomo (config.analytics): one page view per visit, a ping every
 * minute while the page is visible (for "active now"), and events for tabs, search, history and
 * settings. Without cookies, only on the live site, and never when the browser asks not to be
 * tracked (Do Not Track or Global Privacy Control): then matomo.js is not even loaded. See the
 * README, "Visitor statistics".
 */

/**
 * Time between pings while the page is visible, in ms.
 * @type {number}
 */
const ping_interval = 60 * 1000;

/**
 * Time a setting must stay the same before it is counted, in ms, so dragging a slider counts once.
 * @type {number}
 */
const setting_delay = 1500;

/**
 * Event categories, as they show in Matomo.
 * @type {{ tab: string, history: string, settings: string }}
 */
const categories = {
  tab: 'Tab',
  history: 'History',
  settings: 'Settings'
};

/**
 * Whether tracking started; nothing is sent before.
 * @type {boolean}
 */
let started = false;

/**
 * Pending setting events per setting, waiting for setting_delay.
 * @type {Record<string, number>}
 */
const setting_timers = {};

/**
 * Whether the browser asks not to be tracked: Do Not Track (also the older spellings) or
 * Global Privacy Control.
 *
 * @returns {boolean} True when the viewer opted out.
 */
const optedOut = () =>
{
  const dnt = [ navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack ];
  return dnt.some( value => value === '1' || value === 'yes' ) || navigator.globalPrivacyControl === true;
};

/**
 * Hand a command to Matomo; it queues until matomo.js has loaded.
 *
 * @param {...*} command Matomo method name and its arguments.
 * @returns {void}
 */
const push = ( ...command ) =>
{
  if ( started ) window._paq.push( command );
};

/**
 * Ping Matomo while the page is visible, so open maps count as active.
 *
 * @returns {void}
 */
const ping = () =>
{
  if ( document.visibilityState === 'visible' ) push( 'ping' );
};

export const analytics = {

  /**
   * Start tracking: count the page view and load matomo.js. Does nothing off the live site or
   * when the viewer opted out.
   *
   * @returns {void}
   */
  start()
  {
    if ( started || typeof window === 'undefined' ) return;
    if ( window.location.hostname !== config.analytics.host || optedOut() ) return;

    started = true;
    window._paq = window._paq || [];
    push( 'setDoNotTrack', true );
    push( 'disableCookies' );
    // the hash holds the view (shard, map point, zoom); count the page, not the view
    push( 'setCustomUrl', window.location.origin + window.location.pathname );
    push( 'trackPageView' );
    push( 'setTrackerUrl', config.analytics.url + 'matomo.php' );
    push( 'setSiteId', String( config.analytics.site ) );

    const script = document.createElement( 'script' );
    script.async = true;
    script.src = config.analytics.url + 'matomo.js';
    document.head.appendChild( script );

    setInterval( ping, ping_interval );
  },

  /**
   * Count a tab being opened.
   *
   * @param {string} key Tab key, such as "stats".
   * @returns {void}
   */
  tab( key )
  {
    push( 'trackEvent', categories.tab, key );
  },

  /**
   * Count a search that led to a chosen result.
   *
   * @param {string} keyword Search words, normalised.
   * @param {string} kind    Kind of the chosen result: hex, area, location or structure.
   * @param {number} count   Number of suggestions shown.
   * @returns {void}
   */
  search( keyword, kind, count )
  {
    if ( keyword ) push( 'trackSiteSearch', keyword, kind, count );
  },

  /**
   * Count a use of the history: showing a past moment, or going back to live.
   *
   * @param {string} action What was done, such as "show" or "live".
   * @returns {void}
   */
  history( action )
  {
    push( 'trackEvent', categories.history, action );
  },

  /**
   * Count a changed setting once it stays the same for a moment.
   *
   * @param {string}                key   Setting name.
   * @param {string|boolean|number} value New value.
   * @returns {void}
   */
  setting( key, value )
  {
    if ( !started ) return;
    clearTimeout( setting_timers[ key ] );
    setting_timers[ key ] = setTimeout( () => push( 'trackEvent', categories.settings, key, String( value ) ), setting_delay );
  }
};
