<script>
	import { onMount } from "svelte";


  const titles = [
    'Foxhole Artillery Targeting Tool',
    'Foxhole Analytics Tracking Tool',
    'Foxhole Artillery THE Tool',
    'Foxhole Analytics THE Tool',
    'Foxhole Analytics Tracking Thing',
    'Foxhole Artillery Targeting Thing',
    'Foxhole Awesome Tracking Thing',
    'Foxhole Awesome Tracking Tool'
  ];

  let title = '';

  onMount( () => 
  {    
    let r = parseInt( Math.random() * ( titles.length - 1 ) );
    title = titles[ r ];
  })
</script>

{#if title}
<div class="logo">
  <h1>F.A.T.T.</h1>
  <h2>{ title }</h2>
</div>
{/if}

<style>
.logo
{
  font-family: var( --font-header );
  font-size: 10px;
  padding: 6px 12px;
  position: absolute;
  left: 0;
  top: 0;
  background-color: rgba( 255, 255, 255, .5 );
  border-radius: 0 0 10px 0;
  z-index: 9999;
  user-select: none;
}

.logo h1,
.logo h2
{
  margin: 0;
  line-height: 1;
  text-align: center;
  color: rgba( 0, 0, 0, .7 );
}

.logo h1
{
  font-size: 6.3em;
  margin: -.2em 0;  
}

.logo h2
{
  font-size: 1em;
  letter-spacing: .05em;
}
</style>