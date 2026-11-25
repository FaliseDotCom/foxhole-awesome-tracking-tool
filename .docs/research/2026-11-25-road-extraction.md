# Research: extracting the road network from the map images

Date: 25 November 2026, extended the same day with [towns and bridges](#towns-and-bridges)
and with [touching roads](#touching-roads).
Status: data step done; used by the road layer and the route planner. Follows
[route navigation](2026-11-25-route-navigation.md), whose decision was to trace the roads
ourselves from the map images.

## Result in short

- `.scripts/roads/extract-roads.py` (with `requirements.txt`) turns the 53 hex images into one
  road graph in world map pixels, `assets/data/roads.json`, in about 5 minutes and without
  manual input. It is deterministic: a rerun on the same images writes the same file.
- **693 km of road**: 3,683 nodes, 4,917 edges, 22,329 points. **752,882 bytes**
  (735 KB), **168 KB gzipped**.
- Two rules fill in what the images do not show by themselves: **bridges are always roads**
  (27 bridges added) and **towns are never dead ends** (239 links through towns). Before them
  the network had 676 km, 63 pieces and 756 dead ends; now 42 pieces and 566 dead ends.
- A third rule joins **roads that touch** (87 links), and two corrections by hand fill gaps no
  rule catches: 38 pieces and 551 dead ends, and town-to-town routes a few percent shorter on
  average ([Touching roads](#touching-roads)). The file is now 776,542 bytes, 170 KB gzipped.
- Quality, judged by eye per hex: **31 good, 20 usable, 2 poor** (table below).
- **85.2 % of the road length is in one connected network** that covers the whole mainland.
  The rest is the western land mass, the south-eastern land mass and the island hexes: the
  images draw no bridge or road to them, so they are separate networks (see
  [Connectivity](#connectivity)).

## Inputs: which images

- **`assets/maps/classic/<hex>.webp` is the source, for all 53 hexes.** These are the images
  the app shows, rebuilt from the War API by `.app/scripts/build-hexes.js` (October 2026). The
  `.png` files next to them for 37 hexes are from 2022: they differ strongly from the current
  images in 16 of those hexes (palette and roads; Dead Lands, Great March, Heartlands, Loch
  Mor and Umbral Wildwood most), so they are not used. The webp files are lossy (quality 80),
  which the method copes with.
- **`assets/maps/color/<hex>.png` (2022) are used as training labels.** They draw every road
  in one bright yellow. Per hex the script measures how many yellow centre lines still lie on a
  thin line in the current image; 20 hexes score at least 95 % and are used for training
  (Acrithia, Ash Fields, Basin Sionnach, Callahan's Passage, Callum's Cape, Clanshead Valley,
  Drowned Vale, Great March, Howl County, Kalokai, Linn Mercy, Loch Mor, Marban Hollow, Mooring
  County, Reaching Trail, Red River, Shackled Chasm, Speaking Woods, Umbral Wildwood, Viper
  Pit). Hexes reworked since 2022 score low (Godcrofts 14 %, Oarbreaker 16 %, The Fingers 42 %,
  Tempest Island 43 %, Fisherman's Row 44 %, Endless Shore 61 %) and are left out of training.
  The colour maps are never copied into the result.

## Method

1. **Load** each hex image; pixels outside the hexagon get the nearest inside colour so the
   filters see no hard edge.
2. **Pixel classifier, two stages** (scikit-learn gradient boosting, 300 trees).
   - Stage 1 features per pixel: smoothed colour, brightness, saturation; white and black
     morphological top-hats with radius 2, 3, 4 and 6 (thin light lines on dark ground and
     thin dark lines on light ground, the two road styles); the closing and opening
     themselves; Hessian eigenvalues at scales 1.5, 2.5 and 4 (line shape); local mean,
     spread and saturation in 15 and 41 px windows; share of pale pixels; blurred colour.
   - Labels: positives on the yellow centre lines (±1 px, only where the current image has a
     thin line), negatives more than 6 px from any yellow road; 15,000 and 45,000 per hex.
   - Stage 2 (auto-context) adds the stage 1 probability smoothed at several scales, its
     density in a 41 px window, its top-hat and Hessian. It is trained on out-of-fold stage 1
     probabilities (4 folds), so it learns how stage 1 errs on unseen hexes.
   - Hex-out cross validation on the 20 training hexes (skeleton within 3 px of the yellow
     centre line): stage 1 recall 0.95, precision 0.69; stage 2 recall 0.94, precision 0.79,
     before any graph clean-up. Part of the "imprecision" is real roads that the 2022 map lacks.
3. **Mask and skeleton.** Hysteresis threshold on the probability (seeds ≥ 0.8, continuation
   ≥ 0.45), small holes filled, then skeletonized and traced into a graph: junction clusters
   and road ends become nodes, the pixel paths between them edges.
4. **Clean the graph per hex.**
   - Drop "blobs": edges whose median half-width exceeds 8 px (filled town plots).
   - Drop weak edges: mean probability below 0.55, or below 0.8 in **mottled terrain**. Mottle
     is measured as the share of pixels with a middling probability (0.1–0.8) in a 31 px
     window; above 0.3 the ground is speckled (fields, ruins, island texture), real roads there
     still score close to 1.
   - Prune spurs shorter than 14 px (not at the hex border) and drop pieces shorter than 45 px
     (12 px when they reach the border, 120 px when they lie in mottled terrain).
   - **Close gaps** from each road end, cheapest first:
     - short gap: up to 40 px to another road end or 18 px to the side of a road, within 50°
       of the road's direction, with some probability along the gap (mean ≥ 0.12);
     - bridge: up to 60 px straight ahead (25°) when a thin light line covers at least 85 % of
       the gap. Bridges are drawn narrower and dimmer than roads;
     - facing ends: two road ends up to 70 px apart that point at each other (25° each), not
       mostly over water. This closes roads through towns and over ground of their own colour.
     In mottled terrain only facing ends are joined. The final run closed 265 short gaps, 109
     bridges and 117 facing ends.
5. **Bridges and towns** (added later the same day): bridges are always roads, and towns are
   never dead ends. See [Towns and bridges](#towns-and-bridges). Then **roads that touch are
   joined**: junctions the skeleton went round, links over a street, and road ends cut off in
   a patch of road. See [Touching roads](#touching-roads).
6. **World graph.** Polylines simplified with Douglas–Peucker (1.5 px), moved to world pixels
   (`x = int( col * 1024 / 1.333 ) + x`, `y = int( row * 888 / 2 ) + y`, pixel centres at
   +0.5).
7. **Join across hex borders.** Road ends within 14 px of their hexagon edge are paired with the
   nearest road end of another hex within 26 px; both move to their midpoint and become one
   node (335 joins). Ends left over snap to a road of the neighbouring hex within 16 px.
8. **Corrections** from `.scripts/roads/corrections.json` (see below); two since
   [Touching roads](#touching-roads).
9. **Write** the json, and with `--overlays DIR` an overlay per hex and a world overview.

All parameters are constants at the top of the script, with a comment each.

## How to run

```
python -m venv .venv-roads
.venv-roads/Scripts/python -m pip install -r .scripts/roads/requirements.txt
.venv-roads/Scripts/python .scripts/roads/extract-roads.py --overlays <folder outside the repository>
```

`--cache DIR` keeps the probability maps, so a rerun that only changes the graph steps takes
40 seconds instead of 5 minutes (the cache keeps them as 16-bit floats, so a run from the cache
can differ from a fresh run by a link or two; write the final json with a fresh run). `--hex <WorldDataKey>` (repeatable) processes single hexes and
writes no json unless `--out` is given. Rerun after `build-hexes.js` brings new images, and
check the overlays of the changed hexes. The unit tests of the town, bridge and touching-road rules run with
`.venv-roads/Scripts/python -m unittest discover -s .scripts/roads -p "test_*.py"`.

## The json format

```json
{ "version": 1, "generated": "2026-11-25", "source": "traced from assets/maps/classic ...",
  "nodes": [ [ 5762.5, 4948.2 ], ... ],
  "edges": [ { "a": 0, "b": 17, "hex": "AcrithiaHex", "length": 123.4,
               "points": [ [ 5762.5, 4948.2 ], ..., [ 5850.5, 4950.2 ] ] }, ... ] }
```

- Coordinates in world map pixels (the same as the app's SVG and the `#shard/x/y/zoom`
  address), rounded to 0.1. One pixel is about 2.13 m.
- `nodes` are junctions, road ends and border joins. An edge's first and last point equal its
  nodes `a` and `b`. 14 edges are loops (`a` = `b`, a small ring road or roundabout).
- `hex` is the world data key of the image the edge was traced from; `length` is the polyline
  length in map pixels.
- One node or edge per line, no other whitespace, so diffs after a rerun stay readable.
- Not included: road tier (mud, dirt, asphalt; widths cannot be told apart reliably), bridges as
  such, regions. Region per edge can be computed in the browser from `world_data.json`.
- 732,744 bytes, 164 KB with gzip. The host should compress `application/json`; the current
  `.htaccess` has no compression rules.

## Quality per hex

Judged on the overlays (roads over the dimmed map, closed gaps marked) of the final run.
**Good**: the roads are there and connected, at most a few town streets or short pieces
missing. **Usable**: the main roads are right, with noticeable missing pieces, doubtful joins,
or separate pieces. **Poor**: large parts wrong.

| Hex | Quality | Notes |
| --- | --- | --- |
| Acrithia | good | |
| Allods Bight | good | railway correctly left out |
| Ash Fields | good | |
| Basin Sionnach | good | dashed cliff lines correctly left out |
| Callahan's Passage | good | one short loose piece in the east |
| Callum's Cape | good | town streets in the river island partly missing |
| Clahstra | good | |
| Clanshead Valley | good | |
| Dead Lands | **poor** in the north | south half good. The mottled north-west and north-centre still hold loose false pieces and a few false links; the island town in the centre is missing |
| Drowned Vale | good | railway left out; bridges closed |
| Endless Shore | usable | the town west of centre has no streets; a few ends at the water |
| Farranac Coast | usable | a few road ends at the water; small towns coarse |
| Fisherman's Row | usable | island hex, separate network; side islands only partly |
| Godcrofts | usable | islands, few roads, several separate pieces |
| Great March | good | |
| Gutter | usable | western land mass; several road ends not joined |
| Heartlands | good | railways (pale grey curves) correctly left out |
| Howl County | good | |
| Kalokai | good | |
| Kings Cage | good | bridges closed |
| Kuura Strand | usable | north-east good; the north-west village is not joined to the main road; the south peninsula belongs to the western land mass |
| Linn Mercy | good | |
| Loch Mor | good | |
| Lykos Isle | **poor** | islands; the large central island has almost no roads |
| Marban Hollow | good | |
| Mooring County | good | trench lines correctly left out; one doubtful facing join in the east |
| Morgens Crossing | good | |
| Nevish Line | good | the coastal strip in the west is a separate piece |
| Oarbreaker | usable | islands, three separate pieces |
| Olavis Wake | usable | western land mass; the north-east road is a separate piece |
| Onyx | usable | south (mainland) good; the north is part of the south-eastern land mass |
| Origin | good | |
| Palantine Berm | usable | western land mass; few roads found in the mottled north |
| Pari Peak | usable | western land mass |
| Piper's Enclave | usable | south-eastern land mass; the east island is a loose piece |
| Reaching Trail | good | trench lines correctly left out |
| Reaver's Pass | good | the north-east peninsula road ends at the water (no bridge drawn) |
| Red River | good | |
| Sableport | good | the town inside the railway loop is a separate piece |
| Shackled Chasm | good | |
| Speaking Woods | good | |
| Stema Landing | usable | islands, few roads |
| Stlican Shelf | usable | some doubtful joins in the mottled west; small loose pieces |
| Stonecradle | usable | the west peninsula road is a separate piece; mottled south-east |
| Tempest Island | usable | island hex; interior partly found |
| Terminus | good | |
| The Fingers | usable | south-eastern land mass |
| Tyrant Foothills | usable | south-eastern land mass; a thin bridge in the south not closed |
| Umbral Wildwood | good | railway left out; the town in the west joined by several short gaps |
| Viper Pit | usable | mottled west: a few doubtful joins, one loose piece |
| Weathered Expanse | good | |
| Westgate | good | railway left out; the west island is a separate piece |
| Wresta | usable | south-eastern land mass; both channel bridges found; one loose road in the south |

## Connectivity

Measured on the first run, before the town and bridge rules (the figures after them are in
[Towns and bridges](#towns-and-bridges): 42 components, the largest 85.2 %, 276,645 of
324,761 px; the land masses below are still separate).

63 connected components; the largest holds 84.8 % of the road length (268,603 of 316,877 px).

| Component | Share | Hexes |
| --- | --- | --- |
| Mainland | 84.8 % | all mainland hexes |
| South-east 1 | 3.4 % | Tyrant Foothills, Piper's Enclave, north Onyx, part of Wresta |
| South-east 2 | 2.1 % | The Fingers, most of Wresta, Reaver's Pass peninsula |
| West 1 | 1.8 % | south Kuura Strand, Pari Peak, part of Gutter |
| West 2 | 1.5 % | Olavis Wake, Pari Peak, Palantine Berm |
| West 3 | 1.1 % | Palantine Berm, Gutter |
| Islands | 0.2–0.8 % each | Fisherman's Row, Tempest Island, Oarbreaker (3), Stema Landing, Godcrofts, Lykos Isle |
| 35 small pieces | 1.2 % together | under 200 px each, mostly left-overs in mottled terrain |

**Hexes entirely outside the mainland network** (14): Fisherman's Row, Godcrofts, Gutter,
Lykos Isle, Oarbreaker, Olavis Wake, Palantine Berm, Pari Peak, Piper's Enclave, Stema
Landing, Tempest Island, The Fingers, Tyrant Foothills, Wresta. Partly: Kuura Strand (44 % in
the mainland network), Onyx (46 %).

Checked in the images: the south-eastern land mass touches the mainland only at the Reaver's
Pass peninsula, whose road ends at the water, and across the Onyx bay, which has no bridge;
the western land mass is separated from Kuura Strand's north by its bay. So, as drawn, these
are reachable only by sea. Whether the game has a link there that the map does not draw needs
someone who knows the map. Within each land mass the two or three pieces are probably joined in
reality; those links are missed roads, not water.

## Known gaps

- **Mottled terrain** (north Dead Lands, west Viper Pit, Stlican Shelf, Stonecradle, the
  island hexes) gives false pieces and the occasional false join, and hides some real roads.
- **Towns**: streets are drawn in the colour of the town plots; some towns have few or no
  streets (Dead Lands centre, Endless Shore west, Sableport inside the railway loop) or a
  coarse knot instead of a grid. The town rule now leads road ends through the town, but its
  links are drawn along the cheapest way over land, not along the real streets, and some cross
  open ground inside the town circle. The town centre is the region label, not the town hall.
- **Thin bridges**: the bridge rule found the Terminus one; a bridge with no road or town on a
  bank (Tyrant Foothills in the south) is still not joined, and a dashed or broken bridge is
  never joined.
- **Islands and new hexes** (Lykos Isle, Godcrofts, Stema Landing, Oarbreaker) are the weakest:
  speckled texture, few roads, and no training labels for that style.
- **Road ends** at the outer edge of the world, at the water and at dead-end sites are correct
  ends, but some ends are missed joins; 756 nodes were dead ends, 566 after the town and
  bridge rules.
- **No tiers, no region per edge, no railways.** Railways are recognised as not-road (they
  were not yellow in 2022), which is right for vehicles but means no rail data.
- Junction positions are approximate (skeleton of a wide crossing) and town knots can add a
  few pixels of detour; harmless for routing and distances.

## Towns and bridges

Added on 25 November 2026, after the owner looked at the road layer: "assume a town never is
a dead end; bridges are always roads". His example was Saltbrook Channel in Endless Shore, with
Liegehearth just south across a water channel: the roads stopped at the edge of the town, the
town streets were not traced, and the two bridges over the channel were missing, so north and
south were joined only by a 4.8 km detour. That is typical: the classifier loses roads inside
built-up areas (streets have the colour of the town plots) and on bridges (drawn in the colour
of the ground, or as a thin light line). Both rules run in the script, per hex, after the gap
closing (`HexTracer.link_bridges_and_towns`), so a rerun keeps them; nothing is edited by hand.

### Where the towns are

- **Towns** are the region name labels of `world_data.json` (`areas`, the War API's "Major"
  map text). They lie next to the region's town hall or relic base: compared with the town
  halls and relic bases of the War API's map items (October 2026), a median of 6 px away, 21 px
  for 90 % of them, at most 66 px. They need no extra data and change with the map when
  `build-hexes.js` rebuilds it. **Radius 90 px** (about 190 m), so the plots of a large town
  such as Saltbrook Channel (about 100 by 150 px) are covered even when the label is off-centre.
- **Minor places** are the other labels (villages, but also hills and woods). Liegehearth is
  one of them. **Radius 60 px** (about 130 m), and only when at least **two** road ends lead
  into them, so a lone road ending near a hill name is left alone. A label that repeats a
  town's name close by is skipped.

### Towns are never dead ends

For every place, towns first:

1. The **centre** is the label, moved to the nearest land pixel.
2. Every road end within the radius that **leads into** the town is taken, nearest to the
   centre first: it points towards the centre within 120°, or lies within 35 % of the radius
   of it. Road ends near the hex border are left to the border join. An end inside two
   places is taken by the first that links it.
3. From the end, the cheapest way over land is found (`skimage.graph.MCP_Geometric`): inside
   the circle, never over water, never over a bridge band (those are roads already), never
   behind the end, never back along its own road; a pixel costs 1, falling to 0.5 where the
   image looks like a street. The way stops at the first goal it meets: **another road or an
   earlier link that lies closer to the centre than the end** (at least 5 px), or the centre
   itself. The roads within 25 px behind the end are no goal. So a road end is led on into
   the town and joins the nearest street, instead of running along the edge of the town to a
   road outside it.
4. A way is dropped when it is longer than 1.8 times the straight distance plus 15 px, or when
   more than 35 % of it runs within 6 px of the end's own roads (it would only draw a second
   line beside them).
5. A centre that only one link reached is taken out again (it would be a new dead end), and so
   is everything that only led to it.

Road ends that point away from the town (a road leaving it and ending in a field), roads
ending at the water (docks, piers) and roads ending at the town hall with no other road nearby
stay dead ends: those are real.

### Bridges are always roads

A bridge interrupts the water. The rule uses its own water mask: less blurred than the one of
the gap rules and up to the shore line (the rim of the water is a little warmer), so that the
gap a bridge leaves is no wider than the bridge, and with **thin light lines left out of the
water**, so a narrow bridge drawn as a pale line also leaves a gap. Then:

1. The water mask is **closed** with a disk of 12 px: whatever land the closing fills is a
   band at most 12 px wide with water on both sides.
2. A band is a **bridge** when it touches land at two places (the banks) 6 to 160 px apart,
   water runs along at least 40 % of its outline, and the straight line between the banks
   does not cross open water (a curved shore). A band with only one bank is a pier or spit.
3. It is skipped when a traced road already runs within 3 px of half of that line.
4. Each bank is joined to: a road within 5 px; else, in a town, a node of its own that the
   town rule then links to its streets; else a road end within 30 px that points at the bank
   (60°); else a road within 25 px over land. A bridge is added only when both banks are
   joined, and not when the roads already join the two banks within twice the bridge length.
5. A bridge whose town bank no link reached is taken out again.

### Result

| | Before | After |
| --- | --- | --- |
| Road | 676 km | 693 km |
| Nodes, edges | 3,714, 4,773 | 3,683, 4,917 |
| File | 732,744 bytes, 164 KB gzipped | 752,882 bytes, 168 KB gzipped |
| Components | 63 | 42 |
| Largest component | 84.8 % of the length | 85.2 % |
| Dead ends | 756 | 566 |
| Dead ends within 90 px of a town label | 515 | 342 |
| Dead ends within 60 px of a minor label | 132 | 79 |
| Saltbrook Channel to Liegehearth (route planner, shortest) | 4.77 km | 0.14 km |

The run added **27 bridges** and **239 town links**. The largest network hardly grows,
as the mainland was already one network; the gain is inside it (direct routes instead of
detours around a town or a channel) and in the smaller land masses, whose pieces now join more
(the second and third networks grew from 3.4 and 2.1 % to 3.5 and 2.8 %). The western
and south-eastern land masses and the islands remain separate: still no road or bridge to them
is drawn.

Most remaining dead ends near a town are real: an access road that ends at the town hall,
roads to the water, and roads that leave the town and end outside it. A check of two dozen of
the remaining ends that point into a town found those kinds, and towns whose streets are not
traced at all (Headstone in Mooring County), where there is nothing to link to.

Per hex, the share of road in the largest network rose to 100 % in Callahan's Passage,
Clahstra, Dead Lands (87.6 % before), Linn Mercy, Stonecradle (91.7 %) and Viper Pit, and to
99.1 % in Reaching Trail.

### Checked by eye

- **All 27 added bridges**, on crops of the map with the roads drawn over it. Among them the
  two Saltbrook Channel bridges, thin bridges in Terminus (the one the first run missed), Ash
  Fields, Nevish Line, Great March, Stonecradle (the west peninsula is now joined), Piper's
  Enclave, Onyx and Farranac Coast, and channel crossings in the Dead Lands centre.
- Bridge candidates in towns that were not added: spits, sandbars and shore bands, no bridges.
- Town links on contact sheets, and the towns Saltbrook Channel and Liegehearth (Endless
  Shore: both bridges, north and south joined through both towns), the Dead Lands centre,
  Farranac Coast, Basin Sionnach, Callum's Cape, Clanshead Valley and Callahan's Passage.
  Most links fill missing town streets; some cross open ground inside the circle (a square of
  snow in Callum's Cape, a field in Acrithia), because the town plots cannot be told apart from
  the ground reliably.

### Tests

`.scripts/roads/test_extract_roads.py` (run with
`.venv-roads/Scripts/python -m unittest discover -s .scripts/roads -p "test_*.py"`) draws small
maps and checks the rules: a land band over a channel joins the road ends on both banks, open
water does not, a pier is no bridge, the banks are found; road ends in a town are joined
through it, not without the town, not over a river, not for a single road end at a minor
place, and not for a road pointing away; places come from the world data. The route planner's
unit tests (`.app/src/tests/routing.unit.js`) check on the real network that Saltbrook Channel
to Liegehearth is a short route over the channel.

## Touching roads

Added on 25 November 2026, after the owner planned a route from The Cut (Mooring County) to
Blackthroat (Viper Pit), 3.57 km apart in a straight line: "some roads are not drawn, so you
take an enormous detour". The route ran north through Headstone, Elksford, Brodytown, Ice
Ranch and The Ark, crossed the river at Serenity's Blight and came back south past Fort Viper,
all of it friendly.

### The cause of that detour

- **Reproduced** in Node with the route planner on the `roads.json` the live site served then
  (the first trace, 732,744 bytes, before the town and bridge rules), in the default Safest
  mode, all regions Warden, with fighting in Callahan's Passage (a contested hex counts four
  times its length): 7.46 km, the same road as the screenshot. With all territory friendly and
  no fighting there was no detour even then: 4.64 km straight through Callahan's Passage.
  So the planner rightly kept out of Callahan's Passage, and the detour came from the roads
  north of it.
- **Kirknell** (Viper Pit) had no traced streets: the roads from the north ended at the edge of
  the town, and its south half was a separate piece. From the north, the only way to
  Blackthroat was over the bridge at Serenity's Blight. The town rule already fixed that in the
  repository (5.56 km), but it was not yet published.
- **A junction near Reprieve** (Reaching Trail), on the shortest friendly way, has a small
  island in its middle. The skeleton went round it, and the two roads passed each other 6.5 px
  apart without a node, as if one ran over the other. Routes had to go round by Harpy.

That last kind of gap was common: the skeleton of a junction with an island or a small square
in its middle, or of two roads that only touch, gives two roads that pass each other a few
pixels apart; town links can cross a street without a node too; and a road end can be cut off
from the road beside it when the clean-up drops the wide patch of road between them as a
filled area. None of the gap rules saw these, as they only start from road ends, straight
ahead.

### Roads that touch are joined

The rule runs per hex after the town and bridge rules (`HexTracer.join_touching`):

1. **Touching roads.** Every place where two different roads come within **10 px** of each
   other (closest first; the same two roads at most once per 30 px) gets a short link when
   - the roads join the two points only by a way longer than **4 times their distance plus
     40 px**, or not at all: roads that meet at a junction close by never qualify; and
   - unless the roads cross, at least half of the gap lies on the **road mask** (with a pixel
     of slack) and at most 20 % over water: the classifier saw one patch of road there, not
     two roads with open ground between them.
2. **Road ends in a patch of road.** A road end (not at the hex border) is joined to another
   road up to **30 px** away, in any direction, under the same detour condition, when the road
   mask covers at least **90 %** of the way and at most 20 % is water.

Links are drawn in sea green on the overlays. What keeps false links out: the detour condition
(only places the network has no short way between), the road mask (a gap of open ground,
fields or buildings between two roads is not road), the water masks, and the short reach.

### Corrections

Two gaps no rule safely catches went into `.scripts/roads/corrections.json`, each with a note:
the wide road over the ford north-east of Thunderfoot (Umbral Wildwood, 40 px, dropped as a
filled area) and the street of Lochan Berth (Callahan's Passage) that runs on west to the
junction with the road from the north-west. The ends of an added road now snap to the nearest
road when no node is within 8 px, so a correction can end on the side of a road.

### Result

The final run (fresh, without the cache) added **87 links**, 14 of them longer than 10 px
(road ends over a patch of road), and applied the 2 corrections.

| | Before | After |
| --- | --- | --- |
| Road | 693 km | 694 km |
| Nodes, edges, points | 3,683, 4,917, 22,329 | 3,826, 5,149, 22,673 |
| File | 752,882 bytes, 166 KB gzipped | 776,542 bytes, 170 KB gzipped |
| Components | 42 | 38 |
| Largest component | 85.2 % of the length | 85.2 % |
| Dead ends | 566 | 551 |
| Roads within 10 px of each other, joined only the long way round | 39 places | 0 |
| Dead ends with a road within 40 px, joined only the long way round | 44 | 21 |
| The Cut to Blackthroat, Shortest, all friendly | 4.49 km (1.26 times the straight line) | 4.39 km (1.23 times) |
| The same, Safest, fighting in Callahan's Passage | 5.56 km (7.46 km on the first trace) | 5.38 km (1.51 times) |

The rest of the first trace's 7.46 km was the town rule (Kirknell); the Reprieve junction and
the other touching roads took the last 0.2 km off.

### Detours over the whole network

Measured with the route planner (Shortest, all territory friendly) between every two towns
(region labels) 150 to 1,100 px (0.3 to 2.3 km) apart: the road length plus the way to and
from the road, divided by the straight distance.

| 7,013 town pairs | Before | After |
| --- | --- | --- |
| Mean ratio | 1.70 | 1.65 |
| Median ratio | 1.50 | 1.47 |
| Pairs over 2 times the straight line | 998 | 793 |
| Pairs over 3 times | 275 | 234 |
| Pairs over 2.5 times with the straight line over land, not water | 158 | 89 |

The largest gains: Fort Mac Conaill to Reprieve (Reaching Trail) from 6.4 to 1.3 times,
Lochan Berth to The Procession (Callahan's Passage) from 6.1 to 1.2, The Procession to White
Chapel from 6.0 to 1.6, Greenfield Orchard to The Plough (Heartlands) from 5.6 to 1.5, Frostmarch
to Shattered Advance (Weathered Expanse) from 3.6 to 1.3. The worst remaining pairs over land
were checked on the map: most go round water that the straight line misses by a little, round
the dark rock plateaus (Callahan's Passage, Shackled Chasm, Farranac Coast), or lie in the
western and south-eastern land masses; Fort Providence (Heartlands) has its label on a
dead-end road, and east of Reprieve a road ends at the edge of a field. Those are what the map
draws.

### Checked by eye

- All **87 links** of the rule, on crops of the map with the roads drawn over them. Nearly
  all are junctions with an island or a small square in their middle, town squares, and town
  links over a street. One joins two roads that run side by side 11 px apart in Viper Pit,
  north of Kirknell, with a thin strip of ground between them that the classifier counts as
  road; a car crosses that strip anyway, so it is left. Two links in towns that crossed only
  open ground (Dead Lands, Callum's Cape) led to the road-mask condition, which leaves them
  out.
- The 14 links from road ends over a patch of road: a junction in Clanshead Valley, town
  squares in Dead Lands, Kuura Strand, Nevish Line and Viper Pit, the interchange in Reaching
  Trail, side roads in Kalokai, Linn Mercy, Mooring County and Origin, and the cut-off road in
  Stlican Shelf (which made a 3 km detour).
- The two corrections, and the route The Cut to Blackthroat, which now goes by Morrighan's
  Grave, the Reprieve junction, past Fort Mac Conaill and through Kirknell.

### Tests

`test_extract_roads.py` checks that roads that touch are joined where they touch, but not with
open ground or water between them, nor when they already meet at a junction; that a road end
cut off in a patch of road is joined to the road beside it, and not over open ground; and that
a correction joins the road its end lies on. `routing.unit.js` checks on the real network that
The Cut to Blackthroat is at most 1.4 times the straight line, and, with fighting in
Callahan's Passage, in Safest mode, at most 1.6 times without any contested road (it was 2.1
times on the first trace).

### Still open

- The live site serves the first trace until this build is published; the town rule, which
  fixes most of the owner's detour, is in the repository but was not yet published.
- Gaps wider than the rule's reach remain where the image shows a road: a road end at the edge
  of a light field in Reaching Trail (east of Reprieve) is a real end on the map; others are
  bridges or fords drawn in water colour (Drowned Vale) and dead-end roads that the label of a
  town sits on (Fort Providence, Heartlands), which make town-to-town routes long but are what
  the map draws.
- Most of the remaining long routes over land are in the western and south-eastern land masses
  and in mottled terrain, where the tracing is weakest (see [Quality per hex](#quality-per-hex)).

## What a human still needs to fix, and how

Most of the remaining work is a few dozen local fixes, not tracing:

1. Decide the sea question for the west and the south-east (link or no link).
2. Join the pieces inside the west and south-east land masses, the Kuura Strand village, the
   Sableport town and the Westgate island where the map shows a road. (The Stonecradle
   peninsula and the Dead Lands centre town are joined by the bridge and town rules.)
3. Remove the false pieces in north Dead Lands.
4. Spot-check towns used as route ends, and the town links that cross open ground; a wrong
   link can be removed with a `remove` box in the corrections.

**Workflow: a correction file merged by the script.** `.scripts/roads/corrections.json`,
applied after the border joins (the file holds two links since
[Touching roads](#touching-roads)):

```json
{
  "remove": [ [ 4700, 2750, 4950, 2950 ] ],
  "add": [
    { "hex": "KuuraStrandHex", "points": [ [ 1828, 1048 ], [ 1868, 1036 ] ] }
  ]
}
```

- `remove`: boxes `[ x0, y0, x1, y1 ]` in world pixels; every edge whose middle point lies in a
  box is dropped.
- `add`: roads as world-pixel polylines; each end snaps to the nearest node within 8 px, else
  to the nearest point of a road within 8 px (the road is split there), so a two-point line
  between two road ends, or from a road end to the side of a road, joins them. An optional
  `note` says why, for people. (The coordinates above are illustrative.)
- World pixels are easy to read off in the app: centre the view on a point and the address
  shows it (`#able/<x>/<y>/<zoom>`). The overlays (`--overlays`) are in image pixels of the
  hex; add the hex offset (`int( col * 1024 / 1.333 )`, `int( row * 888 / 2 )`) and halve the
  overlay coordinates, as they are drawn at twice the size.
- Because the corrections are in world coordinates and merged on every run, the extraction can
  be rerun after a map update and the corrections still apply where the map did not change;
  corrections in a changed hex should be reviewed then.

A later step could make corrections more robust against small shifts (snap `add` ends within
a larger radius, or match `remove` by overlap instead of the middle point),
and could add a tier per edge by hand for main roads if the route planner needs it.

## Files

- `.scripts/roads/extract-roads.py`: the script, documented at the top.
- `.scripts/roads/test_extract_roads.py`: unit tests of the town, bridge and touching-road
  rules and of the corrections.
- `.scripts/roads/corrections.json`: corrections by hand, merged on every run.
- `.scripts/roads/requirements.txt`: Python packages (numpy, pillow, scipy, scikit-image,
  scikit-learn), pinned to the tested versions.
- `assets/data/roads.json`: the network.
- Intermediate images and overlays are not kept in the repository; rerun with `--overlays`.
