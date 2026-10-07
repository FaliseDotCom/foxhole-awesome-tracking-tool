<?php

/**
 * Compare two versions of the map items in one hex and list what changed. A port of
 * .app/src/lib/warlog-diff.js; both run the test cases in
 * .app/src/tests/fixtures/warlog-diff.json, so keep them in step.
 *
 * Items are [ 'x', 'y', 't', 'i', 'f' ]: position (0–1 in the hex), team ('W', 'C' or ''),
 * icon type, and flags. They have no id, so they are matched by position.
 */
class WarlogDiff
{
  /**
   * Flag bit for a scorched structure, as in the War API.
   * @var int
   */
  public const SCORCHED = 0x10;

  /**
   * Changes between two versions of a hex's items.
   *
   * Kinds: built, destroyed, upgraded (type changed), captured (team gained, from neutral or
   * the other team), lost (team gone), scorched. Each change is [ 'kind', 'item', 'previous' ]
   * where item is the new version (the old one for destroyed) and previous the old one (null
   * for built).
   *
   * @param  array<int, array<string, mixed>> $previous Items before.
   * @param  array<int, array<string, mixed>> $next     Items after.
   * @param  int[]                            $ignore   Icon types to skip, such as resource fields.
   * @return array<int, array<string, mixed>> Changes.
   */
  public static function diff( array $previous, array $next, array $ignore = [] ) : array
  {
    $unmatched = [];
    foreach ( $previous as $item )
    {
      if ( in_array( (int) $item[ 'i' ], $ignore, true ) )
      {
        continue;
      }
      $unmatched[ self::positionKey( $item ) ][] = $item;
    }

    $changes = [];
    foreach ( $next as $item )
    {
      if ( in_array( (int) $item[ 'i' ], $ignore, true ) )
      {
        continue;
      }

      $key = self::positionKey( $item );
      $before = self::takeMatch( $unmatched, $key, $item );
      if ( $before === null )
      {
        $changes[] = [ 'kind' => 'built', 'item' => $item, 'previous' => null ];
        continue;
      }

      if ( $before[ 'i' ] !== $item[ 'i' ] )
      {
        $changes[] = [ 'kind' => 'upgraded', 'item' => $item, 'previous' => $before ];
      }

      if ( $before[ 't' ] !== $item[ 't' ] )
      {
        $changes[] = [ 'kind' => $item[ 't' ] !== '' ? 'captured' : 'lost', 'item' => $item, 'previous' => $before ];
      }

      if ( !( $before[ 'f' ] & self::SCORCHED ) && ( $item[ 'f' ] & self::SCORCHED ) )
      {
        $changes[] = [ 'kind' => 'scorched', 'item' => $item, 'previous' => $before ];
      }
    }

    foreach ( $unmatched as $items )
    {
      foreach ( $items as $item )
      {
        $changes[] = [ 'kind' => 'destroyed', 'item' => $item, 'previous' => $item ];
      }
    }

    return $changes;
  }

  /**
   * Key for matching an item between versions: its position.
   *
   * @param  array<string, mixed> $item Map item.
   * @return string Position key.
   */
  private static function positionKey( array $item ) : string
  {
    return json_encode( [ $item[ 'x' ], $item[ 'y' ] ] );
  }

  /**
   * Take the best previous item for a new one from the same position: the same type first,
   * otherwise any (a type change such as a town hall upgrade).
   *
   * @param  array<string, array<int, array<string, mixed>>> $unmatched Previous items by position; the match is removed.
   * @param  string                                           $key       Position key.
   * @param  array<string, mixed>                             $item      New item.
   * @return array<string, mixed>|null The matching previous item.
   */
  private static function takeMatch( array &$unmatched, string $key, array $item ) : ?array
  {
    if ( empty( $unmatched[ $key ] ) )
    {
      return null;
    }

    $index = 0;
    foreach ( $unmatched[ $key ] as $i => $candidate )
    {
      if ( $candidate[ 'i' ] === $item[ 'i' ] )
      {
        $index = $i;
        break;
      }
    }

    $match = $unmatched[ $key ][ $index ];
    array_splice( $unmatched[ $key ], $index, 1 );
    if ( !$unmatched[ $key ] )
    {
      unset( $unmatched[ $key ] );
    }
    return $match;
  }
}
