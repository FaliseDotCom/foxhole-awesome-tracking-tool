import { expect, test } from '@playwright/test';

/**
 * Collect console errors and uncaught page errors while a test runs.
 *
 * @param {import('@playwright/test').Page} page Page to listen on.
 * @returns {string[]} Live list of error messages.
 */
const collectErrors = page =>
{
  const errors = [];
  page.on( 'console', message =>
  {
    if ( message.type() === 'error' ) errors.push( message.text() );
  } );
  page.on( 'pageerror', error => errors.push( error.message ) );
  return errors;
};

test( 'map renders without errors', async ( { page } ) =>
{
  const errors = collectErrors( page );

  await page.goto( '/' );

  await expect( page.locator( '.logo h1' ) ).toHaveText( 'FATT' );
  // the shard picker only shows when there is more than one live shard to choose from
  const live = await ( await page.request.get( '/api/shards' ) ).json();
  await expect( page.getByRole( 'tab', { name: 'Shard' } ) ).toHaveCount( live.length > 1 ? 1 : 0 );
  await expect( page.locator( 'svg.layer.backgrounds svg.hex' ).first() ).toBeVisible();

  expect( errors ).toEqual( [] );
} );

test( 'live data draws map icons', async ( { page } ) =>
{
  const errors = collectErrors( page );

  await page.goto( '/' );

  // the summary layer shows at the startup zoom, the dynamic layer when zoomed in
  await expect( page.locator( 'image.icon' ).first() ).toBeAttached( { timeout: 20000 } );

  expect( errors ).toEqual( [] );
} );

/**
 * Map point (in map pixels) at the centre of the viewport, from the view panzoom saves.
 *
 * @param {import('@playwright/test').Page} page Page showing the map.
 * @returns {Promise<{ x: number, y: number }>} Map coordinates of the screen centre.
 */
const centrePoint = page => page.evaluate( () =>
{
  const t = JSON.parse( window.localStorage.getItem( 'fatt-view' ) );
  return {
    x: ( window.innerWidth / 2 - t.x ) / t.scale,
    y: ( window.innerHeight / 2 - t.y ) / t.scale
  };
} );

test( 'resizing keeps the centre of the map in place', async ( { page } ) =>
{
  await page.setViewportSize( { width: 1280, height: 720 } );
  await page.goto( '/' );

  // move away from the start position so the test does not pass by accident
  await page.keyboard.press( 'Equal' );
  await page.keyboard.press( 'ArrowLeft' );
  await page.waitForTimeout( 1000 );
  const before = await centrePoint( page );

  await page.setViewportSize( { width: 800, height: 1000 } );
  await page.waitForTimeout( 1000 );
  const after = await centrePoint( page );

  expect( Math.abs( after.x - before.x ) ).toBeLessThan( 2 );
  expect( Math.abs( after.y - before.y ) ).toBeLessThan( 2 );
} );

test( 'zooming in shows every layer', async ( { page } ) =>
{
  const errors = collectErrors( page );

  // open Dead Lands at zoom 1, where the minor labels show; a link is quicker and steadier
  // than pressing + many times, which depends on the speed of the machine
  await page.goto( '/#able/5121/3108/1.00' );

  await expect( page.locator( 'svg.layer.labels-minor text.minor' ).first() ).toBeAttached( { timeout: 10000 } );
  await expect( page.locator( 'svg.layer.dynamics image.icon' ).first() ).toBeAttached( { timeout: 20000 } );

  expect( errors ).toEqual( [] );
} );

test( 'war overview shows victory towns per team', async ( { page } ) =>
{
  await page.goto( '/' );

  const panel = page.locator( '.war' );
  await expect( panel ).toContainText( /War \d+/, { timeout: 20000 } );
  await expect( panel.locator( '.team-wardens' ) ).toContainText( /\d+ \/ \d+/ );
  await expect( panel.locator( '.team-colonials' ) ).toContainText( /\d+ \/ \d+/ );
} );

