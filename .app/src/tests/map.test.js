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
  await expect( panel.locator( '.war-title' ) ).toContainText( /War \d+/, { timeout: 20000 } );
  await expect( panel.locator( '.war-part.wardens' ) ).toHaveText( /\d+/ );
  await expect( panel.locator( '.war-part.colonials' ) ).toHaveText( /\d+/ );

  // hovering a part shows the count and share of all victory towns
  await panel.locator( '.war-part.wardens' ).hover();
  const tip = page.locator( '.tooltip' );
  await expect( tip.locator( '.tooltip-title' ) ).toHaveText( 'Wardens' );
  await expect( tip.locator( '.tooltip-detail' ) ).toContainText( /\d+ of \d+ victory towns \(\d+%\) · \d+ needed to win/ );
} );

test( 'war overview counts key structures per team and shows the players', async ( { page } ) =>
{
  await page.route( '**/api/players', route => route.fulfill( { json: { time: Date.now(), count: 1625 } } ) );
  await page.goto( '/' );

  const panel = page.locator( '.war' );
  await expect( panel.locator( '.war-title' ) ).toContainText( '1,625 players', { timeout: 20000 } );

  // rocket sites, storm cannons and intel centres for each team
  for ( const team of [ 'Wardens', 'Colonials' ] )
  {
    const counters = panel.getByRole( 'list', { name: `${ team } structures` } ).locator( '.war-counter' );
    await expect( counters ).toHaveCount( 3 );
    await expect( counters.first().locator( 'span' ) ).toHaveText( /^\d+$/ );
  }

  await panel.locator( '.war-counter' ).first().hover();
  await expect( page.locator( '.tooltip-title' ) ).toHaveText( /^Wardens: \d+ rocket sites$/ );
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
  // how the map works comes first
  await expect( legend.locator( 'h3' ).first() ).toHaveText( 'How the map works' );
  await expect( legend ).toContainText( 'Fighting: red by the casualties in the last hour' );

  // the search keeps the types that match every word, in the name or other names
  const rows = legend.locator( '.legend-section' ).last().locator( '.legend-row' );
  const all = await rows.count();
  await legend.getByRole( 'textbox', { name: 'Search the structures' } ).fill( 'town base' );
  await expect( rows ).not.toHaveCount( all );
  for ( const text of await rows.allTextContents() ) expect( text ).toMatch( /Town Base/ );
  await legend.getByRole( 'textbox', { name: 'Search the structures' } ).fill( 'nothing like this' );
  await expect( rows ).toHaveCount( 0 );
  await expect( legend ).toContainText( 'No structure matches' );
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
  await expect( page.locator( '.warlog-status' ) ).toContainText( /Live · checked \d+s ago · last change/ );

  // a new event arrives with the next map update
  events = [ ...events, { ...captureEvent( 2, { ...town, t: from }, town.t ) } ];
  await expect( page.locator( '.warlog-entry' ) ).toHaveCount( 2, { timeout: 15000 } );

  // Dead Lands is at column 6, row 6
  // clicking the entry only rings the structure; the target button moves the map there
  const centre_before = await centrePoint( page );
  await page.locator( '.warlog-entry' ).nth( 1 ).click();
  await expect( page.locator( 'circle.marker' ) ).toHaveCount( 1 );
  const unmoved = await centrePoint( page );
  expect( Math.abs( unmoved.x - centre_before.x ) ).toBeLessThan( 1 );
  await page.locator( '.warlog-row' ).nth( 1 ).getByRole( 'button', { name: 'Go there' } ).click();
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

  // going there fits launch and impact: the centre lies between them
  await page.locator( '.warlog-row' ).first().getByRole( 'button', { name: 'Go there' } ).click();
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
  const warlog = page.getByRole( 'tab', { name: 'Log', exact: true } );
  await expect( warlog ).toHaveAttribute( 'aria-selected', 'true' );
  await expect( page.getByRole( 'tabpanel', { name: 'Log', exact: true } ) ).toBeVisible();

  // arrow keys move to the next tab
  await warlog.focus();
  await page.keyboard.press( 'ArrowRight' );
  await expect( page.getByRole( 'tabpanel', { name: 'Stats' } ) ).toBeVisible();

  // clicking the open tab closes its panel
  await page.getByRole( 'tab', { name: 'Stats' } ).click();
  await expect( page.getByRole( 'tabpanel' ) ).toHaveCount( 0 );
} );

