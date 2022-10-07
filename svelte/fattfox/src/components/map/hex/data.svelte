<script>
	import { onMount, beforeUpdate } from 'svelte';
  import { shards } from '@stores/shards'
  //import 'isomorphic-unfetch'
  //import efetch from 'f-etag';
  import axios from 'axios'
	import Hex from './hex.svelte';

             // hex name, also use to build data url
  export let name = '',
             // url to load data from
             url = '',
             // time in seconds between reloads
             time = 0,
             // data retrieved, bind to this on the parent component
             data = null
      
      // timeout id
  let i = 0,
      // current shard name
      shard = '',
      // etag 
      etag = ''

  // subscribe to the current shard
	const unsubscribe = shards.subscribe( s => shard = s );

  // get data from url
  const load = () => {
    
    const options = { 
      headers: {},
      method: 'GET'
    }

    if ( etag ) options.headers['If-None-Match'] = etag

    fetch( shards.url( shard ) + url, options )
      .then( r => {
        etag = r.headers.get( 'etag' )
        return r.json() 
      } )
      .then( d => {
        // set data
        data = d 
        // maybe reload
        reload()
      } )
    ;
  }

  // reload if a time was specified
  const reload = () => 
  {    
    if ( time > 0 )
    {
      clearTimeout( i )
      i = setTimeout( () => load(), time * 1000 )
    }
  }

  // load on mount, cleanup on unmount
  onMount( () =>
  {
    // load for the first time
    load()

    // cleanup on destroy
    return 
    {
      clearTimeout( i )
      unsubscribe()
    }
  })
             
</script>

<Hex class={ `data ${$$props.class || ''}` } {name}>
  <!-- explicit set slot on svg otherwise children won't be added -->
  <slot></slot>
</Hex>