test( 'hovering a structure shows its name and place', async ( { page } ) =>
{
  await page.goto( '/' );

  const icon = page.locator( 'svg.layer.summaries image.icon' ).first();
  await expect( icon ).toBeVisible( { timeout: 20000 } );
  await icon.hover();

  const tip = page.locator( '.tooltip' );
  await expect( tip.locator( '.tooltip-title' ) ).not.toBeEmpty();
  // second line: nearest place, then the hex
  await expect( tip.locator( '.tooltip-detail' ) ).toContainText( ', ' );

  await page.mouse.move( 1, 1 );
  await expect( tip ).toHaveCount( 0 );
} );

test( 'the legend lists the structures on the map', async ( { page } ) =>
{
  await page.goto( '/' );
  await expect( page.locator( 'image.icon' ).first() ).toBeAttached( { timeout: 20000 } );

  await page.getByRole( 'tab', { name: 'Legend' } ).click();
  const legend = page.getByRole( 'tabpanel', { name: 'Legend' } );
  await expect( legend ).toContainText( 'Colors' );
  await expect( legend ).toContainText( 'Town Base Tier 3' );
  await expect( legend ).toContainText( 'Town Hall' );
} );

test( 'settings change the icon style and are remembered', async ( { page } ) =>
{
  await page.goto( '/' );
  await expect( page.locator( 'image.icon' ).first() ).toBeAttached( { timeout: 20000 } );

  await page.getByRole( 'tab', { name: 'Settings' } ).click();
  await page.getByLabel( 'superbright' ).check();
  await expect( page.locator( 'image.icon' ).first() ).toHaveAttribute( 'href', /\/superbright\// );

  await page.reload();
  await expect( page.locator( 'image.icon' ).first() ).toHaveAttribute( 'href', /\/superbright\//, { timeout: 20000 } );
} );

test( 'legend opens and closes', async ( { page } ) =>
{
  await page.goto( '/' );

  await page.getByRole( 'tab', { name: 'Legend' } ).click();
  await expect( page.getByRole( 'tabpanel', { name: 'Legend' } ) ).toContainText( 'Held by the Wardens' );

  await page.keyboard.press( 'Escape' );
  await expect( page.getByRole( 'tabpanel' ) ).toHaveCount( 0 );
} );

test( 'the view is kept in a shareable link', async ( { page } ) =>
{
  await page.goto( '/' );
  await page.keyboard.press( 'Equal' );
  await expect( page ).toHaveURL( /#able\/\d+\/\d+\/\d+\.\d\d$/, { timeout: 10000 } );

  // open the same link in a fresh page: the same map point is in the centre
  const url = page.url();
  const [ , x, y ] = url.match( /#able\/(\d+)\/(\d+)\// );
  const other = await page.context().newPage();
  await other.goto( url );
  await other.waitForTimeout( 1500 );
  const centre = await centrePoint( other );
  expect( Math.abs( centre.x - Number( x ) ) ).toBeLessThan( 2 );
  expect( Math.abs( centre.y - Number( y ) ) ).toBeLessThan( 2 );
} );

test( 'search finds a hex and moves the map to it', async ( { page } ) =>
{
  await page.goto( '/' );
  const field = page.getByRole( 'combobox', { name: 'Search places and structures' } );

  await field.fill( 'dead' );
  await expect( page.getByRole( 'option' ).first() ).toContainText( 'Dead Lands' );
  await field.press( 'Enter' );
  await expect( field ).toHaveValue( 'Dead Lands' );

  // Dead Lands is at column 6, row 6: its centre is at 5121, 3108 in map pixels
  await page.waitForTimeout( 1500 );
  const centre = await centrePoint( page );
  expect( Math.abs( centre.x - 5121 ) ).toBeLessThan( 5 );
  expect( Math.abs( centre.y - 3108 ) ).toBeLessThan( 5 );
} );

test( 'search ignores punctuation and finds structures', async ( { page } ) =>
{
  await page.goto( '/' );
  const field = page.getByRole( 'combobox', { name: 'Search places and structures' } );

  await field.fill( 'callahans' );
  await expect( page.getByRole( 'option', { name: /^Callahans Passage/ } ) ).toBeVisible();
  await expect( page.getByRole( 'option', { name: /^Callahan's Gate/ } ) ).toBeVisible();

  await field.fill( 'seaport' );
  await expect( page.getByRole( 'option', { name: /Seaport – / } ).first() ).toBeVisible( { timeout: 20000 } );
} );

test( 'typing in the search field does not move the map', async ( { page } ) =>
{
  await page.goto( '/' );
  await page.waitForTimeout( 1000 );
  const before = await centrePoint( page );

  await page.getByRole( 'combobox', { name: 'Search places and structures' } ).pressSequentially( 'wasd+-' );
  await page.waitForTimeout( 1000 );
  const after = await centrePoint( page );
  expect( after ).toEqual( before );
} );

test( 'recent searches are shown on an empty field', async ( { page } ) =>
{
  await page.goto( '/' );
  const field = page.getByRole( 'combobox', { name: 'Search places and structures' } );
  await field.fill( 'westgate' );
  await field.press( 'Enter' );

  await page.reload();
  await expect( field ).toBeVisible();
  await page.keyboard.press( '/' );
  await expect( field ).toBeFocused();
  await expect( page.getByRole( 'listbox', { name: 'Recent' } ) ).toContainText( 'Westgate' );
} );

/**
 * A war log event as /api/log sends it.
 *
 * @param {number} id   Event id.
 * @param {object} town Town base item ({ x, y, t, i }).
 * @param {string} from Team before the capture.
 * @returns {object} Event.
 */
const captureEvent = ( id, town, from ) => ( {
  id, time: Date.now(), hex: 'DeadLands', kind: 'captured', major: false,
  icon: town.i, iconFrom: town.i, team: town.t, teamFrom: from, flags: 0, flagsFrom: 0,
  x: town.x, y: town.y, value: null, required: null
} );

/**
 * Live map data, plus a copy in which one Dead Lands town base changed hands.
 *
 * @param {import('@playwright/test').APIRequestContext} request Request context.
 * @returns {Promise<{ base: object, changed: object, town: object, from: string }>} Data.
 */
const mapDataWithCapture = async request =>
{
  const base = await ( await request.get( '/api/data/able' ) ).json();
  const changed = structuredClone( base );
  const hex = changed.DeadLands;
  const town = hex.d.find( item => [ 56, 57, 58 ].includes( item.i ) );
  const from = town.t;
  town.t = from === 'W' ? 'C' : 'W';
  hex.v += 1;
  return { base, changed, town, from };
};

test( 'the war log is filled from the server and moves the map to an entry', async ( { page, request } ) =>
{
  const { town, from } = await mapDataWithCapture( request );
  let events = [ captureEvent( 1, town, from ) ];

  // the first request gets the latest events; later ones ask for events since the newest id
  await page.route( '**/api/log/able**', route =>
  {
    const since = Number( new URL( route.request().url() ).searchParams.get( 'since' ) || 0 );
    route.fulfill( { json: { war: 141, recordedAt: Date.now(), events: events.filter( e => e.id > since ) } } );
  } );
  await page.goto( '/' );

  const entry = page.locator( '.warlog-entry' ).first();
  await expect( entry ).toContainText( /took Town Base Tier \d/ );
  await expect( entry ).toContainText( 'Dead Lands' );
  await expect( page.locator( '.warlog-notice' ) ).toHaveCount( 0 );
  await expect( page.locator( '.warlog-status' ) ).toContainText( /Live · checked \d+ s ago · last change/ );

  // a new event arrives with the next map update
  events = [ ...events, { ...captureEvent( 2, { ...town, t: from }, town.t ) } ];
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 2, { timeout: 15000 } );

  // Dead Lands is at column 6, row 6
  await page.locator( '.warlog-entry' ).nth( 1 ).click();
  await page.waitForTimeout( 1500 );
  const centre = await centrePoint( page );
  expect( Math.abs( centre.x - ( 4609 + town.x * 1024 ) ) ).toBeLessThan( 5 );
  expect( Math.abs( centre.y - ( 2664 + town.y * 888 ) ) ).toBeLessThan( 5 );
} );

test( 'the war log falls back to the browser and back to the server', async ( { page, request } ) =>
{
  const { base, changed, town, from } = await mapDataWithCapture( request );

  let server_up = false;
  await page.route( '**/api/log/able**', route => server_up
    ? route.fulfill( { json: { war: 141, recordedAt: Date.now(), events: [ captureEvent( 7, town, from ) ] } } )
    : route.fulfill( { status: 500, json: { error: 'down' } } ) );
  let calls = 0;
  await page.route( '**/api/data/able', route => route.fulfill( { json: calls++ ? changed : base } ) );
  await page.goto( '/' );

  // server down: the notice shows, and the browser's own comparison finds the capture
  await expect( page.locator( '.warlog-notice' ) ).toBeVisible();
  await expect( page.locator( '.warlog-status' ) ).toContainText( 'This browser', { timeout: 15000 } );
  // the capture also changes the victory town total, so look for its entry among the others
  await expect( page.locator( '.warlog-entry', { hasText: /took Town Base Tier \d/ } ) ).toHaveCount( 1, { timeout: 15000 } );

  // server back: the notice goes and the server's entry replaces the browser's
  server_up = true;
  await expect( page.locator( '.warlog-notice' ) ).toHaveCount( 0, { timeout: 15000 } );
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 1 );
} );

test( 'a rocket launch and impact show as one entry with an arc', async ( { page } ) =>
{
  const now = Date.now();
  const event = ( id, time, hex, kind, icon, icon_from, team, x, y ) => ( {
    id, time, hex, kind, major: true, icon, iconFrom: icon_from, team, teamFrom: icon_from === null ? null : team,
    flags: 0, flagsFrom: icon_from === null ? null : 0, x, y, value: null, required: null
  } );
  // a Wardens rocket site in Dead Lands fires (72 → 37); a Rocket Ground Zero (71) appears in Westgate
  const events = [
    event( 2, now, 'Westgate', 'built', 71, null, '', .5, .5 ),
    event( 1, now - 60000, 'DeadLands', 'upgraded', 37, 72, 'W', .3, .3 )
  ];
  await page.route( '**/api/log/able**', route =>
  {
    const since = Number( new URL( route.request().url() ).searchParams.get( 'since' ) || 0 );
    route.fulfill( { json: { war: 141, recordedAt: Date.now(), events: events.filter( e => e.id > since ) } } );
  } );
  await page.goto( '/' );

  const entry = page.locator( '.warlog-entry' ).first();
  await expect( entry ).toContainText( 'Wardens fired a rocket from' );
  await expect( entry ).toContainText( /hit .*Westgate/ );
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 1 );
  await expect( page.locator( 'path.rocket-arc' ) ).toHaveCount( 1 );

  // clicking fits launch and impact: the centre lies between them
  await entry.click();
  await page.waitForTimeout( 1500 );
  const centre = await centrePoint( page );
  // Dead Lands is at column 6, row 6; Westgate at column 3, row 7
  const launch = { x: 4609 + .3 * 1024, y: 2664 + .3 * 888 };
  const impact = { x: parseInt( 3 * 1024 / 1.333 ) + .5 * 1024, y: parseInt( 7 * 888 / 2 ) + .5 * 888 };
  expect( Math.abs( centre.x - ( launch.x + impact.x ) / 2 ) ).toBeLessThan( 5 );
  expect( Math.abs( centre.y - ( launch.y + impact.y ) / 2 ) ).toBeLessThan( 5 );
} );

/**
 * Rocket launch and impact events as /api/log sends them.
 *
 * @param {number} first Id of the launch; the impact gets the next one.
 * @returns {object[]} Events, newest first.
 */
const rocketEvents = first =>
{
  const now = Date.now();
  const base = { major: true, flags: 0, value: null, required: null };
  return [
    { ...base, id: first + 1, time: now, hex: 'Westgate', kind: 'built', icon: 71, iconFrom: null, team: '', teamFrom: null, flagsFrom: null, x: .5, y: .5 },
    { ...base, id: first, time: now - 1000, hex: 'DeadLands', kind: 'upgraded', icon: 37, iconFrom: 72, team: 'W', teamFrom: 'W', flagsFrom: 0, x: .3, y: .3 }
  ];
};

test( 'a live rocket launch sets off the alarm effects, history does not', async ( { page } ) =>
{
  // the page opens with an old rocket in the log; a new one arrives with the next update
  let events = rocketEvents( 1 );
  await page.route( '**/api/log/able**', route =>
  {
    const since = Number( new URL( route.request().url() ).searchParams.get( 'since' ) || 0 );
    route.fulfill( { json: { war: 141, recordedAt: Date.now(), events: events.filter( e => e.id > since ) } } );
  } );
  await page.goto( '/' );
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 1 );
  await expect( page.locator( '.effect-launch' ) ).toHaveCount( 0 );

  events = [ ...rocketEvents( 3 ), ...events ];

  // launch: beacon and rumble; after the flight: flash, shockwave and quake
  await expect( page.locator( '.effect-launch' ) ).toHaveCount( 1, { timeout: 15000 } );
  await expect( page.locator( '.scaler.shake-rumble' ) ).toHaveCount( 1 );
  await expect( page.locator( '.effect-impact' ) ).toHaveCount( 1, { timeout: 5000 } );
  await expect( page.locator( '.scaler.shake-quake' ) ).toHaveCount( 1 );
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 2 );
} );

test( 'the search button goes to the first suggestion', async ( { page } ) =>
{
  await page.goto( '/' );
  const field = page.getByRole( 'combobox', { name: 'Search places and structures' } );

  // with an empty field the button starts typing
  await page.getByRole( 'button', { name: 'Search', exact: true } ).click();
  await expect( field ).toBeFocused();

  await field.fill( 'dead' );
  await expect( page.getByRole( 'option' ).first() ).toContainText( 'Dead Lands' );
  await page.getByRole( 'button', { name: 'Search', exact: true } ).click();
  await expect( field ).toHaveValue( 'Dead Lands' );
} );

test( 'the tabs switch panels and close again', async ( { page } ) =>
{
  await page.goto( '/' );

  // the war log is open on a wide screen
  const warlog = page.getByRole( 'tab', { name: 'War log' } );
  await expect( warlog ).toHaveAttribute( 'aria-selected', 'true' );
  await expect( page.getByRole( 'tabpanel', { name: 'War log' } ) ).toBeVisible();

  // arrow keys move to the next tab
  await warlog.focus();
  await page.keyboard.press( 'ArrowRight' );
  await expect( page.getByRole( 'tabpanel', { name: 'Legend' } ) ).toBeVisible();

  // clicking the open tab closes its panel
  await page.getByRole( 'tab', { name: 'Legend' } ).click();
  await expect( page.getByRole( 'tabpanel' ) ).toHaveCount( 0 );
} );

test( 'the war log status says who recorded and when the cron job ran', async ( { page } ) =>
{
  await page.route( '**/api/log/able**', route => route.fulfill( { json: {
    war: 141, recordedAt: Date.now(), recordedBy: 'request', cronAt: Date.now() - 30000, events: []
  } } ) );
  await page.goto( '/' );

  const status = page.locator( '.warlog-status' );
  await expect( status ).toHaveAttribute( 'title', /Last checked by a visitor's map update\. The cron job last ran 3\d s ago\./ );
} );
