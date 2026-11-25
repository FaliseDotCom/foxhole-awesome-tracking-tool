"""
Unit tests for the bridge and town rules of extract-roads.py, on small drawn maps.

Run from the repository root:
  .venv-roads/Scripts/python -m unittest discover -s .scripts/roads -p "test_*.py"
"""

import importlib.util
import os
import unittest
import warnings

import numpy as np
from PIL import Image, ImageDraw

SCRIPT = os.path.join( os.path.dirname( os.path.abspath( __file__ ) ), 'extract-roads.py' )
SPEC = importlib.util.spec_from_file_location( 'extract_roads', SCRIPT )
roads = importlib.util.module_from_spec( SPEC )
SPEC.loader.exec_module( roads )

def setUpModule():
  """
  Silence the deprecation notices of scikit-image, as the script itself does (the test runner
  turns warnings back on).
  """
  warnings.filterwarnings( 'ignore' )


LAND = ( 178, 164, 139 )
WATER = ( 166, 174, 169 )


class DrawnHex:
  """
  A hex image drawn for a test: land with water areas, and a road probability that is 1 on the
  drawn roads and 0 elsewhere.
  """

  def __init__( self ):
    self.image = Image.new( 'RGB', ( roads.HEX_WIDTH, roads.HEX_HEIGHT ), LAND )
    self.prob = Image.new( 'L', ( roads.HEX_WIDTH, roads.HEX_HEIGHT ), 0 )

  def water( self, box ):
    """
    Draw a rectangle of water.

    @param box tuple ( x0, y0, x1, y1 ) in image pixels
    @return DrawnHex itself
    """
    ImageDraw.Draw( self.image ).rectangle( box, fill = WATER )
    return self

  def land( self, box ):
    """
    Draw a rectangle of land (a bridge band over the water).

    @param box tuple ( x0, y0, x1, y1 ) in image pixels
    @return DrawnHex itself
    """
    ImageDraw.Draw( self.image ).rectangle( box, fill = LAND )
    return self

  def road( self, points ):
    """
    Draw a road, 3 px wide, as the classifier would find it.

    @param points list of ( x, y ) in image pixels
    @return DrawnHex itself
    """
    ImageDraw.Draw( self.prob ).line( points, fill = 255, width = 3 )
    return self

  def trace( self, places = () ):
    """
    Run the tracer on the drawing.

    @param places list of Place
    @return HexTracer after its run
    """
    hex_image = roads.HexImage( 'TestHex', { 'col': 0, 'row': 0 } )
    outline = Image.new( 'L', ( roads.HEX_WIDTH, roads.HEX_HEIGHT ), 0 )
    ImageDraw.Draw( outline ).polygon( roads.hexagon(), fill = 255 )
    hex_image.inside = np.array( outline ) > 0
    hex_image.rgb = np.array( self.image ).astype( np.float32 )
    tracer = roads.HexTracer( hex_image, np.array( self.prob ).astype( np.float32 ) / 255, places )
    tracer.run()
    return tracer


def component_count( graph ):
  """
  @param graph Graph
  @return int number of connected pieces of road
  """
  return len( [ c for c in graph.components() if c ] )


def kinds( tracer ):
  """
  @param tracer HexTracer after its run
  @return list of the kinds of closed gaps and links, such as 'band' and 'town'
  """
  return [ kind for kind, _ in tracer.gap_lines ]


class BridgeTest( unittest.TestCase ):
  """
  Bridges are always roads.
  """

  def channel( self, bridge ):
    """
    A channel across the map with roads ending on both banks, in line with a bridge.

    @param bridge bool whether a land band crosses the channel
    @return DrawnHex
    """
    drawn = DrawnHex().water( ( 100, 400, 920, 440 ) )
    if bridge:
      drawn.land( ( 500, 400, 505, 440 ) )
    return drawn.road( [ ( 503, 200 ), ( 503, 385 ) ] ).road( [ ( 503, 455 ), ( 503, 650 ) ] )

  def test_a_land_band_across_water_joins_the_roads_on_both_banks( self ):
    """
    The band is found as a bridge, and becomes a road between the two road ends.
    """
    tracer = self.channel( True ).trace()
    self.assertIn( 'band', kinds( tracer ) )
    self.assertEqual( component_count( tracer.graph ), 1 )

  def test_without_a_band_the_banks_stay_apart( self ):
    """
    Road ends at both banks are not joined over open water.
    """
    tracer = self.channel( False ).trace()
    self.assertNotIn( 'band', kinds( tracer ) )
    self.assertEqual( component_count( tracer.graph ), 2 )

  def test_a_pier_is_no_bridge( self ):
    """
    A land band that touches only one bank leads nowhere.
    """
    drawn = DrawnHex().water( ( 100, 400, 920, 480 ) ).land( ( 500, 400, 505, 450 ) )
    tracer = drawn.road( [ ( 503, 200 ), ( 503, 385 ) ] ).trace()
    bridges = tracer.find_bridges()
    self.assertEqual( bridges, [] )

  def test_the_banks_of_a_bridge_are_found( self ):
    """
    The bank points lie at the two ends of the band.
    """
    tracer = self.channel( True ).trace()
    tracer.graph = roads.Graph()
    bridges = tracer.find_bridges()
    self.assertEqual( len( bridges ), 1 )
    ys = sorted( ( bridges[ 0 ][ 'p' ][ 1 ], bridges[ 0 ][ 'q' ][ 1 ] ) )
    self.assertLess( abs( ys[ 0 ] - 400 ), 6 )
    self.assertLess( abs( ys[ 1 ] - 440 ), 6 )


