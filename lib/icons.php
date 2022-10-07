<?php

// class for displaying icons
class Icons
{
  // icon id => filename
  private static $icons = [
    5 => "StaticBase1",
    6 => "StaticBase2",
    7 => "StaticBase3",

    8 => "ForwardBase1",
    9 => "ForwardBase2",
    10 => "ForwardBase3",

    11 => "Hospital",
    12 => "Vehicle",
    13 => "Armory",
    14 => "SupplyStation",
    15 => "Workshop",
    16 => "ManufacturingPlant",
    17 => "Refinery",
    18 => "Shipyard",
    19 => "TechCenter",

    20 => "Salvage",
    21 => "Components",
    22 => "FuelField",
    23 => "Sulfur",
    24 => "World Map Tent",
    25 => "Travel Tent",
    26 => "Training Area",
    //27 => "Special Base",
    28 => "Observation Tower",
    29 => "Fort",
    30 => "Troop Ship",

    32 => "Sulfur Mine",
    33 => "Storage Facility",
    34 => "Factory",
    //35 => "Garrison Station",
    36 => "Ammo Factory",
    37 => "Rocket Site",
    38 => "Salvage Mine",
    39 => "Construction Yard",
    40 => "Component Mine",
    41 => "Oil Well",

    45 => "Relic Base", // 1
    46 => "Relic Base", // 2
    47 => "Relic Base", // 3

    51 => "Mass Production Factory",
    52 => "Seaport",
    53 => "Coastal Gun",
    54 => "Soul Factory",

    56 => "Town Base Tier 1",
    57 => "Town Base Tier 2",
    58 => "Town Base Tier 3",

    59 => "Storm Cannon",
    60 => "Intel Center",

    //61 => "Coal Field",
    62 => "OilWell", // "Oil Field" doesn't exist
  ];

  private static $path = '/assets/images/icons/';
  private static $ext = '.png';

  function __construct(  )
  {
  }

  /**
   * Get an icon by id
   * @param  int          $id   [description]
   * @param  bool|boolean $bare [description]
   * @return [type]             [description]
   */
  public static function getIcon( string $id, bool $bare = false )
  {
    $name = isset( self::$icons[ $id] ) ? self::$icons[ $id] : '';
    return self::getName( $name, $bare );
  }

  /**
   * Get a Colonial version of an icon path
   * @param  string $name [description]
   * @return [type]       [description]
   */
  public static function getColonialIcon( string $name )
  {
    return str_replace( self::$ext, 'Colonial' . self::$ext, $name );
  }

  /**
   * Get a Warden version of an icon path
   * @param  string $name [description]
   * @return [type]       [description]
   */
  public static function getWardenIcon( string $name )
  {
    return str_replace( self::$ext, 'Warden' . self::$ext, $name );
  }

  /**
   * Cleanup icon name, add path
   * @param  string       $name [description]
   * @param  bool|boolean $bare [description]
   * @return [type]             [description]
   */
  private static function getName( string $name, bool $bare = false )
  {
    // remove spaces ( I was lazy with the copy/paste )
    $name = strtolower( trim( str_replace( ' ', '', $name ) ) );
    // return full path
    if ( $name && !$bare ) return self::$path . $name . self::$ext;
    // return bare name
    return $name;
  }

  /**
   * Get full list of icons
   */
  public static function getIcons( bool $bare = false )
  {
    return array_map( function( $name ) use ( $bare )
    {
      return self::getName( $name, $bare  );
    }, self::$icons );
  }
}