test( 'the war log status says who recorded and when the cron job ran', async ( { page } ) =>
{
  await page.route( '**/api/log/able**', route => route.fulfill( { json: {
    war: 141, recordedAt: Date.now(), recordedBy: 'request', cronAt: Date.now() - 30000, events: []
  } } ) );
  await page.goto( '/' );

  const status = page.locator( '.warlog-status' );
  await expect( status ).toHaveAttribute( 'title', /Last checked by a visitor's map update\. The cron job last ran 3\ds ago\./ );
} );

test( 'the war log search shows only matching entries', async ( { page } ) =>
{
  const events = [
    { id: 2, time: Date.now() - 60000, hex: 'DeadLands', kind: 'victory', major: true, team: 'W', value: 25, required: 34 },
    { id: 1, time: Date.now() - 120000, hex: 'DeadLands', kind: 'won', major: true, team: 'C' }
  ];
  // later requests ask for events since the newest id, as the server answers them
  await page.route( '**/api/log/able**', route =>
  {
    const since = Number( new URL( route.request().url() ).searchParams.get( 'since' ) || 0 );
    route.fulfill( { json: { war: 141, recordedAt: Date.now(), events: events.filter( e => e.id > since ) } } );
  } );
  await page.goto( '/' );

  // the log loads after the first map data, which can take a while from the War API
  const entries = page.locator( '.warlog-entry' );
  await expect( entries ).toHaveCount( 2, { timeout: 20000 } );

  // every word must match, in the team, the text or the place
  const field = page.getByRole( 'textbox', { name: 'Search the war log' } );
  await field.fill( 'wardens victory' );
  await expect( entries ).toHaveCount( 1 );
  await expect( entries.first() ).toContainText( 'now hold 25 of 34 victory towns' );

  await field.fill( 'nothing like this' );
  await expect( entries ).toHaveCount( 0 );
  await expect( page.locator( '.warlog-empty' ) ).toContainText( 'Nothing in the log matches' );

  await field.fill( '' );
  await expect( entries ).toHaveCount( 2 );
} );

test( 'on a phone the tabs show only icons and the open panel hides the map search', async ( { page } ) =>
{
  await page.setViewportSize( { width: 390, height: 800 } );
  await page.goto( '/' );

  const tab = page.getByRole( 'tab', { name: 'Log', exact: true } );
  await expect( tab.locator( '.icon' ) ).toBeVisible();
  await expect( tab.locator( '.tab-label' ) ).toHaveCSS( 'width', '1px' );

  const map_search = page.getByRole( 'combobox', { name: 'Search places and structures' } );
  await expect( map_search ).toBeVisible();
  await tab.click();
  await expect( page.getByRole( 'textbox', { name: 'Search the war log' } ) ).toBeVisible();
  await expect( map_search ).toBeHidden();
} );

test( 'the war log loads older entries and shows the map at a moment', async ( { page, request } ) =>
{
  const { changed, town, from } = await mapDataWithCapture( request );
  const recent = { ...captureEvent( 200, town, from ), time: Date.now() - 60000 },
        older = { ...captureEvent( 100, { ...town, t: from }, town.t ), time: Date.now() - 3600000 };

  // the first page has one entry and says older ones start before id 150; history covers both
  await page.route( '**/api/log/able**', route =>
  {
    const params = new URL( route.request().url() ).searchParams;
    const since = Number( params.get( 'since' ) || 0 ),
          before = Number( params.get( 'before' ) || 0 );
    const events = before ? [ older ] : [ recent ].filter( e => e.id > since );
    route.fulfill( { json: { war: 141, recordedAt: Date.now(), nextBefore: before ? 0 : 150, historySince: Date.now() - 7200000, events } } );
  } );
  let asked = 0;
  await page.route( '**/api/history/able**', route =>
  {
    asked = Number( new URL( route.request().url() ).searchParams.get( 'at' ) );
    route.fulfill( { json: { time: asked, since: 0, hexes: changed } } );
  } );
  await page.goto( '/' );

  // scrolling to the end of the list loads the older page
  const rows = page.locator( '.warlog-row' );
  await expect( rows ).toHaveCount( 2, { timeout: 20000 } );
  await expect( page.locator( '.warlog-more' ) ).toHaveCount( 0 );

  // the clock button asks for the map at that entry's moment and shows the history bar
  await rows.nth( 1 ).getByRole( 'button', { name: 'Show the map at this moment' } ).click();
  const bar = page.locator( '.history-bar' );
  await expect( bar ).toContainText( 'Map as it was on' );
  expect( asked ).toBe( older.time );

  await bar.getByRole( 'button', { name: 'Back to live' } ).click();
  await expect( bar ).toHaveCount( 0 );
} );

/**
 * Statistics as /api/stats sends them: a day of hourly samples, viewers for the last two hours,
 * two busy hexes, one change.
 *
 * @returns {object} Statistics.
 */
const sampleStats = () =>
{
  const now = Date.now(),
        series = [],
        players = [],
        viewers = [ [ now - 7200000, 12 ], [ now - 3600000, 30 ], [ now - 60000, 25 ] ];
  for ( let i = 0; i < 24; i++ )
  {
    const time = now - ( 23 - i ) * 3600000;
    series.push( [ time, 50000 + i * 400, 60000 + i * 500, 9000 + i * 10 ] );
    players.push( [ time, 1400 + i * 10 ] );
  }
  return {
    war: 141, now, series, players, viewers,
    hexes: {
      DeadLands: { hour: { wardens: 210, colonials: 260, from: now - 3600000 }, day: { wardens: 3000, colonials: 3300, from: 0 } },
      Westgate: { hour: { wardens: 120, colonials: 60, from: now - 3600000 }, day: { wardens: 900, colonials: 700, from: 0 } }
    },
    changed: { Godcrofts: now - 600000 }
  };
};

test( 'the stats tab shows players, casualties and the busiest hexes', async ( { page } ) =>
{
  await page.route( '**/api/stats/able**', route => route.fulfill( { json: sampleStats() } ) );
  await page.goto( '/' );

  await page.getByRole( 'tab', { name: 'Stats' } ).click();
  const panel = page.getByRole( 'tabpanel', { name: 'Stats' } );
  await expect( panel ).toContainText( '1,630 in Foxhole now' );
  // the last hour: 400 and 500 more casualties than the hour before
  await expect( panel.locator( '.stats-legend' ) ).toContainText( 'Wardens 400' );
  await expect( panel.locator( '.stats-legend' ) ).toContainText( 'Colonials 500' );
  await expect( panel.locator( '.chart-line' ) ).toHaveCount( 4 );
  await expect( panel ).toContainText( '25 on F.A.T.T. now' );

  // busiest first; clicking one moves the map there
  const hexes = panel.locator( '.stats-hex' );
  await expect( hexes ).toHaveCount( 2 );
  await expect( hexes.first() ).toContainText( 'Dead Lands' );
  await expect( hexes.first() ).toContainText( '210 / 260' );
  await hexes.first().click();
  await expect( page ).toHaveURL( /#able\/\d+\/\d+\// );
} );

test( 'map look settings shade hexes and change colours, names and sizes', async ( { page } ) =>
{
  await page.route( '**/api/stats/able**', route => route.fulfill( { json: sampleStats() } ) );
  await page.goto( '/' );
  await expect( page.locator( '.war-part' ).first() ).toBeVisible( { timeout: 20000 } );

  await page.getByRole( 'tab', { name: 'Settings' } ).click();
  const panel = page.getByRole( 'tabpanel', { name: 'Settings' } );

  // fighting: the busiest hex fully, the other one less
  await panel.getByLabel( 'fighting: casualties in the last hour' ).check();
  await expect( page.locator( '.shade.fighting' ) ).toHaveCount( 2 );
  await panel.getByLabel( 'changes: the last 6 hours' ).check();
  await expect( page.locator( '.shade.changes' ) ).toHaveCount( 1 );

  await panel.getByLabel( 'colour-blind: blue and orange' ).check();
  await expect( page.locator( 'html' ) ).toHaveClass( /palette-colour-blind/ );
  await panel.getByLabel( 'Hex names' ).uncheck();
  await expect( page.locator( '.background text' ).first() ).toBeHidden();
  await panel.getByLabel( 'on the left, logo on the right' ).check();
  const tabs = await page.locator( '.tabs' ).boundingBox();
  expect( tabs.x ).toBeLessThan( 20 );
  await panel.locator( 'input[type=range]' ).last().fill( '1.5' );
  expect( await page.evaluate( () => document.documentElement.style.getPropertyValue( '--icon-scale' ) ) ).toBe( '1.5' );

  // remembered after a reload
  await page.reload();
  await expect( page.locator( 'html' ) ).toHaveClass( /palette-colour-blind/ );
  await expect( page.locator( 'html' ) ).toHaveClass( /hide-hex-names/ );
} );

test( 'the map controls pan, zoom and show the whole map again', async ( { page } ) =>
{
  await page.goto( '/' );
  await expect( page.locator( '.war-part' ).first() ).toBeVisible( { timeout: 20000 } );
  const controls = page.getByRole( 'group', { name: 'Map controls' } );
  const start = await centrePoint( page );

  await controls.getByRole( 'button', { name: 'Look right' } ).click();
  await expect.poll( async () => ( await centrePoint( page ) ).x ).toBeGreaterThan( start.x + 10 );

  const zoom = Number( await controls.getByRole( 'slider', { name: 'Zoom' } ).inputValue() );
  await controls.getByRole( 'button', { name: 'Zoom in' } ).click();
  await expect.poll( async () => Number( await controls.getByRole( 'slider', { name: 'Zoom' } ).inputValue() ) ).toBeGreaterThan( zoom );

  await controls.getByRole( 'button', { name: 'Show the whole map' } ).click();
  await expect.poll( async () => Math.round( ( await centrePoint( page ) ).x ) ).toBe( Math.round( start.x ) );
} );

test( 'zoomed out, hovering a hex shows its structures and latest changes', async ( { page } ) =>
{
  await page.goto( '/' );
  const hex = page.locator( '.summaries svg.DeadLandsHex' );
  await expect( hex ).toBeVisible( { timeout: 20000 } );

  const box = await hex.boundingBox();
  // off centre, away from the town icon
  await page.mouse.move( box.x + box.width * .3, box.y + box.height * .75 );
  const tip = page.locator( '.tooltip' );
  await expect( tip.locator( '.tooltip-title' ) ).toHaveText( 'Dead Lands' );
  await expect( tip.locator( '.tooltip-detail' ).first() ).toContainText( /\d+ structures/ );
} );

test( 'hovering a stats chart marks that moment in every chart, with their values', async ( { page } ) =>
{
  await page.route( '**/api/stats/able**', route => route.fulfill( { json: sampleStats() } ) );
  await page.goto( '/' );
  await page.getByRole( 'tab', { name: 'Stats' } ).click();
  const panel = page.getByRole( 'tabpanel', { name: 'Stats' } );

  // the charts span the same time, so the same moment is at the same place in each
  const charts = panel.locator( 'svg.chart' );
  await expect( charts ).toHaveCount( 3 );
  const box = await charts.nth( 2 ).boundingBox();
  await page.mouse.move( box.x + box.width - 2, box.y + box.height / 2 );
  await expect( panel.locator( '.chart-hover' ) ).toHaveCount( 3 );
  const xs = await panel.locator( '.chart-hover' ).evaluateAll( lines => lines.map( line => Math.round( line.getBoundingClientRect().x ) ) );
  expect( new Set( xs ).size ).toBe( 1 );

  const readouts = panel.locator( '.chart-readout' );
  await expect( readouts ).toHaveCount( 3 );
  await expect( readouts.nth( 0 ) ).toContainText( '1,630 players' );
  await expect( readouts.nth( 1 ) ).toContainText( '25 viewers' );
  await expect( readouts.nth( 2 ).locator( '.chart-value' ).first() ).toHaveText( 'Wardens 400 per hour' );
  await expect( readouts.nth( 2 ).locator( '.chart-value' ).nth( 1 ) ).toHaveText( 'Colonials 500 per hour' );

  // two hours back the viewers have a sample, earlier they have none
  await page.mouse.move( box.x + box.width * 22 / 24, box.y + box.height / 2 );
  await expect( readouts.nth( 1 ) ).toContainText( '12 viewers' );
  await page.mouse.move( box.x + box.width / 4, box.y + box.height / 2 );
  await expect( readouts.nth( 1 ) ).toContainText( 'no data' );

  await page.mouse.move( 0, 0 );
  await expect( panel.locator( '.chart-hover' ) ).toHaveCount( 0 );
} );

test( 'visits can be left uncounted, and never are with Do Not Track', async ( { page, browser } ) =>
{
  await page.goto( '/' );
  await page.getByRole( 'tab', { name: 'Settings' } ).click();
  const count = page.getByRole( 'tabpanel', { name: 'Settings' } ).getByLabel( 'Count my visits' );
  await expect( count ).toBeChecked();
  await count.uncheck();
  await page.reload();
  await page.getByRole( 'tab', { name: 'Settings' } ).click();
  await expect( page.getByRole( 'tabpanel', { name: 'Settings' } ).getByLabel( 'Count my visits' ) ).not.toBeChecked();

  // the browser asks not to be tracked: off, and it cannot be turned on
  const context = await browser.newContext();
  await context.addInitScript( () => Object.defineProperty( navigator, 'doNotTrack', { get: () => '1' } ) );
  const blocked = await context.newPage();
  await blocked.goto( page.url() );
  await blocked.getByRole( 'tab', { name: 'Settings' } ).click();
  const panel = blocked.getByRole( 'tabpanel', { name: 'Settings' } );
  await expect( panel.getByLabel( 'Count my visits' ) ).not.toBeChecked();
  await expect( panel.getByLabel( 'Count my visits' ) ).toBeDisabled();
  await expect( panel ).toContainText( 'Your browser asks websites not to track you' );
  await context.close();
} );

test( 'the stats charts can show the whole war, a week, a day, or the last hours', async ( { page } ) =>
{
  const asked = [];
  await page.route( '**/api/stats/able**', route =>
  {
    const hours = new URL( route.request().url() ).searchParams.get( 'hours' ),
          stats = sampleStats();
    asked.push( hours );
    // the war started ten days ago
    route.fulfill( { json: { ...stats, from: hours === 'war' ? stats.now - 10 * 86400000 : stats.now - Number( hours ) * 3600000 } } );
  } );
  await page.goto( '/' );
  await page.getByRole( 'tab', { name: 'Stats' } ).click();
  const panel = page.getByRole( 'tabpanel', { name: 'Stats' } ),
        spans = panel.getByRole( 'group', { name: 'Time span of the charts' } );

  await expect( spans.getByRole( 'button', { name: '24 h', exact: true } ) ).toHaveAttribute( 'aria-pressed', 'true' );
  expect( asked.at( -1 ) ).toBe( '24' );

  await spans.getByRole( 'button', { name: 'War' } ).click();
  await expect( spans.getByRole( 'button', { name: 'War' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
  await expect.poll( () => asked.at( -1 ) ).toBe( 'war' );
  await expect( panel.locator( 'svg.chart' ).first() ).toHaveAttribute( 'aria-label', 'Players over this war' );

  // the day of samples fills the last tenth of a ten day chart; over days the moment has its date
  const box = await panel.locator( 'svg.chart' ).first().boundingBox();
  await page.mouse.move( box.x + box.width - 2, box.y + box.height / 2 );
  await expect( panel.locator( '.chart-time' ).first() ).toHaveText( /^[A-Z][a-z]{2} \d+ [A-Z][a-z]{2}, \d\d:\d\d$/ );
  // a pixel is over an hour here, so the nearest sample is one of the last
  await expect( panel.locator( '.chart-readout' ).first() ).toContainText( /1,6[23]0 players/ );

  // remembered after a reload
  await page.reload();
  await page.getByRole( 'tab', { name: 'Stats' } ).click();
  await expect( spans.getByRole( 'button', { name: 'War' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
  await spans.getByRole( 'button', { name: '4 h', exact: true } ).click();
  await expect.poll( () => asked.at( -1 ) ).toBe( '4' );
} );
