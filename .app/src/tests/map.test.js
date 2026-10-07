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
  // only live shards are listed, and Able has always been live
  await expect( page.locator( '.shard label', { hasText: 'able' } ) ).toBeVisible();
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

test( 'zooming in shows every layer', async ( { page } ) =>
{
  const errors = collectErrors( page );

  await page.goto( '/' );

  // zoom in far enough for the minor labels to appear
  for ( let step = 0; step < 12; step++ )
  {
    await page.keyboard.press( 'Equal' );
    await page.waitForTimeout( 400 );
  }

  await expect( page.locator( 'svg.layer.labels-minor text.minor' ).first() ).toBeAttached();
  await expect( page.locator( 'svg.layer.dynamics image.icon' ).first() ).toBeAttached( { timeout: 20000 } );

  expect( errors ).toEqual( [] );
} );
