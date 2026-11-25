#!/usr/bin/env python3
"""
Extract the Foxhole road network from the hex map images into one graph.

What it does
  1. Reads every hex of the world from .app/src/stores/world_data.json and its current map
     image, assets/maps/classic/<hex>.webp (the images the app shows, rebuilt from the War API;
     the .png files next to them are from 2022 and outdated for many hexes).
  2. Trains a pixel classifier (gradient boosting on colour, top-hat and Hessian features),
     in two stages: the second also sees the first stage's probability at larger scales
     (auto-context), which suppresses speckled terrain. The labels come from the 2022 maps in
     assets/maps/color, which draw roads in yellow, for the hexes whose yellow roads still
     match the current image (agreement >= 95 %).
  3. Predicts a road probability per pixel for every hex, thresholds it with hysteresis,
     skeletonizes it and traces the skeleton into a graph of junctions and road pieces.
  4. Cleans the graph: drops blobs, weak edges (stricter in mottled terrain), short spurs and
     tiny pieces, and closes gaps: short gaps the image supports, bridges (a thin light line
     over the gap) and road ends that point at each other over land.
  5. Applies two rules the images cannot show by themselves. Bridges are always roads: a
     narrow land band across water, with a town or a road end on both banks, becomes a road.
     Towns are never dead ends: every road end inside a town (a region's name label, or a
     minor place name with at least two road ends) is led on through the town, over land and
     not over water, to the nearest other road or to the town centre.
     Then roads that touch are joined: where two roads pass each other a few pixels apart (a
     junction whose middle the skeleton went round, a link over a street), or a road end lies
     in the same patch of road as another road, with road and not water between them, while
     the roads only join them a long way round.
  6. Moves everything to world map pixels and joins roads that cross a hex border to the
     road of the neighbouring hex.
  7. Writes assets/data/roads.json, and optionally an overlay image per hex for checking.

How to run (from the repository root)
  python -m venv .venv-roads
  .venv-roads/Scripts/python -m pip install -r .scripts/roads/requirements.txt
  .venv-roads/Scripts/python .scripts/roads/extract-roads.py [options]

Options
  --overlays DIR   also write <hex>.png overlays (roads over the dimmed map) and world.png
  --cache DIR      keep the probability maps there and reuse them on the next run
  --hex NAME       only process these hexes (repeatable; world data keys); for testing,
                   writes no json unless --out is given
  --out FILE       output file (default assets/data/roads.json)

Inputs
  .app/src/stores/world_data.json   hex keys, grid positions, and the place names (region
                                    labels and minor labels) used as towns
  assets/maps/classic/*.webp        current hex maps, 1024 x 888 px each
  assets/maps/color/*.png           2022 maps with yellow roads (training labels only)
  .scripts/roads/corrections.json   optional manual corrections (see the report)

Output
  assets/data/roads.json, in world map pixels (1 px is about 2.13 m):
  { "version": 1, "generated": "YYYY-MM-DD", "source": "...", "nodes": [ [ x, y ], ... ],
    "edges": [ { "a": i, "b": j, "hex": "<world data key>", "length": px,
                 "points": [ [ x, y ], ... ] }, ... ] }

The method, parameters and known gaps are in .docs/research/2026-11-25-road-extraction.md.
"""

import argparse
import datetime
import heapq
import json
import math
import os
import time
import warnings

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.filters import apply_hysteresis_threshold
from skimage.graph import MCP_Geometric
from skimage.measure import approximate_polygon
from skimage.morphology import closing, disk, opening, remove_small_holes, remove_small_objects, skeletonize
from sklearn.ensemble import HistGradientBoostingClassifier

warnings.filterwarnings( 'ignore' )

ROOT = os.path.abspath( os.path.join( os.path.dirname( os.path.abspath( __file__ ) ), '..', '..' ) )
WORLD_FILE = os.path.join( ROOT, '.app', 'src', 'stores', 'world_data.json' )
CLASSIC_DIR = os.path.join( ROOT, 'assets', 'maps', 'classic' )
COLOR_DIR = os.path.join( ROOT, 'assets', 'maps', 'color' )
CORRECTIONS_FILE = os.path.join( os.path.dirname( os.path.abspath( __file__ ) ), 'corrections.json' )
OUT_FILE = os.path.join( ROOT, 'assets', 'data', 'roads.json' )

# hex image size and grid steps, as in .app/src/stores/grid.js
HEX_WIDTH = 1024
HEX_HEIGHT = 888
COLUMN_FACTOR = 1.333
ROW_FACTOR = 2

# training: hexes whose 2022 yellow roads match the current image at least this well
TRAIN_AGREEMENT = 0.95
TRAIN_POSITIVES = 15000
TRAIN_NEGATIVES = 45000

# thresholds on the road probability (hysteresis: strong seeds, weaker continuation)
PROB_HIGH = 0.8
PROB_LOW = 0.45
# an edge is dropped when its mean probability is below this
EDGE_MIN_PROB = 0.55
# mottled terrain: share of middling probabilities (0.1-0.8) in a window above MOTTLE; there an
# edge needs MOTTLE_EDGE_PROB, gaps are only closed between facing ends, and loose pieces
# shorter than MOTTLE_COMPONENT are dropped
MOTTLE = 0.3
MOTTLE_WINDOW = 31
MOTTLE_EDGE_PROB = 0.8
MOTTLE_COMPONENT = 120

# graph clean-up, in image pixels (one pixel is about 2.13 m)
SPUR_LENGTH = 14            # dead ends shorter than this, off a junction, are dropped
MIN_COMPONENT = 45          # pieces shorter than this are dropped ...
MIN_BORDER_COMPONENT = 12   # ... or than this when they reach the hex border
BLOB_WIDTH = 8.0            # median half-width above this: a filled area, not a road
GAP_END_TO_END = 40         # short gaps: road end to road end ...
GAP_END_TO_EDGE = 18        # ... or road end to the side of a road
GAP_ANGLE = 50              # at most this far off the direction of the road end, in degrees
GAP_MIN_PROB = 0.12         # with at least this mean probability along the gap
BRIDGE_LENGTH = 60          # bridges: up to this long, BRIDGE_ANGLE straight ahead, and a
BRIDGE_ANGLE = 25           # thin light line along BRIDGE_LINE of the gap
BRIDGE_LINE = 0.85
FACING_LENGTH = 70          # road ends pointing at each other within FACING_ANGLE, with at
FACING_ANGLE = 25           # most FACING_MAX_WATER of the line over water
FACING_MAX_WATER = 0.3
BORDER_DISTANCE = 14        # road ends this close to the hex border may join a neighbour ...
BORDER_SNAP = 26            # ... road end up to this far away
SIMPLIFY = 1.5              # Douglas-Peucker tolerance for the polylines
CORRECTION_SNAP = 8         # the ends of a road added by hand snap to a node, else a road, this close

# bridges are always roads: a land band at most BRIDGE_WIDTH wide that interrupts water (found
# by closing the water mask), touching land at two banks BRIDGE_SPAN apart and water along at
# least BRIDGE_WATER_SIDE of its outline; skipped when a traced road runs within 3 px of
# BRIDGE_TRACED of the straight line between the banks, or already joins them closely
BRIDGE_WIDTH = 12
BRIDGE_SPAN = ( 6, 160 )
BRIDGE_WATER_SIDE = 0.4
BRIDGE_TRACED = 0.5
BRIDGE_REACH = 30           # a bank outside a town needs a road end this close, pointing at it
BRIDGE_SNAP = 5             # a bank this close to a road is joined to that road directly
BRIDGE_ROAD = 25            # ... and, outside towns, to a road this close over land
BRIDGE_END_ANGLE = 60       # within this many degrees
WATER_MIN = 40              # water areas smaller than this are ignored (speckle)

# towns are never dead ends: road ends within TOWN_RADIUS of a region's name label (which lies
# a median 6 px, at most about 65 px, from its town hall or relic base) or within VILLAGE_RADIUS
# of a minor place name (only when at least VILLAGE_ENDS road ends are there) are led on
# through the town to the nearest other road, link or the town centre, over land, inside the
# circle, and at most TOWN_DETOUR times the straight distance plus TOWN_SLACK
TOWN_RADIUS = 90
VILLAGE_RADIUS = 60
VILLAGE_ENDS = 2
TOWN_ANGLE = 120            # only road ends pointing into the town, within this many degrees
TOWN_CORE = 0.35            # ... unless they lie within this share of the radius from the centre
TOWN_DETOUR = 1.8
TOWN_SLACK = 15
TOWN_STREET = 0.5           # cost per pixel falls to this on pixels that look like a road (1 on land)
TOWN_BEHIND = 25            # a link goes ahead of its road end, never to the roads this close behind it
TOWN_INWARD = 5             # ... and inwards: it reaches a road at least this much closer to the centre
TOWN_ALONGSIDE = 0.35       # ... and is dropped when more than this share runs within 6 px of those roads

# roads that touch are joined: two roads that come within TOUCH_DISTANCE of each other (a
# junction whose middle the skeleton went round, like ")(", or a link that crosses a street),
# while the roads join those two points only by a way longer than TOUCH_DETOUR times their
# distance plus TOUCH_SLACK, get a link where they are closest; the same two roads at most
# once per TOUCH_SPACING. Unless they cross (TOUCH_CROSSING), the gap lies on the road mask
# (at least TOUCH_ON_ROAD of it, with a pixel of slack) and hardly over water
TOUCH_DISTANCE = 10
TOUCH_DETOUR = 4
TOUCH_SLACK = 40
TOUCH_SPACING = 30
TOUCH_CROSSING = 1.5
TOUCH_ON_ROAD = 0.5
TOUCH_MAX_WATER = 0.2
# ... and a road end reaches a road up to TOUCH_END_REACH away, in any direction, when the road
# mask covers at least TOUCH_END_ON_ROAD of the way (one patch of road the clean-up cut through)
TOUCH_END_REACH = 30
TOUCH_END_ON_ROAD = 0.9


def hexagon():
  """
  Corners of the flat-topped hexagon inside a hex image, in image pixels.

  @return list of six ( x, y ) tuples
  """
  w, h = HEX_WIDTH, HEX_HEIGHT
  return [ ( w / 4, 0 ), ( w * 3 / 4, 0 ), ( w, h / 2 ), ( w * 3 / 4, h ), ( w / 4, h ), ( 0, h / 2 ) ]


def border_distance( x, y ):
  """
  Distance from a point in image pixels to the hexagon outline.

  @param x float image x
  @param y float image y
  @return float distance in pixels
  """
  corners = hexagon()
  best = float( 'inf' )
  for i in range( 6 ):
    ax, ay = corners[ i ]
    bx, by = corners[ ( i + 1 ) % 6 ]
    dx, dy = bx - ax, by - ay
    t = max( 0.0, min( 1.0, ( ( x - ax ) * dx + ( y - ay ) * dy ) / ( dx * dx + dy * dy ) ) )
    best = min( best, math.hypot( x - ax - t * dx, y - ay - t * dy ) )
  return best


