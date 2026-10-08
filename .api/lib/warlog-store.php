<?php

/**
 * Storage for the server-side war log: events, the last snapshot of every hex, and recording
 * status per shard, in one SQLite file. See .docs/plans/2026-10-07-war-log.md.
 */
class WarlogStore
{
  /**
   * Database connection.
   * @var PDO
   */
  private PDO $db;

  /**
   * Open (and create when needed) the database.
   *
   * @param string $file Path of the SQLite file; its folder is created when missing.
   * @throws RuntimeException When SQLite is not available.
   */
  public function __construct( string $file )
  {
    if ( !in_array( 'sqlite', PDO::getAvailableDrivers(), true ) )
    {
      throw new RuntimeException( 'pdo_sqlite is not available' );
    }

    $folder = dirname( $file );
    if ( !is_dir( $folder ) )
    {
      mkdir( $folder, 0755, true );
    }

    $this->db = new PDO( 'sqlite:' . $file, null, null, [ PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION ] );
    // wait for a moment instead of failing when the cron job and a request write at once
    $this->db->exec( 'PRAGMA busy_timeout = 5000' );
    $this->db->exec( 'PRAGMA journal_mode = WAL' );
    $this->createTables();
  }

  /**
   * Create the tables on first use.
   *
   * @return void
   */
  private function createTables() : void
  {
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS events (
      id         INTEGER PRIMARY KEY,
      shard      TEXT    NOT NULL,
      war        INTEGER NOT NULL,
      time       INTEGER NOT NULL,
      hex        TEXT    NOT NULL,
      kind       TEXT    NOT NULL,
      major      INTEGER NOT NULL,
      icon       INTEGER,
      icon_from  INTEGER,
      team       TEXT,
      team_from  TEXT,
      flags      INTEGER,
      flags_from INTEGER,
      x          REAL,
      y          REAL,
      value      INTEGER,
      required   INTEGER
    )' );
    $this->db->exec( 'CREATE INDEX IF NOT EXISTS events_by_war ON events ( shard, war, id )' );
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS snapshots (
      shard   TEXT    NOT NULL,
      hex     TEXT    NOT NULL,
      version INTEGER NOT NULL,
      items   TEXT    NOT NULL,
      PRIMARY KEY ( shard, hex )
    )' );
    // every version of a hex's items that differs from the one before, for the map at any
    // moment of a war; items are compressed (see pack())
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS hex_history (
      shard TEXT    NOT NULL,
      war   INTEGER NOT NULL,
      hex   TEXT    NOT NULL,
      time  INTEGER NOT NULL,
      items BLOB    NOT NULL,
      PRIMARY KEY ( shard, war, hex, time )
    )' );
    // war report per hex (enlistments and casualties so far this war), sampled every few minutes
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS reports (
      shard       TEXT    NOT NULL,
      war         INTEGER NOT NULL,
      hex         TEXT    NOT NULL,
      time        INTEGER NOT NULL,
      enlistments INTEGER NOT NULL,
      colonials   INTEGER NOT NULL,
      wardens     INTEGER NOT NULL,
      PRIMARY KEY ( shard, war, hex, time )
    )' );
    // players in the game (all shards together, from Steam), sampled every few minutes
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS players (
      time  INTEGER PRIMARY KEY,
      count INTEGER NOT NULL
    )' );
    // the latest map data of each shard, as /api/data sends it
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS latest (
      shard    TEXT    PRIMARY KEY,
      saved_at INTEGER NOT NULL,
      data     TEXT    NOT NULL
    )' );
    $this->db->exec( 'CREATE TABLE IF NOT EXISTS status (
      shard       TEXT PRIMARY KEY,
      war         INTEGER,
      recorded_at INTEGER,
      wardens     INTEGER,
      colonials   INTEGER,
      winner      TEXT
    )' );

    // columns added after the first release; databases created before get them here
    $this->addColumn( 'events', 'recorded_by', 'TEXT' );
    $this->addColumn( 'status', 'recorded_by', 'TEXT' );
    $this->addColumn( 'status', 'cron_at', 'INTEGER' );
  }

  /**
   * Add a column to a table unless it already exists.
   *
   * @param  string $table  Table name.
   * @param  string $column Column name.
   * @param  string $type   SQLite column type.
   * @return void
   */
  private function addColumn( string $table, string $column, string $type ) : void
  {
    $columns = array_column( $this->db->query( "PRAGMA table_info( {$table} )" )->fetchAll( PDO::FETCH_ASSOC ), 'name' );
    if ( !in_array( $column, $columns, true ) )
    {
      $this->db->exec( "ALTER TABLE {$table} ADD COLUMN {$column} {$type}" );
    }
  }

