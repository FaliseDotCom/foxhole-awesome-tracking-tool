<script>
  import { fly } from 'svelte/transition';
	import DataHex from './data.svelte'
  // import icons from '@stores/icons'
  export let name = ''
  let data = null
  const url = `worldconquest/maps/${name}/dynamic/public`,
        time = 10,
        size = 25,
        icons = {
          5 : "StaticBase1",
          6 : "StaticBase2",
          7 : "StaticBase3",

          8 : "ForwardBase1",
          9 : "ForwardBase2",
          10 : "ForwardBase3",

          11 : "Hospital",
          12 : "Vehicle",
          13 : "Armory",
          14 : "SupplyStation",
          15 : "Workshop",
          16 : "ManufacturingPlant",
          17 : "Refinery",
          18 : "Shipyard",
          19 : "TechCenter",

          20 : "Salvage",
          21 : "Components",
          22 : "FuelField",
          23 : "Sulfur",
          24 : "World Map Tent",
          25 : "Travel Tent",
          26 : "Training Area",
          //27 : "Special Base",
          28 : "Observation Tower",
          29 : "Fort",
          30 : "Troop Ship",

          32 : "Sulfur Mine",
          33 : "Storage Facility",
          34 : "Factory",
          //35 : "Garrison Station",
          36 : "Ammo Factory",
          37 : "rocketfacility", // rocket site?
          38 : "salvage", // "Salvage Mine",
          39 : "Construction Yard",
          40 : "Component Mine",
          41 : "Oil Well",

          45 : "Relic Base", // 1
          46 : "Relic Base", // 2
          47 : "Relic Base", // 3

          51 : "Mass Production Factory",
          52 : "Seaport",
          53 : "Coastal Gun",
          54 : "Soul Factory",

          56 : "Town Base Tier 1",
          57 : "Town Base Tier 2",
          58 : "Town Base Tier 3",

          59 : "Storm Cannon",
          60 : "Intel Center",

          //61 : "Coal Field",
          // 62 : "OilWell", // "Oil Field" doesn't exist
        }

  const getIcon = id => ( id in icons )  ? `/icons/${ icons[ id ].replaceAll( ' ', '' ).toLowerCase() }.png` : ''

        //icons.url( item.iconType )
</script>

<DataHex bind:data={ data } { name } { url } { time } class={ `dynamic ${$$props.class || ''}` }>
  { #if data }
    { #each data.mapItems as item ( `${item.x}-${item.y}` ) }
      <image 
        x={ `${ item.x * 100 }%` } 
        y={ `${ item.y * 100 }%` } 
        width={ size + 'px' }
        hwight={ size + 'px' }
        class={ item.teamId }
        href={ getIcon( item.iconType ) }
        in:fly={{ y: -20 }}
      />
       
    { /each }
  { /if }
</DataHex>