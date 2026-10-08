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
    const r = Math.floor( Math.random() * titles.length );
    title = titles[ r ];
  })
</script>

{#if title}
<div class="logo">
  <h1><b>F</b><b>A</b><b>T</b><b>T</b></h1>
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
  z-index: 9999;
  user-select: none;
  /* a watermark: no background, and the map under it stays usable */
  pointer-events: none;
}

/* with the tabs on the left (Settings) the logo is on the right */
:global( .tabs-left ) .logo
{
  left: auto;
  right: 0;
}

.logo h1,
.logo h2
{
  margin: 0;
  line-height: 1;
  text-align: center;
  color: rgba( 0, 0, 0, .45 );
  /* a faint halo keeps it readable over dark regions */
  text-shadow: 0 0 6px rgba( 255, 255, 255, .6 );
}

.logo h1
{
  font-family: var( --font-header );
  font-size: 4.2em;
  letter-spacing: -2px;
}

.logo h1 b:after
{
  content: ".";
  display: inline-block;
  margin-left: -.1em;
}

.logo h1 b:nth-child(2)::after
{
  margin-left: 0;
}

.logo h2
{
  font-size: 1em;
  font-family: var( --font-body );
}
</style>