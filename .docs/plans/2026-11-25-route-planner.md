# Plan: route planner

Date: 25 November 2026. Status: built on branch `route-planner` (phases 1 to 3 of the
[route navigation research](../research/2026-11-25-route-navigation.md): A to B, stops, fuel),
not merged. Builds on the road network of
[the road extraction](../research/2026-11-25-road-extraction.md), `assets/data/roads.json`.

A Route tab that plans a route over the roads from a start through stops to a destination, as
the shortest or the safest route for the viewer's team, with the distance in km and a fuel
estimate, and draws it on the map.

## What was built

| Part | Where |
| --- | --- |
| Region of a map point: hexagon, then region outline, else the nearest region name | `.app/src/lib/regions.js` |
| Routing: graph, snapping, A*, territory costs, automatic options, chained legs | `.app/src/lib/routing.js` |
| Vehicle speed classes and the fuel estimate | `.app/src/lib/vehicles.js` |
| Who holds each region (shared with the region colours), fighting hexes | `.app/src/stores/territory.js` |
| Team, places, preferences, the planned route, fit on screen | `.app/src/stores/route.js` |
| The Route tab | `.app/src/components/route.svelte` |
| The route on the map, and picking a place by clicking the map | `.app/src/components/map/route.svelte`, `assets/css/route.css` |
| One place field for the map search and the route places | `.app/src/components/place-field.svelte`, `search.createField()` in `stores/search.js` |
| One row of choices (stats time spans, team, route kind, vehicle) | `.app/src/components/choice-row.svelte` |
| One button with an icon and a label, in a main, light or danger variant | `.app/src/components/button.svelte`, `.button` in `panels.css` |
| Unit tests | `.app/src/tests/routing.unit.js` |
| Browser tests | the two route tests at the end of `.app/src/tests/map.test.js` |

The lib modules are pure and run in Node; the stores feed them the live data.

## How it works

1. **Graph.** When the Route tab first opens, `roads.json` is loaded (716 KB, 164 KB with
   gzip) and turned into a graph: every segment of every road polyline gets its region (the
   region holding its middle point). This takes about 20 ms. Connected parts of the network
   are numbered, so two places on separate networks are known to have no route without
   searching.
2. **Territory.** Each region takes the team of its town hall or relic base and is scorched
   when a structure in it is, the same rule as the region colours on the map
   (`regionState()` in `stores/territory.js` now serves both). Hexes with casualties in the
   last hour (the "fighting" hex shading) are contested. Per region and team:
   - **enemy**: held by the other team, also when fighting;
   - **contested**: any other region in a fighting hex;
   - **friendly**: held by the team;
   - **neutral**: no base, a neutral or a scorched one.
   Routes always use the live map, also while the map shows a moment of the history: they are
   for driving now.
3. **Places.** A place from the search is its map point; a picked place is the clicked point,
   named after the nearest named place ("Map point – The Spine, Dead Lands"). Each place snaps
   to the nearest point on any road; the gap is counted as off-road distance (in km and fuel)
   and drawn dashed. A place more than 300 px (about 640 m) from a road has no route.
4. **Search.** A* per leg, with the straight line as estimate. Cost per map pixel of road:
   1 in the shortest mode; 1 + penalty in the safest mode. Roads in territory the options
   forbid are left out. Both modes are exact (the costs never fall below the length).
5. **Automatic options.** When the start, a stop or the destination lies in enemy or
   contested territory, that option switches on for the whole route; in a neutral or scorched
   region, the matching avoid option switches off. The panel shows the switch ticked or
   unticked and greyed, with a note such as "Switched on: the destination is in enemy
   territory."; it follows the places, so it reverts when the place changes.
