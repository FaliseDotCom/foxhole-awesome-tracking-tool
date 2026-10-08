# History, statistics and map options

Ideas from [other-foxhole-sites.md](../other-foxhole-sites.md): use the history F.A.T.T. is now
recording as a timeline, show which hexes are active, count key structures per team, and let
viewers change how the map looks.

## 1. Recording (done)

The War API keeps no history, so everything below depends on recording it now. The cron tasks
(`lib/cron.php`) record, in the war log database:

| Table | What | How often | Size |
| --- | --- | --- | --- |
| `hex_history` | every version of a hex's items that differs from the one before (noise included), compressed; the first run stores all hexes as a starting point | every 15 s, only on change | about 500 bytes per change, 27 KB for the starting point |
| `reports` | per hex: enlistments and casualties per team so far this war (`worldconquest/warReport`) | every 5 minutes | 53 rows per sample, about 15,000 a day |
| `players` | players in the game, all shards together (Steam; it knows no teams) | every 5 minutes | one row per sample |

`WarlogStore::getHexesAt()` gives every hex as it was at any moment since recording started.

## 2. The war log as a timeline (done)

- Load older entries while scrolling down (`/api/log?before=<id>` exists already).
- Each entry gets two buttons: **go there** (as clicking does now) and **show the map at this
  moment**.
- `/api/history/<shard>?at=<ms>` answers like `/api/data`, from `getHexesAt()`.
- The map then shows that moment, with a bar "Map as it was on 8 Oct, 14:32 · Back to live";
  live updates pause, the war log stays usable to step through moments. Entries from before
  history recording started have no map button.

## 3. Statistics and active hexes (done)

- `/api/stats/<shard>?hours=24`: casualties per hour per hex and in total, enlistments, and the
  player count over time, worked out from `reports` and `players`.
- A **Stats** tab: players in the game now, casualties per hour over the last 24 hours, and the
  most active hexes (casualties in the last hour and day, per team); click a hex to go there.

## 4. Map shading and map look (done)

In Settings:

- **Hex shading:** none, *fighting* (hexes red by casualties in the last hour, against the
  busiest hex, from `reports`), or *changes* (hexes darker the more recently they had a war log
  event, within 6 hours).
- **Colour-blind palette** for the team colours (regions, war bar, log stripes).
- **Region colours** and **icon size** sliders, and hex names on or off.

The war bar also got the faction emblems, with their names, at both ends.

## 5. Structure counters and players (done)

Per team, next to the war bar: rocket sites (armed ones in red), storm cannons and intel
centres, as on FoxholeHQ, counted from the live map data. Hover for where they are. Early in a
war all three are 0: they are late-war technology, which is likely why FoxholeHQ's counters
look broken. The title shows the players in the game (`/api/players`).

## Order

1. Recording (done; needs a deploy, history starts then).
2. Structure counters and player count (done).
3. Timeline: older entries and the map at a moment (done).
4. Statistics tab and hex shading (done).
5. Map look settings (done).