class HexImage:
  """
  One hex: its world data key, grid position, image and the mask of the hexagon.
  """

  def __init__( self, key, item ):
    """
    @param key string world data key, such as DeadLandsHex
    @param item dict the world data entry with col and row
    """
    self.key = key
    self.file = key.lower().replace( 'hex', '' ).replace( 'map', '' )
    self.x0 = int( item[ 'col' ] * HEX_WIDTH / COLUMN_FACTOR )
    self.y0 = int( item[ 'row' ] * HEX_HEIGHT / ROW_FACTOR )
    self.rgb = None
    self.inside = None

  def load( self ):
    """
    Load the current map image; pixels outside the hexagon get the nearest inside colour, so
    filters do not see a hard edge there.

    @return bool whether the image exists
    """
    path = os.path.join( CLASSIC_DIR, self.file + '.webp' )
    if not os.path.exists( path ):
      return False
    a = np.array( Image.open( path ).convert( 'RGBA' ) ).astype( np.float32 )
    self.inside = a[ :, :, 3 ] > 200
    _, idx = ndi.distance_transform_edt( ~self.inside, return_indices = True )
    self.rgb = a[ :, :, :3 ][ idx[ 0 ], idx[ 1 ] ]
    return True

  def yellow( self ):
    """
    The roads of the 2022 colour map, drawn in yellow, as a mask.

    @return numpy bool array, or an empty array when there is no colour map
    """
    path = os.path.join( COLOR_DIR, self.file + '.png' )
    if not os.path.exists( path ):
      return np.zeros( 0, bool )
    c = np.array( Image.open( path ).convert( 'RGBA' ) ).astype( int )
    y = ( c[ :, :, 0 ] - c[ :, :, 2 ] > 60 ) & ( c[ :, :, 0 ] > 195 ) & ( c[ :, :, 3 ] > 200 )
    return remove_small_objects( y, 30 )

  def to_world( self, x, y ):
    """
    @param x float image x
    @param y float image y
    @return tuple ( x, y ) in world map pixels
    """
    return ( self.x0 + x, self.y0 + y )


class Place:
  """
  A named place of a hex that roads must not dead-end in: a town (a region's name label, next
  to its town hall or relic base) or a minor place name (a village, or a landmark), in image
  pixels.
  """

  def __init__( self, name, x, y, town ):
    """
    @param name string place name
    @param x float image x
    @param y float image y
    @param town bool whether it is a region's town (else a minor place name)
    """
    self.name = name
    self.x = float( x )
    self.y = float( y )
    self.town = town
    self.radius = TOWN_RADIUS if town else VILLAGE_RADIUS
    # road ends (and bridge banks) needed before the place is linked at all
    self.minimum = 1 if town else VILLAGE_ENDS

  @staticmethod
  def of_hex( item ):
    """
    The places of one hex from its world data entry: the region labels as towns, the other
    labels as minor places (left out when they repeat a town's name close by).

    @param item dict world data entry with areas ( name: { x, y } ) and labels ( [ { x, y, text } ] )
    @return list of Place
    """
    towns = [ Place( name, a[ 'x' ] * HEX_WIDTH, a[ 'y' ] * HEX_HEIGHT, True )
              for name, a in sorted( ( item.get( 'areas' ) or {} ).items() ) ]
    minors = []
    for label in item.get( 'labels' ) or []:
      place = Place( label[ 'text' ], label[ 'x' ] * HEX_WIDTH, label[ 'y' ] * HEX_HEIGHT, False )
      if any( t.name == place.name and math.hypot( t.x - place.x, t.y - place.y ) < VILLAGE_RADIUS for t in towns ):
        continue
      minors.append( place )
    return towns + minors

  def reach( self, x, y ):
    """
    Distance from the place relative to its radius: at most 1 inside it.

    @param x float image x
    @param y float image y
    @return float
    """
    return math.hypot( x - self.x, y - self.y ) / self.radius


class RoadClassifier:
  """
  Pixel classifier that gives every pixel of a hex image a road probability.
  """

  def __init__( self ):
    self.model = None
    self.model2 = None

  @staticmethod
  def features( rgb ):
    """
    Per-pixel features: colour, white and black top-hats at several radii (thin light or dark
    lines), Hessian eigenvalues (line shape), and local statistics (the terrain around).

    @param rgb numpy float array ( h, w, 3 )
    @return numpy float32 array ( h, w, n )
    """
    f = []
    sm = ndi.gaussian_filter( rgb, ( 0.7, 0.7, 0 ) )
    lum = sm.mean( 2 )
    sat = sm.max( 2 ) - sm.min( 2 )
    f += [ sm[ :, :, 0 ], sm[ :, :, 1 ], sm[ :, :, 2 ], lum, sat, sm[ :, :, 2 ] - sm[ :, :, 0 ] ]
    for r in ( 2, 3, 4, 6 ):
      f.append( lum - opening( lum, disk( r ) ) )
      f.append( closing( lum, disk( r ) ) - lum )
    f.append( closing( lum, disk( 4 ) ) )
    f.append( opening( lum, disk( 4 ) ) )
    for s in ( 1.5, 2.5, 4.0 ):
      hrr = ndi.gaussian_filter( lum, s, order = ( 2, 0 ) )
      hcc = ndi.gaussian_filter( lum, s, order = ( 0, 2 ) )
      hrc = ndi.gaussian_filter( lum, s, order = ( 1, 1 ) )
      root = np.sqrt( ( hrr - hcc ) ** 2 + 4 * hrc ** 2 )
      f.append( ( hrr + hcc + root ) / 2 * s * s )
      f.append( ( hrr + hcc - root ) / 2 * s * s )
    for w in ( 15, 41 ):
      m = ndi.uniform_filter( lum, w )
      f.append( m )
      f.append( np.sqrt( np.maximum( ndi.uniform_filter( lum * lum, w ) - m * m, 0 ) ) )
      f.append( ndi.uniform_filter( sat, w ) )
    pale = ( sat <= 22 ) & ( lum >= 190 )
    f.append( ndi.uniform_filter( pale.astype( np.float32 ), 41 ) )
    for i in range( 3 ):
      f.append( ndi.gaussian_filter( sm[ :, :, i ], 5 ) )
    return np.stack( [ x.astype( np.float32 ) for x in f ], 2 )

  @staticmethod
  def agreement( hex_image, yellow ):
    """
    Share of the 2022 yellow road centre lines that still lie on a thin line in the current
    image; low when the hex was reworked since 2022.

    @param hex_image HexImage loaded hex
    @param yellow numpy bool array yellow road mask
    @return float between 0 and 1
    """
    lum = ndi.gaussian_filter( hex_image.rgb, ( 0.7, 0.7, 0 ) ).mean( 2 )
    th = np.maximum( lum - opening( lum, disk( 4 ) ), closing( lum, disk( 4 ) ) - lum )
    strong = ndi.maximum_filter( th, 5 ) > 10
    sk = skeletonize( yellow & hex_image.inside ) & ndi.binary_erosion( hex_image.inside, iterations = 8 )
    if not sk.any():
      return 0.0
    return float( strong[ sk ].mean() )

  @staticmethod
  def context( p ):
    """
    Auto-context features from a first road probability: the probability smoothed, its local
    density (high in speckled terrain), and its own line shape.

    @param p numpy float array first-stage probability
    @return numpy float32 array ( h, w, n )
    """
    f = [ p, ndi.gaussian_filter( p, 2 ), ndi.gaussian_filter( p, 5 ), ndi.uniform_filter( p, 41 ),
          ndi.maximum_filter( p, 7 ), p - opening( p, disk( 6 ) ) ]
    for s in ( 2.0, 4.0 ):
      hrr = ndi.gaussian_filter( p, s, order = ( 2, 0 ) )
      hcc = ndi.gaussian_filter( p, s, order = ( 0, 2 ) )
      hrc = ndi.gaussian_filter( p, s, order = ( 1, 1 ) )
      root = np.sqrt( ( hrr - hcc ) ** 2 + 4 * hrc ** 2 )
      f.append( ( hrr + hcc + root ) / 2 * s * s )
      f.append( ( hrr + hcc - root ) / 2 * s * s )
    return np.stack( [ x.astype( np.float32 ) for x in f ], 2 )

  @staticmethod
  def new_model():
    """
    @return HistGradientBoostingClassifier with the parameters used for both stages
    """
    return HistGradientBoostingClassifier( max_iter = 300, learning_rate = 0.1, max_leaf_nodes = 63, random_state = 0 )

  def samples( self, h, yellow, rng ):
    """
    Training pixels of one hex: positives on the yellow centre lines (where the current image
    still has a thin line), negatives well away from any yellow road.

    @return tuple ( pixel coordinates array, labels array )
    """
    F = self.features( h.rgb )
    y = yellow & h.inside
    th = np.maximum( F[ :, :, 7 ], F[ :, :, 8 ] )
    core = ndi.binary_dilation( skeletonize( y ), iterations = 1 ) & ( ndi.maximum_filter( th, 3 ) > 8 )
    far = ~ndi.binary_dilation( y, iterations = 6 )
    ins = ndi.binary_erosion( h.inside, iterations = 2 )
    pos = np.argwhere( core & ins )
    neg = np.argwhere( far & ins )
    pos = pos[ rng.choice( len( pos ), min( TRAIN_POSITIVES, len( pos ) ), replace = False ) ]
    neg = neg[ rng.choice( len( neg ), min( TRAIN_NEGATIVES, len( neg ) ), replace = False ) ]
    return np.concatenate( [ pos, neg ] ), np.r_[ np.ones( len( pos ) ), np.zeros( len( neg ) ) ]

  def train( self, hexes, folds = 4 ):
    """
    Train both stages on the hexes whose colour map still matches. The second stage learns
    from first-stage probabilities of models that did not see that hex (out of fold), so it
    learns how the first stage errs on unseen images.

    @param hexes list of loaded HexImage
    @param folds int number of folds for the out-of-fold first stage
    @return list of the hex keys used for training
    """
    rng = np.random.default_rng( 1 )
    train = []
    for h in hexes:
      yellow = h.yellow()
      if yellow.size and self.agreement( h, yellow ) >= TRAIN_AGREEMENT:
        idx, labels = self.samples( h, yellow, rng )
        rows = self.features( h.rgb )[ idx[ :, 0 ], idx[ :, 1 ] ]
        train.append( ( h, idx, labels, rows ) )
    fit = lambda items, col: self.new_model().fit( np.concatenate( [ t[ col ] for t in items ] ), np.concatenate( [ t[ 2 ] for t in items ] ) )
    self.model = fit( train, 3 )
    stage2 = []
    for k in range( folds ):
      held = train[ k::folds ]
      model = fit( [ t for t in train if not any( t is u for u in held ) ], 3 )
      for h, idx, labels, rows in held:
        p = self.stage1( h, model )
        ctx = self.context( p )[ idx[ :, 0 ], idx[ :, 1 ] ]
        stage2.append( ( h, idx, labels, np.concatenate( [ rows, ctx ], 1 ) ) )
    self.model2 = fit( stage2, 3 )
    return [ t[ 0 ].key for t in train ]

  @staticmethod
  def stage1( hex_image, model ):
    """
    @return numpy float32 array first-stage probability, 0 outside the hexagon
    """
    F = RoadClassifier.features( hex_image.rgb )
    ins = ndi.binary_erosion( hex_image.inside, iterations = 2 )
    p = np.zeros( ins.shape, np.float32 )
    p[ ins ] = model.predict_proba( F[ ins ] )[ :, 1 ]
    return p

  def predict( self, hex_image ):
    """
    @param hex_image HexImage loaded hex
    @return numpy float32 array road probability per pixel, 0 outside the hexagon
    """
    F = self.features( hex_image.rgb )
    ins = ndi.binary_erosion( hex_image.inside, iterations = 2 )
    p1 = np.zeros( ins.shape, np.float32 )
    p1[ ins ] = self.model.predict_proba( F[ ins ] )[ :, 1 ]
    G = np.concatenate( [ F, self.context( p1 ) ], 2 )
    p = np.zeros( ins.shape, np.float32 )
    p[ ins ] = self.model2.predict_proba( G[ ins ] )[ :, 1 ]
    return p


