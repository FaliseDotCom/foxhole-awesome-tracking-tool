# Research: extracting the road network from the map images

Date: 25 November 2026. Status: data step done, no app code. Follows
[route navigation](2026-11-25-route-navigation.md), whose decision was to trace the roads
ourselves from the map images.

## Result in short

- `.scripts/roads/extract-roads.py` (with `requirements.txt`) turns the 53 hex images into one
  road graph in world map pixels, `assets/data/roads.json`, in about 5 minutes and without
  manual input. It is deterministic: a rerun on the same images writes the same file.
- **676 km of road**: 3,714 nodes, 4,773 edges, 21,642 points. **732,744 bytes**
  (716 KB), **164 KB gzipped**.
- Quality, judged by eye per hex: **31 good, 20 usable, 2 poor** (table below).
- **84.8 % of the road length is in one connected network** that covers the whole mainland.
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
5. **World graph.** Polylines simplified with Douglas–Peucker (1.5 px), moved to world pixels
   (`x = int( col * 1024 / 1.333 ) + x`, `y = int( row * 888 / 2 ) + y`, pixel centres at
   +0.5).
6. **Join across hex borders.** Road ends within 14 px of their hexagon edge are paired with the
   nearest road end of another hex within 26 px; both move to their midpoint and become one
   node (335 joins). Ends left over snap to a road of the neighbouring hex within 16 px.
7. **Corrections** from `.scripts/roads/corrections.json`, when it exists (see below).
8. **Write** the json, and with `--overlays DIR` an overlay per hex and a world overview.

All parameters are constants at the top of the script, with a comment each.

## How to run

```
python -m venv .venv-roads
.venv-roads/Scripts/python -m pip install -r .scripts/roads/requirements.txt
.venv-roads/Scripts/python .scripts/roads/extract-roads.py --overlays <folder outside the repository>
```

`--cache DIR` keeps the probability maps, so a rerun that only changes the graph steps takes
20 seconds instead of 5 minutes. `--hex <WorldDataKey>` (repeatable) processes single hexes and
writes no json unless `--out` is given. Rerun after `build-hexes.js` brings new images, and
check the overlays of the changed hexes.

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
  coarse knot instead of a grid. Through-roads are usually joined by the facing-ends rule.
- **Thin bridges** that are not in line with the road ends are missed (Terminus, Tyrant
  Foothills); a dashed or broken bridge is never joined.
- **Islands and new hexes** (Lykos Isle, Godcrofts, Stema Landing, Oarbreaker) are the weakest:
  speckled texture, few roads, and no training labels for that style.
- **Road ends** at the outer edge of the world, at the water and at dead-end sites are correct
  ends, but some ends are missed joins; 756 nodes are dead ends.
- **No tiers, no region per edge, no railways.** Railways are recognised as not-road (they
  were not yellow in 2022), which is right for vehicles but means no rail data.
- Junction positions are approximate (skeleton of a wide crossing) and town knots can add a
  few pixels of detour; harmless for routing and distances.

## What a human still needs to fix, and how

Most of the remaining work is a few dozen local fixes, not tracing:

1. Decide the sea question for the west and the south-east (link or no link).
2. Join the pieces inside the west and south-east land masses, the Kuura Strand village, the
   Stonecradle peninsula, the Sableport town and the Westgate island where the map shows a
   road.
3. Remove the false pieces in north Dead Lands, and add its centre town if needed.
4. Spot-check towns used as route ends.

**Suggested workflow: a correction file merged by the script** (already supported).
`.scripts/roads/corrections.json`, applied after the border joins:

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
- `add`: roads as world-pixel polylines; each end snaps to the nearest node within 8 px, so a
  two-point line between two road ends joins them. (The coordinates above are illustrative.)
- World pixels are easy to read off in the app: centre the view on a point and the address
  shows it (`#able/<x>/<y>/<zoom>`). The overlays (`--overlays`) are in image pixels of the
  hex; add the hex offset (`int( col * 1024 / 1.333 )`, `int( row * 888 / 2 )`) and halve the
  overlay coordinates, as they are drawn at twice the size.
- Because the corrections are in world coordinates and merged on every run, the extraction can
  be rerun after a map update and the corrections still apply where the map did not change;
  corrections in a changed hex should be reviewed then.

A later step could make corrections more robust against small shifts (snap `add` ends to the
nearest road within a larger radius, or match `remove` by overlap instead of the middle point),
and could add a tier per edge by hand for main roads if the route planner needs it.

## Files

- `.scripts/roads/extract-roads.py`: the script, documented at the top.
- `.scripts/roads/requirements.txt`: Python packages (numpy, pillow, scipy, scikit-image,
  scikit-learn), pinned to the tested versions.
- `assets/data/roads.json`: the network.
- Intermediate images and overlays are not kept in the repository; rerun with `--overlays`.