  /**
   * Run a function inside a transaction.
   *
   * @param  callable $work Writes to do together.
   * @return void
   */
  public function transaction( callable $work ) : void
  {
    $this->db->beginTransaction();
    try
    {
      $work();
      $this->db->commit();
    }
    catch ( Throwable $e )
    {
      $this->db->rollBack();
      throw $e;
    }
  }

  /**
   * Recording status of a shard.
   *
   * @param  string $shard Shard name.
   * @return array<string, mixed> war, recorded_at, wardens, colonials, winner, recorded_by, cron_at;
   *   empty when never recorded.
   */
  public function getStatus( string $shard ) : array
  {
    $query = $this->db->prepare( 'SELECT * FROM status WHERE shard = ?' );
    $query->execute( [ $shard ] );
    return $query->fetch( PDO::FETCH_ASSOC ) ?: [];
  }

  /**
   * Save the recording status of a shard.
   *
   * @param  string               $shard  Shard name.
   * @param  array<string, mixed> $status war, recorded_at, wardens, colonials, winner,
   *   recorded_by (cron or request), cron_at (last cron run, ms).
   * @return void
   */
  public function saveStatus( string $shard, array $status ) : void
  {
    $query = $this->db->prepare( 'INSERT OR REPLACE INTO status
      ( shard, war, recorded_at, wardens, colonials, winner, recorded_by, cron_at )
      VALUES ( ?, ?, ?, ?, ?, ?, ?, ? )' );
    $query->execute( [
      $shard,
      $status[ 'war' ],
      $status[ 'recorded_at' ],
      $status[ 'wardens' ],
      $status[ 'colonials' ],
      $status[ 'winner' ],
      $status[ 'recorded_by' ] ?? null,
      $status[ 'cron_at' ] ?? null
    ] );
  }

  /**
   * Last saved items and version of every hex of a shard.
   *
   * @param  string $shard Shard name.
   * @return array<string, array<string, mixed>> Per hex: version and items.
   */
  public function getSnapshots( string $shard ) : array
  {
    $query = $this->db->prepare( 'SELECT hex, version, items FROM snapshots WHERE shard = ?' );
    $query->execute( [ $shard ] );

    $snapshots = [];
    foreach ( $query->fetchAll( PDO::FETCH_ASSOC ) as $row )
    {
      $snapshots[ $row[ 'hex' ] ] = [
        'version' => (int) $row[ 'version' ],
        'items'   => json_decode( $row[ 'items' ], true ) ?: []
      ];
    }
    return $snapshots;
  }

  /**
   * Save the items of one hex.
   *
   * @param  string                           $shard   Shard name.
   * @param  string                           $hex     Hex name as the API proxy sends it.
   * @param  int                              $version Hex version from the War API.
   * @param  array<int, array<string, mixed>> $items   Map items.
   * @return void
   */
  public function saveSnapshot( string $shard, string $hex, int $version, array $items ) : void
  {
    $query = $this->db->prepare( 'INSERT OR REPLACE INTO snapshots ( shard, hex, version, items ) VALUES ( ?, ?, ?, ? )' );
    $query->execute( [ $shard, $hex, $version, json_encode( $items ) ] );
  }

  /**
   * Compress items for storage; plain JSON when zlib is missing.
   *
   * @param  array<int, array<string, mixed>> $items Map items.
   * @return string Stored value.
   */
  private function pack( array $items ) : string
  {
    $json = (string) json_encode( $items );
    return function_exists( 'gzdeflate' ) ? (string) gzdeflate( $json, 6 ) : $json;
  }

  /**
   * Items from a stored value, see pack().
   *
   * @param  string $value Stored value.
   * @return array<int, array<string, mixed>> Map items.
   */
  private function unpack( string $value ) : array
  {
    $json = function_exists( 'gzinflate' ) ? @gzinflate( $value ) : false;
    return json_decode( $json === false ? $value : $json, true ) ?: [];
  }

  /**
   * Hexes of a war that have a stored version of their items.
   *
   * @param  string $shard Shard name.
   * @param  int    $war   War number.
   * @return string[] Hex names.
   */
  public function getHistoryHexes( string $shard, int $war ) : array
  {
    $query = $this->db->prepare( 'SELECT DISTINCT hex FROM hex_history WHERE shard = ? AND war = ?' );
    $query->execute( [ $shard, $war ] );
    return $query->fetchAll( PDO::FETCH_COLUMN );
  }

  /**
   * Store a new version of a hex's items.
   *
   * @param  string                           $shard Shard name.
   * @param  int                              $war   War number.
   * @param  string                           $hex   Hex name as the API proxy sends it.
   * @param  int                              $time  When the War API says the hex changed, in ms.
   * @param  array<int, array<string, mixed>> $items Map items.
   * @return void
   */
  public function saveHexHistory( string $shard, int $war, string $hex, int $time, array $items ) : void
  {
    $query = $this->db->prepare( 'INSERT OR REPLACE INTO hex_history ( shard, war, hex, time, items ) VALUES ( ?, ?, ?, ?, ? )' );
    $query->bindValue( 1, $shard );
    $query->bindValue( 2, $war, PDO::PARAM_INT );
    $query->bindValue( 3, $hex );
    $query->bindValue( 4, $time, PDO::PARAM_INT );
    $query->bindValue( 5, $this->pack( $items ), PDO::PARAM_LOB );
    $query->execute();
  }

  /**
   * The items of every hex as they were at a moment of a war: per hex, the last version stored
   * at or before that time.
   *
   * @param  string $shard Shard name.
   * @param  int    $war   War number.
   * @param  int    $time  Moment in ms.
   * @return array<string, array{time: int, items: array<int, array<string, mixed>>}> Per hex.
   */
  public function getHexesAt( string $shard, int $war, int $time ) : array
  {
    $query = $this->db->prepare( 'SELECT h.hex, h.time, h.items FROM hex_history h
      JOIN ( SELECT hex, MAX( time ) AS time FROM hex_history
             WHERE shard = :shard AND war = :war AND time <= :time GROUP BY hex ) latest
        ON latest.hex = h.hex AND latest.time = h.time
      WHERE h.shard = :shard AND h.war = :war' );
    $query->execute( [ 'shard' => $shard, 'war' => $war, 'time' => $time ] );

    $hexes = [];
    foreach ( $query->fetchAll( PDO::FETCH_ASSOC ) as $row )
    {
      $hexes[ $row[ 'hex' ] ] = [ 'time' => (int) $row[ 'time' ], 'items' => $this->unpack( (string) $row[ 'items' ] ) ];
    }
    return $hexes;
  }

  /**
   * When the war reports of a shard were last sampled.
   *
   * @param  string $shard Shard name.
   * @return int Time in ms, 0 for never.
   */
  public function getReportTime( string $shard ) : int
  {
    $query = $this->db->prepare( 'SELECT MAX( time ) FROM reports WHERE shard = ?' );
    $query->execute( [ $shard ] );
    return (int) $query->fetchColumn();
  }

  /**
   * Store one sample of the war reports of a shard.
   *
   * @param  string                            $shard   Shard name.
   * @param  int                               $war     War number.
   * @param  int                               $time    Sample time in ms.
   * @param  array<string, array<string, int>> $reports Per hex: enlistments, colonials, wardens.
   * @return void
   */
  public function saveReports( string $shard, int $war, int $time, array $reports ) : void
  {
    $query = $this->db->prepare( 'INSERT OR REPLACE INTO reports ( shard, war, hex, time, enlistments, colonials, wardens )
      VALUES ( ?, ?, ?, ?, ?, ?, ? )' );
    foreach ( $reports as $hex => $report )
    {
      $query->execute( [ $shard, $war, $hex, $time, $report[ 'enlistments' ], $report[ 'colonials' ], $report[ 'wardens' ] ] );
    }
  }

  /**
   * When the player count was last sampled.
   *
   * @return int Time in ms, 0 for never.
   */
  public function getPlayersTime() : int
  {
    return (int) $this->db->query( 'SELECT MAX( time ) FROM players' )->fetchColumn();
  }

  /**
   * The last sample of the player count.
   *
   * @return array{time: int, count: int} Sample; time 0 and count 0 when there is none.
   */
  public function getPlayers() : array
  {
    $row = $this->db->query( 'SELECT time, count FROM players ORDER BY time DESC LIMIT 1' )->fetch( PDO::FETCH_ASSOC );
    return [ 'time' => (int) ( $row[ 'time' ] ?? 0 ), 'count' => (int) ( $row[ 'count' ] ?? 0 ) ];
  }

  /**
   * Store one sample of the player count.
   *
   * @param  int $time  Sample time in ms.
   * @param  int $count Players in the game.
   * @return void
   */
  public function savePlayers( int $time, int $count ) : void
  {
    $this->db->prepare( 'INSERT OR REPLACE INTO players ( time, count ) VALUES ( ?, ? )' )->execute( [ $time, $count ] );
  }

  /**
   * Keep the latest map data of a shard.
   *
   * @param  string               $shard Shard name.
   * @param  array<string, mixed> $data  Compressed map data from FoxholeApi::async_dynamics().
   * @param  int                  $time  When it was fetched, in ms.
   * @return void
   */
  public function saveLatest( string $shard, array $data, int $time ) : void
  {
    $query = $this->db->prepare( 'INSERT OR REPLACE INTO latest ( shard, saved_at, data ) VALUES ( ?, ?, ? )' );
    $query->execute( [ $shard, $time, json_encode( $data ) ] );
  }

  /**
   * The latest map data of a shard, if it was fetched recently enough.
   *
   * @param  string $shard Shard name.
   * @param  int    $since Oldest acceptable fetch time, in ms.
   * @return array<string, mixed> Map data, or [] when there is none that recent.
   */
  public function getLatest( string $shard, int $since ) : array
  {
    $query = $this->db->prepare( 'SELECT data FROM latest WHERE shard = ? AND saved_at >= ?' );
    $query->execute( [ $shard, $since ] );
    $data = $query->fetchColumn();
    return is_string( $data ) ? ( json_decode( $data, true ) ?: [] ) : [];
  }

  /**
   * Forget every snapshot of a shard, for a new war.
   *
   * @param  string $shard Shard name.
   * @return void
   */
  public function clearSnapshots( string $shard ) : void
  {
    $this->db->prepare( 'DELETE FROM snapshots WHERE shard = ?' )->execute( [ $shard ] );
  }

  /**
   * Store events.
   *
   * @param  array<int, array<string, mixed>> $events Events with the columns of the events table.
   * @return void
   */
  public function addEvents( array $events ) : void
  {
    $query = $this->db->prepare( 'INSERT INTO events
      ( shard, war, time, hex, kind, major, icon, icon_from, team, team_from, flags, flags_from, x, y, value, required, recorded_by )
      VALUES ( :shard, :war, :time, :hex, :kind, :major, :icon, :icon_from, :team, :team_from, :flags, :flags_from, :x, :y, :value, :required, :recorded_by )' );

    $columns = [ 'shard', 'war', 'time', 'hex', 'kind', 'major', 'icon', 'icon_from', 'team', 'team_from', 'flags', 'flags_from', 'x', 'y', 'value', 'required', 'recorded_by' ];
    foreach ( $events as $event )
    {
      $values = [];
      foreach ( $columns as $column )
      {
        $values[ $column ] = $event[ $column ] ?? null;
      }
      $query->execute( $values );
    }
  }

  /**
   * Whether an event of a kind was stored for one spot since a time.
   *
   * @param  string $shard Shard name.
   * @param  int    $war   War number.
   * @param  string $hex   Hex name.
   * @param  string $kind  Event kind.
   * @param  float  $x     Position in the hex, 0–1.
   * @param  float  $y     Position in the hex, 0–1.
   * @param  int    $since Time in ms.
   * @return bool True when there is one.
   */
  public function hasEvent( string $shard, int $war, string $hex, string $kind, float $x, float $y, int $since ) : bool
  {
    $query = $this->db->prepare( 'SELECT 1 FROM events
      WHERE shard = :shard AND war = :war AND hex = :hex AND kind = :kind AND x = :x AND y = :y AND time >= :since
      LIMIT 1' );
    $query->execute( [ 'shard' => $shard, 'war' => $war, 'hex' => $hex, 'kind' => $kind, 'x' => $x, 'y' => $y, 'since' => $since ] );
    return (bool) $query->fetchColumn();
  }

  /**
   * Events of a war, newest first.
   *
   * @param  string $shard  Shard name.
   * @param  int    $war    War number.
   * @param  int    $since  Only events with a higher id; 0 for no limit.
   * @param  int    $before Only events with a lower id; 0 for no limit.
   * @param  int    $limit  Most events returned.
   * @param  bool   $major  Only major events.
   * @return array<int, array<string, mixed>> Events.
   */
  public function getEvents( string $shard, int $war, int $since, int $before, int $limit, bool $major = false ) : array
  {
    $sql = 'SELECT * FROM events WHERE shard = :shard AND war = :war';
    $values = [ 'shard' => $shard, 'war' => $war ];
    if ( $major )
    {
      $sql .= ' AND major = 1';
    }
    if ( $since > 0 )
    {
      $sql .= ' AND id > :since';
      $values[ 'since' ] = $since;
    }
    if ( $before > 0 )
    {
      $sql .= ' AND id < :before';
      $values[ 'before' ] = $before;
    }
    $sql .= ' ORDER BY id DESC LIMIT ' . max( 1, $limit );

    $query = $this->db->prepare( $sql );
    $query->execute( $values );
    return $query->fetchAll( PDO::FETCH_ASSOC );
  }
}