class Graph:
  """
  An undirected graph of road pieces with polylines, in image or world pixels.
  """

  def __init__( self ):
    self.nodes = {}
    self.edges = {}
    self.adj = {}
    self.next_node = 0
    self.next_edge = 0

  def add_node( self, x, y ):
    """
    @return int node id
    """
    n = self.next_node
    self.next_node += 1
    self.nodes[ n ] = ( float( x ), float( y ) )
    self.adj[ n ] = set()
    return n

  def add_edge( self, a, b, pts, **data ):
    """
    @param a int node id at pts[ 0 ]
    @param b int node id at pts[ -1 ]
    @param pts list of ( x, y )
    @return int edge id
    """
    e = self.next_edge
    self.next_edge += 1
    self.edges[ e ] = dict( a = a, b = b, pts = [ ( float( x ), float( y ) ) for x, y in pts ], **data )
    self.adj[ a ].add( e )
    self.adj[ b ].add( e )
    return e

  def remove_edge( self, e, keep_nodes = False ):
    """
    Remove an edge; nodes left without edges are removed too, unless keep_nodes.
    """
    edge = self.edges.pop( e )
    for n in { edge[ 'a' ], edge[ 'b' ] }:
      self.adj[ n ].discard( e )
      if not self.adj[ n ] and not keep_nodes:
        del self.adj[ n ]
        del self.nodes[ n ]

  def degree( self, n ):
    """
    @return int number of edge ends at the node (a loop counts twice)
    """
    return sum( 2 if self.edges[ e ][ 'a' ] == self.edges[ e ][ 'b' ] else 1 for e in self.adj[ n ] )

  @staticmethod
  def length( pts ):
    """
    @return float polyline length
    """
    a = np.asarray( pts )
    if len( a ) < 2:
      return 0.0
    return float( np.hypot( *np.diff( a, axis = 0 ).T ).sum() )

  @staticmethod
  def densify( pts, step = 1.0 ):
    """
    @param pts list of ( x, y ) polyline
    @param step float the largest distance between two points of the result
    @return list of ( x, y ): the polyline with points added at most step apart
    """
    out = []
    for ( x0, y0 ), ( x1, y1 ) in zip( pts[ :-1 ], pts[ 1: ] ):
      n = max( 1, int( math.ceil( math.hypot( x1 - x0, y1 - y0 ) / step ) ) )
      out.extend( ( x0 + ( x1 - x0 ) * k / n, y0 + ( y1 - y0 ) * k / n ) for k in range( n ) )
    out.extend( pts[ -1: ] )
    return out

  def oriented( self, e, start ):
    """
    @return list the points of edge e, starting at node start
    """
    edge = self.edges[ e ]
    return list( edge[ 'pts' ] ) if edge[ 'a' ] == start else list( reversed( edge[ 'pts' ] ) )

  def merge_degree2( self ):
    """
    Join the two edges at every node with exactly two (different) edges into one.
    """
    for n in list( self.nodes ):
      if n not in self.adj or len( self.adj[ n ] ) != 2:
        continue
      e1, e2 = list( self.adj[ n ] )
      E1, E2 = self.edges[ e1 ], self.edges[ e2 ]
      if E1[ 'a' ] == E1[ 'b' ] or E2[ 'a' ] == E2[ 'b' ]:
        continue
      if E1.get( 'hex' ) != E2.get( 'hex' ):
        continue
      a = E1[ 'b' ] if E1[ 'a' ] == n else E1[ 'a' ]
      b = E2[ 'b' ] if E2[ 'a' ] == n else E2[ 'a' ]
      pts = self.oriented( e1, a ) + self.oriented( e2, n )[ 1: ]
      data = { k: v for k, v in E1.items() if k not in ( 'a', 'b', 'pts' ) }
      self.remove_edge( e1, keep_nodes = True )
      self.remove_edge( e2, keep_nodes = True )
      del self.adj[ n ]
      del self.nodes[ n ]
      self.add_edge( a, b, pts, **data )

  def components( self ):
    """
    @return list of sets of edge ids, one per connected component
    """
    seen, result = set(), []
    for start in self.nodes:
      if start in seen:
        continue
      stack, edges = [ start ], set()
      seen.add( start )
      while stack:
        n = stack.pop()
        for e in self.adj[ n ]:
          edges.add( e )
          for m in ( self.edges[ e ][ 'a' ], self.edges[ e ][ 'b' ] ):
            if m not in seen:
              seen.add( m )
              stack.append( m )
      result.append( edges )
    return result

  def split( self, e, i ):
    """
    Split edge e at point index i (not an end) into two edges with a new node there.

    @return int the new node id
    """
    edge = self.edges[ e ]
    pts = edge[ 'pts' ]
    data = { k: v for k, v in edge.items() if k not in ( 'a', 'b', 'pts' ) }
    n = self.add_node( *pts[ i ] )
    a, b = edge[ 'a' ], edge[ 'b' ]
    self.remove_edge( e, keep_nodes = True )
    self.add_edge( a, n, pts[ :i + 1 ], **data )
    self.add_edge( n, b, pts[ i: ], **data )
    return n


NEIGHBOURS = [ ( -1, -1 ), ( -1, 0 ), ( -1, 1 ), ( 0, -1 ), ( 0, 1 ), ( 1, -1 ), ( 1, 0 ), ( 1, 1 ) ]