6. **No route.** The panel says why: a place too far from a road; no road link between two
   places (an island, a land mass reached only by sea, or a gap in the traced roads); or the
   options close every road, naming the territory that would open it ("Every road from the
   start to the destination goes through enemy territory").
7. **Result.** Total distance in km with one decimal (road plus off-road), per leg when there
   are stops, how much of it runs through friendly, neutral, contested and enemy territory,
   and the fuel estimate (distance and fuel in two boxes of the same size, each with an (i)
   saying what the road network does not know and how the fuel is estimated), with a warning when it is more than the smallest tank of the class.
   A new complete route is fitted on screen beside the open panel (the view store's box
   request, as for rockets in the war log, now with the width the panel covers); "Show the
   route" fits it again.

## Decisions

From the developer (research, 25 November 2026): the team is chosen in the panel itself;
contested means hexes with casualties in the last hour; avoiding scorched and neutral regions
are options; vehicles are offered as speed classes, loaded, with fuel estimated on the high
side. Chosen while building, the simplest sensible option each time:

- **Team**: no default; the panel asks first and shows nothing else until one is chosen.
- **Defaults**: Safest; through contested territory on; through enemy territory off; avoid
  neutral regions off and avoid scorched regions off (both are common and usually passable;
  Safest already counts neutral ground double).
- **Remembered in the browser** (`fatt-route` in localStorage): team, route kind, options as
  chosen, vehicle class. The places are not remembered and not put in the link.
- **Penalties** (Safest), the research's example: friendly 0, neutral 1, contested 3, enemy
  10, so a km of enemy road costs as much as 11 km of friendly road.
- **Automatic options** apply to the whole route, not only to the region of the place.
- **Snapping** to the nearest point on a road, not the nearest junction, within 300 px.
- **Regions per piece of road**: by the middle of each polyline segment (segments are short,
  a few to a few dozen pixels); an edge is not split exactly at region borders.
- **Stops**: "Add stop" adds an empty place at the bottom, so the old destination becomes a
  stop. Every place can move up and down, so a stop moved above the start becomes the start.
  Empty fields are skipped: any two chosen places make a route. Any place, empty or not, can
  be removed while more than two remain. The order is the user's (no travelling salesman).
- **Picking on the map**: a crosshair button per place; the next click on the map (not a drag)
  picks it; Escape or the button again stops; closing the panel stops it too.
- **Choosing a place** with the search moves the map to it while the route is not complete;
  once it is, the route is fitted on screen. A place picked on the map, and adding, moving or
  removing a place, leaves the map where it is (2026-11-25, after the owner found the zoom
  jumps confusing).
- **Units**: km with one decimal; fuel in whole litres, rounded up.

### Vehicle classes and fuel

Fuel is used per minute of driving (Foxhole Wiki), so litres per km are the use per minute
divided by the speed. Each vehicle is taken **fully loaded**: slowed down by the largest
amount its wiki page gives (the fuel tanker's is not given; taken as 28 %, the largest of the
others). A class uses the figures of its **thirstiest** vehicle and its smallest tank, and
**25 % is added** for bends, hills, junctions, mud and weather. Figures are for update 1.67
and live in `lib/vehicles.js` with that version.

| Class | Vehicles | Tank | Road, loaded | Off-road, loaded | Estimate per road km |
| --- | --- | --- | --- | --- | --- |
| Fast | Dunne Transport / R-1 Hauler (2.00 L/km) | 100 L | 2.00 L/km | 10.0 L/km | 2.5 L |
| Medium | Dunne Fuelrunner 2d / RR-3 Stolon (4.29), Cnute Cliffwrest (4.43), AU-A150 Taurine Rigger (4.68) | 100 L | 4.68 L/km | 14.8 L/km | 5.9 L |
| Slow | BMS - Packmule Flatbed (6.39) | 150 L | 6.39 L/km | 12.8 L/km | 8.0 L |

Trucks have a class of their own (2026-11-25): in one class with the fuel tanker, the estimate
for a truck was about twice what it uses. The tanker drives about as fast as the heavy-duty
trucks (42 km/h loaded, against 41 and 38), so it joined the Medium class; its 100 L tank makes
the Medium tank warning come early for the heavy-duty trucks, which is on the safe side.

## Limitations

- **Road data**: traced from the map images; some hexes are poor or usable only (Dead Lands
  north, Lykos Isle, the islands), some roads and bridges are missing and the western and
  south-eastern land masses and the islands are separate networks, so routes there end with
  "no road link". No road tiers, so no speed bonus for asphalt; player-built roads, gates,
  walls and destroyed bridges are not known. See the road extraction research for the list.
- **Territory**: region outlines are partly approximate, so a road near a border can be put in
  the neighbouring region. Contested is per hex, not per region (the War API gives casualties
  per hex only). Fighting needs the statistics (`/api/stats`); without them nothing is
  contested.
- **Regions without a base** count as neutral, also when the hex is offline.
- **Safest** uses fixed penalties; there is no slider between shortest and safest.
- **Time** is not shown, only distance and fuel.
- **Fit on screen** keeps clear of the open panel on wide screens; on phones the panel covers
  the whole width and the route is fitted under it.
- **Not built**: "route from here / to here" on a structure's tooltip; the route in the link;
  counting route use in the visitor statistics beyond the clicks in the panel.

## Also changed

- The map search uses the shared place field; the Stats time spans use the shared row of
  choices (same look and behaviour as before).
- Arrow and chevron icons in buttons move 2 px in their direction on hover and keyboard focus,
  defined once in `main.css`, not with reduced motion.
- With five tabs the row of tabs is about 477 px wide, so the map search moves to a row of its
  own below 1,240 px (was 1,000 px) and makes way for an open panel of that width.
