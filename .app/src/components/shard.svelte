<script>
  import { onMount } from 'svelte';
  import { shards } from '@stores/shards'

  const available = shards.available;

  onMount( () => shards.load() );

  const onChange = e =>
  {
    shards.set( e.target.value );
    e.preventDefault();
    e.stopPropagation();
  }
</script>

{#if $available.length > 1}
<div class="shard">
  <div class="title">Shard:</div>
  <div class="list">
    {#each $available as value ( value )}
      <label>
        <input type="radio" name="shard" { value } checked={ value == $shards } on:change={ onChange }/>
        <div>{ value }</div>
      </label>
    {/each}
  </div>
</div>
{/if}

<style>
  .shard
  {
    font-family: var( --font-body );
    font-size: 14px;
    padding: 6px 12px 12px 12px;
    position: absolute;
    right: 0;
    top: 0;
    background-color: rgba( 255, 255, 255, .5 );
    border-radius: 0 0 0 10px;
    z-index: 9999;
    user-select: none;
    text-align: center;
  }

  .shard .list
  {
    border-radius: 6px;
    overflow: hidden;
  }

  .shard input
  {
    display: none;
  }

  .shard label
  {
    display: block;
    background-color: rgba( 0, 0, 0, .7 );
    color: var( --clr-white );
    margin: 0 0 1px 0;
    cursor: pointer;
    transition: background-color var( --transition-time );
    text-transform: uppercase;
  }

  .shard label:last-child
  {
    margin: 0;
  }

  .shard label div
  {
    padding: 4px 6px;
    background-color:  rgba( 0, 0, 0, 0 );
    transition: background-color var( --transition-time );
  }

  .shard label:hover
  {
    background-color: rgba( 0, 0, 0, .6 );
  }

  .shard label input:checked + div
  {
    background: var( --clr-focus );
    color: var( --clr-black );
  }
  </style>