class HexTracer:
  """
  Turns the road probability of one hex into a cleaned graph in image pixels.
  """

  def __init__( self, hex_image, prob, places = () ):
    """
    @param hex_image HexImage loaded hex
    @param prob numpy float array road probability
    @param places list of Place on this hex (towns that roads must not dead-end in)
    """
    self.hex = hex_image
    self.prob = prob
    self.places = list( places )
    self.mask = None
    self.width = None
    self.graph = Graph()
    # gaps closed per rule, and the gap lines themselves as ( kind, points ) (for the overlays)
    self.joins = {}
    self.gap_lines = []
    # bridges and town links added by the two rules, by edge id: ( kind, points )
    self.links = {}
    # pixels no town link may cross: the bands of the bridges added as roads
    self.blocked = np.zeros( prob.shape, bool )
    # probability with a pixel of slack sideways
    self.pmax = ndi.maximum_filter( prob, 3 )
    # share of middling probabilities around each pixel: high in mottled terrain
    mid = ( prob > 0.1 ) & ( prob < 0.8 )
    self.mottle = ndi.uniform_filter( mid.astype( np.float32 ), MOTTLE_WINDOW )
    # thin light lines (bridges), and water (blue-grey: blue at least red, middling light)
    lum = ndi.gaussian_filter( hex_image.rgb, ( 0.7, 0.7, 0 ) ).mean( 2 )
    self.thin = ndi.maximum_filter( lum - opening( lum, disk( 3 ) ) > 6, 3 )
    sm = ndi.gaussian_filter( hex_image.rgb, ( 1.5, 1.5, 0 ) )
    self.water = ( sm[ :, :, 2 ] - sm[ :, :, 0 ] >= 0 ) & ( lum > 135 ) & ( lum < 192 )
    # water for the bridge and town rules: less blurred and up to the shore line (the rim of
    # the water is a little warmer), so the gap a bridge leaves is no wider than the bridge;
    # thin light lines over it (narrow bridges) are not water; small speckles are left out
    fine = ndi.gaussian_filter( hex_image.rgb, ( 0.7, 0.7, 0 ) )
    wet = ( fine[ :, :, 1 ] - fine[ :, :, 0 ] >= -3 ) & ( fine[ :, :, 2 ] - fine[ :, :, 0 ] >= -12 ) & ( lum > 135 ) & ( lum < 200 )
    self.wet = remove_small_objects( wet & ~self.thin & hex_image.inside, WATER_MIN )

  def run( self ):
    """
    @return Graph cleaned graph in image pixels
    """
    self.segment()
    self.trace( skeletonize( self.mask ) )
    self.drop_blobs()
    self.drop_weak()
    self.prune()
    self.bridge_gaps()
    self.prune()
    self.drop_small()
    self.link_bridges_and_towns()
    self.join_touching()
    return self.graph

  def segment( self ):
    """
    Road mask: hysteresis threshold, small pieces dropped and pinholes filled.
    """
    m = apply_hysteresis_threshold( self.prob, PROB_LOW, PROB_HIGH )
    m = remove_small_holes( m, 30 )
    m = remove_small_objects( m, 40 )
    self.mask = m
    self.width = ndi.distance_transform_edt( m )

  def trace( self, sk ):
    """
    Trace a skeleton into nodes (junction clusters and ends) and edges (pixel paths).

    @param sk numpy bool skeleton
    """
    g = self.graph
    count = ndi.convolve( sk.astype( np.uint8 ), np.ones( ( 3, 3 ), np.uint8 ), mode = 'constant' ) - 1
    junction = sk & ( count >= 3 )
    jlab, nj = ndi.label( junction, structure = np.ones( ( 3, 3 ) ) )
    jnode = {}
    if nj:
      centres = ndi.center_of_mass( junction, jlab, range( 1, nj + 1 ) )
      for i, ( r, c ) in enumerate( centres ):
        jnode[ i + 1 ] = g.add_node( c + 0.5, r + 0.5 )
    rest = sk & ~junction
    slab, ns = ndi.label( rest, structure = np.ones( ( 3, 3 ) ) )
    objects = ndi.find_objects( slab )
    h, w = sk.shape

    def neighbours( r, c, lab ):
      for dr, dc in NEIGHBOURS:
        rr, cc = r + dr, c + dc
        if 0 <= rr < h and 0 <= cc < w and slab[ rr, cc ] == lab:
          yield ( rr, cc )

    def junctions_at( r, c ):
      for dr, dc in NEIGHBOURS:
        rr, cc = r + dr, c + dc
        if 0 <= rr < h and 0 <= cc < w and jlab[ rr, cc ]:
          return jlab[ rr, cc ]
      return 0

    for lab in range( 1, ns + 1 ):
      sl = objects[ lab - 1 ]
      pix = [ ( r + sl[ 0 ].start, c + sl[ 1 ].start ) for r, c in np.argwhere( slab[ sl ] == lab ) ]
      ends = [ p for p in pix if sum( 1 for _ in neighbours( p[ 0 ], p[ 1 ], lab ) ) <= 1 ]
      start = ends[ 0 ] if ends else pix[ 0 ]
      path, seen = [ start ], { start }
      while True:
        cand = [ q for q in neighbours( path[ -1 ][ 0 ], path[ -1 ][ 1 ], lab ) if q not in seen ]
        if not cand:
          break
        cand.sort( key = lambda q: sum( 1 for x in neighbours( q[ 0 ], q[ 1 ], lab ) if x not in seen ) )
        path.append( cand[ 0 ] )
        seen.add( cand[ 0 ] )
      pts = [ ( c + 0.5, r + 0.5 ) for r, c in path ]
      ja, jb = junctions_at( *path[ 0 ] ), junctions_at( *path[ -1 ] )
      if not ends and ja:
        a = b = jnode[ ja ]
      else:
        a = jnode[ ja ] if ja else g.add_node( *pts[ 0 ] )
        if len( path ) == 1 and ja:
          others = [ jlab[ path[ 0 ][ 0 ] + dr, path[ 0 ][ 1 ] + dc ] for dr, dc in NEIGHBOURS
                     if 0 <= path[ 0 ][ 0 ] + dr < h and 0 <= path[ 0 ][ 1 ] + dc < w ]
          others = [ j for j in others if j and j != ja ]
          jb = others[ 0 ] if others else 0
        b = jnode[ jb ] if jb else ( a if not ends else g.add_node( *pts[ -1 ] ) )
      pts = [ g.nodes[ a ] ] + pts + [ g.nodes[ b ] ]
      g.add_edge( a, b, pts )
    for n in list( g.nodes ):
      if not g.adj[ n ]:
        del g.adj[ n ]
        del g.nodes[ n ]
    g.merge_degree2()

  def sample( self, arr, pts ):
    """
    @return numpy array of arr at the polyline points
    """
    p = np.asarray( pts )
    r = np.clip( p[ :, 1 ].astype( int ), 0, arr.shape[ 0 ] - 1 )
    c = np.clip( p[ :, 0 ].astype( int ), 0, arr.shape[ 1 ] - 1 )
    return arr[ r, c ]

  def drop_blobs( self ):
    """
    Remove edges that run through wide filled areas (town plots, fields) rather than lines.
    """
    g = self.graph
    for e in list( g.edges ):
      pts = g.edges[ e ][ 'pts' ]
      if np.median( self.sample( self.width, pts ) ) > BLOB_WIDTH:
        g.remove_edge( e )
    g.merge_degree2()

  def drop_weak( self ):
    """
    Remove edges whose mean road probability is low: speckled terrain that the threshold let
    through, rarely a real road (those score close to 1). In mottled terrain, where many
    pixels have a middling probability, an edge must score MOTTLE_EDGE_PROB.
    """
    g = self.graph
    for e in list( g.edges ):
      pts = g.edges[ e ][ 'pts' ]
      limit = MOTTLE_EDGE_PROB if self.sample( self.mottle, pts ).mean() > MOTTLE else EDGE_MIN_PROB
      if self.sample( self.prob, pts ).mean() < limit:
        g.remove_edge( e )
    g.merge_degree2()

  def prune( self ):
    """
    Remove short spurs (dead ends off a junction) and repeat until stable.
    """
    g = self.graph
    for _ in range( 4 ):
      removed = False
      for e in list( g.edges ):
        if e not in g.edges:
          continue
        edge = g.edges[ e ]
        da, db = g.degree( edge[ 'a' ] ), g.degree( edge[ 'b' ] )
        if ( da == 1 ) != ( db == 1 ) and g.length( edge[ 'pts' ] ) < SPUR_LENGTH:
          end = edge[ 'a' ] if da == 1 else edge[ 'b' ]
          if border_distance( *g.nodes[ end ] ) < BORDER_DISTANCE:
            continue
          g.remove_edge( e )
          removed = True
        elif edge[ 'a' ] == edge[ 'b' ] and g.length( edge[ 'pts' ] ) < 2 * SPUR_LENGTH:
          g.remove_edge( e )
          removed = True
      g.merge_degree2()
      if not removed:
        break

  def drop_small( self ):
    """
    Remove components shorter than MIN_COMPONENT, unless they touch the hex border (a road
    that continues in the neighbouring hex), and loose pieces shorter than MOTTLE_COMPONENT in
    mottled terrain (left-overs of speckle).
    """
    g = self.graph
    for comp in g.components():
      total = sum( g.length( g.edges[ e ][ 'pts' ] ) for e in comp )
      touches = any( border_distance( *g.nodes[ n ] ) < BORDER_DISTANCE
                     for e in comp for n in ( g.edges[ e ][ 'a' ], g.edges[ e ][ 'b' ] ) )
      mottled = np.concatenate( [ self.sample( self.mottle, g.edges[ e ][ 'pts' ] ) for e in comp ] ).mean() > MOTTLE
      limit = MIN_BORDER_COMPONENT if touches else ( MOTTLE_COMPONENT if mottled else MIN_COMPONENT )
      if total < limit:
        for e in comp:
          g.remove_edge( e )

  def end_direction( self, n ):
    """
    @return numpy unit vector pointing out of a road end, or None
    """
    g = self.graph
    e = next( iter( g.adj[ n ] ) )
    pts = np.asarray( g.oriented( e, n ) )
    back = pts[ min( len( pts ) - 1, 10 ) ]
    d = pts[ 0 ] - back
    norm = np.hypot( *d )
    return d / norm if norm > 2 else None

  def line_fraction( self, arr, p, q ):
    """
    Share of the straight line between two points where a boolean map is set.

    @return float
    """
    steps = max( 2, int( math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ) ) )
    t = np.linspace( 0, 1, steps )
    pts = np.stack( [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * t, p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * t ], 1 )
    return float( self.sample( arr, pts ).mean() )

  def line_support( self, p, q ):
    """
    Mean road probability on the straight line between two points (with a little slack
    sideways, as the gap may be slightly off the line).

    @return float
    """
    steps = max( 2, int( math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] ) ) )
    t = np.linspace( 0, 1, steps )
    pts = np.stack( [ p[ 0 ] + ( q[ 0 ] - p[ 0 ] ) * t, p[ 1 ] + ( q[ 1 ] - p[ 1 ] ) * t ], 1 )
    return float( self.sample( self.pmax, pts ).mean() )

  def bridge_gaps( self ):
    """
    Connect road ends to a facing road end or a road just ahead of them, when the gap is
    short, roughly straight ahead, and the image shows at least a faint road along it. Longer
    gaps straight ahead are joined when a thin light line runs across nearly all of the gap
    (bridges are drawn narrower and dimmer than roads), or when two road ends point at each
    other over land (a road through a town, or over ground of its own colour).
    """
    g = self.graph
    ends = [ n for n in g.nodes if g.degree( n ) == 1 and border_distance( *g.nodes[ n ] ) >= BORDER_DISTANCE ]
    pts, owner = [], []
    for e, edge in g.edges.items():
      for i, p in enumerate( edge[ 'pts' ] ):
        pts.append( p )
        owner.append( ( e, i ) )
    if not ends or not pts:
      return
    tree = cKDTree( np.asarray( pts ) )
    cands = []
    for n in ends:
      d = self.end_direction( n )
      if d is None:
        continue
      p = np.asarray( g.nodes[ n ] )
      own = next( iter( g.adj[ n ] ) )
      for j in tree.query_ball_point( p, max( BRIDGE_LENGTH, FACING_LENGTH ) ):
        e, i = owner[ j ]
        if e == own:
          continue
        q = np.asarray( pts[ j ] )
        v = q - p
        dist = np.hypot( *v )
        if dist < 1:
          continue
        angle = math.degrees( math.acos( max( -1, min( 1, float( v @ d ) / dist ) ) ) )
        if angle > GAP_ANGLE:
          continue
        edge = g.edges[ e ]
        is_end = ( i == 0 and g.degree( edge[ 'a' ] ) == 1 ) or ( i == len( edge[ 'pts' ] ) - 1 and g.degree( edge[ 'b' ] ) == 1 )
        kind = 'gap'
        bridge = dist <= BRIDGE_LENGTH and angle <= BRIDGE_ANGLE and self.line_fraction( self.thin, p, q ) >= BRIDGE_LINE
        if bridge:
          kind = 'bridge'
        elif is_end and dist <= FACING_LENGTH and angle <= FACING_ANGLE:
          back = self.end_direction( edge[ 'a' ] if i == 0 else edge[ 'b' ] )
          facing = back is not None and math.degrees( math.acos( max( -1, min( 1, float( -v @ back ) / dist ) ) ) ) <= FACING_ANGLE
          bridge = facing and self.line_fraction( self.water, p, q ) <= FACING_MAX_WATER
          kind = 'facing' if bridge else kind
        if kind != 'facing' and self.line_fraction( self.mottle > MOTTLE, p, q ) > 0.5:
          continue
        if dist > ( GAP_END_TO_END if is_end else GAP_END_TO_EDGE ) and not bridge:
          continue
        if self.line_support( p, q ) < GAP_MIN_PROB and not bridge:
          continue
        cost = dist * ( 1 + angle / 45 ) * ( 0.7 if is_end else 1.0 )
        cands.append( ( cost, n, tuple( q ), kind ) )
    cands.sort()
    done = set()
    for cost, n, q, kind in cands:
      if n in done or n not in g.nodes or g.degree( n ) != 1:
        continue
      target = self.find_point( q )
      if target is None:
        continue
      e, i = target
      edge = g.edges[ e ]
      if n in ( edge[ 'a' ], edge[ 'b' ] ):
        continue
      if i == 0:
        m = edge[ 'a' ]
      elif i == len( edge[ 'pts' ] ) - 1:
        m = edge[ 'b' ]
      else:
        m = g.split( e, i )
      g.add_edge( n, m, [ g.nodes[ n ], g.nodes[ m ] ], gap = kind )
      self.joins[ kind ] = self.joins.get( kind, 0 ) + 1
      self.gap_lines.append( ( kind, [ g.nodes[ n ], g.nodes[ m ] ] ) )
      done.add( n )
      done.add( m )
    g.merge_degree2()

  def find_point( self, q ):
    """
    @return tuple ( edge id, point index ) of the current edge holding point q, or None
    """
    for e, edge in self.graph.edges.items():
      for i, p in enumerate( edge[ 'pts' ] ):
        if p == q:
          return ( e, i )
    return None

  def link_bridges_and_towns( self ):
    """
    Apply the two rules the images do not show by themselves: bridges are always roads, and
    towns are never dead ends. Bridges come first, so that a town can lead its roads to the
    bridges on its bank; a bridge that still has no road on one of its banks afterwards is
    taken out again.
    """
    g = self.graph
    if not g.edges:
      return
    loose = self.add_bridges( self.find_bridges() )
    for place in self.places:
      centre = self.link_place( place )
      if centre is not None:
        loose.add( centre )
    self.drop_loose( loose )
    for e, ( kind, pts ) in self.links.items():
      self.gap_lines.append( ( kind, pts ) )
      self.joins[ kind ] = self.joins.get( kind, 0 ) + 1
    self.links = {}
    g.merge_degree2()

  def rasterize( self, lines, box, width ):
    """
    Draw polylines into a mask of part of the image.

    @param lines list of polylines, each a list of ( x, y ) in image pixels
    @param box tuple ( r0, r1, c0, c1 ) rows and columns of the part
    @param width int line width in pixels
    @return numpy bool array of the part
    """
    r0, r1, c0, c1 = box
    img = Image.new( 'L', ( c1 - c0, r1 - r0 ), 0 )
    draw = ImageDraw.Draw( img )
    for pts in lines:
      local = [ ( x - 0.5 - c0, y - 0.5 - r0 ) for x, y in pts ]
      if len( local ) > 1:
        draw.line( local, fill = 1, width = width )
      elif local:
        draw.point( local, fill = 1 )
    return np.array( img ) > 0

  def find_bridges( self ):
    """
    Bridges the traced roads do not cross yet. A bridge interrupts the water: closing the
    water mask over bands up to BRIDGE_WIDTH wide fills it. A filled band that touches land at
    two places (the banks) BRIDGE_SPAN apart, has water along most of its sides, and is not
    yet covered by a traced road, is a bridge (or a causeway, which is just as good a road).

    @return list of dicts: p and q, the bank points ( x, y ) in image pixels; box, the slices
            of the image around the band; and band, its mask within the box
    """
    inside = self.hex.inside
    water = self.wet
    closed = ndi.binary_closing( water, structure = disk( BRIDGE_WIDTH // 2 ) )
    band = closed & ~water & inside
    land = ~water & ~band & inside
    h, w = band.shape
    roads = self.rasterize( [ edge[ 'pts' ] for edge in self.graph.edges.values() ], ( 0, h, 0, w ), 7 )
    lab, _ = ndi.label( band, structure = np.ones( ( 3, 3 ) ) )
    found = []
    for i, sl in enumerate( ndi.find_objects( lab ) ):
      if sl is None:
        continue
      box = tuple( slice( max( 0, s.start - 2 ), s.stop + 2 ) for s in sl )
      comp = lab[ box ] == i + 1
      size = comp.sum()
      if size < 6:
        continue
      ring = ndi.binary_dilation( comp, structure = np.ones( ( 3, 3 ) ) ) & ~comp
      if ( ring & water[ box ] ).sum() < BRIDGE_WATER_SIDE * ring.sum():
        continue
      glab, ng = ndi.label( ring & land[ box ], structure = np.ones( ( 3, 3 ) ) )
      groups = [ np.argwhere( glab == j + 1 ).mean( 0 ) for j in range( ng ) if ( glab == j + 1 ).sum() >= 2 ]
      if len( groups ) < 2:
        continue
      span, k, m = max( ( float( np.hypot( *( a - b ) ) ), k, m ) for k, a in enumerate( groups ) for m, b in enumerate( groups ) if k < m )
      if not BRIDGE_SPAN[ 0 ] <= span <= BRIDGE_SPAN[ 1 ]:
        continue
      p = ( float( groups[ k ][ 1 ] + box[ 1 ].start + 0.5 ), float( groups[ k ][ 0 ] + box[ 0 ].start + 0.5 ) )
      q = ( float( groups[ m ][ 1 ] + box[ 1 ].start + 0.5 ), float( groups[ m ][ 0 ] + box[ 0 ].start + 0.5 ) )
      # a band whose straight crossing runs over open water is a curved shore, not a bridge
      if self.line_fraction( water, p, q ) > 0.3:
        continue
      if self.line_fraction( roads, p, q ) >= BRIDGE_TRACED:
        continue
      found.append( dict( p = p, q = q, box = box, band = comp ) )
    return found

  def place_at( self, x, y ):
    """
    The place a point belongs to: the one it lies deepest inside, relative to the radius.

    @param x float image x
    @param y float image y
    @return Place or None when the point lies in no place
    """
    best = min( self.places, key = lambda place: place.reach( x, y ), default = None )
    return best if best is not None and best.reach( x, y ) <= 1 else None

  def end_towards( self, xy ):
    """
    The road end that leads to a bridge bank: within BRIDGE_REACH, pointing at it within
    BRIDGE_END_ANGLE, on the same bank (the line to it hardly crosses water), not at the hex
    border (those join the neighbouring hex).

    @param xy tuple ( x, y ) bank point in image pixels
    @return int node id or None
    """
    g = self.graph
    p = np.asarray( xy )
    best = None
    for n, node in g.nodes.items():
      if g.degree( n ) != 1 or border_distance( *node ) < BORDER_DISTANCE:
        continue
      v = p - np.asarray( node )
      dist = float( np.hypot( *v ) )
      if dist > BRIDGE_REACH or ( best is not None and dist >= best[ 0 ] ):
        continue
      if dist >= 2:
        d = self.end_direction( n )
        if d is None or math.degrees( math.acos( max( -1, min( 1, float( v @ d ) / dist ) ) ) ) > BRIDGE_END_ANGLE:
          continue
      if self.line_fraction( self.wet, node, xy ) > 0.3:
        continue
      best = ( dist, n )
    return best[ 1 ] if best else None

  def add_bridges( self, bridges ):
    """
    Add the bridges with a road, a town or a road end on both banks as roads. A bank right
    next to a road is joined to it; a bank in a town gets a node of its own, which the town
    links to its streets; a bank outside towns is joined to the road end that leads to it, or
    else to a road close by on the same bank. Banks already joined closely by the roads are
    left alone. The band of every added bridge is blocked for town links, so they never run
    over it a second time.

    @param bridges list from find_bridges
    @return set of the bank node ids made here (taken out again when no town reaches them)
    """
    g = self.graph
    banks = set()
    for bridge in bridges:
      sides = []
      for xy in ( bridge[ 'p' ], bridge[ 'q' ] ):
        road = self.attach( xy, set(), BRIDGE_SNAP )
        if road is not None and road not in sides:
          sides.append( road )
          continue
        if self.place_at( *xy ) is not None:
          sides.append( None )
          continue
        end = self.end_towards( xy )
        if end is None:
          end = self.attach( xy, set(), BRIDGE_ROAD, self.wet )
        if end is None or end in sides:
          break
        sides.append( end )
      if len( sides ) < 2:
        continue
      span = math.hypot( bridge[ 'p' ][ 0 ] - bridge[ 'q' ][ 0 ], bridge[ 'p' ][ 1 ] - bridge[ 'q' ][ 1 ] )
      if None not in sides and self.road_distance( sides[ 0 ], sides[ 1 ], 2 * span + 20 ) is not None:
        continue
      ids = []
      for side, xy in zip( sides, ( bridge[ 'p' ], bridge[ 'q' ] ) ):
        if side is None:
          side = g.add_node( *xy )
          banks.add( side )
        ids.append( side )
      pts = [ g.nodes[ ids[ 0 ] ] ]
      for xy in ( bridge[ 'p' ], bridge[ 'q' ], g.nodes[ ids[ 1 ] ] ):
        if xy != pts[ -1 ]:
          pts.append( xy )
      e = g.add_edge( ids[ 0 ], ids[ 1 ], pts, gap = 'band' )
      self.links[ e ] = ( 'band', pts )
      self.blocked[ bridge[ 'box' ] ] |= bridge[ 'band' ]
    return banks

  def link_place( self, place ):
    """
    Lead every road end in a place on through it, so the town is never a dead end. Road ends
    (and bridge banks) that belong to the place and point into it are taken nearest to the
    centre first; each is led along the cheapest way over land inside the place's circle
    (cheaper where the image looks like a street, never over water or a bridge band, never
    behind the end) to the nearest other road or earlier link that lies closer to the centre
    than the end, or to the centre itself. A link may be at most TOWN_DETOUR times the
    straight distance plus TOWN_SLACK.

    @param place Place
    @return int the centre node when a link reached it, else None
    """
    g = self.graph
    h, w = self.prob.shape
    r = int( place.radius ) + 2
    box = ( max( 0, int( place.y ) - r ), min( h, int( place.y ) + r + 1 ),
            max( 0, int( place.x ) - r ), min( w, int( place.x ) + r + 1 ) )
    r0, r1, c0, c1 = box
    if r1 <= r0 or c1 <= c0:
      return None
    rows, cols = np.mgrid[ r0:r1, c0:c1 ]
    circle = np.hypot( cols + 0.5 - place.x, rows + 0.5 - place.y ) <= place.radius
    open_land = circle & self.hex.inside[ r0:r1, c0:c1 ] & ~self.wet[ r0:r1, c0:c1 ] & ~self.blocked[ r0:r1, c0:c1 ]
    if not open_land.any():
      return None
    cost = np.where( open_land, 1 - ( 1 - TOWN_STREET ) * np.clip( self.pmax[ r0:r1, c0:c1 ], 0, 1 ), np.inf )
    # the centre: the open pixel nearest to the label
    _, nearest = ndi.distance_transform_edt( ~open_land, return_indices = True )
    lr, lc = min( max( int( place.y ) - r0, 0 ), r1 - r0 - 1 ), min( max( int( place.x ) - c0, 0 ), c1 - c0 - 1 )
    cr, cc = int( nearest[ 0 ][ lr, lc ] ), int( nearest[ 1 ][ lr, lc ] )
    centre_xy = ( cc + c0 + 0.5, cr + r0 + 0.5 )
    hub = np.zeros( cost.shape, bool )
    hub[ max( 0, cr - 2 ):cr + 3, max( 0, cc - 2 ):cc + 3 ] = True
    hub &= open_land
    depth = np.hypot( cols + 0.5 - centre_xy[ 0 ], rows + 0.5 - centre_xy[ 1 ] )
    ends = [ n for n in g.nodes if g.degree( n ) == 1 and self.leads_into( n, place, centre_xy ) ]
    if len( ends ) < place.minimum:
      return None
    ends.sort( key = lambda n: math.hypot( g.nodes[ n ][ 0 ] - centre_xy[ 0 ], g.nodes[ n ][ 1 ] - centre_xy[ 1 ] ) )
    roads = self.rasterize( [ edge[ 'pts' ] for edge in g.edges.values() ], box, 3 ) & circle
    centre = None
    for n in ends:
      if n not in g.nodes or g.degree( n ) != 1:
        continue
      near = self.nearby_edges( n, TOWN_BEHIND )
      # a link leads into the town, not along its edge to a road outside it
      reach = math.hypot( g.nodes[ n ][ 0 ] - centre_xy[ 0 ], g.nodes[ n ][ 1 ] - centre_xy[ 1 ] )
      inner = depth <= max( reach - TOWN_INWARD, TOWN_CORE * place.radius )
      link = self.street( n, near, cost, box, roads & inner, hub )
      if link is None:
        continue
      path, on_road = link
      if on_road:
        target = self.attach( path[ -1 ], near )
        if target is None or target == n:
          continue
      else:
        if centre is None:
          centre = g.add_node( *centre_xy )
        target = centre
      pts = [ g.nodes[ n ] ] + path[ 1:-1 ] + [ g.nodes[ target ] ]
      e = g.add_edge( n, target, pts, gap = 'town' )
      self.links[ e ] = ( 'town', pts )
      roads |= self.rasterize( [ pts ], box, 3 ) & circle
    return centre

  def leads_into( self, n, place, centre ):
    """
    Whether a road end leads into a place: it lies in the place, away from the hex border, and
    points towards the centre within TOWN_ANGLE, or lies close to the centre anyway. An end
    may lead into two places; the first to link it (towns before minor places) takes it.

    @param n int node id of a road end
    @param place Place
    @param centre tuple ( x, y ) the place's centre in image pixels
    @return bool
    """
    g = self.graph
    x, y = g.nodes[ n ]
    if border_distance( x, y ) < BORDER_DISTANCE or place.reach( x, y ) > 1:
      return False
    v = np.asarray( centre ) - np.asarray( ( x, y ) )
    dist = float( np.hypot( *v ) )
    if dist <= TOWN_CORE * place.radius:
      return True
    d = self.end_direction( n )
    return d is not None and math.degrees( math.acos( max( -1, min( 1, float( v @ d ) / dist ) ) ) ) <= TOWN_ANGLE

  def reachable( self, n, limit ):
    """
    Everything a node reaches over the roads within a distance.

    @param n int node id
    @param limit float distance along the roads in pixels
    @return tuple ( dict node id: distance, set of the edge ids touched on the way )
    """
    g = self.graph
    dist = { n: 0.0 }
    queue = [ ( 0.0, n ) ]
    edges = set()
    while queue:
      d, m = heapq.heappop( queue )
      if d > dist[ m ]:
        continue
      for e in g.adj[ m ]:
        edges.add( e )
        edge = g.edges[ e ]
        other = edge[ 'b' ] if edge[ 'a' ] == m else edge[ 'a' ]
        nd = d + Graph.length( edge[ 'pts' ] )
        if nd < limit and nd < dist.get( other, float( 'inf' ) ):
          dist[ other ] = nd
          heapq.heappush( queue, ( nd, other ) )
    return dist, edges

  def road_distance( self, a, b, limit ):
    """
    The distance between two nodes along the roads, when it is below a limit.

    @param a int node id
    @param b int node id
    @param limit float the largest distance of interest in pixels
    @return float distance, or None when b is not reached within the limit
    """
    return self.reachable( a, limit )[ 0 ].get( b )

  def nearby_edges( self, n, limit ):
    """
    The edges that a road end reaches over the network within a distance: its own road and the
    roads at the junction just behind it. A link from the end may not lead back to those, as it
    would run alongside them.

    @param n int node id
    @param limit float distance along the roads in pixels
    @return set of edge ids
    """
    return self.reachable( n, limit )[ 1 ]

  def street( self, n, near, cost, box, roads, hub ):
    """
    The cheapest way from a road end to another road (not one of the roads just behind it) or
    to the centre of a place, over the cost of the place's circle.

    @param n int node id of the road end
    @param near set of edge ids that are no goal: the end's own road and those just behind it
    @param cost numpy float array cost per pixel of the box, inf where closed
    @param box tuple ( r0, r1, c0, c1 ) the part of the image of the place
    @param roads numpy bool array roads and links so far in the box
    @param hub numpy bool array the centre of the place in the box
    @return tuple ( points from the end to the goal as ( x, y ) image pixels, whether the goal
            is a road ), or None when there is no way within the allowed detour
    """
    g = self.graph
    r0, r1, c0, c1 = box
    x, y = g.nodes[ n ]
    sr, sc = int( y ) - r0, int( x ) - c0
    if not ( 0 <= sr < r1 - r0 and 0 <= sc < c1 - c0 ):
      return None
    own = next( iter( g.adj[ n ] ) )
    # the way leads on ahead of the end: not back along its own road, not behind it, and not
    # to the roads just behind it
    own_road = self.rasterize( [ g.edges[ own ][ 'pts' ] ], box, 5 )
    behind = self.rasterize( [ g.edges[ e ][ 'pts' ] for e in near ], box, 5 )
    back = np.zeros( cost.shape, bool )
    d = self.end_direction( n )
    if d is not None:
      rows, cols = np.mgrid[ r0:r1, c0:c1 ]
      back = ( cols + 0.5 - x ) * d[ 0 ] + ( rows + 0.5 - y ) * d[ 1 ] < -2
    start = np.zeros( cost.shape, bool )
    start[ max( 0, sr - 3 ):sr + 4, max( 0, sc - 3 ):sc + 4 ] = True
    goals = ( ( roads & ~behind ) | hub ) & ~back & ~start
    here = cost.copy()
    here[ ( own_road | back ) & ~start ] = np.inf
    # a goal can always be reached, even a road over water (a traced bridge): the way stops there
    here[ goals & ~np.isfinite( here ) ] = 1.0
    here[ sr, sc ] = min( here[ sr, sc ], 1.0 )
    targets = np.argwhere( goals )
    if not len( targets ):
      return None
    mcp = MCP_Geometric( here )
    reached, _ = mcp.find_costs( [ ( sr, sc ) ], [ tuple( t ) for t in targets ], find_all_ends = False )
    values = reached[ goals ]
    if not np.isfinite( values ).any():
      return None
    gr, gc = targets[ int( np.argmin( values ) ) ]
    path = mcp.traceback( ( int( gr ), int( gc ) ) )
    length = Graph.length( path )
    if length > TOWN_DETOUR * math.hypot( gr - sr, gc - sc ) + TOWN_SLACK:
      return None
    # a way that mostly runs alongside the end's own roads adds nothing but a second line
    zone = self.rasterize( [ g.edges[ e ][ 'pts' ] for e in near ], box, 13 )
    beside = [ zone[ r, c ] for r, c in path[ 5: ] ]
    if beside and sum( beside ) > TOWN_ALONGSIDE * len( path ):
      return None
    points = [ ( c + c0 + 0.5, r + r0 + 0.5 ) for r, c in path ]
    return ( points, bool( roads[ gr, gc ] ) and not behind[ gr, gc ] )

  def attach( self, xy, skip, limit = 3, water = None ):
    """
    The node at the point of a road nearest to xy, splitting the road there when needed.

    @param xy tuple ( x, y ) in image pixels
    @param skip set of edge ids to leave out (the roads the link starts from)
    @param limit float the largest distance to the road in pixels
    @param water numpy bool array, when given: no road across more than 30 % of water
    @return int node id, or None when no road lies within the limit
    """
    g = self.graph
    best = self.nearest_road( xy, skip, limit )
    if best is None:
      return None
    _, e, i, proj = best
    if water is not None and self.line_fraction( water, xy, proj ) > 0.3:
      return None
    pts = g.edges[ e ][ 'pts' ]
    for j in ( i, i + 1 ):
      if math.hypot( pts[ j ][ 0 ] - proj[ 0 ], pts[ j ][ 1 ] - proj[ 1 ] ) <= 1.5:
        return self.node_at( e, j )
    pts.insert( i + 1, proj )
    return self.node_at( e, i + 1 )

  def nearest_road( self, xy, skip, limit ):
    """
    The point of a road nearest to xy.

    @param xy tuple ( x, y ) in image pixels
    @param skip set of edge ids to leave out
    @param limit float the largest distance to the road in pixels
    @return tuple ( distance, edge id, index of the polyline segment, ( x, y ) the point on
            it ), or None when no road lies within the limit
    """
    p = np.asarray( xy )
    best = None
    for e, edge in self.graph.edges.items():
      if e in skip:
        continue
      pts = np.asarray( edge[ 'pts' ] )
      if len( pts ) < 2 or ( pts.min( 0 ) - limit - 1 > p ).any() or ( pts.max( 0 ) + limit + 1 < p ).any():
        continue
      a, d = pts[ :-1 ], np.diff( pts, axis = 0 )
      t = np.clip( ( ( p - a ) * d ).sum( 1 ) / np.maximum( ( d * d ).sum( 1 ), 1e-9 ), 0, 1 )
      proj = a + t[ :, None ] * d
      dist = np.hypot( *( proj - p ).T )
      i = int( np.argmin( dist ) )
      if best is None or dist[ i ] < best[ 0 ]:
        best = ( float( dist[ i ] ), e, i, ( float( proj[ i ][ 0 ] ), float( proj[ i ][ 1 ] ) ) )
    if best is None or best[ 0 ] > limit:
      return None
    return best

  def node_at( self, e, j ):
    """
    The node at point j of edge e: its end node, or a new node splitting the edge there. A
    split link keeps its kind in both halves.

    @param e int edge id
    @param j int point index
    @return int node id
    """
    g = self.graph
    edge = g.edges[ e ]
    if j == 0:
      return edge[ 'a' ]
    if j == len( edge[ 'pts' ] ) - 1:
      return edge[ 'b' ]
    n = g.split( e, j )
    if e in self.links:
      kind = self.links.pop( e )[ 0 ]
      for half in ( g.next_edge - 2, g.next_edge - 1 ):
        self.links[ half ] = ( kind, g.edges[ half ][ 'pts' ] )
    return n

  def drop_loose( self, nodes ):
    """
    Take out the bridges and town links that lead nowhere: a bridge bank that no town link
    reached, a town centre that only one link reached, and whatever leads only to those.

    @param nodes set of node ids of bridge banks and town centres
    """
    g = self.graph
    todo = set( nodes )
    while todo:
      n = todo.pop()
      if n not in g.nodes or g.degree( n ) != 1:
        continue
      e = next( iter( g.adj[ n ] ) )
      edge = g.edges[ e ]
      if edge.get( 'gap' ) not in ( 'band', 'town' ):
        continue
      other = edge[ 'b' ] if edge[ 'a' ] == n else edge[ 'a' ]
      g.remove_edge( e )
      self.links.pop( e, None )
      if other in g.nodes and other in nodes:
        todo.add( other )

  def join_touching( self ):
    """
    Join roads that touch without meeting. Where a junction has an island in its middle, or
    two roads meet at a small square, the skeleton goes round the middle, and the roads pass
    each other a few pixels apart (like ")(") as if one ran over the other; a town link can
    cross a street the same way. Two roads that come within TOUCH_DISTANCE of each other, with
    road (the road mask) and not water between them, while the roads join those two points
    only by a way longer than TOUCH_DETOUR times their distance plus TOUCH_SLACK (or not at
    all), get a short link where they are closest. Roads that meet at a junction are joined
    right there, so they never qualify; two roads with open ground between them do not either.
    A road end reaches further, TOUCH_END_REACH, in any direction, when the road mask runs all
    the way (TOUCH_END_ON_ROAD): the classifier saw one patch of road there, and the clean-up
    (a dropped blob or weak piece at a wide junction) cut the road off.
    """
    g = self.graph
    pts, owner = [], []
    for e, edge in g.edges.items():
      dense = Graph.densify( edge[ 'pts' ] )
      pts.extend( dense )
      owner.extend( [ e ] * len( dense ) )
    if len( pts ) < 2:
      return
    pts = np.asarray( pts )
    owner = np.asarray( owner )
    tree = cKDTree( pts )
    # the road mask with a pixel of slack: a gap between two roads in one patch of road
    on_road = ndi.binary_dilation( self.mask ) if self.mask is not None else np.zeros( self.prob.shape, bool )
    for d, p, q, key, end in self.touch_candidates( pts, owner, tree ):
      if end is not None:
        if end not in g.nodes or g.degree( end ) != 1:
          continue
        if self.line_fraction( self.wet, p, q ) > TOUCH_MAX_WATER or self.line_fraction( on_road, p, q ) < TOUCH_END_ON_ROAD:
          continue
      elif d > TOUCH_CROSSING and ( self.line_fraction( self.wet, p, q ) > TOUCH_MAX_WATER or self.line_fraction( on_road, p, q ) < TOUCH_ON_ROAD ):
        continue
      limit = TOUCH_DETOUR * d + TOUCH_SLACK
      if self.touch_distance( p, q, limit ) <= limit:
        continue
      a = end if end is not None else self.attach( p, set(), 1.5 )
      b = self.attach( q, set( g.adj[ a ] ) if a is not None else set(), 1.5 )
      if a is None or b is None or a == b:
        continue
      line = [ g.nodes[ a ], g.nodes[ b ] ]
      g.add_edge( a, b, line, gap = 'touch' )
      self.joins[ 'touch' ] = self.joins.get( 'touch', 0 ) + 1
      self.gap_lines.append( ( 'touch', line ) )
    g.merge_degree2()

  def touch_candidates( self, pts, owner, tree ):
    """
    The places where two roads come close, closest first: every pair of points of different
    roads within TOUCH_DISTANCE, and every road end with a point of another road within
    TOUCH_END_REACH; of the same two roads only the closest pair within TOUCH_SPACING.

    @param pts numpy array of the road points, densified, in image pixels
    @param owner numpy array the edge id of every point
    @param tree cKDTree of the points
    @return list of tuples ( distance, p, q, ( edge id, edge id ), road end node id or None )
    """
    g = self.graph
    cands = []
    pairs = tree.query_pairs( TOUCH_DISTANCE, output_type = 'ndarray' )
    if len( pairs ):
      pairs = pairs[ owner[ pairs[ :, 0 ] ] != owner[ pairs[ :, 1 ] ] ]
      dist = np.hypot( *( pts[ pairs[ :, 0 ] ] - pts[ pairs[ :, 1 ] ] ).T )
      for ( i, j ), d in zip( pairs, dist ):
        cands.append( ( float( d ), tuple( map( float, pts[ i ] ) ), tuple( map( float, pts[ j ] ) ),
                        ( min( owner[ i ], owner[ j ] ), max( owner[ i ], owner[ j ] ) ), None ) )
    for n in list( g.nodes ):
      if g.degree( n ) != 1 or border_distance( *g.nodes[ n ] ) < BORDER_DISTANCE:
        continue
      own = next( iter( g.adj[ n ] ) )
      p = g.nodes[ n ]
      for j in tree.query_ball_point( p, TOUCH_END_REACH ):
        d = math.hypot( pts[ j ][ 0 ] - p[ 0 ], pts[ j ][ 1 ] - p[ 1 ] )
        if owner[ j ] != own and d > TOUCH_DISTANCE:
          cands.append( ( d, p, tuple( map( float, pts[ j ] ) ), ( min( own, owner[ j ] ), max( own, owner[ j ] ) ), n ) )
    cands.sort( key = lambda c: c[ 0 ] )
    picked, result = {}, []
    for cand in cands:
      d, p, q, key, end = cand
      if any( math.hypot( p[ 0 ] - x, p[ 1 ] - y ) < TOUCH_SPACING for x, y in picked.get( key, [] ) ):
        continue
      picked.setdefault( key, [] ).append( p )
      result.append( cand )
    return result

  def road_position( self, xy ):
    """
    Where a point lies on the roads.

    @param xy tuple ( x, y ) in image pixels, on or right next to a road
    @return tuple ( edge id, distance from the edge's node a along it, edge length ), or None
            when no road lies within 2 px
    """
    near = self.nearest_road( xy, set(), 2 )
    if near is None:
      return None
    _, e, i, proj = near
    pts = self.graph.edges[ e ][ 'pts' ]
    offset = Graph.length( pts[ :i + 1 ] ) + math.hypot( proj[ 0 ] - pts[ i ][ 0 ], proj[ 1 ] - pts[ i ][ 1 ] )
    return ( e, offset, Graph.length( pts ) )

  def touch_distance( self, p, q, limit ):
    """
    The distance between two points on the roads, along the roads, when it is within a limit.

    @param p tuple ( x, y ) a point on a road, in image pixels
    @param q tuple ( x, y ) a point on a road
    @param limit float the largest distance of interest in pixels
    @return float the distance, inf when it is above the limit, 0 when a point is on no road
    """
    g = self.graph
    here, there = self.road_position( p ), self.road_position( q )
    if here is None or there is None:
      return 0.0
    ( e1, o1, l1 ), ( e2, o2, l2 ) = here, there
    best = abs( o1 - o2 ) if e1 == e2 else math.inf
    E1, E2 = g.edges[ e1 ], g.edges[ e2 ]
    for n1, d1 in ( ( E1[ 'a' ], o1 ), ( E1[ 'b' ], l1 - o1 ) ):
      if d1 > min( best, limit ):
        continue
      reached = self.reachable( n1, limit - d1 + 1 )[ 0 ]
      for n2, d2 in ( ( E2[ 'a' ], o2 ), ( E2[ 'b' ], l2 - o2 ) ):
        if n2 in reached:
          best = min( best, d1 + reached[ n2 ] + d2 )
    return best if best <= limit else math.inf


class Network:
  """
  The world road network: all hex graphs in world pixels, joined across hex borders.
  """

  def __init__( self ):
    self.graph = Graph()
    self.border_joins = 0
    self.border = {}
    self.hex_of = {}
    self.gap_lines = []

  def add_hex( self, hex_image, g ):
    """
    Copy a hex graph into the world graph, simplified and in world pixels.

    @param hex_image HexImage
    @param g Graph in image pixels
    """
    W = self.graph
    ids = {}
    for n, ( x, y ) in g.nodes.items():
      ids[ n ] = W.add_node( *hex_image.to_world( x, y ) )
      self.border[ ids[ n ] ] = border_distance( x, y )
      self.hex_of[ ids[ n ] ] = hex_image.key
    for e, edge in g.edges.items():
      pts = np.asarray( edge[ 'pts' ] )
      if len( pts ) > 2:
        pts = approximate_polygon( pts, SIMPLIFY )
      pts = [ hex_image.to_world( x, y ) for x, y in pts ]
      W.add_edge( ids[ edge[ 'a' ] ], ids[ edge[ 'b' ] ], pts, hex = hex_image.key )

  def join_borders( self ):
    """
    Join road ends near a hex border to the nearest road end of a neighbouring hex across that
    border; both ends move to their midpoint and become one node.
    """
    W = self.graph
    ends = [ n for n in W.nodes if W.degree( n ) == 1 and self.border.get( n, 99 ) < BORDER_DISTANCE ]
    if not ends:
      return
    xy = np.asarray( [ W.nodes[ n ] for n in ends ] )
    tree = cKDTree( xy )
    pairs = []
    for i, j in tree.query_pairs( BORDER_SNAP ):
      a, b = ends[ i ], ends[ j ]
      if self.hex_of[ a ] == self.hex_of[ b ]:
        continue
      pairs.append( ( float( np.hypot( *( xy[ i ] - xy[ j ] ) ) ), a, b ) )
    pairs.sort()
    used = set()
    for dist, a, b in pairs:
      if a in used or b in used:
        continue
      used.add( a )
      used.add( b )
      self.merge_nodes( a, b )
      self.border_joins += 1
    # ends left over: join to a road of the neighbouring hex close to the border
    pts, owner = [], []
    for e, edge in W.edges.items():
      for i, p in enumerate( edge[ 'pts' ] ):
        pts.append( p )
        owner.append( ( e, i, edge[ 'hex' ] ) )
    tree = cKDTree( np.asarray( pts ) )
    for n in ends:
      if n in used or n not in W.nodes or W.degree( n ) != 1:
        continue
      best = None
      for j in tree.query_ball_point( W.nodes[ n ], BORDER_SNAP * 0.6 ):
        e, i, hx = owner[ j ]
        if hx == self.hex_of[ n ] or e not in W.edges:
          continue
        d = math.hypot( pts[ j ][ 0 ] - W.nodes[ n ][ 0 ], pts[ j ][ 1 ] - W.nodes[ n ][ 1 ] )
        if best is None or d < best[ 0 ]:
          best = ( d, e, pts[ j ] )
      if best is None:
        continue
      d, e, q = best
      edge = W.edges[ e ]
      idx = edge[ 'pts' ].index( q ) if q in edge[ 'pts' ] else -1
      if idx == 0:
        m = edge[ 'a' ]
      elif idx == len( edge[ 'pts' ] ) - 1:
        m = edge[ 'b' ]
      elif idx > 0:
        m = W.split( e, idx )
        self.hex_of[ m ] = edge[ 'hex' ]
        self.border[ m ] = 0
      else:
        continue
      used.add( n )
      self.move_end( n, W.nodes[ m ] )
      self.merge_nodes( m, n, keep_position = True )
      self.border_joins += 1

  def move_end( self, n, xy ):
    """
    Move a node and the matching end point of its edges.
    """
    W = self.graph
    W.nodes[ n ] = xy
    for e in W.adj[ n ]:
      edge = W.edges[ e ]
      if edge[ 'a' ] == n:
        edge[ 'pts' ][ 0 ] = xy
      if edge[ 'b' ] == n:
        edge[ 'pts' ][ -1 ] = xy

  def merge_nodes( self, a, b, keep_position = False ):
    """
    Merge node b into node a, at their midpoint unless keep_position.
    """
    W = self.graph
    if keep_position:
      xy = W.nodes[ a ]
    else:
      xy = ( ( W.nodes[ a ][ 0 ] + W.nodes[ b ][ 0 ] ) / 2, ( W.nodes[ a ][ 1 ] + W.nodes[ b ][ 1 ] ) / 2 )
    self.move_end( a, xy )
    self.move_end( b, xy )
    for e in list( W.adj[ b ] ):
      edge = W.edges[ e ]
      if edge[ 'a' ] == b:
        edge[ 'a' ] = a
      if edge[ 'b' ] == b:
        edge[ 'b' ] = a
      W.adj[ a ].add( e )
    del W.adj[ b ]
    del W.nodes[ b ]

  def apply_corrections( self, path ):
    """
    Apply manual corrections from a json file, when it exists:
      { "remove": [ [ x0, y0, x1, y1 ], ... ],   boxes in world pixels; edges with their
                                                  middle point inside are dropped
        "add": [ { "hex": "<key>", "points": [ [ x, y ], ... ] }, ... ] }
                                                  roads to add; their ends snap to the
                                                  nearest node within 8 px, else to the
                                                  nearest road within 8 px; an optional
                                                  "note" says why, for people

    @param path string file path
    @return int number of corrections applied
    """
    if not os.path.exists( path ):
      return 0
    with open( path, encoding = 'utf-8' ) as fh:
      data = json.load( fh )
    W = self.graph
    count = 0
    for x0, y0, x1, y1 in data.get( 'remove', [] ):
      for e in list( W.edges ):
        pts = W.edges[ e ][ 'pts' ]
        mx, my = pts[ len( pts ) // 2 ]
        if min( x0, x1 ) <= mx <= max( x0, x1 ) and min( y0, y1 ) <= my <= max( y0, y1 ):
          W.remove_edge( e )
          count += 1
    for road in data.get( 'add', [] ):
      pts = [ tuple( map( float, p ) ) for p in road[ 'points' ] ]
      ends = []
      for p in ( pts[ 0 ], pts[ -1 ] ):
        near = min( W.nodes.items(), key = lambda kv: math.hypot( kv[ 1 ][ 0 ] - p[ 0 ], kv[ 1 ][ 1 ] - p[ 1 ] ), default = None )
        if near and math.hypot( near[ 1 ][ 0 ] - p[ 0 ], near[ 1 ][ 1 ] - p[ 1 ] ) <= CORRECTION_SNAP:
          ends.append( near[ 0 ] )
        else:
          ends.append( self.road_node( p, CORRECTION_SNAP ) )
      pts[ 0 ], pts[ -1 ] = W.nodes[ ends[ 0 ] ], W.nodes[ ends[ 1 ] ]
      W.add_edge( ends[ 0 ], ends[ 1 ], pts, hex = road.get( 'hex', '' ) )
      count += 1
    return count

  def road_node( self, p, limit ):
    """
    A node on the road nearest to a point, splitting the road there; a new loose node when no
    road lies within the limit.

    @param p tuple ( x, y ) in world pixels
    @param limit float the largest distance to the road in pixels
    @return int node id
    """
    W = self.graph
    best = None
    for e, edge in W.edges.items():
      pts = edge[ 'pts' ]
      for i in range( len( pts ) - 1 ):
        ( ax, ay ), ( bx, by ) = pts[ i ], pts[ i + 1 ]
        dx, dy = bx - ax, by - ay
        t = max( 0.0, min( 1.0, ( ( p[ 0 ] - ax ) * dx + ( p[ 1 ] - ay ) * dy ) / max( dx * dx + dy * dy, 1e-9 ) ) )
        q = ( ax + t * dx, ay + t * dy )
        d = math.hypot( q[ 0 ] - p[ 0 ], q[ 1 ] - p[ 1 ] )
        if d <= limit and ( best is None or d < best[ 0 ] ):
          best = ( d, e, i, q )
    if best is None:
      return W.add_node( *p )
    _, e, i, q = best
    edge = W.edges[ e ]
    pts = edge[ 'pts' ]
    for j, n in ( ( 0, edge[ 'a' ] ), ( len( pts ) - 1, edge[ 'b' ] ) ):
      if math.hypot( pts[ j ][ 0 ] - q[ 0 ], pts[ j ][ 1 ] - q[ 1 ] ) < 0.5:
        return n
    pts.insert( i + 1, q )
    return W.split( e, i + 1 )

  def export( self ):
    """
    @return dict the network in the roads.json format
    """
    W = self.graph
    index = {}
    nodes = []
    for n in sorted( W.nodes ):
      if not W.adj.get( n ):
        continue
      index[ n ] = len( nodes )
      x, y = W.nodes[ n ]
      nodes.append( [ round( x, 1 ), round( y, 1 ) ] )
    edges = []
    for e in sorted( W.edges ):
      edge = W.edges[ e ]
      pts = [ [ round( x, 1 ), round( y, 1 ) ] for x, y in edge[ 'pts' ] ]
      edges.append( dict( a = index[ edge[ 'a' ] ], b = index[ edge[ 'b' ] ], hex = edge[ 'hex' ],
                          length = round( Graph.length( edge[ 'pts' ] ), 1 ), points = pts ) )
    return dict( version = 1, generated = datetime.date.today().isoformat(),
                 source = 'traced from assets/maps/classic (current .webp images) by .scripts/roads/extract-roads.py',
                 nodes = nodes, edges = edges )


def write_json( data, path ):
  """
  Write the network compactly: one node or edge per line, no other whitespace.

  @param data dict from Network.export
  @param path string output file
  """
  os.makedirs( os.path.dirname( path ), exist_ok = True )
  dump = lambda v: json.dumps( v, separators = ( ',', ':' ), ensure_ascii = False )
  head = { k: v for k, v in data.items() if k not in ( 'nodes', 'edges' ) }
  lines = [ dump( head )[ :-1 ] + ',', '"nodes":[' ]
  lines.append( ',\n'.join( dump( n ) for n in data[ 'nodes' ] ) )
  lines.append( '],"edges":[' )
  lines.append( ',\n'.join( dump( e ) for e in data[ 'edges' ] ) )
  lines.append( ']}' )
  with open( path, 'w', encoding = 'utf-8', newline = '\n' ) as fh:
    fh.write( '\n'.join( lines ) + '\n' )


class Overlay:
  """
  Images for checking the result by eye.
  """

  def __init__( self, folder ):
    self.folder = folder
    os.makedirs( folder, exist_ok = True )

  def hex( self, hex_image, network, main, places = () ):
    """
    Draw the roads of one hex (and the ends of neighbouring hexes) over the dimmed map.
    Red: road in the largest component; magenta: road cut off from it; closed gaps: cyan for a
    bridge, orange for facing road ends, yellow-green for a short gap; dark blue for a bridge
    band, gold for a link through a town, sea green where touching roads are joined; grey
    circles: the towns (solid) and minor places
    (thin); blue dot: road end; green dot: joined across the hex border.

    @param hex_image HexImage
    @param network Network
    @param main set of edge ids in the largest component
    @param places list of Place of the hex
    """
    W = network.graph
    base = ( hex_image.rgb * 0.45 + 140 ).clip( 0, 255 ).astype( np.uint8 )
    base[ ~hex_image.inside ] = 255
    scale = 2
    img = Image.fromarray( base ).resize( ( HEX_WIDTH * scale, HEX_HEIGHT * scale ), Image.BILINEAR )
    draw = ImageDraw.Draw( img )
    local = lambda p: ( ( p[ 0 ] - hex_image.x0 ) * scale, ( p[ 1 ] - hex_image.y0 ) * scale )
    for e, edge in W.edges.items():
      if edge[ 'hex' ] != hex_image.key:
        continue
      colour = ( 220, 0, 0 ) if e in main else ( 200, 0, 200 )
      draw.line( [ local( p ) for p in edge[ 'pts' ] ], fill = colour, width = 3 )
    for place in places:
      x, y, r = place.x * scale, place.y * scale, place.radius * scale
      draw.ellipse( ( x - r, y - r, x + r, y + r ), outline = ( 90, 90, 90 ), width = 3 if place.town else 1 )
    gap_colours = dict( bridge = ( 0, 200, 230 ), facing = ( 255, 140, 0 ), gap = ( 150, 200, 0 ),
                        band = ( 0, 40, 160 ), town = ( 230, 170, 0 ), touch = ( 0, 160, 90 ) )
    for key, kind, pts in network.gap_lines:
      if key == hex_image.key:
        draw.line( [ local( p ) for p in pts ], fill = gap_colours[ kind ], width = 5 if kind == 'town' else 7 )
    for n, xy in W.nodes.items():
      x, y = local( xy )
      if not ( -10 <= x <= HEX_WIDTH * scale + 10 and -10 <= y <= HEX_HEIGHT * scale + 10 ):
        continue
      hexes = { W.edges[ e ][ 'hex' ] for e in W.adj[ n ] }
      if hex_image.key not in hexes:
        continue
      if len( hexes ) > 1:
        draw.ellipse( ( x - 6, y - 6, x + 6, y + 6 ), fill = ( 0, 170, 0 ) )
      elif W.degree( n ) == 1:
        draw.ellipse( ( x - 4, y - 4, x + 4, y + 4 ), fill = ( 0, 60, 255 ) )
    img.save( os.path.join( self.folder, hex_image.file + '.png' ) )

  def world( self, hexes, network, main ):
    """
    The whole world at a small scale: roads in the largest component red, others magenta.
    """
    W = network.graph
    scale = 0.35
    width = int( ( max( h.x0 for h in hexes ) + HEX_WIDTH ) * scale )
    height = int( ( max( h.y0 for h in hexes ) + HEX_HEIGHT ) * scale )
    img = Image.new( 'RGB', ( width, height ), ( 255, 255, 255 ) )
    for h in hexes:
      tile = Image.fromarray( np.dstack( [ ( h.rgb * 0.4 + 150 ).clip( 0, 255 ).astype( np.uint8 ), ( h.inside * 255 ).astype( np.uint8 ) ] ), 'RGBA' )
      tile = tile.resize( ( int( HEX_WIDTH * scale ), int( HEX_HEIGHT * scale ) ) )
      img.paste( tile, ( int( h.x0 * scale ), int( h.y0 * scale ) ), tile )
    draw = ImageDraw.Draw( img )
    for e, edge in W.edges.items():
      colour = ( 220, 0, 0 ) if e in main else ( 200, 0, 200 )
      draw.line( [ ( x * scale, y * scale ) for x, y in edge[ 'pts' ] ], fill = colour, width = 2 )
    img.save( os.path.join( self.folder, 'world.png' ) )


def log( message ):
  """
  Print a progress line with the time.
  """
  print( time.strftime( '%H:%M:%S' ), message, flush = True )


def main():
  """
  Run the extraction; see the module documentation for the options.
  """
  parser = argparse.ArgumentParser( description = 'Extract the road network from the hex map images.' )
  parser.add_argument( '--overlays', default = '' )
  parser.add_argument( '--cache', default = '' )
  parser.add_argument( '--hex', action = 'append', default = [] )
  parser.add_argument( '--out', default = '' )
  args = parser.parse_args()

  with open( WORLD_FILE, encoding = 'utf-8' ) as fh:
    world = json.load( fh )
  hexes = []
  for key in sorted( world ):
    h = HexImage( key, world[ key ] )
    if h.load():
      hexes.append( h )
    else:
      log( 'no image for ' + key )
  log( '%d hexes loaded' % len( hexes ) )

  todo = [ h for h in hexes if not args.hex or h.key in args.hex ]
  places = { h.key: Place.of_hex( world[ h.key ] ) for h in hexes }
  probs = {}
  if args.cache:
    os.makedirs( args.cache, exist_ok = True )
    for h in todo:
      path = os.path.join( args.cache, h.file + '.npy' )
      if os.path.exists( path ):
        probs[ h.key ] = np.load( path ).astype( np.float32 )
  if len( probs ) < len( todo ):
    classifier = RoadClassifier()
    used = classifier.train( hexes )
    log( 'trained on %d hexes: %s' % ( len( used ), ' '.join( used ) ) )
    for h in todo:
      if h.key in probs:
        continue
      probs[ h.key ] = classifier.predict( h )
      if args.cache:
        np.save( os.path.join( args.cache, h.file + '.npy' ), probs[ h.key ].astype( np.float16 ) )
    log( 'probabilities ready' )

  network = Network()
  joins = {}
  for h in todo:
    tracer = HexTracer( h, probs[ h.key ], places[ h.key ] )
    network.add_hex( h, tracer.run() )
    network.gap_lines += [ ( h.key, kind, [ h.to_world( *p ) for p in pts ] ) for kind, pts in tracer.gap_lines ]
    for kind, count in tracer.joins.items():
      joins[ kind ] = joins.get( kind, 0 ) + count
  log( 'traced %d edges; gaps closed and links added: %s' % ( len( network.graph.edges ), ', '.join( '%d %s' % ( v, k ) for k, v in sorted( joins.items() ) ) ) )
  network.join_borders()
  log( 'joined %d road ends across hex borders' % network.border_joins )
  fixes = network.apply_corrections( CORRECTIONS_FILE )
  if fixes:
    log( 'applied %d corrections' % fixes )

  W = network.graph
  comps = sorted( W.components(), key = lambda c: -sum( Graph.length( W.edges[ e ][ 'pts' ] ) for e in c ) )
  total = sum( Graph.length( e[ 'pts' ] ) for e in W.edges.values() )
  main_set = comps[ 0 ] if comps else set()
  largest = sum( Graph.length( W.edges[ e ][ 'pts' ] ) for e in main_set )
  log( 'network: %d nodes, %d edges, %.0f km of road, %d components, largest holds %.1f %%'
       % ( len( W.nodes ), len( W.edges ), total * 2.1328 / 1000, len( comps ), 100 * largest / max( total, 1 ) ) )
  per_hex = {}
  for e, edge in W.edges.items():
    s = per_hex.setdefault( edge[ 'hex' ], [ 0.0, 0.0 ] )
    length = Graph.length( edge[ 'pts' ] )
    s[ 0 ] += length
    if e in main_set:
      s[ 1 ] += length
  for key in sorted( per_hex ):
    t, m = per_hex[ key ]
    print( '  %-22s %6.0f px  %5.1f %% in largest component' % ( key, t, 100 * m / max( t, 1 ) ) )

  out = args.out or ( '' if args.hex else OUT_FILE )
  if out:
    write_json( network.export(), out )
    log( 'wrote %s (%d bytes)' % ( out, os.path.getsize( out ) ) )
  if args.overlays:
    overlay = Overlay( args.overlays )
    for h in todo:
      overlay.hex( h, network, main_set, places[ h.key ] )
    if not args.hex:
      overlay.world( hexes, network, main_set )
    log( 'overlays in ' + args.overlays )


if __name__ == '__main__':
  main()
