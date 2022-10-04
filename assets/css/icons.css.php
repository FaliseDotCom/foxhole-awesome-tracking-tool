<?php
  header( "Content-type: text/css" );

  $icons = [
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
    23 => "SulfurField",
    24 => "World Map Tent",
    25 => "Travel Tent",
    26 => "Training Area",
    27 => "Special Base",
    28 => "Observation Tower",
    29 => "Fort",
    30 => "Troop Ship",

    32 => "Sulfur Mine",
    33 => "torage Facility",
    34 => "Factory",
    35 => "Garrison Station",
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

    61 => "Coal Field",
    62 => "OilWell", // "Oil Field" doesn't exist
   ];

    foreach ( $icons as $key => $value)
    {
      $value = str_replace( ' ', '', $value );
      $none = '/assets/images/icons/MapIcon' . $value . '.png';
      echo '#maps .item.icon-' . $key . ' { background-image: url( ' . $none . ' ); } ';
      //echo '#maps .hex-pop .item.team-WARDENS.icon-' . $key . ' { background-image: url( ' . $none . ' ), url( /assets/images/icons/MapIcon' . $value . 'Warden.png ); } ';
      //echo '#maps .hex-pop .item.team-COLONIALS.icon-' . $key . ' { background-image: url( ' . $none . '), url( /assets/images/icons/MapIcon' . $value . 'Colonial.png ); } ';
    }
?>