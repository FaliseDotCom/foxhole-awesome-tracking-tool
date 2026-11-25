# Research: route navigation from A to B

Date: 25 November 2026, during war 142, Foxhole update 1.67. Status: research only, nothing
built.

## The question

Can F.A.T.T. plan a route from point A to point B on the world map, and how would we build it?
Wanted:

- A route from A to B, as the **shortest** or the **safest** route.
- Two options: **through enemy territory** (default off) and **through contested territory**
  (default on). When the start or the destination itself lies in enemy or contested territory,
  the matching option switches on by itself.
- If feasible, **waypoints** (stops along the way).
- The **distance in km** and an **estimate of the fuel** used.

## Verdict in short

Feasible, and a good fit for F.A.T.T.: the hard parts the app already has (the live territory
per region, the region outlines, search, an SVG layer for lines on the map). The one thing it
lacks is a **road network**, and nobody publishes one under an open licence. Getting road data
is the critical path; the routing itself is a small, well-known algorithm that runs in the
browser in milliseconds.

## Findings

### 1. Road network

**The War API has no roads.** Its endpoints are the war state, the map list, the war report
(casualties), static map data (text labels: major and minor place names) and dynamic map data
(map icons with team and flags). Nothing about roads, bridges or their tiers
([War API README](https://github.com/clapfoot/warapi), checked 25 November 2026, last commit
26 May 2026).

**Roads in the game** ([Foxhole Wiki: Roads](https://foxhole.wiki.gg/wiki/Roads)):

- Three tiers: **Mud**, **Dirt** and **Asphalt**. Asphalt on major roads and in large towns,
  Dirt in smaller towns and minor links, Mud to off-road sites such as resource fields.
- Vehicles are **2.5 % faster on Dirt** and **5 % faster on Asphalt**; no bonus on Mud.
- World roads "cannot decay, be destroyed, or modified". Players can build Provisional Roads,
  which are weaker and decay; those are not in the War API either.
- So the road network is static between game updates. It changes when Siege Camp reworks a
  hex (for example the map changes of 1.63 and 1.64), not during a war.

**Community road data: LogiWaze.** [LogiWaze](https://www.logiwaze.com/)
([source](https://github.com/NoUDerp/LogiWaze), a fork of Hayden's
[foxhole-router](https://github.com/hayden-t/foxhole-router), the Foxhole Stats author) is the
only working Foxhole router found. What it has:

- `road_source.geojson`: roads traced by hand in QGIS, 20,972 line segments with 156,214
  points, each with a `region` (hex) and a `tier` (1–3 in their scheme: good road and stone
  bridges, dirt, mud and wooden bridges). Last road commit 29 April 2026: "Bake post-1.63 road
  corrections". Coordinates in EPSG:3857, in their own Leaflet frame.
- It covers **43 of F.A.T.T.'s 53 hexes**. Missing: Gutter, Kuura Strand, Lykos Isle, Olavis
  Wake, Onyx, Palantine Berm, Pari Peak, Piper's Enclave, Tyrant Foothills and Wresta.
- Routing with [geojson-path-finder](https://github.com/perliedman/geojson-path-finder)
  (Dijkstra, ISC licence, vendored in `src/geojson-path-finder`).
- Faction-safe routes by building **separate Warden and Colonial road networks**: every road
  point gets an ownership score from the live map, and a point counts as Warden below −0.25,
  Colonial above 0.25, otherwise neutral (`src/IRouter.ts`). Routes then use only their own
  side's network. No "contested" level and no penalties: a road is in or out.
- Travel times from fixed vehicle speeds (truck 45 km/h, flatbed 25 km/h and so on).
- Its distance scale is "256 map units = 12,012 m". Applied to its own hex outlines, that
  makes a hex about 1.98 km wide, roughly 9 % less than the War API figure below. We could not
  reconcile this; it is another reason to compute distances ourselves.

**Licence: neither repository has one.** GitHub shows no licence for LogiWaze or
foxhole-router. Without a licence the authors keep all rights; the code and the road data may
be viewed but not reused
([choosealicense.com: no permission](https://choosealicense.com/no-permission/)).
Reusing `road_source.geojson` therefore needs **written permission** from the authors
(NoUDerp, and Hayden for the original tracing), ideally as an open data licence such as
CC BY 4.0 or ODbL. Their Discord is the Foxhole Stats server, linked in the LogiWaze README.
The vendored path finder is ISC and free to use.

**Other tools.** No other tool routes over roads:

- FoxholeHQ has a distance and azimuth tool with vehicle travel times along a straight line
  ([other-foxhole-sites.md](../other-foxhole-sites.md)).
- [Foxhole Logistics Calculator](https://foxholelogi.com/) computes factory and crate costs,
  not routes. [Foxhole Planner](https://foxholeplanner.com/) plans bases.
- A Roboflow dataset "road-detection-foxhole-map"
  ([link](https://universe.roboflow.com/vscode-jrigg/road-detection-foxhole-map/dataset/))
  suggests someone tried detecting roads in map images with machine learning; the page refused
  automated access, so its size, quality and licence are unknown.

**Extracting roads from our own map images.** `assets/maps/classic/` holds the official War
API hex images, 1024 × 888 px per hex, built by `scripts/build-hexes.js`. Roads are visible as
thin light lines. A quick test on Dead Lands (masking single palette colours with `sharp`):

- The images are quantised to about 19 colours. Roads share their light colour with other
  pale terrain (snowy and grey ground, town plots), so a colour mask finds the roads cleanly on
  dark ground and loses them on pale ground.
- One pixel is about 2.1 m, so a road is 2–4 px wide; tiers cannot be told apart by width
  with any confidence.
- The old `assets/maps/color/` images draw roads in one bright yellow, which would be easy to
  extract, but they are from 2022 and miss 16 hexes (see `stores/config.js`).

So automatic extraction gives a rough start at best: it needs line thinning, gap closing at
bridges and junctions, and manual clean-up and tier tagging per hex. Realistically a few hours
per hex for 53 hexes, redone when Siege Camp changes a hex.

**A coarse graph without roads.** F.A.T.T. already has 431 region outlines and their label
positions in `world_data.json`. A graph with a node per region (or per town) and an edge
between regions whose outlines touch, weighted by straight-line distance times a detour
factor (about 1.3), takes a day to build. It knows nothing about rivers, bridges, cliffs or
water, so it would happily route across a lake; km and fuel would be off by tens of percent.
Usable as a territory corridor ("which regions do I pass"), not as navigation.

### 2. Territory

What F.A.T.T. knows per region and per hex today:

| Data | Where | Granularity |
| --- | --- | --- |
| Holder of the town hall or relic base | `world` store, `components/map/hex/areas.svelte` | region |
| Scorched structures | same, `icons.isScorched` | region |
| Region outlines and hit test | `grid.getDetails`, `grid.areaContains` | region polygon |
| Casualties last hour and day | `stats` store, `/api/stats` | hex only |
| Captures, losses, destroyed structures with position and time | `warlog` store | point |

The War API gives casualties per hex only, so fighting cannot be placed within a hex from the
statistics. The war log can: every capture or loss has a position, so it falls in a region.

**"The user's team".** The app has no login and should not get one for this. A team choice
(Wardens or Colonials) in the route panel, remembered in the browser like the other settings,
is enough. Without a team there is no friend or enemy, so the route panel asks for it first.

**A proposed classification per region**, computed in the browser from the live data:

- **Friendly**: the region's town hall or relic base is held by the chosen team.
- **Enemy**: held by the other team.
- **Neutral**: no base, a neutral base, or scorched. Open question how to treat these.
- **Contested**: any of
  - a capture or loss in that region in the war log in the last few hours;
  - its hex had casualties above a threshold in the last hour, and the region borders a region
    of the other team or a neutral one (the front line);
  - optionally: every friendly region that borders an enemy region, fighting or not.

Neighbours: regions inside a hex share outline points (the same letters in `areas`); across
hexes, outlines that touch on the shared hex edge. Both can be computed once from
`world_data.json`.

A caveat: region outlines in `world_data.json` are partly approximations, corrected by hand
with the points tool. In the game, regions are zones around the major place names ("Major
markers form the basis of Region Zones", War API README). Where the outlines are rough, a road
near a border can land in the wrong region; the nearest major label in the hex is a fallback.

### 3. Distances

**Authoritative figure: one hex is 2,184 m wide (corner to corner) and 1,890 m tall (flat
side to flat side).** The War API README gives the world extents of every hex as −109,200 to
109,200 by −94,500 to 94,500 in-game units, and Foxhole runs on Unreal Engine, whose unit is
the centimetre. That is 218,400 × 189,000 cm.

Two checks:

- The ratio 1,890 / 2,184 = 0.865 matches the 888 / 1,024 px of the official hex images, so
  the images span the full extents.
- The in-game map grid has squares of 125 m labelled A–Q and 1–15
  ([Foxhole Wiki: Map](https://foxhole.wiki.gg/wiki/Map)): 17 × 125 = 2,125 m and
  15 × 125 = 1,875 m, consistent with 2,184 × 1,890 when the partial edge squares carry no
  label.

So in F.A.T.T. map pixels: **1 px = 2,184 / 1,024 ≈ 2.13 m**, the same horizontally and
vertically (1,890 / 888 ≈ 2.13). The whole map, 5,633 px wide, is about 12.0 km. The rocket
plan's "about 2.2 km across" is right; its 80 m blast circle is 37.5 px.

### 4. Fuel

**Fuel use is per minute of driving, not per km**
([Foxhole Wiki: Fuel](https://foxhole.wiki.gg/wiki/Fuel)):
"Vehicles that consume fuel do so at a constant rate every second which depends on the vehicle
type." It does not depend on speed, surface, weight or fuel type; idling and steering on the
spot use none; driving forward or reverse does. Boosting vehicles use much more. So fuel per km
is consumption divided by speed, and anything that slows the vehicle (off-road, mud, load,
weather) costs fuel.

Logistics vehicles, figures from each wiki page, marked accurate for update 1.67:

| Vehicle (Warden / Colonial) | Tank | Use | Road | Off-road | Slowed by load and mud | L/km road | L/km off-road | Range on road |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Truck: [Dunne Transport](https://foxhole.wiki.gg/wiki/Dunne_Transport) / [R-1 Hauler](https://foxhole.wiki.gg/wiki/R-1_Hauler) | 100 L | 1.5 L/min | 17.32 m/s | 3.46 m/s | up to 28 % | 1.4 | 7.2 | 69 km |
| Flatbed: [BMS - Packmule Flatbed](https://foxhole.wiki.gg/wiki/BMS_-_Packmule_Flatbed) (both) | 150 L | 3 L/min | 9.78 m/s | 4.89 m/s | up to 20 % | 5.1 | 10.2 | 29 km |
| Fuel tanker: [Dunne Fuelrunner 2d](https://foxhole.wiki.gg/wiki/Dunne_Fuelrunner_2d) / [RR-3 "Stolon" Tanker](https://foxhole.wiki.gg/wiki/RR-3_%22Stolon%22_Tanker) | 100 L | 3 L/min | 16.17 m/s | 4.85 m/s | not stated | 3.1 | 10.3 | 32 km |
| Heavy-duty truck: [Cnute Cliffwrest](https://foxhole.wiki.gg/wiki/Cnute_Cliffwrest) | 150 L | 3 L/min | 15.66 m/s | 4.70 m/s | up to 28 % | 3.2 | 10.6 | 47 km |
| Heavy-duty truck: [AU-A150 Taurine Rigger](https://foxhole.wiki.gg/wiki/AU-A150_Taurine_Rigger) | 150 L | 3 L/min | 14.06 m/s | 5.63 m/s | up to 24 % | 3.6 | 8.9 | 42 km |

L/km is our calculation: L/min ÷ (m/s × 60 / 1000), at top speed, empty. Real trips are
slower (bends, hills, junctions, traffic, a full load), so these are best cases; a full load
alone adds up to 39 % (1 / 0.72). The road bonus (+5 % on asphalt) is small next to that.

Caveats:

- The figures are per game version; Siege Camp changes vehicle stats regularly. Keep them in
  one data file with the version they come from, and check them after each update.
- The wiki's off-road speeds are low (a truck at 12.5 km/h); we did not verify them in game.
- Weather (snow) can slow vehicles, and mud adds weight while driving through it; neither is
  quantified, and the War API does not report weather.

### 5. Algorithm

- **Graph.** Nodes are road junctions and road ends; edges are the road pieces between them,
  with their length in map pixels, their tier, the region they lie in (an edge crossing a
  region border is split at the border) and their points for drawing. Built once by a script,
  like `scripts/build-hexes.js`, into a static data file. The LogiWaze data, compacted to
  junctions, would be in the order of 20,000–40,000 nodes.
- **Search.** A* with the straight-line distance as heuristic (or plain Dijkstra). Both modes
  use the same search with a different edge cost:
  - shortest: cost = length;
  - safest: cost = length × (1 + penalty), with for example penalty 0 for friendly, 1 for
    neutral, 3 for contested and 10 for enemy, so a detour is taken when it avoids danger but
    not at any price;
  - options off: edges in contested or enemy regions are left out entirely.
  Penalties are at least 0, so the straight-line heuristic stays valid and A* stays exact.
- **Fastest instead of shortest?** Fuel follows driving time, not distance. On a road-only
  graph the two hardly differ (tier bonuses are 2.5–5 %); they differ for the off-road legs to
  and from the road. "Shortest" is fine for a first version.
- **Start and end off the road.** A chosen place (a town, a structure) is rarely on a road:
  snap it to the nearest road node within a maximum distance and count the gap as off-road
  (slower, more fuel). Islands without a road connection get "no route".
- **Auto options.** Classify the regions of A and B first; if either is enemy or contested,
  switch the matching option on and say so in the panel.
- **Waypoints.** Chain legs: A → W1, W1 → W2, …, Wn → B, each its own search, results
  joined.
  The auto options apply per leg. Optimising the order of stops is a travelling salesman
  problem; leave it out, the user orders the stops.
- **Where it runs: in the browser.** The live territory, the team choice and the history view
  are all in the browser already; a route depends on each viewer's team and options; a search
  over tens of thousands of nodes takes tens of milliseconds in JavaScript; and it adds no
  public endpoint and no load to the PHP server. The road file is loaded only when the route
  panel opens (an estimated 0.5–1 MB gzipped as GeoJSON, less after compaction and rounding
  to whole pixels). A Web Worker is not needed at this size.
- **Live updates.** Recompute when the territory class of a region on or near the route
  changes, not on every 10-second map refresh; show what changed.

### 6. UI sketch in the app's terms

- **A Route tab** in `tabs.svelte`, next to Log, Stats, Legend and Settings, with a route
  icon. Its panel, top to bottom:
  - Team: Wardens or Colonials (segmented buttons, remembered in `fatt-settings`).
  - From, stops, To: each a place field with the same search as the top search field
    (`stores/search.js` `find()`, places and structures, recent choices). The search store now
    holds one global query; it would be split into the shared index (`find`, `placeOf`,
    `entryId`) and a field component used by both the top search and the route fields, so it
    is one component, not a copy. A crosshair button picks a point on the map; a swap button
    swaps From and To; "Add stop" adds a field (phase 2).
  - Shortest or Safest, in the same button row style as the Stats tab's time spans.
  - Two switches: "Through contested territory" (on) and "Through enemy territory" (off),
    with a line such as "Switched on: the destination is in enemy territory" when automatic.
  - Vehicle (phase 3), and the result: distance in km, estimated time and fuel, and how much
    of the route runs through friendly, contested and enemy territory.
- **Entry points from the map**: "Route from here" and "Route to here" on a structure's
  tooltip or a search result.
- **The route on the map**: a new layer `components/map/route.svelte` in `layer-map.svelte`,
  like `arcs.svelte`: SVG paths in map pixels, stroke width divided by `--scale` so the line
  keeps its width at every zoom, a casing for contrast, colour per piece by territory class
  from the team tokens in `vars.css`, and lettered markers for A, stops and B. Choosing a
  route fits it on screen with the view store's box request, as search results do.
- **Sharing**: the route could go into the address next to the view, so a link opens it.

## Options for the road data

| Option | Coverage | Accuracy | Effort | Licence |
| --- | --- | --- | --- | --- |
| A. LogiWaze roads, with permission | 43 of 53 hexes; 10 to trace | good, maintained since 2019 | low: convert and fit to our grid | needs the authors' consent |
| B. Trace our own from the official images | all 53 | as good as we make it | high: a few hours per hex, again after map changes | our own work, from images we already use |
| C. Coarse region graph, no roads | all 53 | poor: ignores rivers and bridges | low: about a day | no issue |
| D. A + B: LogiWaze roads plus our tracing of the 10 missing hexes, offered back upstream | all 53 | good | medium | consent needed for A |

## Recommendation

**Build it, in phases, after settling the road data.** Start by asking the LogiWaze authors;
it is cheap and decides most of the effort.

**Phase 0: road data.** Ask NoUDerp and Hayden for permission to use `road_source.geojson`
under an open licence with credit (option D). Meanwhile trace one missing hex by hand with a
QGIS or points-tool workflow to measure the effort of option B. If permission is refused,
choose between B for all hexes and not building it. Do not ship option C as navigation.

**Phase 1: A → B.** Build script for the road graph (into a lazily loaded static file),
region neighbours, territory classification, team choice, shortest and safest, the two options
with their automatic switching, the Route tab with From and To, and the route layer. Show the
distance in km already here: it is one multiplication (2.13 m per map pixel) and helps judge
the route.

**Phase 2: waypoints.** Stops as chained legs, add, remove and reorder.

**Phase 3: fuel and time.** A vehicle choice from a small data file with the wiki figures and
their game version; time per leg from speed, tier bonus, off-road gaps and an optional load
factor; fuel from time; a warning when a leg needs more fuel than the tank holds.

## Open questions for the developer

1. **Team.** No default (ask first), or a default team? Also used elsewhere later (for
   example, "friendly" colours)?
2. **Contested.** Which signals count, and with what thresholds: captures or losses in the
   last 6 hours (as the "changes" shading)? Casualties above how many per hour in the hex? Is
   every friendly region on the front line contested?
3. **Neutral and scorched regions.** Friendly, contested or enemy for routing?
4. **Automatic options.** When the destination is in enemy territory, allow enemy territory
   for the whole route, or only for the region(s) of the start and the destination? May the
   user switch an automatic option off again (then there is no route)?
5. **Safest.** Fixed penalties, or a slider between shortest and safest? Which mode is the
   default?
6. **Units.** Distance in km with one decimal (metres below 1 km)? Fuel in litres, or also in
   fuel cans? Time in minutes?
7. **Vehicles.** Which ones (truck, flatbed, fuel tanker, heavy-duty truck; also others, such
   as the light utility vehicle)? Default vehicle? Empty, loaded, or a range from both?
8. **Off-road.** How far may the start or destination be from a road before it is "no
   route"? Should off-road shortcuts between roads be allowed at all?
9. **Edge cases.** Hexes that are offline or not drawn: impassable? Islands and places
   reachable only by sea: "no route", or point to naval transport? Player-built gates and
   walls on roads, destroyed bridges, provisional roads: not in the War API, so ignore and
   say so?
10. **History.** In the history view, route through the territory of that moment, or always
    the live one?
11. **Sharing and privacy.** Put the route in the link? Count route use in the visitor
    statistics, as the search is counted?

## Sources

- War API documentation: <https://github.com/clapfoot/warapi> (world extents, endpoints, map
  flags)
- LogiWaze: <https://www.logiwaze.com/>, <https://github.com/NoUDerp/LogiWaze>
  (`road_source.geojson`, `hexes.geojson`, `src/IRouter.ts`, README on editing roads)
- foxhole-router: <https://github.com/hayden-t/foxhole-router>
- geojson-path-finder (ISC): <https://github.com/perliedman/geojson-path-finder>
- No licence means no permission: <https://choosealicense.com/no-permission/>
- Foxhole Wiki: [Roads](https://foxhole.wiki.gg/wiki/Roads),
  [Fuel](https://foxhole.wiki.gg/wiki/Fuel), [Map](https://foxhole.wiki.gg/wiki/Map),
  [Vehicles](https://foxhole.wiki.gg/wiki/Vehicles), and the vehicle pages linked in the fuel
  table (all checked 25 November 2026, marked accurate for update 1.67)
- Roboflow road detection dataset (not reachable):
  <https://universe.roboflow.com/vscode-jrigg/road-detection-foxhole-map/dataset/>
- In this repository: `README.md`, `.docs/other-foxhole-sites.md`,
  `.docs/plans/2026-10-07-rocket-arcs.md`, `.app/src/stores/grid.js`, `world_data.json`,
  `world.js`, `stats.js`, `search.js`, `warlog.js`, `components/map/arcs.svelte`,
  `components/map/hex/areas.svelte`
