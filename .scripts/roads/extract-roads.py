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
  5. Moves everything to world map pixels and joins roads that cross a hex border to the
     road of the neighbouring hex.
  6. Writes assets/data/roads.json, and optionally an overlay image per hex for checking.

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
  .app/src/stores/world_data.json   hex keys and grid positions
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

  def __init__( self, hex_image, prob ):
    """
    @param hex_image HexImage loaded hex
    @param prob numpy float array road probability
    """
    self.hex = hex_image
    self.prob = prob
    self.mask = None
    self.width = None
    self.graph = Graph()
    # gaps closed per rule, and the gap lines themselves (for the overlays)
    self.joins = {}
    self.gap_lines = []
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
      self.gap_lines.append( ( kind, g.nodes[ n ], g.nodes[ m ] ) )
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
                                                  nearest node within 8 px

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
        if near and math.hypot( near[ 1 ][ 0 ] - p[ 0 ], near[ 1 ][ 1 ] - p[ 1 ] ) <= 8:
          ends.append( near[ 0 ] )
        else:
          ends.append( W.add_node( *p ) )
      pts[ 0 ], pts[ -1 ] = W.nodes[ ends[ 0 ] ], W.nodes[ ends[ 1 ] ]
      W.add_edge( ends[ 0 ], ends[ 1 ], pts, hex = road.get( 'hex', '' ) )
      count += 1
    return count

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

  def hex( self, hex_image, network, main ):
    """
    Draw the roads of one hex (and the ends of neighbouring hexes) over the dimmed map.
    Red: road in the largest component; magenta: road cut off from it; closed gaps: cyan for a
    bridge, orange for facing road ends, yellow-green for a short gap; blue dot: road end;
    green dot: joined across the hex border.

    @param hex_image HexImage
    @param network Network
    @param main set of edge ids in the largest component
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
    gap_colours = dict( bridge = ( 0, 200, 230 ), facing = ( 255, 140, 0 ), gap = ( 150, 200, 0 ) )
    for key, kind, a, b in network.gap_lines:
      if key == hex_image.key:
        draw.line( [ local( a ), local( b ) ], fill = gap_colours[ kind ], width = 7 )
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
    tracer = HexTracer( h, probs[ h.key ] )
    network.add_hex( h, tracer.run() )
    network.gap_lines += [ ( h.key, kind, h.to_world( *a ), h.to_world( *b ) ) for kind, a, b in tracer.gap_lines ]
    for kind, count in tracer.joins.items():
      joins[ kind ] = joins.get( kind, 0 ) + count
  log( 'traced %d edges; gaps closed: %s' % ( len( network.graph.edges ), ', '.join( '%d %s' % ( v, k ) for k, v in sorted( joins.items() ) ) ) )
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
      overlay.hex( h, network, main_set )
    if not args.hex:
      overlay.world( hexes, network, main_set )
    log( 'overlays in ' + args.overlays )


if __name__ == '__main__':
  main()
