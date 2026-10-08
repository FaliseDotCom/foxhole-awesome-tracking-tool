# Other Foxhole sites

What other Foxhole war map and war data sites do, and how F.A.T.T. differs. Checked on 8 October
2026, during war 141. Several of these sites are single-page apps that show little without a
browser, so some features come from their meta tags, GitHub pages, or the community list at
[pickles976/FoxholeProjects](https://github.com/pickles976/FoxholeProjects). Where something could
not be checked, it says so.

## War maps and war data

### Foxhole Stats

[foxholestats.com](https://foxholestats.com/), with `shard2.` and `shard3.` subdomains for the
other shards. The oldest general stats and map site, by hayden-t.

- Live map with faction control, darker for more recent changes (up to 5 days back), and a page
  per region with its activity per hour (`/?map=AllodsBightHex&days=3`).
- Event log of captures, losses and construction, in UTC, in over 20 languages.
- Steam player count, casualties and casualty rate, enlistments, scorched victory towns over
  1–7 days, a commander leaderboard.
- History of every war (1–141): winner, length, casualties, and the overall tally. Replay videos
  of wars 34–141 ([hayden-t/foxholestats-resources](https://github.com/hayden-t/foxholestats-resources)).
- A `/data/` page with population and queue analysis for wars 63–111, with downloads.
- Own history database going back years. A heavy, older jQuery UI page, with a "slim" mode;
  phone use not checked.

### FoxholeHQ

[foxholehq.com](https://foxholehq.com/), by TreeSugar. A toolbox for regiments.

- Map (`/map`) refreshed every 15 seconds, with a shard selector and over 70 icon types.
- Colour-blind palettes, icon size and opacity settings, hex overlay.
- Distance and azimuth tool with vehicle travel times, weapon range presets, drawing (not saved).
- Discord login for private regiment marker groups, with invite codes and roles.
- A 3D model viewer, a logistics calculator, and a browser extension that shows victory points
  and superweapons. The sister site foxholehq.net has a factory queue calculator; its stockpile
  map is offline.
- No search, war log or history found; desktop first. The page as served says "War 114 | Able"
  (the app may correct that once loaded; not confirmed).

### FoxholeHub

[foxholehub.com](https://www.foxholehub.com/), by Hendo. War follow-up plus a content hub.

- Victory town progress, casualties and faction population on the front page.
- `/stats/`: charts of casualties, casualty rate, victory towns, regions, bases and enlistments
  over 24 hours to the whole war, sampled every 3 minutes, and the most active regions of the
  last 24 hours with casualties per faction.
- `/map/` with live faction control, and a war archive (`/wars/`) from war 135 (May 2026).
- YouTube videos, Shorts, Twitch streams and weekly top clips.
- Modern and clean (Astro). No shard selector, event log, or structure detail found.

### Foxhole 3D Map

[foxholemap3d.app](https://foxholemap3d.app/): a 3D terrain map; whether it shows live war data
could not be checked.

### Sigil HQ

[sigilhq.com](https://sigilhq.com/), with `/stats/`: "an organizational platform for Foxhole
players", apparently Colonial. A single-page app, so its features could not be checked; it is
mentioned elsewhere for artillery and planning tools.

## Tools without a war map

- **[LogiWaze](https://www.logiwaze.com/)** ([source](https://github.com/NoUDerp/LogiWaze)):
  route planning by vehicle (jeep, truck, heavy truck, flatbed) and road tier, like a navigation
  app. Towns from the War API, roads drawn by hand.
- **[FHArty](https://fharty.com/)** and
  **[ArtilleryCalc](https://albert-b-b.github.io/ArtilleryCalc/)**: artillery calculators on the
  map; pick a gun position and a target for distance and azimuth (ArtilleryCalc also does wind).
- **[Foxhole Planner](https://foxholeplanner.com/)**: plan facilities, bunkers and trenches
  before building.
- **[Foxhole Logistics Calculator](https://foxholelogi.com/)**: costs of factory orders, mass
  production and vehicle crates.

## Discord bots

- **FoxholeWarBot** (on about 600 servers): war state, casualties and hex images on request,
  per shard. Basic and without notifications, by the author's own description.
- **[Storeman-Bot](https://github.com/Tkaixiang/Storeman-Bot)**: stockpile contents from scans
  with the Stockpiler overlay, a logistics channel that updates itself, reminders before
  reserve stockpiles expire, and item search.

## Offline or stale

warmap.pogobanane.de, foxholeglobal.com and foxhole.tools did not answer; foxholeglobal's map and
foxholebounties.com are listed as unmaintained; foxholemap.com only frames Foxhole Stats. Searches
for "artillery calculator" and "logi calculator" mostly turn up spam pages on taken-over domains.

## What others have that F.A.T.T. does not

- **History of every war**, war archives and replay videos (Foxhole Stats, FoxholeHub). F.A.T.T.
  only has history since it started recording, because the War API keeps none.
- **Statistics over time**: casualties, victory towns, population and player counts, most active
  regions (FoxholeHub, Foxhole Stats). The War API's war report endpoint has casualties per hex,
  so this could be recorded alongside the war log.
- **Map ageing**: regions shaded by how recently they changed (Foxhole Stats). F.A.T.T.'s war log
  has the data for this.
- **Measuring and artillery tools**: distance, azimuth, weapon ranges, drawing (FoxholeHQ, FHArty).
- **Routes** by vehicle and road (LogiWaze).
- **Discord login with private regiment markers** (FoxholeHQ), and **Discord bots** for war state
  and stockpiles.
- **Accessibility settings**: colour-blind palettes, icon size and opacity (FoxholeHQ). F.A.T.T.
  has icon brightness only.
- **A browser extension** for victory points and superweapons (FoxholeHQ).
- **Event log in many languages** (Foxhole Stats).
- **Community content**: streams, videos, clips (FoxholeHub).

## What F.A.T.T. does that others do not

As far as could be checked:

- **Rockets**: launches and impacts shown as arcs on the map, with alarm and impact sounds. No
  other site shows rocket launches.
- **Live map with structure detail and a recorded war log on one page**: Foxhole Stats has a log
  with a coarser map, FoxholeHQ detail without a log. F.A.T.T.'s log tells construction from
  captures and leaves out build sites that come and go.
- **Search** for places and structures, in the map and in the war log, and **shareable links**
  to a view. No other map has search; Foxhole Stats links to single regions only.
- **A phone layout.** The others look desktop first (not checked on phones).
- **A victory town bar on the map**, with the totals in the war log.
- **All shards on one site**, as FoxholeHQ has; Foxhole Stats uses subdomains, FoxholeHub showed
  no shard choice.

## Ideas this suggests

In rough order of value for the effort:

1. **Map ageing** from the war log: shade regions by the time since their last change.
2. **Victory towns and casualties over time**: record the war report every few minutes next to
   the war log and chart it; also the basis for a timeline or replay later.
3. **A link to Foxhole Stats' war archive** for wars before F.A.T.T. started recording.
4. **Colour-blind palette** setting for the team colours.
5. **Distance and azimuth tool**, if artillery players are an audience.
