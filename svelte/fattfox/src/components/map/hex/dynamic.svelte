<script>
	import { afterUpdate } from 'svelte';
	import DataHex from './data.svelte'
	import Polygon from '../polygon.svelte';
  import Icon from '../icon.svelte';
  export let name = ''

      // data will change as its loaded from server
  let data = null,
      // do an animation?
      animate = false,
      // this stores the last version of the data
      version = 0

  // check for updates
  afterUpdate( () =>
  {
    if ( data && data.version !== version )
    {
      // skip initial update when version is zero
      if ( version )
      {
        //console.log( name + ' version change from ' + version + ' to ' + data.version )
        // start CSS animation
        animate = true
        // remove animation so it can run again
        setTimeout( () => {
          animate = false
        }, 500 )
      }
      // always update version
      version = data.version
    }
  });

  let color = '',
      perc = 0;

  const not_countable = [ 41, 62, 23, 32, 61, 20, 38, 21, 40 ]

  afterUpdate( () => 
  {
    if ( data && 'mapItems' in data )
    {
      // reset counters
      let colonials = 0,
          wardens = 0,
          none = 0,
          total = 0;

      color = '';
      perc = 0;
        
      data.mapItems.forEach( item => {
        if ( !not_countable.includes( item.iconType ) )
        {
          total++
          if ( item.teamId == 'WARDENS')    wardens++;
          if ( item.teamId == 'COLONIALS')  colonials++;
          if ( item.teamId == 'NONE')       none++;
        }        
      });

      let colonial = total ? colonials / total : 0,
          warden   = total ? wardens / total : 0,
          rest = 1 - colonial - warden

      if ( colonial > warden && colonial > rest ) 
      {
        perc = colonial;
        color = 'colonial';
      }
      if ( warden > colonial && warden > rest ) 
      {
        perc = warden;
        color = 'warden'
      }
    }    
  })  
  

</script>

<DataHex bind:data={ data } { name } class={ `dynamic ${$$props.class || ''}` }>
  { #if data && Array.isArray( data.mapItems ) }
    { #each data.mapItems as item ( `${item.x}-${item.y}` ) }
      <Icon x={ item.x } y={ item.y } icon={ item.iconType } team={ item.teamId }/>
    { /each }
    <Polygon class={ 'team ' + color } style={ `opacity: ${perc}` }/>
    <Polygon class={ 'flasher ' + ( animate ? 'animate' : '' ) } />
  { /if }
</DataHex>