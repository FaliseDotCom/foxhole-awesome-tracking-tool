# Plan: rocket launches as arcs on the map

Date: 7 October 2026. Status: built on the documented icon sequence (`lib/rockets.js`,
`components/map/arcs.svelte`, rocket entries in `stores/warlog.js`); still to be checked against
a real launch. Not built yet: the 80 m blast circle (needs the hex size in metres) and fading
old arcs. Added: alarm, beacon and rumble on a live launch; flash, shockwave, explosion and
quake on a live impact (`stores/effects.js`, `lib/sound.js`, `assets/css/effects.css`).

Use the war log to work out when a rocket was fired, from where, and where it landed, and draw
an arc on the map from the launch site to the impact.

## What exists in Foxhole today

- **The rocket ("nuke") still exists.** The A0E-9 Rocket is launched from a player-built
  Rocket Site and permanently destroys structures within 80 m of where it lands. It was
  removed in update 1.52 and came back in 1.54 (Naval Warfare); it is still in the game
  ([Foxhole Wiki](https://foxhole.wiki.gg/wiki/A0E-9_Rocket_Platform)).
- **Mortar Houses are not a replacement.** A Mortar House (Emplacement House) is a town
  defence: a fixed mortar one soldier can fire up to 100 m
  ([Foxhole Wiki](https://foxhole.wiki.gg/wiki/Emplacement_House)). The War API only lists the
  building, never its shots, so mortar fire cannot be detected or drawn.

## What the War API shows of a rocket

Icon types documented in the War API README:

| Id | Name | Meaning (to verify against a real launch) |
| --- | --- | --- |
| 37 | Rocket Site | launch site without a rocket |
| 72 | Rocket Site With Rocket | launch site with a rocket assembled |
| 70 | Rocket Target | the target marker, before launch |
| 71 | Rocket Ground Zero | the impact point, after launch |

None of these appear in the current war's data, so the exact sequence has not been seen yet.
The likely sequence of one launch, as the war log would see it:

1. A Rocket Site (37) is **built**.
2. It becomes a Rocket Site With Rocket (72): **upgraded**.
3. A Rocket Target (70) **appears** somewhere, possibly only on the public map once launched.
4. The site turns back into 37 (**upgraded** in reverse), the target disappears, and a Rocket
   Ground Zero (71) **appears** at the impact point.
5. Structures around the impact are **scorched** or **destroyed**.

## Detecting a launch

A launch is a short burst of war log events, so it is a second pass over the changes of one
update (or two consecutive updates, because the launch site and the impact can be in
different hexes that update separately):

- **Launch site:** a 72 → 37 change. Its position is point A.
- **Impact:** a new 71. Its position is point B. If there is no 71, use the centre of the
  structures that were scorched or destroyed in the same update.
- **Pairing:** one launch and one impact within the same or the next update form one launch.
  With several at once (rare), pair each impact with the launch site that had a Rocket Target
  nearest to it, or else the nearest site.
- **Team:** the team of the launch site.

The result is a new war log entry, `kind: 'rocket'`, major, for example
"**Colonials** fired a rocket from The Spine, Dead Lands at Brine Glen, Dead Lands", with both
points. Clicking it fits the whole arc on screen (the search's "fit a box" view request).

If a site loses its rocket but no impact appears, log "rocket removed" without an arc rather
than guessing.

## Drawing the arc

- A new map layer, `components/map/arcs.svelte`, in `layer-map.svelte` above the icons, like
  the search marker.
- Each arc is an SVG quadratic Bézier path from A to B, with the control point raised
  perpendicular to the line by about a quarter of its length, so it reads as a trajectory.
  Map coordinates in map pixels, so it pans and zooms with the map; the stroke width divided
  by the zoom (`--scale`) so it stays the same on screen.
- Team colour from `vars.css`; a small circle of 80 m radius at B for the blast. That needs the
  hex size in metres to convert, which is still to be confirmed (one hex is about 2.2 km
  across).
- Animate once when the entry arrives (`stroke-dashoffset` from the full length to 0), then
  stay. Arcs older than an hour fade out; with the server log (war log phase 2) they could be
  shown for the whole war, with a toggle.

## Before building

1. Record the data during a real launch: save `/api/data/<shard>` every 10 seconds for a few
   minutes around one, to confirm the icon sequence above and whether the Rocket Target is
   ever public. This is easiest once the war log's server recording (phase 2) exists, since
   launches are rare and unannounced.
2. Then build detection as a pure function next to `lib/warlog-diff.js`, with unit tests made
   from the recorded data, and the arc layer.