class TownTest( unittest.TestCase ):
  """
  Towns are never dead ends.
  """

  def corner( self ):
    """
    Two roads that end at the edge of a town, at right angles, too far apart and not facing
    each other, so no other rule joins them.

    @return DrawnHex
    """
    return DrawnHex().road( [ ( 100, 600 ), ( 240, 600 ) ] ).road( [ ( 300, 800 ), ( 300, 660 ) ] )

  def test_road_ends_in_a_town_are_led_on_through_it( self ):
    """
    Both road ends are linked through the town, so the roads are one network.
    """
    tracer = self.corner().trace( [ roads.Place( 'Town', 300, 600, True ) ] )
    self.assertIn( 'town', kinds( tracer ) )
    self.assertEqual( component_count( tracer.graph ), 1 )

  def test_without_a_town_the_road_ends_stay_apart( self ):
    """
    The same roads without a place stay two pieces.
    """
    tracer = self.corner().trace()
    self.assertEqual( component_count( tracer.graph ), 2 )

  def test_a_minor_place_needs_two_road_ends( self ):
    """
    A minor place name with a single road end is no town: nothing is added.
    """
    drawn = DrawnHex().road( [ ( 100, 600 ), ( 240, 600 ) ] )
    tracer = drawn.trace( [ roads.Place( 'Hill', 290, 600, False ) ] )
    self.assertNotIn( 'town', kinds( tracer ) )
    self.assertEqual( len( tracer.graph.edges ), 1 )

  def test_a_town_link_never_crosses_water( self ):
    """
    With a river through the town and no bridge, the two banks stay apart.
    """
    drawn = self.corner().water( ( 255, 300, 275, 880 ) )
    tracer = drawn.trace( [ roads.Place( 'Town', 300, 600, True ) ] )
    self.assertEqual( component_count( tracer.graph ), 2 )

  def test_a_road_end_pointing_away_from_the_town_is_left_alone( self ):
    """
    A road that leaves the town and ends outside it is not led back.
    """
    drawn = DrawnHex().road( [ ( 300, 600 ), ( 300, 520 ) ] ).road( [ ( 100, 700 ), ( 400, 700 ) ] )
    tracer = drawn.trace( [ roads.Place( 'Town', 300, 600, True ) ] )
    ends = [ n for n in tracer.graph.nodes if tracer.graph.degree( n ) == 1 ]
    self.assertTrue( any( abs( tracer.graph.nodes[ n ][ 1 ] - 520 ) < 4 for n in ends ) )


class PlaceTest( unittest.TestCase ):
  """
  Places come from the world data.
  """

  def test_regions_are_towns_and_labels_minor_places( self ):
    """
    Region labels are towns with the town radius; other labels are minor places, unless they
    repeat a town's name close by.
    """
    item = {
      'areas': { 'Saltbrook Channel': { 'x': 0.3, 'y': 0.38, 'points': '' } },
      'labels': [ { 'x': 0.3, 'y': 0.45, 'text': 'Liegehearth' }, { 'x': 0.3, 'y': 0.39, 'text': 'Saltbrook Channel' } ]
    }
    places = roads.Place.of_hex( item )
    self.assertEqual( [ ( p.name, p.town ) for p in places ], [ ( 'Saltbrook Channel', True ), ( 'Liegehearth', False ) ] )
    self.assertEqual( places[ 0 ].radius, roads.TOWN_RADIUS )
    self.assertEqual( places[ 1 ].radius, roads.VILLAGE_RADIUS )
    self.assertAlmostEqual( places[ 0 ].x, 0.3 * roads.HEX_WIDTH )
    self.assertLess( places[ 0 ].reach( places[ 0 ].x + roads.TOWN_RADIUS / 2, places[ 0 ].y ), 1 )


if __name__ == '__main__':
  unittest.main()
